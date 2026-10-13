async function reload() {
    for (const name of storeNames) state[name] = await all(name);
    render()
  }

  function nav() {
    const entries = Object.keys(names);
    $('#side-nav').innerHTML = entries.map(k => `<button class="nav-item ${state.page === k ? 'active' : ''}" data-page="${k}"><span class="nav-icon">${icons[k]}</span>${names[k]}</button>`).join('');
    $('#bottom-nav').innerHTML = entries.map(k => `<button class="${state.page === k ? 'active' : ''}" data-page="${k}"><span>${icons[k]}</span>${k === 'home' ? 'Home' : names[k]}</button>`).join('');
    document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => {
      state.page = b.dataset.page;
      render();
      scrollTo(0, 0)
    })
  }

  function empty(title, desc, icon = '◈') {
    return `<div class="empty"><div class="empty-icon">${icon}</div><b>${title}</b><p>${desc}</p></div>`
  }

  function monthControl() {
    return `<div class="filter-row"><button class="icon-btn" id="prev-month">‹</button><strong style="font-size:13px;min-width:130px;text-align:center">${monthLabel(state.month)}</strong><button class="icon-btn" id="next-month">›</button></div>`
  }

  function bindMonth() {
    const shift = d => {
      state.month = shiftMonth(state.month, d);
      render()
    };
    $('#prev-month')?.addEventListener('click', () => shift(-1));
    $('#next-month')?.addEventListener('click', () => shift(1))
  }

  function accountSelect(id = 'account-filter') {
    return `<select class="select" id="${id}"><option value="all">All accounts</option>${state.accounts.filter(a => !a.archived).map(a => `<option value="${a.id}" ${state.accountFilter === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select>`
  }

  function txList(items) {
    if (!items.length) return empty('No transactions yet', 'Your financial activity will appear here.', '↗');
    return items.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || '')) || b.createdAt.localeCompare(a.createdAt)).map(t => {
      const a = account(t.accountId), c = cat(t.categoryId),
        description = t.description ?? t.note ?? '',
        payee = t.payee ?? t.place ?? '',
        label = t.type === 'transfer' ? `Transfer to ${account(t.toAccountId)?.name || 'account'}` : (payee || description || c?.name || t.type),
        currency = a?.currency || 'EUR',
        equivalent = currency !== base() ? money(convertedTransactionAmount(t), base()) : '',
        detail = [a?.name || 'Unknown account', t.date, t.time, equivalent && `${equivalent} ${base()} equivalent`, description && payee ? description : ''].filter(Boolean).join(' · ');
      return `<div class="transaction"><div class="tx-icon">${t.type === 'transfer' ? '⇄' : c?.icon || '◈'}</div><div class="tx-main"><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></div><div class="tx-amount ${t.type}">${t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}${fmt(t.amount, currency)}</div><div class="tx-actions"><button class="mini-btn" data-edit-tx="${t.id}" title="Edit">✎</button><button class="mini-btn" data-delete-tx="${t.id}" title="Delete">×</button></div></div>`
    }).join('')
  }

  function spendingByCategory(items) {
    const map = new Map();
    for (const t of items.filter(t => t.type === 'expense')) {
      const splits = t.splits?.length ? t.splits : [{categoryId: t.categoryId, amount: t.amount}];
      for (const s of splits) {
        const id = s.categoryId || 'other';
        map.set(id, (map.get(id) || 0) + convertedTransactionAmount(t, s.amount, account(t.accountId)?.currency || 'EUR'))
      }
    }
    return [...map].map(([id, value]) => ({
      name: cat(id)?.name || 'Other',
      value,
      color: cat(id)?.color || '#94a3b8'
    })).sort((a, b) => b.value - a.value)
  }

  function donut(items) {
    const groups = spendingByCategory(items), sum = groups.reduce((s, x) => s + x.value, 0);
    if (!sum) return empty('Nothing to analyze yet', 'Add an expense to see your spending breakdown.', '◉');
    let pct = 0;
    const segments = groups.map(x => {
      const a = pct;
      pct += x.value / sum * 100;
      return `${x.color} ${a}% ${pct}%`
    }).join(',');
    return `<div class="chart-wrap"><div class="donut" style="background:conic-gradient(${segments})"><div class="donut-hole"><div><strong>${money(sum, base())}</strong><br><small>Total spent</small></div></div></div><div class="legend">${groups.slice(0, 6).map(x => `<div class="legend-item"><span><i class="legend-dot" style="background:${x.color}"></i>${escapeHtml(x.name)}</span><b>${Math.round(x.value / sum * 100)}%</b></div>`).join('')}<p class="form-hint">Totals are calculated before display rounding.</p></div></div>`
  }

  function home() {
    const ts = txs(), t = totals(), active = state.accounts.filter(a => !a.archived),
      total = state.accountFilter === 'all' ? active.reduce((s, a) => s + converted(balance(a), a.currency), 0) : balance(account(state.accountFilter) || {
        id: '',
        opening: 0
      });
    const cur = state.accountFilter === 'all' ? base() : account(state.accountFilter)?.currency || base();
    return `<div class="welcome"><div><h2>Welcome to your money space 👋</h2><div class="muted">A clearer picture of your finances, every day.</div></div><button class="btn" data-add="transaction">+ Add transaction</button></div><div class="toolbar">${monthControl()}${accountSelect()}</div><div class="grid summary-grid"><section class="balance-card"><p>Total balance</p><h2>${money(total, cur)}</h2><footer>◈ ${state.accountFilter === 'all' ? active.length + ' active accounts' : escapeHtml(account(state.accountFilter)?.name || 'Account')} · ${state.accountFilter === 'all' ? 'Estimated base-currency total' : 'Native currency'}</footer></section><section class="stat-card"><span class="stat-icon">↙</span><div class="label">Monthly income</div><div class="stat-value income">${money(t.income, base())}</div><div class="stat-bottom">For ${monthLabel(state.month)}</div></section><section class="stat-card"><span class="stat-icon expense-icon">↗</span><div class="label">Monthly expenses</div><div class="stat-value expense">${money(t.expense, base())}</div><div class="stat-bottom">For ${monthLabel(state.month)}</div></section></div><div class="section-grid"><section class="panel"><div class="panel-head"><h3>Recent transactions</h3><button class="link-btn" data-page="transactions">View all →</button></div>${txList(ts.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || ''))).slice(0, 5))}</section><section class="panel"><div class="panel-head"><h3>Spending breakdown</h3><span class="pill">${monthLabel(state.month)}</span></div>${donut(ts)}</section></div><div class="section-grid"><section class="panel"><div class="panel-head"><h3>Quick actions</h3></div><div class="quick-actions"><button class="quick-action" data-add="expense"><span>↗</span>Add expense</button><button class="quick-action" data-add="income"><span>↙</span>Add income</button><button class="quick-action" data-add="transfer"><span>⇄</span>Transfer</button></div></section><section class="panel"><div class="panel-head"><h3>Your accounts</h3><button class="link-btn" data-page="accounts">Manage →</button></div>${active.length ? active.slice(0, 4).map(a => `<div class="transaction"><div class="tx-icon">▣</div><div class="tx-main"><b>${escapeHtml(a.name)}</b><small>${a.currency} · ${escapeHtml(a.type)}</small></div><b>${money(balance(a), a.currency)}</b></div>`).join('') : empty('No accounts yet', 'Create your first account to begin.', '▣')}</section></div>`
  }

  function transactions() {
    const items = txs();
    return `<div class="toolbar"><div><h2>Transaction history</h2><p class="muted">Every movement, all in one place.</p></div><button class="btn" data-add="transaction">+ New transaction</button></div><div class="toolbar">${monthControl()}${accountSelect()}</div><section class="table-list">${txList(items)}</section>`
  }

  function statistics() {
    const ts = txs(), t = totals();
    return `<div class="toolbar"><div><h2>Financial insights</h2><p class="muted">Understand where your money goes.</p></div>${monthControl()}</div><div class="grid summary-grid"><section class="balance-card"><p>Net cash flow</p><h2>${money(t.income - t.expense, base())}</h2><footer>Income minus expenses</footer></section><section class="stat-card"><div class="label">Income</div><div class="stat-value income">${money(t.income, base())}</div></section><section class="stat-card"><div class="label">Expenses</div><div class="stat-value expense">${money(t.expense, base())}</div></section></div><div class="section-grid"><section class="panel"><div class="panel-head"><h3>Expenses by category</h3></div>${donut(ts)}</section><section class="panel"><div class="panel-head"><h3>Category details</h3></div>${spendingByCategory(ts).length ? spendingByCategory(ts).map(x => `<div class="budget-row"><div class="head"><b>${escapeHtml(x.name)}</b><b>${money(x.value, base())}</b></div><div class="progress"><span style="width:${t.expense ? Math.min(100, x.value / t.expense * 100) : 0}%;background:${x.color}"></span></div></div>`).join('') : empty('No spending data', 'Your categories will appear here.', '◉')}</section></div><p class="muted" style="margin-top:15px">Cross-currency totals use editable reference rates and are estimates. Original transaction amounts remain unchanged.</p>`
  }

  function accounts() {
    const active = state.accounts.filter(a => !a.archived), archived = state.accounts.filter(a => a.archived);
    const cards = arr => arr.map(a => `<div class="account-card"><div class="account-symbol">▣</div><h3>${escapeHtml(a.name)} ${a.archived ? '<span class="pill">Archived</span>' : ''}</h3><strong>${money(balance(a), a.currency)}</strong><p>${escapeHtml(a.type)} · ${a.currency}</p><div class="actions"><button class="btn ghost" data-edit-account="${a.id}">Edit</button><button class="btn secondary" data-archive="${a.id}">${a.archived ? 'Restore' : 'Archive'}</button><button class="btn danger" data-delete-account="${a.id}">Delete</button></div></div>`).join('');
    return `<div class="toolbar"><div><h2>My accounts</h2><p class="muted">Keep every balance in view.</p></div><button class="btn" data-add="account">+ Add account</button></div>${active.length ? `<div class="account-grid">${cards(active)}</div>` : empty('Create your first account', 'Add a bank, cash, or savings account to get started.', '▣')}${archived.length ? `<h3 style="margin-top:32px">Archived accounts</h3><div class="account-grid">${cards(archived)}</div>` : ''}`
  }

  function more() {
    const current = state.budgets.filter(b => b.month === state.month);
    return `<div class="toolbar"><div><h2>Manage your money</h2><p class="muted">Budgets, categories, automation and preferences.</p></div></div><div class="settings-grid"><section class="settings-tile"><h3>◉ Monthly budgets</h3><p>Set monthly spending limits without carry-over.</p><button class="btn secondary" id="open-budgets">Manage budgets</button></section><section class="settings-tile"><h3>◈ Categories</h3><p>Customize expense and income categories, icons and colors.</p><button class="btn secondary" id="open-categories">Manage categories</button></section><section class="settings-tile"><h3>↻ Recurring transactions</h3><p>Schedule regular income and expenses, processed when the app opens.</p><button class="btn secondary" id="open-recurring">Manage schedules</button></section><section class="settings-tile"><h3>⚙ Settings & backup</h3><p>Currency, data export and import, and privacy options.</p><button class="btn secondary" id="open-settings">Open settings</button></section></div><section class="panel" style="margin-top:20px"><div class="panel-head"><h3>Budget overview · ${monthLabel(state.month)}</h3><button class="link-btn" id="budget-quick">Manage →</button></div>${current.length ? current.map(b => {
      const spent = state.transactions.filter(t => t.type === 'expense' && t.date.startsWith(state.month)).reduce((s, t) => s + (t.splits?.length ? t.splits.filter(x => x.categoryId === b.categoryId).reduce((a, x) => a + convertedTransactionAmount(t, x.amount, account(t.accountId)?.currency || 'EUR'), 0) : t.categoryId === b.categoryId ? convertedTransactionAmount(t) : 0), 0);
      return `<div class="budget-row"><div class="head"><b>${escapeHtml(cat(b.categoryId)?.name || 'Overall budget')}</b><b>${money(spent, base())} / ${money(b.limit, base())}</b></div><div class="progress"><span style="width:${Math.min(100, spent / b.limit * 100)}%;background:${spent > b.limit ? '#f16a76' : '#3479f4'}"></span></div></div>`
    }).join('') : empty('No budgets set', 'Create a monthly budget to track spending.', '◉')}</section>`
  }

  function render() {
    nav();
    $('#page-title').textContent = names[state.page];
    $('#view').innerHTML = ({home, transactions, statistics, accounts, more})[state.page]();
    bindMonth();
    $('#account-filter')?.addEventListener('change', e => {
      state.accountFilter = e.target.value;
      render()
    });
    document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => {
      state.page = b.dataset.page;
      render()
    });
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      if (b.dataset.add === 'account') accountModal(); else transactionModal(null, b.dataset.add === 'transaction' ? 'expense' : b.dataset.add)
    });
    document.querySelectorAll('[data-edit-account]').forEach(b => b.onclick = () => accountModal(account(b.dataset.editAccount)));
    document.querySelectorAll('[data-archive]').forEach(b => b.onclick = async () => {
      const a = account(b.dataset.archive);
      await put('accounts', {...a, archived: !a.archived});
      await reload()
    });
    document.querySelectorAll('[data-delete-account]').forEach(b => b.onclick = async () => {
      const a = account(b.dataset.deleteAccount);
      if (state.transactions.some(t => t.accountId === a.id || t.toAccountId === a.id)) return toast('Account has transactions. Archive it instead.');
      confirmAction({
        title: 'Delete account',
        message: `Delete ${a.name}? This cannot be undone.`,
        confirmText: 'Delete account',
        onConfirm: async () => {
          await del('accounts', a.id);
          closeModal();
          await reload()
        }
      })
    });
    document.querySelectorAll('[data-edit-tx]').forEach(b => b.onclick = () => transactionModal(state.transactions.find(t => t.id === b.dataset.editTx)));
    document.querySelectorAll('[data-delete-tx]').forEach(b => b.onclick = async () => {
      confirmAction({
        title: 'Delete transaction',
        message: 'Delete this transaction? This cannot be undone.',
        confirmText: 'Delete transaction',
        onConfirm: async () => {
          await del('transactions', b.dataset.deleteTx);
          closeModal();
          await reload()
        }
      })
    });
    $('#open-categories')?.addEventListener('click', categoriesModal);
    $('#open-budgets')?.addEventListener('click', budgetsModal);
    $('#budget-quick')?.addEventListener('click', budgetsModal);
    $('#open-recurring')?.addEventListener('click', recurringModal);
    $('#open-settings')?.addEventListener('click', settingsModal)
  }
