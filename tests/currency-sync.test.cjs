const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = name => fs.readFileSync(path.join(__dirname, '../assets/js', name + '.js'), 'utf8')
const payload = {
  base: 'EUR',
  timestamp: Date.UTC(2026, 9, 21, 12) / 1000,
  rates: { USD: 1.2, CAD: 1.5, MKD: 61.604208 },
}
function setup() {
  const elements = new Map()
  let request,
    timer,
    renders = 0,
    writes = 0
  const context = vm.createContext({
    Date,
    Intl,
    AbortController,
    console: { error() {} },
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, {})
        return elements.get(selector)
      },
      querySelectorAll: () => [],
    },
    setTimeout: callback => {
      timer = callback
      return 1
    },
    clearTimeout() {},
    fetch: async (url, options) => {
      request = { url, options }
      return { ok: true, json: async () => payload }
    },
    putSettings: async () => {
      writes++
    },
    render: () => {
      renders++
    },
  })
  vm.runInContext(source('state') + '\n' + source('currency-sync'), context)
  return {
    context,
    elements,
    run: code => vm.runInContext(code, context),
    request: () => request,
    timeout: () => timer(),
    writes: () => writes,
    renders: () => renders,
  }
}

test('sync caches full list but enables only EUR and sends no user-specific data', async () => {
  const s = setup()
  s.run("state.transactions=[{id:'private',amount:42,exchangeRates:{EUR:1,USD:1.09}}]")
  const snapshot = s.run('JSON.stringify(state.transactions)')
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().USD'), undefined)
  assert.equal(s.run("getSetting('currencySync').rates.CAD"), 1.5)
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR"]')
  assert.equal(s.run('JSON.stringify(state.transactions)'), snapshot)
  const request = s.request()
  assert.equal(request.url, 'https://api.exchangerate.fun/latest?base=eur')
  assert.deepEqual(Object.keys(request.options).sort(), ['credentials', 'referrerPolicy', 'signal'])
  assert.equal(request.options.credentials, 'omit')
  assert.equal(request.options.referrerPolicy, 'no-referrer')
  assert.equal(s.writes(), 1)
  assert.match(s.run('currencySyncStatus()'), /Rate date: 21\.10\.2026/)
})

test('existing and explicit manual overrides survive sync; automatic currencies update', async () => {
  const s = setup()
  s.run("state.settings=[{id:'exchangeRates',value:{EUR:1,USD:1.8,CAD:2}}]")
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().USD'), 1.8)
  assert.equal(s.run('exchangeRates().CAD'), 2)
  s.run("state.settings.find(s=>s.id==='manualCurrencyCodes').value=['USD']")
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().CAD'), 1.5)
  assert.equal(s.run('exchangeRates().USD'), 1.8)
})

test('invalid rates, response metadata and HTTP/network/storage errors preserve data', async () => {
  for (const response of [
    [],
    null,
    {},
    { ...payload, rates: {} },
    { ...payload, rates: [] },
    { ...payload, rates: { USD: 0 } },
    { ...payload, rates: { USD: Infinity } },
    { ...payload, rates: { USD: '1.2' } },
    { ...payload, rates: { USD: 1.2, EUR: 2 } },
    { ...payload, rates: { USD: 1.2, '<X>': 1 } },
    { ...payload, base: 'USD' },
    { ...payload, timestamp: -1 },
    { ...payload, timestamp: 'bad' },
    { ...payload, timestamp: 1e20 },
    { ...payload, timestamp: undefined, date: '2026-02-30' },
    { ...payload, timestamp: undefined, date: 'bad' },
  ]) {
    const s = setup()
    s.context.fetch = async () => ({ ok: true, json: async () => response })
    await s.context.syncCurrencyRates()
    assert.equal(s.writes(), 0)
    assert.equal(s.run('exchangeRates().USD'), undefined)
    assert.match(s.run('currencySyncStatus()'), /Sync failed/)
  }
  for (const failure of ['http', 'network', 'storage']) {
    const s = setup()
    if (failure === 'http') s.context.fetch = async () => ({ ok: false })
    if (failure === 'network')
      s.context.fetch = async () => {
        throw Error('offline')
      }
    if (failure === 'storage')
      s.context.putSettings = async () => {
        throw Error('quota')
      }
    await s.context.syncCurrencyRates()
    assert.equal(s.run('state.settings.length'), 0)
    assert.equal(s.run('exchangeRates().USD'), undefined)
    assert.match(s.run('currencySyncStatus()'), /Sync failed/)
  }
})

