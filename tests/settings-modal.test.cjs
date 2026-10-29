const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { source, createAppHarness, createModalHarness } = require('./helpers/app-harness.cjs')

test('settings apply cached rates and preserve manual rates absent from provider', async () => {
  const s = createAppHarness()
  vm.runInContext(source('modals'), s.context)
  Object.assign(s.context, { modal() {}, toast() {}, reload: async () => {} })
  s.run("state.settings=[{id:'exchangeRates',value:{EUR:1,USD:1.8,ZZZ:2}}]")
  await s.context.syncCurrencyRates()
  s.run('settingsModal()')
  await s.elements.get('#use-synced-rates').onclick()
  assert.equal(s.run('exchangeRates().USD'), 1.2)
  assert.equal(s.run('exchangeRates().ZZZ'), 2)
  assert.equal(s.run("manualCurrencyCodes().includes('ZZZ')"), true)
  assert.equal(s.run("manualCurrencyCodes().includes('USD')"), false)
  const toggle = { checked: false }
  await s.elements.get('#sync-on-startup').onchange({ target: toggle })
  assert.equal(s.run("getSetting('syncCurrenciesOnStartup')"), false)
})

test('Settings actions preserve the modal body, scroll and focused controls in place', async () => {
  for (const action of ['use-synced-rates', 'add-currency-submit', 'save-rates', 'base-currency']) {
    const s = createModalHarness()
    await s.context.syncCurrencyRates()
    s.run('settingsModal()')
    s.flush()
    assert.equal(s.body().scrollTop, 0)
    assert.equal(s.focusCalls().at(-1).id, 'app-language')
    const oldBody = s.body()
    oldBody.scrollTop = 537
    s.context.document.activeElement = s.control(action)
    if (action === 'add-currency-submit') {
      const button = s.control(action)
      await s.control('add-currency-form').onsubmit({
        preventDefault() {},
        target: {
          elements: { code: { value: 'CAD' }, rate: { value: '' } },
          querySelector: () => button,
        },
      })
    } else if (action === 'save-rates') {
      await s
        .control('rates-form')
        .onsubmit({ preventDefault() {}, target: { querySelectorAll: () => [] } })
    } else if (action === 'base-currency') {
      await s.control(action).onchange({ target: { value: 'EUR' } })
    } else await s.control(action).onclick()
    assert.equal(s.body(), oldBody, action)
    s.flush()
    assert.equal(s.body().scrollTop, 537, action)
    assert.equal(s.context.document.activeElement, s.control(action))
    assert.equal(s.focusCalls().length, 1)
  }
})

test('queued focus for a replaced or closed dialog cannot affect its successor', () => {
  const s = createModalHarness()
  s.run('settingsModal();settingsModal()')
  s.flush()
  assert.equal(s.focusCalls().length, 1)
  s.run('settingsModal();closeModal()')
  s.flush()
  assert.equal(s.focusCalls().length, 1)
  s.context.window.matchMedia = () => ({ matches: true })
  s.run('settingsModal()')
  s.flush()
  assert.equal(s.body().scrollTop, 0)
  assert.equal(s.focusCalls().at(-1).id, 'close-modal')
})

test('targeted refresh inserts sorted rate rows and preserves dirty inputs, drafts and existing nodes', () => {
  const s = createAppHarness()
  vm.runInContext(source('modals'), s.context)
  s.run(
    "state.settings=[{id:'exchangeRates',value:{EUR:1,USD:1.4,CAD:1.5}},{id:'manualCurrencyCodes',value:[]},{id:'currencySync',value:{provider:'exchangerate.fun',rates:{EUR:1,USD:1.4,CAD:1.5,MKD:61.6}}}]"
  )
  const rows = []
  let bindings = 0
  function makeRow(code, value, original = value) {
    const row = {
      dataset: { rateCurrency: code },
      input: {
        name: code,
        value: String(value),
        dataset: { originalRate: String(original) },
        selectionStart: 4,
        addEventListener() {
          bindings++
        },
      },
      source: { dataset: { currencyRateSource: code }, textContent: '' },
      insertAdjacentHTML(position, html) {
        rows.splice(rows.indexOf(this), 0, parseRow(html))
      },
    }
    return row
  }
  function parseRow(html) {
    return makeRow(html.match(/data-rate-currency="([^"]+)"/)[1], html.match(/ value="([^"]*)"/)[1])
  }
  rows.push(makeRow('EUR', 1), makeRow('USD', '1.23456789', 1.2))
  const dirty = rows[1].input
  const list = {
    children: rows,
    querySelector: selector => rows.find(row => selector.includes(`"${row.dataset.rateCurrency}"`)),
    querySelectorAll: () => rows.map(row => row.input),
    insertAdjacentHTML(position, html) {
      rows.push(parseRow(html))
    },
  }
  const baseSelect = {
    value: 'EUR',
    innerHTML: '<option value="EUR">EUR</option><option value="USD">USD</option>',
  }
  Object.defineProperty(baseSelect, 'options', {
    get() {
      return [...this.innerHTML.matchAll(/value="([^"]+)"/g)].map(match => ({ value: match[1] }))
    },
  })
  const notice = { textContent: '' }
  const draft = { value: '99.999' }
  const originalQuery = s.context.document.querySelector
  const content = {
    querySelector: selector =>
      ({ '#base-currency': baseSelect, '#base-currency-notice': notice, '.rate-list': list })[
        selector
      ],
  }
  s.context.document.querySelector = selector =>
    selector === '.settings-content'
      ? content
      : selector === '#new-currency-rate'
        ? draft
        : originalQuery(selector)
  s.context.document.querySelectorAll = selector =>
    selector.includes('data-currency-rate-source')
      ? rows.map(row => row.source)
      : rows.map(row => row.input)
  s.run('refreshSettingsCurrencyControls()')
  assert.deepEqual(
    rows.map(row => row.dataset.rateCurrency),
    ['CAD', 'EUR', 'USD']
  )
  assert.equal(rows[2].input, dirty)
  assert.equal(dirty.value, '1.23456789')
  assert.equal(dirty.selectionStart, 4)
  assert.equal(draft.value, '99.999')
  assert.ok(baseSelect.innerHTML.includes('value="CAD"'))
  assert.equal(rows[0].input.value, '1.5')
  assert.equal(bindings, 6)
  s.run('refreshSettingsCurrencyControls()')
  assert.equal(bindings, 6, 'Retained inputs must not receive duplicate listeners')
  s.run("refreshSettingsCurrencyControls({savedCodes:['USD']})")
  assert.equal(dirty.value, '1.4')
  assert.equal(dirty.dataset.originalRate, '1.4')
  assert.equal(draft.value, '99.999')
})
