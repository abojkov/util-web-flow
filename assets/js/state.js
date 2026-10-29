// Update this value when releasing a new app version.
const APP_VERSION = '1.2.5'

const $ = s => document.querySelector(s),
  uid = () => crypto.randomUUID(),
  today = () => new Date().toLocaleDateString('en-CA'),
  currentTime = () => new Date().toTimeString().slice(0, 5)
let txSearchTimer
const icons = {
  home: '⌂',
  transactions: '≡',
  statistics: '◉',
  accounts:
    '<svg class="accounts-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5a2 2 0 0 0 0 4h5"/><circle cx="16" cy="14" r=".5" fill="currentColor" stroke="none"/></svg>',
  more: '☷',
}
const splitTransactionIcon =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v5a3 3 0 0 0 3 3h2a3 3 0 0 1 3 3v6M12 8a3 3 0 0 1-3 3H7a3 3 0 0 0-3 3v6M1 17l3 3 3-3m10 0 3 3 3-3"/></svg>'
function pageNames() {
  return {
    home: t('nav.home'),
    transactions: t('nav.transactions'),
    statistics: t('nav.statistics'),
    accounts: t('nav.accounts'),
    more: t('nav.more'),
  }
}
const defaults = [
  ['common.starterCategory.foodDrinks', '🍽️', '#fb923c', 'expense'],
  ['common.starterCategory.shopping', '🛍️', '#a78bfa', 'expense'],
  ['common.starterCategory.transport', '🚙', '#60a5fa', 'expense'],
  ['common.starterCategory.bills', '🧾', '#2dd4bf', 'expense'],
  ['common.starterCategory.health', '♥', '#fb7185', 'expense'],
  ['common.starterCategory.home', '⌂', '#fbbf24', 'expense'],
  ['common.starterCategory.travel', '✈', '#38bdf8', 'expense'],
  ['common.starterCategory.otherExpense', '◈', '#94a3b8', 'expense'],
  ['common.starterCategory.salary', '💼', '#34d399', 'income'],
  ['common.starterCategory.gift', '🎁', '#a78bfa', 'income'],
  ['common.starterCategory.interest', '↗', '#60a5fa', 'income'],
  ['common.starterCategory.otherIncome', '◈', '#94a3b8', 'income'],
]
const createInitialState = () => ({
  page: 'home',
  accounts: [],
  accountsEditing: false,
  archivedAccountsExpanded: false,
  transactions: [],
  categories: [],
  budgets: [],
  recurring: [],
  settings: [],
  month: today().slice(0, 7),
  accountFilter: 'all',
  txSearch: '',
  txTypeFilter: 'all',
  txSearchPeriod: 'month',
  txSearchWeekStart: '',
  txSearchYear: today().slice(0, 4),
  txCategoryFilters: [],
  txExpandedCategories: [],
  txExpandedCategoryGroups: [],
  activeTxDescription: '',
  activeTxSplit: '',
  txType: 'expense',
  statsPeriod: 'month',
  statsAccount: 'all',
})
let state = createInitialState()
const getSetting = (k, d) => state.settings.find(x => x.id === k)?.value ?? d
const totalBalanceHidden = () => getSetting('hideTotalBalance', false) === true
const escapeHtml = v =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  )
const money = (n, c = 'EUR') => {
  const parts = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: c,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(n || 0)
  const value = parts
    .filter(part => part.type !== 'currency' && part.type !== 'literal')
    .map(part => part.value)
    .join('')
  return `${value} ${parts.find(part => part.type === 'currency').value}`
}
const fmt = (n, c) => money(n, c)
const DECIMAL_INPUT_PATTERN = '-?[0-9][0-9\\s.,]*'
const POSITIVE_DECIMAL_INPUT_PATTERN = '[0-9][0-9\\s.,]*'
const groupedNumberParts = (value, separator) => {
  const parts = value.split(separator)
  if (parts.length <= 1) return false
  return parts.every((part, index) =>
    index === 0 ? /^\d{1,3}$/.test(part) : /^\d{3}$/.test(part)
  )
}
const parseDecimalInput = (raw, { maxFractionDigits = 10 } = {}) => {
  let value = String(raw ?? '').trim()
  if (!value) return NaN
  let sign = 1
  if (value.startsWith('-')) {
    sign = -1
    value = value.slice(1).trim()
  }
  if (!value) return NaN
  value = value.replace(/\s+/g, '')
  if (!/^[\d.,]+$/.test(value)) return NaN
  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')
  const lastSeparator = Math.max(lastComma, lastDot)
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    value = value.split(thousandsSeparator).join('')
    if (decimalSeparator === ',') value = value.replace(',', '.')
  } else if (lastSeparator >= 0) {
    const separator = value[lastSeparator]
    const integerPart = value.slice(0, lastSeparator)
    const fractionPart = value.slice(lastSeparator + 1)
    if (!/^\d+$/.test(fractionPart)) return NaN
    const integerDigits = integerPart.split(/[.,]/).join('')
    if (!/^\d+$/.test(integerDigits)) return NaN
    const grouped =
      groupedNumberParts(value, separator) ||
      (fractionPart.length === 3 &&
        integerPart.includes(separator) &&
        groupedNumberParts(integerPart, separator))
    if (
      fractionPart.length > 0 &&
      fractionPart.length <= maxFractionDigits &&
      !grouped
    ) {
      value = `${integerDigits}.${fractionPart}`
    } else if (grouped) {
      value = value.split(separator).join('')
    } else if (fractionPart.length <= maxFractionDigits) {
      value = `${integerDigits}.${fractionPart}`
    } else {
      value = value.split(separator).join('')
    }
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return NaN
  const parsed = Number(value)
  return Number.isFinite(parsed) ? sign * parsed : NaN
}
const roundAmount = value => Math.round(value * 100) / 100
const decimalValue = x => {
  if (typeof x === 'number') return Number.isFinite(x) ? x : NaN
  return parseDecimalInput(x, { maxFractionDigits: 12 })
}
const amount = x => {
  if (typeof x === 'number') return Number.isFinite(x) ? roundAmount(x) : NaN
  const parsed = parseDecimalInput(x, { maxFractionDigits: 2 })
  return Number.isFinite(parsed) ? roundAmount(parsed) : NaN
}
const displayDate = value => String(value || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1')
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const shiftMonth = (month, delta) => {
  const [year, monthNumber] = month.split('-').map(Number)
  return monthKey(new Date(year, monthNumber - 1 + delta, 1, 12))
}
const monthLabel = m => {
  const [year, monthNumber] = String(m || '').split('-').map(Number)
  if (!year || !monthNumber) return String(m || '')
  return t('months.yearLabel', { month: t(`months.${monthNumber}`), year })
}
const account = id => state.accounts.find(a => a.id === id)
const isSelectableAccount = a => !a.archived && a.visible !== false
const cat = id => state.categories.find(c => c.id === id)
const subcat = (categoryId, subcategoryId) =>
  cat(categoryId)?.subcategories?.find(s => s.id === subcategoryId)
const categoryLabel = (categoryId, subcategoryId) => {
  const c = cat(categoryId),
    s = subcat(categoryId, subcategoryId)
  return [c?.name, s?.name].filter(Boolean).join(' / ') || t('common.other')
}
const defaultRates = { EUR: 1 }

function exchangeRates() {
  const rates = { ...defaultRates, ...getSetting('exchangeRates', {}) }
  // Older accounts may rely on starter rates that were never saved to Settings.
  const legacyRates = { USD: 1.09, GBP: 0.86, MKD: 61.5, CHF: 0.94, SEK: 11.2 }
  for (const currency of usedCurrencies()) {
    if (!Object.hasOwn(rates, currency) && Object.hasOwn(legacyRates, currency))
      rates[currency] = legacyRates[currency]
  }
  return rates
}

function availableCurrencies() {
  return [...new Set([...Object.keys(exchangeRates()), ...usedCurrencies()])]
    .filter(code => /^[A-Z]{3}$/.test(code))
    .sort()
}

function usedCurrencies() {
  const values = new Set([base()])
  for (const item of state.accounts) values.add(item.currency)
  for (const item of state.transactions) {
    const from = account(item.accountId),
      to = account(item.toAccountId)
    if (from?.currency) values.add(from.currency)
    if (to?.currency) values.add(to.currency)
  }
  return [...values].filter(Boolean).sort()
}

function canReportInCurrency(currency) {
  const configured = exchangeRates()
  if (!Number.isFinite(configured[currency]) || configured[currency] <= 0) return false
  return state.transactions.every(transaction => {
    const rates = transactionRates(transaction)
    const accounts = [account(transaction.accountId)]
    if (transaction.type === 'transfer') accounts.push(account(transaction.toAccountId))
    return accounts.every(item => {
      if (!item) return false
      if (item.currency === currency) return true
      return [rates[item.currency], rates[currency]].every(
        rate => Number.isFinite(rate) && rate > 0
      )
    })
  })
}

function payeeOptions() {
  const seen = new Map()
  for (const item of [...state.transactions, ...state.recurring]) {
    const value = String(item.payee ?? item.place ?? '').trim()
    if (!value) continue
    const key = value.toLocaleLowerCase()
    if (!seen.has(key)) seen.set(key, value)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

function convertedWithRates(v, c, targetCurrency = base(), sourceRates = exchangeRates()) {
  if (c === targetCurrency) return v
  const from = sourceRates[c],
    to = sourceRates[targetCurrency]
  return from && to ? (v / from) * to : 0
}

function converted(v, c) {
  const base = getSetting('baseCurrency', 'EUR')
  return convertedWithRates(v, c, base)
}

function transactionRates(t) {
  return t?.exchangeRates || exchangeRates()
}

function rateSnapshotForCurrencies(currencies, sourceRates = exchangeRates()) {
  const snapshot = {}
  for (const currency of new Set(currencies.filter(Boolean))) {
    if (sourceRates[currency]) snapshot[currency] = sourceRates[currency]
  }
  snapshot.EUR = sourceRates.EUR || 1
  return snapshot
}

function convertedTransactionAmount(
  t,
  value = t?.amount,
  currency = account(t?.accountId)?.currency || 'EUR'
) {
  return convertedWithRates(value, currency, base(), transactionRates(t))
}

function inverseTransferQuote(
  fromCurrency,
  toCurrency,
  directRate = null,
  sourceRates = exchangeRates()
) {
  if (fromCurrency === toCurrency || fromCurrency === base()) return false
  if (toCurrency === base()) return true
  const from = sourceRates[fromCurrency],
    to = sourceRates[toCurrency]
  if (Number.isFinite(from) && from > 0 && Number.isFinite(to) && to > 0) return to < from
  return Number.isFinite(directRate) && directRate > 0 && directRate < 1
}

const formatTransferRate = value =>
  Number.isFinite(value) && value > 0
    ? new Intl.NumberFormat('en-GB', { useGrouping: false, maximumSignificantDigits: 10 }).format(
        value
      )
    : ''

function conversionRate(fromCurrency, toCurrency = base()) {
  if (fromCurrency === toCurrency) return 1
  const rates = exchangeRates(),
    from = rates[fromCurrency],
    to = rates[toCurrency]
  return from && to ? to / from : null
}

function conversionNote(value, fromCurrency, toCurrency = base()) {
  const rate = conversionRate(fromCurrency, toCurrency)
  if (!rate)
    return t('currency.conversion.noRate', { from: fromCurrency, to: toCurrency })
  return t('currency.conversion.estimate', {
    fromAmount: money(value, fromCurrency),
    toAmount: money(value * rate, toCurrency),
    from: fromCurrency,
    to: toCurrency,
    rate: rate.toFixed(4),
  })
}

function conversionNoteWithRates(
  value,
  fromCurrency,
  toCurrency = base(),
  sourceRates = exchangeRates()
) {
  const rate =
    fromCurrency === toCurrency
      ? 1
      : sourceRates[fromCurrency] && sourceRates[toCurrency]
        ? sourceRates[toCurrency] / sourceRates[fromCurrency]
        : null
  if (!rate)
    return t('currency.conversion.noRate', { from: fromCurrency, to: toCurrency })
  return t('currency.conversion.estimate', {
    fromAmount: money(value, fromCurrency),
    toAmount: money(value * rate, toCurrency),
    from: fromCurrency,
    to: toCurrency,
    rate: rate.toFixed(4),
  })
}

function balance(a) {
  return amount(
    Number(a.opening || 0) +
      state.transactions.reduce(
        (sum, t) =>
          sum +
          (t.type === 'income' && t.accountId === a.id
            ? t.amount
            : t.type === 'expense' && t.accountId === a.id
              ? -t.amount
              : t.type === 'transfer' && t.accountId === a.id
                ? -t.amount
                : t.type === 'transfer' && t.toAccountId === a.id
                  ? t.received
                  : 0),
        0
      )
  )
}

function convertedBalance(a) {
  return amount(
    converted(a.opening || 0, a.currency) +
      state.transactions.reduce((sum, t) => {
        if (t.type === 'income' && t.accountId === a.id) return sum + convertedTransactionAmount(t)
        if (t.type === 'expense' && t.accountId === a.id) return sum - convertedTransactionAmount(t)
        if (t.type === 'transfer' && t.accountId === a.id)
          return sum - convertedTransactionAmount(t)
        if (t.type === 'transfer' && t.toAccountId === a.id)
          return sum + convertedTransactionAmount(t, t.received || 0, a.currency)
        return sum
      }, 0)
  )
}

function txs() {
  return state.transactions.filter(
    t =>
      t.date?.startsWith(state.month) &&
      (state.accountFilter === 'all' ||
        t.accountId === state.accountFilter ||
        t.toAccountId === state.accountFilter)
  )
}

function totals() {
  const ts = txs()
  return {
    income: ts
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + convertedTransactionAmount(t), 0),
    expense: ts
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + convertedTransactionAmount(t), 0),
  }
}

const base = () => getSetting('baseCurrency', 'EUR')

const FLOW_LOCALES = {}
const FLOW_LANGUAGE_META = {}

function registerFlowLocale(code, messages, meta = {}) {
  FLOW_LOCALES[code] = messages
  if (meta.label) FLOW_LANGUAGE_META[code] = meta
}