test('in-flight sync is deduplicated and cancellation blocks late writes after data replacement', async () => {
  const s = setup()
  let finish,
    requests = 0
  s.context.fetch = async () => {
    requests++
    return new Promise(resolve => {
      finish = resolve
    })
  }
  const pending = s.context.syncCurrencyRates()
  await s.context.syncCurrencyRates()
  assert.equal(requests, 1)
  s.context.cancelCurrencySync()
  s.run('state=createInitialState()')
  finish({ ok: true, json: async () => payload })
  await pending
  assert.equal(s.writes(), 0)
  assert.equal(s.run('state.settings.length'), 0)
})

test('timeout keeps prior rates and allows retry', async () => {
  const s = setup()
  s.context.fetch = async (url, options) =>
    new Promise((resolve, reject) =>
      options.signal.addEventListener('abort', () => reject(Error('timeout')))
    )
  const pending = s.context.syncCurrencyRates()
  s.timeout()
  await pending
  assert.equal(s.writes(), 0)
  assert.equal(s.run('currencySyncRequest'), null)
  assert.match(s.run('currencySyncStatus()'), /Sync failed/)
  s.context.fetch = async () => ({ ok: true, json: async () => payload })
  await s.context.syncCurrencyRates()
  assert.equal(s.run("getSetting('currencySync').rates.USD"), 1.2)
  assert.equal(s.run('exchangeRates().USD'), undefined)
})

