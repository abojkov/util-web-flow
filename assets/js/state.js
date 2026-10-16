// Update this value when releasing a new app version.
const APP_VERSION = '1.0.0';

const $ = s => document.querySelector(s), uid = () => crypto.randomUUID(),
    today = () => new Date().toLocaleDateString('en-CA'),
    currentTime = () => new Date().toTimeString().slice(0, 5);
  let txSearchTimer;
  const icons = {home: '⌂', transactions: '≡', statistics: '◉', accounts: '<svg class="accounts-nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5a2 2 0 0 0 0 4h5"/><circle cx="16" cy="14" r=".5" fill="currentColor" stroke="none"/></svg>', more: '☷'};
  const splitTransactionIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v5a3 3 0 0 0 3 3h2a3 3 0 0 1 3 3v6M12 8a3 3 0 0 1-3 3H7a3 3 0 0 0-3 3v6M1 17l3 3 3-3m10 0 3 3 3-3"/></svg>';
  const names = {
    home: 'Overview',
    transactions: 'Transactions',
    statistics: 'Statistics',
    accounts: 'Accounts',
    more: 'More'
  };
  const defaults = [['Food & Drinks', '🍽️', '#fb923c', 'expense'], ['Shopping', '🛍️', '#a78bfa', 'expense'], ['Transport', '🚙', '#60a5fa', 'expense'], ['Bills', '🧾', '#2dd4bf', 'expense'], ['Health', '♥', '#fb7185', 'expense'], ['Home', '⌂', '#fbbf24', 'expense'], ['Travel', '✈', '#38bdf8', 'expense'], ['Other Expense', '◈', '#94a3b8', 'expense'], ['Salary', '💼', '#34d399', 'income'], ['Gift', '🎁', '#a78bfa', 'income'], ['Interest', '↗', '#60a5fa', 'income'], ['Other Income', '◈', '#94a3b8', 'income']];
  let state = {
    page: 'home',
    accounts: [],
    transactions: [],
    categories: [],
    budgets: [],
    recurring: [],
    settings: [],
    month: today().slice(0, 7),
    accountFilter: 'all',
    txSearch: '',
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
    statsAccount: 'all'
  };
  const getSetting = (k, d) => state.settings.find(x => x.id === k)?.value ?? d;
  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
  const money = (n, c = 'EUR') => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: c,
    maximumFractionDigits: 2
  }).format(n || 0);
  const fmt = (n, c) => money(n, c);
  const decimalValue = x => Number(String(x ?? '').trim().replace(',', '.'));
  const amount = x => Math.round((decimalValue(x) || 0) * 100) / 100;
  const displayDate = value => String(value || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1');
  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const shiftMonth = (month, delta) => {
    const [year, monthNumber] = month.split('-').map(Number);
    return monthKey(new Date(year, monthNumber - 1 + delta, 1, 12))
  };
  const monthLabel = m => new Date(m + '-01T12:00:00').toLocaleDateString('en-GB', {month: 'long', year: 'numeric'});
  const account = id => state.accounts.find(a => a.id === id);
  const isSelectableAccount = a => !a.archived && a.visible !== false;
  const cat = id => state.categories.find(c => c.id === id);
  const subcat = (categoryId, subcategoryId) => cat(categoryId)?.subcategories?.find(s => s.id === subcategoryId);
  const categoryLabel = (categoryId, subcategoryId) => {
    const c = cat(categoryId), s = subcat(categoryId, subcategoryId);
    return [c?.name, s?.name].filter(Boolean).join(' / ') || 'Other'
  };
  const defaultRates = {EUR: 1, USD: 1.09, GBP: .86, MKD: 61.5, CHF: .94, SEK: 11.2};

  function exchangeRates() {
    return {...defaultRates, ...getSetting('exchangeRates', {})}
  }

  function usedCurrencies() {
    const values = new Set([base()]);
    for (const item of state.accounts) values.add(item.currency);
    for (const item of state.transactions) {
      const from = account(item.accountId), to = account(item.toAccountId);
      if (from?.currency) values.add(from.currency);
      if (to?.currency) values.add(to.currency)
    }
    return [...values].filter(Boolean).sort()
  }

  function payeeOptions() {
    const seen = new Map();
    for (const item of [...state.transactions, ...state.recurring]) {
      const value = String(item.payee ?? item.place ?? '').trim();
      if (!value) continue;
      const key = value.toLocaleLowerCase();
      if (!seen.has(key)) seen.set(key, value)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }

  function convertedWithRates(v, c, targetCurrency = base(), sourceRates = exchangeRates()) {
    if (c === targetCurrency) return v;
    const from = sourceRates[c], to = sourceRates[targetCurrency];
    return from && to ? v / from * to : 0
  }

  function converted(v, c) {
    const base = getSetting('baseCurrency', 'EUR');
    return convertedWithRates(v, c, base)
  }

  function transactionRates(t) {
    return t?.exchangeRates || exchangeRates()
  }

  function rateSnapshotForCurrencies(currencies, sourceRates = exchangeRates()) {
    const snapshot = {};
    for (const currency of new Set(currencies.filter(Boolean))) {
      if (sourceRates[currency]) snapshot[currency] = sourceRates[currency]
    }
    snapshot.EUR = sourceRates.EUR || 1;
    return snapshot
  }

  function convertedTransactionAmount(t, value = t?.amount, currency = account(t?.accountId)?.currency || 'EUR') {
    return convertedWithRates(value, currency, base(), transactionRates(t))
  }

  function conversionRate(fromCurrency, toCurrency = base()) {
    if (fromCurrency === toCurrency) return 1;
    const rates = exchangeRates(), from = rates[fromCurrency], to = rates[toCurrency];
    return from && to ? to / from : null
  }

  function conversionNote(value, fromCurrency, toCurrency = base()) {
    const rate = conversionRate(fromCurrency, toCurrency);
    if (!rate) return `No reference rate is available for ${fromCurrency} to ${toCurrency}.`;
    return `${money(value, fromCurrency)} ≈ ${money(value * rate, toCurrency)} · 1 ${fromCurrency} ≈ ${rate.toFixed(4)} ${toCurrency}`
  }

  function conversionNoteWithRates(value, fromCurrency, toCurrency = base(), sourceRates = exchangeRates()) {
    const rate = fromCurrency === toCurrency ? 1 : sourceRates[fromCurrency] && sourceRates[toCurrency] ? sourceRates[toCurrency] / sourceRates[fromCurrency] : null;
    if (!rate) return `No reference rate is available for ${fromCurrency} to ${toCurrency}.`;
    return `${money(value, fromCurrency)} ≈ ${money(value * rate, toCurrency)} · 1 ${fromCurrency} ≈ ${rate.toFixed(4)} ${toCurrency}`
  }

  function balance(a) {
    return amount(Number(a.opening || 0) + state.transactions.reduce((sum, t) => sum + (t.type === 'income' && t.accountId === a.id ? t.amount : t.type === 'expense' && t.accountId === a.id ? -t.amount : t.type === 'transfer' && t.accountId === a.id ? -t.amount : t.type === 'transfer' && t.toAccountId === a.id ? t.received : 0), 0))
  }

  function convertedBalance(a) {
    return amount(converted(a.opening || 0, a.currency) + state.transactions.reduce((sum, t) => {
      if (t.type === 'income' && t.accountId === a.id) return sum + convertedTransactionAmount(t);
      if (t.type === 'expense' && t.accountId === a.id) return sum - convertedTransactionAmount(t);
      if (t.type === 'transfer' && t.accountId === a.id) return sum - convertedTransactionAmount(t);
      if (t.type === 'transfer' && t.toAccountId === a.id) return sum + convertedTransactionAmount(t, t.received || 0, a.currency);
      return sum
    }, 0))
  }

  function txs() {
    return state.transactions.filter(t => t.date?.startsWith(state.month) && (state.accountFilter === 'all' || t.accountId === state.accountFilter || t.toAccountId === state.accountFilter))
  }

  function totals() {
    const ts = txs();
    return {
      income: ts.filter(t => t.type === 'income').reduce((s, t) => s + convertedTransactionAmount(t), 0),
      expense: ts.filter(t => t.type === 'expense').reduce((s, t) => s + convertedTransactionAmount(t), 0)
    }
  }

  const base = () => getSetting('baseCurrency', 'EUR');
