const CURRENCY_RATE_URL = 'https://api.exchangerate.fun/latest?base=eur'
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

function syncedCurrenciesToAdd() {
  const sync = getSetting('currencySync', {})
  if (sync.provider !== 'exchangerate.fun') return []
  const enabled = new Set(availableCurrencies())
  return Object.entries(sync.rates || {})
    .filter(
      ([code, rate]) =>
        /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0 && !enabled.has(code)
    )
    .map(([code]) => code)
    .sort()
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
  const rateDates =
    sync.firstDate === sync.lastDate
      ? `Rate date: ${displayDate(sync.firstDate)}`
      : `Rate dates: ${displayDate(sync.firstDate)} to ${displayDate(sync.lastDate)}`
  return `Last synced: ${date}, ${time}. ${rateDates}.`
}

function updateCurrencySyncStatus() {
  const status = $('#currency-sync-status')
  if (status) status.textContent = currencySyncStatus()
  const button = $('#sync-currencies')
  if (button) button.disabled = !!currencySyncRequest
  if (typeof updateAddCurrencyOptions === 'function') updateAddCurrencyOptions()
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
    const data = await response.json()
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      String(data.base).toUpperCase() !== 'EUR' ||
      !data.rates ||
      typeof data.rates !== 'object' ||
      Array.isArray(data.rates)
    )
      throw new Error('Invalid rate response')
    let rateDate
    let sourceUpdatedAt
    if (data.timestamp !== undefined) {
      if (!Number.isSafeInteger(data.timestamp) || data.timestamp <= 0)
        throw new Error('Invalid rate timestamp')
      const sourceDate = new Date(data.timestamp * 1000)
      if (!Number.isFinite(sourceDate.getTime())) throw new Error('Invalid rate timestamp')
      sourceUpdatedAt = sourceDate.toISOString()
      rateDate = sourceUpdatedAt.slice(0, 10)
    } else {
      // The published documentation also describes a date-only response.
      rateDate = data.date
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(rateDate) ||
        !Number.isFinite(Date.parse(rateDate + 'T00:00:00Z')) ||
        new Date(rateDate + 'T00:00:00Z').toISOString().slice(0, 10) !== rateDate
      )
        throw new Error('Invalid rate date')
    }
    const rates = {}
    for (const [code, rate] of Object.entries(data.rates)) {
      if (
        !/^[A-Z]{3}$/.test(code) ||
        !Number.isFinite(rate) ||
        rate <= 0 ||
        (code === 'EUR' && rate !== 1)
      )
        throw new Error('Invalid rate response')
      rates[code] = rate
    }
    rates.EUR = 1
    if (!Object.keys(data.rates).length) throw new Error('Incomplete rate response')
    if (currencySyncRequest !== controller || controller.signal.aborted) return
    const next = { ...exchangeRates() }
    const manual = manualCurrencyCodes()
    for (const code of Object.keys(next)) {
      if (!manual.includes(code) && rates[code]) next[code] = rates[code]
    }
    await saveCurrencySettings({
      exchangeRates: next,
      manualCurrencyCodes: manual,
      currencySync: {
        rates,
        updatedAt: new Date().toISOString(),
        provider: 'exchangerate.fun',
        sourceUpdatedAt: sourceUpdatedAt || null,
        firstDate: rateDate,
        lastDate: rateDate,
      },
    })
    if (typeof refreshSettingsCurrencyControls === 'function') refreshSettingsCurrencyControls()
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
