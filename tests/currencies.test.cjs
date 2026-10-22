const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { source, createAppHarness } = require('./helpers/app-harness.cjs')

test('cached currency addition is automatic; editing a rate creates an override without freezing untouched rates', async () => {
  const s = createAppHarness()
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

test('add-currency dropdown loads only current-provider codes and preserves valid selections across sync', async () => {
  const s = createAppHarness()
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
  const s = createAppHarness()
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
  form.elements.code.value = 'MKD'
  await submit()
  assert.equal(s.writes(), before + 1)
})

test('EUR is the only starter before/after sync; existing USD rates and accounts survive upgrades', async () => {
  const s = createAppHarness()
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR"]')
  await s.context.syncCurrencyRates()
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR"]')
  assert.ok(s.run('syncedCurrenciesToAdd()').includes('USD'))
  s.run("state.settings.find(item=>item.id==='exchangeRates').value.USD=1.3")
  assert.equal(s.run('exchangeRates().USD'), 1.3)
  s.run("state.settings=[];state.accounts=[{id:'old',currency:'USD'}]")
  assert.equal(s.run('exchangeRates().USD'), 1.09)
  assert.equal(s.run("amount(convertedWithRates(109,'USD','EUR'))"), 100)
})
