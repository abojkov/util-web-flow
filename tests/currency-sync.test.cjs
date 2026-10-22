const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = name => fs.readFileSync(path.join(__dirname, '../assets/js', name + '.js'), 'utf8')
const rows = [
  { base: 'EUR', quote: 'EUR', rate: 1, date: '2026-10-21' },
  { base: 'EUR', quote: 'USD', rate: 1.2, date: '2026-10-21' },
  { base: 'EUR', quote: 'CAD', rate: 1.5, date: '2026-10-20' },
]
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
      return { ok: true, json: async () => rows }
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

test('sync caches full list but enables only EUR/USD and sends no user-specific data', async () => {
  const s = setup()
  s.run("state.transactions=[{id:'private',amount:42,exchangeRates:{EUR:1,USD:1.09}}]")
  const snapshot = s.run('JSON.stringify(state.transactions)')
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().USD'), 1.2)
  assert.equal(s.run("getSetting('currencySync').rates.CAD"), 1.5)
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR","USD"]')
  assert.equal(s.run('JSON.stringify(state.transactions)'), snapshot)
  const request = s.request()
  assert.equal(request.url, 'https://api.frankfurter.dev/v2/rates')
  assert.deepEqual(Object.keys(request.options).sort(), ['credentials', 'referrerPolicy', 'signal'])
  assert.equal(request.options.credentials, 'omit')
  assert.equal(request.options.referrerPolicy, 'no-referrer')
  assert.equal(s.writes(), 1)
  assert.match(s.run('currencySyncStatus()'), /20\.10\.2026 to 21\.10\.2026/)
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

test('invalid rates, duplicate codes, invalid dates and HTTP/network/storage errors preserve data', async () => {
  for (const response of [
    [],
    [...rows, rows[1]],
    [rows[0]],
    rows.map(r => ({ ...r, rate: 0 })),
    rows.map(r => ({ ...r, base: 'USD' })),
    rows.map(r => ({ ...r, date: 'bad' })),
    rows.map(r => ({ ...r, rate: Infinity })),
  ]) {
    const s = setup()
    s.context.fetch = async () => ({ ok: true, json: async () => response })
    await s.context.syncCurrencyRates()
    assert.equal(s.writes(), 0)
    assert.equal(s.run('exchangeRates().USD'), 1.09)
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
    assert.equal(s.run('exchangeRates().USD'), 1.09)
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
  finish({ ok: true, json: async () => rows })
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
  s.context.fetch = async () => ({ ok: true, json: async () => rows })
  await s.context.syncCurrencyRates()
  assert.equal(s.run('exchangeRates().USD'), 1.2)
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
    { name: 'USD', value: '1.2', dataset: { originalRate: '1.2' } },
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
