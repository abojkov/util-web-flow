const CURRENCY_RATE_URL = 'https://api.frankfurter.dev/v2/rates'
let currencySyncRequest = null
let currencySyncError = ''

function cancelCurrencySync() {
  currencySyncRequest?.abort()
  currencySyncRequest = null
  currencySyncError = ''
}

function manualCurrencyCodes() {
  // Rates saved before synchronization was introduced are manual overrides.
  return getSetting('manualCurrencyCodes', Object.keys(getSetting('exchangeRates', {})))
}

async function saveCurrencySettings(values) {
  await putSettings(values)
  for (const [id, value] of Object.entries(values)) {
    state.settings = state.settings.filter(item => item.id !== id)
    state.settings.push({ id, value })
  }
}

function currencyRateSource(code) {
  if (manualCurrencyCodes().includes(code)) return 'Manual'
  return getSetting('currencySync', {}).rates?.[code] ? 'Synced' : 'Local'
}

function currencySyncStatus() {
  const sync = getSetting('currencySync', {})
  if (currencySyncRequest) return 'Syncing reference rates…'
  if (currencySyncError) return currencySyncError
  if (!sync.updatedAt) return 'Not synced yet. Local reference rates remain available.'
  const updated = new Date(sync.updatedAt)
  const date = displayDate(monthKey(updated) + '-' + String(updated.getDate()).padStart(2, '0'))
  const time = [updated.getHours(), updated.getMinutes(), updated.getSeconds()]
    .map(value => String(value).padStart(2, '0'))
    .join(':')
  return `Last synced: ${date}, ${time}. Rate dates: ${displayDate(sync.firstDate)} to ${displayDate(sync.lastDate)}.`
}

function updateCurrencySyncStatus() {
  const status = $('#currency-sync-status')
  if (status) status.textContent = currencySyncStatus()
  const button = $('#sync-currencies')
  if (button) button.disabled = !!currencySyncRequest
  for (const label of document.querySelectorAll('[data-currency-rate-source]'))
    label.textContent = currencyRateSource(label.dataset.currencyRateSource)
}

async function syncCurrencyRates() {
  if (currencySyncRequest) return
  const controller = new AbortController()
  currencySyncRequest = controller
  currencySyncError = ''
  updateCurrencySyncStatus()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    // The same public URL is used for everyone; no selected currencies or financial data are sent.
    const response = await fetch(CURRENCY_RATE_URL, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok) throw new Error('Rate service unavailable')
    const rows = await response.json()
    if (!Array.isArray(rows) || !rows.length) throw new Error('Invalid rate response')
    const rates = {}
    const dates = []
    for (const row of rows) {
      if (
        row.base !== 'EUR' ||
        !/^[A-Z]{3}$/.test(row.quote) ||
        !Number.isFinite(row.rate) ||
        row.rate <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
        !Number.isFinite(Date.parse(row.date + 'T00:00:00Z')) ||
        new Date(row.date + 'T00:00:00Z').toISOString().slice(0, 10) !== row.date ||
        (row.quote === 'EUR' && row.rate !== 1) ||
        Object.hasOwn(rates, row.quote)
      )
        throw new Error('Invalid rate response')
      rates[row.quote] = row.rate
      dates.push(row.date)
    }
    rates.EUR = 1
    if (!rates.USD) throw new Error('Incomplete rate response')
    if (currencySyncRequest !== controller || controller.signal.aborted) return
    const next = { ...exchangeRates() }
    const manual = manualCurrencyCodes()
    for (const code of Object.keys(next)) {
      if (!manual.includes(code) && rates[code]) next[code] = rates[code]
    }
    dates.sort()
    await saveCurrencySettings({
      exchangeRates: next,
      manualCurrencyCodes: manual,
      currencySync: {
        rates,
        updatedAt: new Date().toISOString(),
        firstDate: dates[0],
        lastDate: dates[dates.length - 1],
      },
    })
    for (const input of document.querySelectorAll('#rates-form .rate-input')) {
      if (decimalValue(input.value) === Number(input.dataset.originalRate)) {
        input.value = exchangeRates()[input.name] ?? ''
        input.dataset.originalRate = input.value
      }
    }
    // Avoid rebuilding an open form and losing unsaved edits.
    if (!$('#modal-root')?.innerHTML) render()
  } catch (error) {
    if (currencySyncRequest !== controller) return
    currencySyncError =
      'Sync failed. Cached or manual rates are still in use. Check your connection or browser permissions and try again.'
  } finally {
    clearTimeout(timeout)
    if (currencySyncRequest === controller) currencySyncRequest = null
    updateCurrencySyncStatus()
  }
}