test('settings apply cached rates and preserve manual rates absent from provider', async () => {
  const s = setup()
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

test('rates and metadata use a single settings transaction; abort rejects', async () => {
  let transaction,
    puts = []
  const db = {
    transaction(store, mode) {
      assert.equal(store, 'settings')
      assert.equal(mode, 'readwrite')
      transaction = {
        objectStore() {
          return {
            put(item) {
              puts.push(item)
            },
          }
        },
      }
      return transaction
    },
  }
  const c = vm.createContext({ Error })
  vm.runInContext(source('storage'), c)
  c.openDB = async () => db
  const pending = c.putSettings({
    exchangeRates: { USD: 1.2 },
    currencySync: { updatedAt: 'today' },
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(puts.length, 2)
  transaction.oncomplete()
  await pending
  const aborted = c.putSettings({ exchangeRates: { USD: 2 } })
  await new Promise(resolve => setImmediate(resolve))
  transaction.onabort()
  await assert.rejects(aborted, /aborted/)
})

test('cached currency addition is automatic; editing a rate creates an override without freezing untouched rates', async () => {
  const s = setup()
  vm.runInContext(source('modals'), s.context)
  Object.assign(s.context, { modal() {}, toast() {}, reload: async () => {} })
  await s.context.syncCurrencyRates()
  s.run('settingsModal()')
  const button = { disabled: false }
  const form = {
    elements: { code: { value: 'cad' }, rate: { value: '' } },
    querySelector: () => button,
  }
  await s.elements.get('#add-currency-form').onsubmit({ preventDefault() {}, target: form })
  assert.equal(s.run('exchangeRates().CAD'), 1.5)
  assert.equal(s.run("manualCurrencyCodes().includes('CAD')"), false)
  const inputs = [
    { name: 'EUR', value: '1', dataset: { originalRate: '1' } },
    { name: 'CAD', value: '1.6', dataset: { originalRate: '1.5' } },
  ]
  await s.elements
    .get('#rates-form')
    .onsubmit({ preventDefault() {}, target: { querySelectorAll: () => inputs } })
  assert.equal(s.run('exchangeRates().CAD'), 1.6)
  assert.equal(s.run("manualCurrencyCodes().includes('CAD')"), true)
  assert.equal(s.run("manualCurrencyCodes().includes('USD')"), false)
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().CAD'), 1.6)
})

test('startup sync runs after local initialization and honors the saved opt-out', async () => {
  for (const enabled of [true, false]) {
    const s = setup()
    s.run(
      `state.categories=[{id:'starter'}];state.settings=[{id:'syncCurrenciesOnStartup',value:${enabled}}]`
    )
    const calls = []
    Object.assign(s.context, {
      settingsModal() {},
      reload: async () => {
        calls.push('local')
      },
      processRecurring: async () => {
        calls.push('recurring')
      },
      syncCurrencyRates: async () => {
        calls.push('sync')
      },
    })
    vm.runInContext(source('app'), s.context)
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(
      calls,
      enabled ? ['local', 'recurring', 'local', 'sync'] : ['local', 'recurring', 'local']
    )
  }
})

test('sync status uses dotted dates and local 24-hour time with padded fields', () => {
  const s = setup()
  const timestamp = new Date(2026, 9, 22, 17, 13, 39).toISOString()
  s.context.timestamp = timestamp
  s.run(
    "state.settings=[{id:'currencySync',value:{updatedAt:timestamp,firstDate:'2026-10-21',lastDate:'2026-10-22'}}]"
  )
  assert.equal(
    s.run('currencySyncStatus()'),
    'Last synced: 22.10.2026, 17:13:39. Rate dates: 21.10.2026 to 22.10.2026.'
  )
  s.context.timestamp = new Date(2026, 0, 2, 0, 5, 9).toISOString()
  s.run(
    "state.settings[0].value.updatedAt=timestamp;state.settings[0].value.firstDate='2026-01-01';state.settings[0].value.lastDate='2026-01-02'"
  )
  assert.equal(
    s.run('currencySyncStatus()'),
    'Last synced: 02.01.2026, 00:05:09. Rate dates: 01.01.2026 to 02.01.2026.'
  )
})

test('new provider replaces old automatic quotes and records source metadata without changing snapshots', async () => {
  const s = setup()
  s.run(
    "state.accounts=[{id:'mkd',currency:'MKD'}];state.settings=[{id:'exchangeRates',value:{EUR:1,USD:1.1,MKD:61.738}},{id:'manualCurrencyCodes',value:[]},{id:'currencySync',value:{rates:{EUR:1,MKD:61.738}}}];state.transactions=[{id:'old',exchangeRates:{EUR:1,MKD:61.738}}]"
  )
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().MKD'), 61.604208)
  assert.equal(s.run('state.transactions[0].exchangeRates.MKD'), 61.738)
  assert.equal(s.run("getSetting('currencySync').provider"), 'exchangerate.fun')
  assert.equal(s.run("getSetting('currencySync').sourceUpdatedAt"), '2026-10-21T12:00:00.000Z')
})

test('date-only response is accepted with the same validation and EUR identity rate', async () => {
  const s = setup()
  s.context.fetch = async () => ({
    ok: true,
    json: async () => ({ base: 'EUR', date: '2026-10-22', rates: payload.rates }),
  })
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().EUR'), 1)
  assert.equal(s.run("getSetting('currencySync').firstDate"), '2026-10-22')
  assert.equal(s.run("getSetting('currencySync').sourceUpdatedAt"), null)
})

test('add-currency dropdown loads only current-provider codes and preserves valid selections across sync', async () => {
  const s = setup()
  vm.runInContext(source('modals'), s.context)
  Object.assign(s.context, { modal() {}, toast() {}, reload: async () => {} })
  s.run('settingsModal()')
  const select = s.elements.get('#new-currency-code')
  assert.equal(select.disabled, true)
  assert.match(s.elements.get('#new-currency-hint').textContent, /Sync rates first/)
  s.run("state.settings=[{id:'currencySync',value:{rates:{ABC:2,CAD:1.5}}}]")
  assert.equal(s.run('syncedCurrenciesToAdd().length'), 0)
  await s.context.syncCurrencyRates()
  assert.equal(select.disabled, false)
  assert.equal(s.run('JSON.stringify(syncedCurrenciesToAdd())'), '["CAD","MKD","USD"]')
  assert.ok(select.innerHTML.includes('value="CAD"'))
  assert.ok(select.innerHTML.includes('value="USD"'))
  assert.ok(!select.innerHTML.includes('value="ABC"'))
  select.value = 'CAD'
  await s.context.syncCurrencyRates()
  assert.equal(select.value, 'CAD')
  s.run(
    "state.accounts=[{id:'cad',currency:'CAD'},{id:'mkd',currency:'MKD'},{id:'usd',currency:'USD'},{id:'custom',currency:'ABC'}];updateAddCurrencyOptions()"
  )
  assert.equal(select.value, '')
  assert.equal(select.disabled, true)
  assert.match(s.elements.get('#new-currency-hint').textContent, /already available/)
  assert.ok(s.run('availableCurrencies()').includes('ABC'))
})

test('unsupported/tampered codes cannot be added even with manual rates; supported overrides can', async () => {
  const s = setup()
  vm.runInContext(source('modals'), s.context)
  Object.assign(s.context, { modal() {}, toast() {}, reload: async () => {} })
  s.run('settingsModal()')
  const button = { disabled: false }
  const form = {
    elements: { code: { value: 'ABC' }, rate: { value: '123' } },
    querySelector: () => button,
  }
  const submit = () =>
    s.elements.get('#add-currency-form').onsubmit({ preventDefault() {}, target: form })
  await submit()
  assert.equal(s.writes(), 0)
  await s.context.syncCurrencyRates()
  const before = s.writes()
  for (const code of ['ABC', 'EUR', '<X>', '']) {
    form.elements.code.value = code
    await submit()
    assert.equal(s.writes(), before)
  }
  form.elements.code.value = 'MKD'
  form.elements.rate.value = '61.5'
  await submit()
  assert.equal(s.writes(), before + 1)
  assert.equal(s.run('exchangeRates().MKD'), 61.5)
  assert.equal(s.run("manualCurrencyCodes().includes('MKD')"), true)
  await submit()
  assert.equal(s.writes(), before + 1)
})

test('EUR is the only starter before/after sync and full reset; existing USD rates and accounts survive upgrades', async () => {
  const s = setup()
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR"]')
  await s.context.syncCurrencyRates()
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR"]')
  assert.ok(s.run('syncedCurrenciesToAdd()').includes('USD'))
  s.run("state.settings.find(item=>item.id==='exchangeRates').value.USD=1.3")
  assert.equal(s.run('exchangeRates().USD'), 1.3)
  s.run("state.settings=[];state.accounts=[{id:'old',currency:'USD'}]")
  assert.equal(s.run('exchangeRates().USD'), 1.09)
  assert.equal(s.run("amount(convertedWithRates(109,'USD','EUR'))"), 100)
  vm.runInContext(source('modals'), s.context)
  let confirmation,
    replacement,
    id = 0
  Object.assign(s.context, {
    crypto: { randomUUID: () => `starter-${++id}` },
    confirmAction: options => {
      confirmation = options
    },
    replaceAll: async data => {
      replacement = data
    },
    toast() {},
  })
  s.run('resetDataModal()')
  await confirmation.onConfirm()
  assert.ok(replacement.categories.length > 0)
  assert.equal(s.run('state.accounts.length'), 0)
  assert.equal(s.run('state.settings.length'), 0)
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR"]')
})

test('resetting starter rates leaves an enabled automatic USD rate unchanged', async () => {
  const s = setup()
  vm.runInContext(source('modals'), s.context)
  Object.assign(s.context, { modal() {}, toast() {}, reload: async () => {} })
  s.run(
    "state.settings=[{id:'exchangeRates',value:{EUR:1,USD:1.2}},{id:'manualCurrencyCodes',value:[]}];settingsModal()"
  )
  await s.elements.get('#reset-rates').onclick()
  assert.equal(s.run('exchangeRates().USD'), 1.2)
  assert.equal(s.run("manualCurrencyCodes().includes('USD')"), false)
})

function scrollingSettings() {
  const s = setup()
  const frames = []
  let body = null,
    html = '',
    controls = new Map(),
    focusCalls = []
  const root = {
    get innerHTML() {
      return html
    },
    set innerHTML(value) {
      html = value
      controls = new Map(
        [...value.matchAll(/<([a-z-]+)[^>]*\bid="([^"]+)"/g)].map(([, tag, id]) => [
          id,
          {
            id,
            tag,
            disabled: false,
            focus(options) {
              focusCalls.push({ id, options })
              s.context.document.activeElement = this
            },
          },
        ])
      )
      body = value
        ? {
            scrollTop: 0,
            contains: node => controls.get(node.id) === node && node.id !== 'close-modal',
            querySelector: selector =>
              selector === '.settings-content'
                ? html.includes('class="settings-content"')
                  ? {}
                  : null
                : [...controls.values()].find(node => ['input', 'select'].includes(node.tag)),
          }
        : null
    },
  }
  Object.assign(s.context.document, {
    querySelector: selector =>
      selector === '#modal-root'
        ? root
        : selector === '.modal-body'
          ? body
          : controls.get(selector.slice(1)) || null,
    getElementById: id => controls.get(id) || null,
  })
  Object.assign(s.context, {
    requestAnimationFrame: callback => frames.push(callback),
    window: { matchMedia: () => ({ matches: false }) },
    reload: async () => {},
    toast() {},
    put: async (store, item) => {
      s.context.item = item
      s.run('state.settings=state.settings.filter(s=>s.id!==item.id).concat([item])')
    },
  })
  vm.runInContext(source('modals'), s.context)
  s.context.toast = () => {}
  return {
    ...s,
    body: () => body,
    root,
    control: id => controls.get(id),
    focusCalls: () => focusCalls,
    flush: () => {
      while (frames.length) frames.shift()()
    },
  }
}

test('Settings actions preserve scroll and focus after replacing the modal body', async () => {
  for (const action of [
    'reset-rates',
    'use-synced-rates',
    'add-currency-submit',
    'save-rates',
    'base-currency',
  ]) {
    const s = scrollingSettings()
    await s.context.syncCurrencyRates()
    s.run('settingsModal()')
    s.flush()
    assert.equal(s.body().scrollTop, 0)
    assert.equal(s.focusCalls().at(-1).id, 'base-currency')
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
    assert.notEqual(s.body(), oldBody, action)
    s.flush()
    assert.equal(s.body().scrollTop, 537, action)
    assert.equal(s.focusCalls().at(-1).id, action)
    assert.equal(s.focusCalls().at(-1).options.preventScroll, true)
  }
})

test('queued focus for a replaced or closed dialog cannot affect its successor', () => {
  const s = scrollingSettings()
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
