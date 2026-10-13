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

  function isoDate(date) {
    return date.toISOString().slice(0, 10)
  }

  function startOfWeek(dateKey) {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return isoDate(d)
  }

  function shiftDate(dateKey, days) {
    const d = new Date(dateKey + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return isoDate(d)
  }

  function txPeriodControl() {
    if (state.txSearchPeriod === 'all') return '';
    if (state.txSearchPeriod === 'week') {
      const weekStart = state.txSearchWeekStart || startOfWeek(today()), weekEnd = shiftDate(weekStart, 6);
      return `<div class="toolbar period-toolbar"><div class="filter-row"><button class="icon-btn" id="prev-tx-period">‹</button><strong style="font-size:13px;min-width:210px;text-align:center">${weekStart} – ${weekEnd}</strong><button class="icon-btn" id="next-tx-period">›</button></div></div>`
    }
    if (state.txSearchPeriod === 'year') return `<div class="toolbar period-toolbar"><div class="filter-row"><button class="icon-btn" id="prev-tx-period">‹</button><strong style="font-size:13px;min-width:130px;text-align:center">${state.txSearchYear || today().slice(0, 4)}</strong><button class="icon-btn" id="next-tx-period">›</button></div></div>`;
    return `<div class="toolbar period-toolbar"><div class="filter-row"><button class="icon-btn" id="prev-tx-period">‹</button><strong style="font-size:13px;min-width:130px;text-align:center">${monthLabel(state.month)}</strong><button class="icon-btn" id="next-tx-period">›</button></div></div>`
  }

  function bindMonth() {
    const shift = d => {
      state.month = shiftMonth(state.month, d);
      render()
    };
    $('#prev-month')?.addEventListener('click', () => shift(-1));
    $('#next-month')?.addEventListener('click', () => shift(1))
  }

  function bindTxPeriod() {
    const shift = d => {
      if (state.txSearchPeriod === 'week') state.txSearchWeekStart = shiftDate(state.txSearchWeekStart || startOfWeek(today()), d * 7);
      else if (state.txSearchPeriod === 'year') state.txSearchYear = String(Number(state.txSearchYear || today().slice(0, 4)) + d);
      else state.month = shiftMonth(state.month, d);
      render()
    };
    $('#prev-tx-period')?.addEventListener('click', () => shift(-1));
    $('#next-tx-period')?.addEventListener('click', () => shift(1))
  }

  function accountSelect(id = 'account-filter') {
    return `<select class="select" id="${id}"><option value="all">All accounts</option>${state.accounts.filter(a => !a.archived).map(a => `<option value="${a.id}" ${state.accountFilter === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select>`
  }

  function txList(items) {
    if (!items.length) return empty('No transactions yet', 'Your financial activity will appear here.', '↗');
    return items.map(t => {
      const a = account(t.accountId), c = cat(t.categoryId),
        description = String(t.description ?? t.note ?? '').trim(),
        payee = t.payee ?? t.place ?? '',
        categoryName = t.categoryId ? categoryLabel(t.categoryId, t.subcategoryId) : '',
        label = t.type === 'transfer' ? `Transfer to ${account(t.toAccountId)?.name || 'account'}` : (payee || categoryName || t.type),
        currency = a?.currency || 'EUR',
        equivalent = currency !== base() ? money(convertedTransactionAmount(t), base()) : '',
        detail = [a?.name || 'Unknown account', categoryName, t.date, t.time, equivalent && `${equivalent} ${base()} equivalent`].filter(Boolean).join(' · '),
        descriptionOpen = state.activeTxDescription === t.id,
        descriptionBadge = description ? `<button class="tx-note-badge ${descriptionOpen ? 'open' : ''}" type="button" data-tx-description="${t.id}" aria-expanded="${descriptionOpen ? 'true' : 'false'}">Note</button>` : '',
        descriptionPopover = description && descriptionOpen ? `<div class="tx-note-popover">${escapeHtml(description)}</div>` : '';
      return `<div class="transaction"><div class="tx-icon">${t.type === 'transfer' ? '⇄' : c?.icon || '◈'}</div><div class="tx-main"><b><span>${escapeHtml(label)}</span>${descriptionBadge}</b><small>${escapeHtml(detail)}</small>${descriptionPopover}</div><div class="tx-amount ${t.type}">${t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}${fmt(t.amount, currency)}</div><div class="tx-actions"><button class="mini-btn" data-edit-tx="${t.id}" title="Edit">✎</button><button class="mini-btn" data-delete-tx="${t.id}" title="Delete">×</button></div></div>`
    }).join('')
  }

  function spendingByCategory(items) {
    const map = new Map();
    for (const t of items.filter(t => t.type === 'expense')) {
      const splits = t.splits?.length ? t.splits : [{categoryId: t.categoryId, subcategoryId: t.subcategoryId, amount: t.amount}];
      for (const s of splits) {
        const id = s.subcategoryId ? `${s.categoryId}:${s.subcategoryId}` : s.categoryId || 'other';
        map.set(id, (map.get(id) || 0) + convertedTransactionAmount(t, s.amount, account(t.accountId)?.currency || 'EUR'))
      }
    }
    return [...map].map(([id, value]) => {
      const [categoryId, subcategoryId] = id.split(':');
      const c = cat(categoryId), s = subcat(categoryId, subcategoryId);
      return {
        name: categoryId === 'other' ? 'Other' : categoryLabel(categoryId, subcategoryId),
        value,
        color: s?.color || c?.color || '#94a3b8'
      }
    }).sort((a, b) => b.value - a.value)
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
    const rawSearch = state.txSearch.trim();
    const query = rawSearch.length >= 2 ? rawSearch.toLocaleLowerCase() : '';
    const searchPeriodOptions = [['month', 'Monthly'], ['week', 'Weekly'], ['year', 'Yearly'], ['all', 'All history']];
    const categoryGroups = ['expense', 'income'].map(type => ({
      type,
      label: type === 'expense' ? 'Expense categories' : 'Income categories',
      items: state.categories.filter(c => c.type === type).sort(sortByOrderThenName)
    }));
    const categoryFilterKey = (categoryId, subcategoryId = '') => subcategoryId ? `sub:${categoryId}:${subcategoryId}` : `cat:${categoryId}`;
    const categoryFilterOptions = categoryGroups.flatMap(group => group.items.flatMap(c => [
      {key: categoryFilterKey(c.id), categoryId: c.id},
      ...(c.subcategories || []).map(s => ({key: categoryFilterKey(c.id, s.id), categoryId: c.id, subcategoryId: s.id}))
    ]));
    const validCategoryKeys = new Set(categoryFilterOptions.map(option => option.key));
    const selectedCategoryKeys = new Set((state.txCategoryFilters || []).filter(key => validCategoryKeys.has(key)));
    state.txCategoryFilters = [...selectedCategoryKeys];
    const expandedCategoryIds = new Set((state.txExpandedCategories || []).filter(id => categoryFilterOptions.some(option => option.categoryId === id && option.subcategoryId)));
    state.txExpandedCategories = [...expandedCategoryIds];
    const expandedCategoryGroups = new Set((state.txExpandedCategoryGroups || []).filter(type => ['expense', 'income'].includes(type)));
    state.txExpandedCategoryGroups = [...expandedCategoryGroups];
    const categoryMatches = t => {
      if (!selectedCategoryKeys.size) return true;
      const matches = item => selectedCategoryKeys.has(categoryFilterKey(item.categoryId)) || selectedCategoryKeys.has(categoryFilterKey(item.categoryId, item.subcategoryId));
      if (t.splits?.length) return t.splits.some(matches);
      return matches(t)
    };
    if (!state.txSearchWeekStart) state.txSearchWeekStart = startOfWeek(today());
    if (!state.txSearchYear) state.txSearchYear = today().slice(0, 4);
    const weekStart = state.txSearchWeekStart, weekEnd = shiftDate(weekStart, 6), yearKey = state.txSearchYear;
    const inSearchPeriod = t => state.txSearchPeriod === 'all' || (state.txSearchPeriod === 'year' ? t.date?.startsWith(yearKey) : state.txSearchPeriod === 'week' ? t.date >= weekStart && t.date <= weekEnd : t.date?.startsWith(state.month));
    const baseItems = state.transactions.filter(t => inSearchPeriod(t) && (state.accountFilter === 'all' || t.accountId === state.accountFilter || t.toAccountId === state.accountFilter));
    const matchedItems = baseItems.filter(t => (!query || [t.payee, t.place, t.description, t.note].some(value => String(value || '').toLocaleLowerCase().includes(query))) && categoryMatches(t));
    const hasSearchFilters = Boolean(query || selectedCategoryKeys.size);
    const items = state.txSearchPeriod === 'all' && !hasSearchFilters ? matchedItems.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || '')) || b.createdAt.localeCompare(a.createdAt)).slice(0, 250) : matchedItems;
    const periodLabel = searchPeriodOptions.find(([value]) => value === state.txSearchPeriod)?.[1] || 'Monthly';
    const categorySummary = selectedCategoryKeys.size ? ` · ${selectedCategoryKeys.size} ${selectedCategoryKeys.size === 1 ? 'category filter' : 'category filters'}` : '';
    const resultText = hasSearchFilters ? `${matchedItems.length} matching transactions · ${periodLabel}${categorySummary}` : rawSearch ? `Type at least 2 characters to search · ${periodLabel}` : state.txSearchPeriod === 'all' ? `Showing latest ${items.length} of ${matchedItems.length} transactions · type to search all history` : `${periodLabel} transactions`;
    const categoryBadge = (option) => `<label class="category-check ${option.isSubcategory ? 'subcategory' : ''} ${selectedCategoryKeys.has(option.key) ? 'selected' : ''}"><input type="checkbox" data-tx-category="${escapeHtml(option.key)}" ${selectedCategoryKeys.has(option.key) ? 'checked' : ''}><span style="--category-color:${option.color}">${escapeHtml(option.icon)}</span>${escapeHtml(option.label)}</label>`;
    const renderCategory = c => {
      const subcategories = (c.subcategories || []).slice().sort(sortByOrderThenName);
      const expanded = expandedCategoryIds.has(c.id);
      const parent = categoryBadge({key: categoryFilterKey(c.id), label: c.name, icon: c.icon || '◈', color: c.color || '#3479f4'});
      const expand = subcategories.length ? `<button class="category-expand ${expanded ? 'open' : ''}" data-tx-category-expand="${c.id}" type="button" title="${expanded ? 'Hide subcategories' : 'Show subcategories'}">${expanded ? '−' : '+'}</button>` : '';
      const children = expanded ? `<div class="subcategory-options">${subcategories.map(s => categoryBadge({key: categoryFilterKey(c.id, s.id), label: s.name, icon: s.icon || c.icon || '◦', color: s.color || c.color || '#3479f4', isSubcategory: true})).join('')}</div>` : '';
      return `<div class="category-filter-item"><div class="category-main">${parent}${expand}</div>${children}</div>`
    };
    const renderGroup = group => {
      const expanded = expandedCategoryGroups.has(group.type);
      const count = group.items.reduce((sum, c) => sum + 1 + (c.subcategories?.length || 0), 0);
      return `<div class="category-filter-group ${expanded ? 'open' : ''}"><button class="category-group-toggle" data-tx-category-group="${group.type}" type="button"><span>${group.label}</span><small>${count} filters</small><b>${expanded ? '−' : '+'}</b></button>${expanded ? `<div class="category-filter-options">${group.items.length ? group.items.map(renderCategory).join('') : '<p class="form-hint">No categories yet.</p>'}</div>` : ''}</div>`
    };
    return `<div class="toolbar"><div><h2>Transaction history</h2><p class="muted">Every movement, all in one place.</p></div><button class="btn" data-add="transaction">+ New transaction</button></div><section class="search-panel"><div class="search-panel-head"><div><h3>Search transactions</h3><p>Find transactions by text, period, account, and category.</p></div>${selectedCategoryKeys.size || rawSearch ? '<button class="link-btn" id="tx-clear-search">Clear search</button>' : ''}</div><div class="search-grid"><label class="search-field"><span>Search</span><input id="tx-search" type="search" value="${escapeHtml(state.txSearch)}" placeholder="Payee or description"></label><label class="search-field search-period"><span>Period</span><select id="tx-search-period">${searchPeriodOptions.map(([value, label]) => `<option value="${value}" ${state.txSearchPeriod === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="search-field"><span>Account</span>${accountSelect()}</label></div><div class="category-filter"><span>Categories</span><div class="category-filter-groups">${categoryGroups.map(renderGroup).join('')}</div></div></section>${txPeriodControl()}<p class="form-hint">${escapeHtml(resultText)}</p><section class="table-list">${txList(items)}</section>`
  }

  function statistics() {
    const ts = txs(), t = totals();
    const filterLabel = state.accountFilter === 'all' ? 'All accounts' : account(state.accountFilter)?.name || 'Selected account';
    return `<div class="toolbar"><div><h2>Financial insights</h2><p class="muted">Understand where your money goes.</p></div><div class="filter-row">${monthControl()}${accountSelect()}</div></div><div class="grid summary-grid"><section class="balance-card"><p>Net cash flow</p><h2>${money(t.income - t.expense, base())}</h2><footer>${escapeHtml(filterLabel)} · Income minus expenses</footer></section><section class="stat-card"><div class="label">Income</div><div class="stat-value income">${money(t.income, base())}</div></section><section class="stat-card"><div class="label">Expenses</div><div class="stat-value expense">${money(t.expense, base())}</div></section></div><div class="section-grid"><section class="panel"><div class="panel-head"><h3>Expenses by category</h3></div>${donut(ts)}</section><section class="panel"><div class="panel-head"><h3>Category details</h3></div>${spendingByCategory(ts).length ? spendingByCategory(ts).map(x => `<div class="budget-row"><div class="head"><b>${escapeHtml(x.name)}</b><b>${money(x.value, base())}</b></div><div class="progress"><span style="width:${t.expense ? Math.min(100, x.value / t.expense * 100) : 0}%;background:${x.color}"></span></div></div>`).join('') : empty('No spending data', 'Your categories will appear here.', '◉')}</section></div><p class="muted" style="margin-top:15px">Cross-currency totals use editable reference rates and are estimates. Original transaction amounts remain unchanged.</p>`
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
    bindTxPeriod();
    $('#account-filter')?.addEventListener('change', e => {
      state.accountFilter = e.target.value;
      render()
    });
    $('#tx-search')?.addEventListener('input', e => {
      const value = e.target.value, cursor = e.target.selectionStart;
      clearTimeout(txSearchTimer);
      if (!value.trim()) {
        state.txSearch = '';
        render();
        $('#tx-search')?.focus({preventScroll: true});
        return
      }
      txSearchTimer = setTimeout(() => {
        state.txSearch = value;
        render();
        const next = $('#tx-search');
        next?.focus({preventScroll: true});
        next?.setSelectionRange(cursor, cursor)
      }, 180)
    });
    $('#tx-search-period')?.addEventListener('change', e => {
      state.txSearchPeriod = e.target.value;
      if (state.txSearchPeriod === 'week' && !state.txSearchWeekStart) state.txSearchWeekStart = startOfWeek(today());
      if (state.txSearchPeriod === 'year' && !state.txSearchYear) state.txSearchYear = today().slice(0, 4);
      render()
    });
    document.querySelectorAll('[data-tx-category]').forEach(input => input.addEventListener('change', e => {
      const selected = new Set(state.txCategoryFilters || []);
      const key = e.target.dataset.txCategory;
      const [, categoryId] = key.split(':');
      if (e.target.checked) {
        if (key.startsWith('cat:')) {
          [...selected].filter(item => item.startsWith(`sub:${categoryId}:`)).forEach(item => selected.delete(item));
          selected.add(key)
        } else {
          selected.delete(`cat:${categoryId}`);
          selected.add(key)
        }
      } else {
        selected.delete(key)
      }
      state.txCategoryFilters = [...selected];
      render()
    }));
    document.querySelectorAll('[data-tx-category-expand]').forEach(button => button.addEventListener('click', e => {
      const expanded = new Set(state.txExpandedCategories || []), id = e.currentTarget.dataset.txCategoryExpand;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      state.txExpandedCategories = [...expanded];
      render()
    }));
    document.querySelectorAll('[data-tx-category-group]').forEach(button => button.addEventListener('click', e => {
      const expanded = new Set(state.txExpandedCategoryGroups || []), type = e.currentTarget.dataset.txCategoryGroup;
      if (expanded.has(type)) expanded.delete(type); else expanded.add(type);
      state.txExpandedCategoryGroups = [...expanded];
      render()
    }));
    document.querySelectorAll('[data-tx-description]').forEach(button => button.addEventListener('click', e => {
      const id = e.currentTarget.dataset.txDescription;
      state.activeTxDescription = state.activeTxDescription === id ? '' : id;
      render()
    }));
    $('#tx-clear-search')?.addEventListener('click', () => {
      state.txSearch = '';
      state.txCategoryFilters = [];
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
