const $ = s => document.querySelector(s), uid = () => crypto.randomUUID(),
    today = () => new Date().toLocaleDateString('en-CA'),
    currentTime = () => new Date().toTimeString().slice(0, 5);
  const icons = {home: '⌂', transactions: '≡', statistics: '◉', accounts: '▣', more: '☷'};
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
  const amount = x => Math.round((Number(x) || 0) * 100) / 100;
  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const shiftMonth = (month, delta) => {
    const [year, monthNumber] = month.split('-').map(Number);
    return monthKey(new Date(year, monthNumber - 1 + delta, 1, 12))
  };
  const monthLabel = m => new Date(m + '-01T12:00:00').toLocaleDateString('en-GB', {month: 'long', year: 'numeric'});
  const account = id => state.accounts.find(a => a.id === id);
  const cat = id => state.categories.find(c => c.id === id);
  const rates = {EUR: 1, USD: 1.09, GBP: .86, MKD: 61.5, CHF: .94, SEK: 11.2};

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

  function converted(v, c) {
    const base = getSetting('baseCurrency', 'EUR');
    if (c === base) return v;
    const from = rates[c], to = rates[base];
    return from && to ? v / from * to : 0
  }

  function balance(a) {
    return amount(Number(a.opening || 0) + state.transactions.reduce((sum, t) => sum + (t.type === 'income' && t.accountId === a.id ? t.amount : t.type === 'expense' && t.accountId === a.id ? -t.amount : t.type === 'transfer' && t.accountId === a.id ? -t.amount : t.type === 'transfer' && t.toAccountId === a.id ? t.received : 0), 0))
  }

  function txs() {
    return state.transactions.filter(t => t.date?.startsWith(state.month) && (state.accountFilter === 'all' || t.accountId === state.accountFilter || t.toAccountId === state.accountFilter))
  }

  function totals() {
    const ts = txs();
    return {
      income: ts.filter(t => t.type === 'income').reduce((s, t) => s + converted(t.amount, account(t.accountId)?.currency || 'EUR'), 0),
      expense: ts.filter(t => t.type === 'expense').reduce((s, t) => s + converted(t.amount, account(t.accountId)?.currency || 'EUR'), 0)
    }
  }

  const base = () => getSetting('baseCurrency', 'EUR');
