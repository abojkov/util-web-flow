const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { source, createAppHarness } = require('./helpers/app-harness.cjs')
const payload = require('./fixtures/currency-rates.cjs')

test('sync caches full list but enables only EUR and sends no user-specific data', async () => {
  const s = createAppHarness()
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
  const s = createAppHarness()
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
    const s = createAppHarness()
    s.context.fetch = async () => ({ ok: true, json: async () => response })
    await s.context.syncCurrencyRates()
    assert.equal(s.writes(), 0)
    assert.equal(s.run('exchangeRates().USD'), undefined)
    assert.match(s.run('currencySyncStatus()'), /Sync failed/)
  }
  for (const failure of ['http', 'network', 'storage']) {
    const s = createAppHarness()
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
  const s = createAppHarness()
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
  const s = createAppHarness()
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

test('startup sync runs after local initialization and honors the saved opt-out', async () => {
  for (const enabled of [true, false]) {
    const s = createAppHarness()
    s.run(
      `state.categories=[{id:'starter'}];state.settings=[{id:'syncCurrenciesOnStartup',value:${enabled}}]`
    )
    const calls = []
    Object.assign(s.context, {
      settingsModal() {},
      welcomeModal() {},
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
  const s = createAppHarness()
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
  const s = createAppHarness()
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
  const s = createAppHarness()
  s.context.fetch = async () => ({
    ok: true,
    json: async () => ({ base: 'EUR', date: '2026-10-22', rates: payload.rates }),
  })
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().EUR'), 1)
  assert.equal(s.run("getSetting('currencySync').firstDate"), '2026-10-22')
  assert.equal(s.run("getSetting('currencySync').sourceUpdatedAt"), null)
})
