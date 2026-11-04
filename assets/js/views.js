async function reload() {
  for (const name of storeNames) state[name] = await all(name)
  render()
}

function nav() {
  const names = pageNames()
  const entries = Object.keys(names)
  $('#side-nav').innerHTML = entries
    .map(
      k => `
        <button class="nav-item ${state.page === k ? 'active' : ''}" data-page="${k}">
          <span class="nav-icon">${icons[k]}</span>${escapeHtml(names[k])}
        </button>
      `
    )
    .join('')
  $('#bottom-nav').innerHTML = entries
    .map(
      k => `
        <button class="${state.page === k ? 'active' : ''}" data-page="${k}">
          <span>${icons[k]}</span>${k === 'home' ? escapeHtml(t('nav.homeMobile')) : escapeHtml(names[k])}
        </button>
      `
    )
    .join('')
  document.querySelectorAll('[data-page]').forEach(
    b =>
      (b.onclick = () => {
        state.page = b.dataset.page
        render()
        scrollTo(0, 0)
      })
  )
}

function empty(title, desc, icon = icons.empty) {
  return `
    <div class="empty">
      <div class="empty-icon">${icon}</div>
      <b>${title}</b>
      <p>${desc}</p>
    </div>
  `
}

function monthControl() {
  return `
    <div class="filter-row">
      <button class="icon-btn" id="prev-month">‹</button>
      <strong style="font-size:13px;min-width:130px;text-align:center">${monthLabel(state.month)}</strong>
      <button class="icon-btn" id="next-month">›</button>
    </div>
  `
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function startOfWeek(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoDate(d)
}

function shiftDate(dateKey, days) {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

function periodToolbar(label, minWidth = '130px') {
  return `
    <div class="toolbar period-toolbar">
      <div class="filter-row">
        <button class="icon-btn" id="prev-tx-period">‹</button>
        <strong style="font-size:13px;min-width:${minWidth};text-align:center">${label}</strong>
        <button class="icon-btn" id="next-tx-period">›</button>
      </div>
    </div>
  `
}

function txPeriodControl() {
  if (state.txSearchPeriod === 'all') return ''
  if (state.txSearchPeriod === 'week') {
    const weekStart = state.txSearchWeekStart || startOfWeek(today()),
      weekEnd = shiftDate(weekStart, 6)
    return periodToolbar(
      `${escapeHtml(displayDate(weekStart))} - ${escapeHtml(displayDate(weekEnd))}`,
      '210px'
    )
  }
  if (state.txSearchPeriod === 'year')
    return periodToolbar(state.txSearchYear || today().slice(0, 4))
  return periodToolbar(monthLabel(state.month))
}

function bindMonth() {
  const shift = d => {
    state.month = shiftMonth(state.month, d)
    render()
  }
  $('#prev-month')?.addEventListener('click', () => shift(-1))
  $('#next-month')?.addEventListener('click', () => shift(1))
}

function bindTxPeriod() {
  const shift = d => {
    if (state.txSearchPeriod === 'week')
      state.txSearchWeekStart = shiftDate(state.txSearchWeekStart || startOfWeek(today()), d * 7)
    else if (state.txSearchPeriod === 'year')
      state.txSearchYear = String(Number(state.txSearchYear || today().slice(0, 4)) + d)
    else state.month = shiftMonth(state.month, d)
    render()
  }
  $('#prev-tx-period')?.addEventListener('click', () => shift(-1))
  $('#next-tx-period')?.addEventListener('click', () => shift(1))
}

function accountSelect(id = 'account-filter') {
  const options = orderedAccounts(state.accounts.filter(isSelectableAccount))
    .map(
      a =>
        `<option value="${a.id}" ${state.accountFilter === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`
    )
    .join('')
  return `
    <select class="select" id="${id}">
      <option value="all">${escapeHtml(t('common.allAccounts'))}</option>
      ${options}
    </select>
  `
}

function orderedAccounts(items) {
  const typeOrder = accountTypeOrder()
  const typeRank = type => {
    const rank = typeOrder.indexOf(type || 'Other')
    return rank < 0 ? typeOrder.length : rank
  }
  return items.slice().sort((a, b) => {
    const orderA = Number.isFinite(Number(a.sortOrder))
      ? Number(a.sortOrder)
      : Number.MAX_SAFE_INTEGER
    const orderB = Number.isFinite(Number(b.sortOrder))
      ? Number(b.sortOrder)
      : Number.MAX_SAFE_INTEGER
    return (
      typeRank(a.type) - typeRank(b.type) ||
      orderA - orderB ||
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    )
  })
}

function accountTypeOrder() {
  const defaults = ACCOUNT_TYPES
  const saved = getSetting('accountTypeOrder', [])
  const custom = state.accounts
    .map(a => a.type || 'Other')
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return [
    ...new Set([
      ...(Array.isArray(saved) ? saved.filter(type => typeof type === 'string' && type) : []),
      ...defaults,
      ...custom,
    ]),
  ]
}

function accountGroups(items) {
  const groups = new Map()
  for (const item of orderedAccounts(items)) {
    const type = item.type || 'Other'
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push(item)
  }
  const typeOrder = accountTypeOrder()
  return [...groups.entries()].sort(([a], [b]) => typeOrder.indexOf(a) - typeOrder.indexOf(b))
}

async function moveAccountType(type, direction, archived) {
  if (direction !== -1 && direction !== 1) return
  const displayed = accountGroups(state.accounts.filter(a => Boolean(a.archived) === archived)).map(
    ([name]) => name
  )
  const index = displayed.indexOf(type),
    next = index + direction
  if (index < 0 || next < 0 || next >= displayed.length) return
  const order = accountTypeOrder(),
    from = order.indexOf(type),
    to = order.indexOf(displayed[next])
  ;[order[from], order[to]] = [order[to], order[from]]
  await put('settings', { id: 'accountTypeOrder', value: order })
  await reload()
}

function compareTransactionsNewestFirst(a, b) {
  const timeKey = value => String(value || '00:00').padEnd(8, ':00')
  return (
    String(b.date || '').localeCompare(String(a.date || '')) ||
    timeKey(b.time).localeCompare(timeKey(a.time)) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')) ||
    String(b.id || '').localeCompare(String(a.id || ''))
  )
}

function transactionDayLabel(dateKey) {
  const key = String(dateKey || '')
  if (!key) return ''
  const todayKey = today()
  if (key === todayKey) return t('transactions.list.dayToday')
  if (key === shiftDate(todayKey, -1)) return t('transactions.list.dayYesterday')
  const weekday = new Intl.DateTimeFormat(localeTag(), { weekday: 'long' }).format(
    new Date(key + 'T12:00:00')
  )
  return t('transactions.list.dayDate', { weekday, date: displayDate(key) })
}

function renderTransactionRow(item, { hideDate = false } = {}) {
  const a = account(item.accountId),
    c = cat(item.categoryId),
    description = String(item.description ?? item.note ?? '').trim(),
    payee = String(item.payee ?? item.place ?? '').trim(),
    categoryName = item.categoryId ? categoryLabel(item.categoryId, item.subcategoryId) : '',
    label =
      payee ||
      (item.type === 'transfer'
        ? txTypeLabel('transfer')
        : categoryName || txTypeLabel(item.type)),
    currency = a?.currency || 'EUR',
    equivalent = currency !== base() ? money(convertedTransactionAmount(item), base()) : '',
    accountDetail =
      item.type === 'transfer'
        ? `${a?.name || t('transactions.list.unknownAccount')} → ${account(item.toAccountId)?.name || t('transactions.list.unknownAccount')}`
        : a?.name || t('transactions.list.unknownAccount'),
    detail = [
      item.time && displayTime(item.time),
      accountDetail,
      item.type !== 'transfer' && categoryName,
      !hideDate && displayDate(item.date),
      equivalent && t('transactions.list.equivalent', { amount: equivalent }),
    ]
      .filter(Boolean)
      .join(' · '),
    descriptionOpen = state.activeTxDescription === item.id,
    descriptionBadge = description
      ? `
        <button
          class="tx-note-badge ${descriptionOpen ? 'open' : ''}"
          type="button"
          data-tx-description="${item.id}"
          aria-expanded="${descriptionOpen ? 'true' : 'false'}"
        >
          ${escapeHtml(t('transactions.list.note'))}
        </button>
      `
      : '',
    descriptionPopover =
      description && descriptionOpen
        ? `<div class="tx-note-popover">${escapeHtml(description)}</div>`
        : '',
    hasSplits = item.type !== 'transfer' && item.splits?.length > 0,
    splitOpen = state.activeTxSplit === item.id,
    splitDetailsId = `tx-splits-${escapeHtml(item.id)}`,
    splitBadge = hasSplits
      ? `
        <button
          class="tx-note-badge tx-split-badge ${splitOpen ? 'open' : ''}"
          type="button"
          data-tx-splits="${escapeHtml(item.id)}"
          aria-expanded="${splitOpen}"
          aria-controls="${splitDetailsId}"
        >
          ${escapeHtml(t('transactions.list.split'))}
        </button>
      `
      : '',
    splitDetails = hasSplits
      ? `
        <div class="tx-note-popover tx-split-details" id="${splitDetailsId}" ${splitOpen ? '' : 'hidden'}>
          ${item.splits
            .map(
              split => `
            <div class="tx-split-line">
              <span>${escapeHtml(categoryLabel(split.categoryId, split.subcategoryId))}</span>
              <span class="tx-split-amount">${money(split.amount, currency)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
      : ''
  return `
    <div class="transaction">
      <div class="tx-icon">${item.type === 'transfer' ? icons.transfer : hasSplits ? splitTransactionIcon : c?.icon || '◈'}</div>
      <div class="tx-main">
        <b><span>${escapeHtml(label)}</span>${descriptionBadge}${splitBadge}</b>
        <small>${escapeHtml(detail)}</small>
        ${descriptionPopover}${splitDetails}
      </div>
      <div class="tx-amount ${item.type}">
        ${item.type === 'expense' ? '−' : item.type === 'income' ? '+' : ''}${fmt(item.amount, currency)}
      </div>
      <div class="tx-actions">
        <button class="mini-btn" data-edit-tx="${item.id}" title="${escapeHtml(t('transactions.list.editTitle'))}">✎</button>
      </div>
    </div>
  `
}

function txList(items, { groupByDay = false } = {}) {
  if (!items.length)
    return empty(
      t('transactions.list.empty.title'),
      t('transactions.list.empty.desc'),
      '↗'
    )
  if (!groupByDay) return items.map(item => renderTransactionRow(item)).join('')
  const parts = []
  let currentDate = null
  for (const item of items) {
    const dateKey = String(item.date || '')
    if (dateKey !== currentDate) {
      currentDate = dateKey
      const label = transactionDayLabel(dateKey)
      parts.push(
        `<div class="tx-day-separator" role="separator" aria-label="${escapeHtml(label)}"><span>${escapeHtml(label)}</span></div>`
      )
    }
    parts.push(renderTransactionRow(item, { hideDate: true }))
  }
  return parts.join('')
}

function spendingByCategory(items) {
  const map = new Map()
  for (const t of items.filter(t => t.type === 'expense')) {
    const splits = t.splits?.length
      ? t.splits
      : [
          {
            categoryId: t.categoryId,
            subcategoryId: t.subcategoryId,
            amount: t.amount,
          },
        ]
    for (const s of splits) {
      const id = s.subcategoryId ? `${s.categoryId}:${s.subcategoryId}` : s.categoryId || 'other'
      map.set(
        id,
        (map.get(id) || 0) +
          convertedTransactionAmount(t, s.amount, account(t.accountId)?.currency || 'EUR')
      )
    }
  }
  return [...map]
    .map(([id, value]) => {
      const [categoryId, subcategoryId] = id.split(':')
      const c = cat(categoryId),
        s = subcat(categoryId, subcategoryId)
      return {
        name:
          categoryId === 'other'
            ? t('common.other')
            : categoryLabel(categoryId, subcategoryId),
        value,
        color: s?.color || c?.color || '#94a3b8',
      }
    })
    .sort((a, b) => b.value - a.value)
}

function donut(items) {
  const groups = spendingByCategory(items),
    sum = groups.reduce((s, x) => s + x.value, 0)
  if (!sum)
    return empty(
      t('statistics.donut.empty.title'),
      t('statistics.donut.empty.desc'),
      icons.statistics
    )
  let pct = 0
  const segments = groups
    .map(x => {
      const a = pct
      pct += (x.value / sum) * 100
      return `${x.color} ${a}% ${pct}%`
    })
    .join(',')
  const legend = groups
    .slice(0, 6)
    .map(
      x => `
        <div class="legend-item">
          <span>
            <i class="legend-dot" style="background:${x.color}"></i>${escapeHtml(x.name)}
          </span>
          <b>${Math.round((x.value / sum) * 100)}%</b>
        </div>
      `
    )
    .join('')
  return `
    <div class="chart-wrap">
      <div class="donut" style="background:conic-gradient(${segments})">
        <div class="donut-hole">
          <div>
            <strong>${money(sum, base())}</strong><br />
            <small>${escapeHtml(t('statistics.donut.totalSpent'))}</small>
          </div>
        </div>
      </div>
      <div class="legend">
        ${legend}
        <p class="form-hint">${escapeHtml(t('statistics.donut.roundingHint'))}</p>
      </div>
    </div>
  `
}

function home() {
  const ts = txs(),
    tot = totals(),
    active = orderedAccounts(state.accounts.filter(a => !a.archived)),
    total =
      state.accountFilter === 'all'
        ? active.reduce((s, a) => s + converted(balance(a), a.currency), 0)
        : balance(
            account(state.accountFilter) || {
              id: '',
              opening: 0,
            }
          )
  const cur =
    state.accountFilter === 'all' ? base() : account(state.accountFilter)?.currency || base()
  const accountRows = active.length
    ? active
        .slice(0, 4)
        .map(
          a => `
            <div class="transaction">
              <div class="tx-icon">${icons.accounts}</div>
              <div class="tx-main">
                <b>${escapeHtml(a.name)}</b>
                <small>${a.currency} · ${escapeHtml(accountTypeLabel(a.type))}</small>
              </div>
              <b>${money(balance(a), a.currency)}</b>
            </div>
          `
        )
        .join('')
    : empty(t('home.empty.noAccounts.title'), t('home.empty.noAccounts.desc'), icons.accounts)
  return `
    <div class="welcome">
      <div>
        <h2>${escapeHtml(t('home.welcome.title'))}</h2>
        <div class="muted">${escapeHtml(t('home.welcome.subtitle'))}</div>
      </div>
      <button class="btn" data-add="transaction">${escapeHtml(t('home.addTransaction'))}</button>
    </div>
    <div class="toolbar">${monthControl()}${accountSelect()}</div>
    <div class="grid summary-grid">
      <section class="balance-card">
        <div class="balance-card-heading">
          <p>${escapeHtml(t('home.totalBalance'))}</p>
          <button
            type="button"
            class="balance-privacy-toggle"
            id="toggle-total-balance"
            aria-label="${escapeHtml(totalBalanceHidden() ? t('home.showTotalBalance') : t('home.blurTotalBalance'))}"
            aria-pressed="${totalBalanceHidden()}"
          >
            ${escapeHtml(totalBalanceHidden() ? t('home.show') : t('home.hide'))}
          </button>
        </div>
        <h2 ${totalBalanceHidden() ? `aria-label="${escapeHtml(t('home.totalBalanceHidden'))}"` : ''}>
          <span
            class="${totalBalanceHidden() ? 'balance-value-blurred' : ''}"
            ${totalBalanceHidden() ? 'aria-hidden="true"' : ''}
          >
            ${money(total, cur)}
          </span>
        </h2>
        <footer>
          ${icons.accounts}
          <span>
            ${state.accountFilter === 'all' ? escapeHtml(t('home.activeAccounts', { count: active.length })) : escapeHtml(account(state.accountFilter)?.name || t('home.accountFallback'))}
            ·
            ${escapeHtml(state.accountFilter === 'all' ? t('home.estimatedBaseTotal') : t('home.nativeCurrency'))}
          </span>
        </footer>
      </section>
      <section class="stat-card">
        <span class="stat-icon">${icons.income}</span>
        <div class="label">${escapeHtml(t('home.monthlyIncome'))}</div>
        <div class="stat-value income">${money(tot.income, base())}</div>
        <div class="stat-bottom">${escapeHtml(t('home.forMonth', { month: monthLabel(state.month) }))}</div>
      </section>
      <section class="stat-card">
        <span class="stat-icon expense-icon">${icons.expense}</span>
        <div class="label">${escapeHtml(t('home.monthlyExpenses'))}</div>
        <div class="stat-value expense">${money(tot.expense, base())}</div>
        <div class="stat-bottom">${escapeHtml(t('home.forMonth', { month: monthLabel(state.month) }))}</div>
      </section>
    </div>
    <div class="section-grid">
      <section class="panel">
        <div class="panel-head">
          <h3>${escapeHtml(t('home.recentTransactions'))}</h3>
          <button class="link-btn" data-page="transactions">${escapeHtml(t('home.viewAll'))}</button>
        </div>
        ${txList(ts.slice().sort(compareTransactionsNewestFirst).slice(0, 5))}
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>${escapeHtml(t('home.spendingBreakdown'))}</h3>
          <span class="pill">${monthLabel(state.month)}</span>
        </div>
        ${donut(ts)}
      </section>
    </div>
    <div class="section-grid">
      <section class="panel">
        <div class="panel-head"><h3>${escapeHtml(t('home.quickActions'))}</h3></div>
        <div class="quick-actions">
          <button class="quick-action" data-add="expense"><span>↗</span>${escapeHtml(t('home.addExpense'))}</button>
          <button class="quick-action" data-add="income"><span>↙</span>${escapeHtml(t('home.addIncome'))}</button>
          <button class="quick-action" data-add="transfer"><span>⇄</span>${escapeHtml(t('home.transfer'))}</button>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>${escapeHtml(t('home.yourAccounts'))}</h3>
          <button class="link-btn" data-page="accounts">${escapeHtml(t('home.manageAccounts'))}</button>
        </div>
        ${accountRows}
      </section>
    </div>
  `
}

function transactionSearchModel() {
  const typeOptions = [
    ['all', t('transactions.filter.allTypes')],
    ['income', t('transactions.filter.income')],
    ['expense', t('transactions.filter.expenses')],
    ['transfer', t('transactions.filter.transfers')],
  ]
  const typeFilter = typeOptions.some(([value]) => value === state.txTypeFilter)
    ? state.txTypeFilter
    : 'all'
  const rawSearch = state.txSearch.trim()
  const query = rawSearch.length >= 2 ? rawSearch.toLocaleLowerCase() : ''
  const searchPeriodOptions = [
    ['month', t('transactions.period.monthly')],
    ['week', t('transactions.period.weekly')],
    ['year', t('transactions.period.yearly')],
    ['all', t('transactions.period.allHistory')],
  ]
  const categoryGroups = ['expense', 'income'].map(type => ({
    type,
    label:
      type === 'expense'
        ? t('transactions.categoryGroup.expense')
        : t('transactions.categoryGroup.income'),
    items: state.categories.filter(c => c.type === type).sort(sortByOrderThenName),
  }))
  const categoryFilterKey = (categoryId, subcategoryId = '') =>
    subcategoryId ? `sub:${categoryId}:${subcategoryId}` : `cat:${categoryId}`
  const categoryFilterOptions = categoryGroups.flatMap(group =>
    group.items.flatMap(c => [
      { key: categoryFilterKey(c.id), categoryId: c.id },
      ...(c.subcategories || []).map(s => ({
        key: categoryFilterKey(c.id, s.id),
        categoryId: c.id,
        subcategoryId: s.id,
      })),
    ])
  )
  const validCategoryKeys = new Set(categoryFilterOptions.map(option => option.key))
  const selectedCategoryKeys = new Set(
    (state.txCategoryFilters || []).filter(key => validCategoryKeys.has(key))
  )
  state.txCategoryFilters = [...selectedCategoryKeys]
  const expandedCategoryIds = new Set(
    (state.txExpandedCategories || []).filter(id =>
      categoryFilterOptions.some(option => option.categoryId === id && option.subcategoryId)
    )
  )
  state.txExpandedCategories = [...expandedCategoryIds]
  const expandedCategoryGroups = new Set(
    (state.txExpandedCategoryGroups || []).filter(type => ['expense', 'income'].includes(type))
  )
  state.txExpandedCategoryGroups = [...expandedCategoryGroups]
  const categoryMatches = item => {
    if (typeFilter === 'transfer' || !selectedCategoryKeys.size) return true
    const matches = entry =>
      selectedCategoryKeys.has(categoryFilterKey(entry.categoryId)) ||
      selectedCategoryKeys.has(categoryFilterKey(entry.categoryId, entry.subcategoryId))
    if (item.splits?.length) return item.splits.some(matches)
    return matches(item)
  }
  if (!state.txSearchWeekStart) state.txSearchWeekStart = startOfWeek(today())
  if (!state.txSearchYear) state.txSearchYear = today().slice(0, 4)
  const weekStart = state.txSearchWeekStart,
    weekEnd = shiftDate(weekStart, 6),
    yearKey = state.txSearchYear
  const inSearchPeriod = item =>
    state.txSearchPeriod === 'all' ||
    (state.txSearchPeriod === 'year'
      ? item.date?.startsWith(yearKey)
      : state.txSearchPeriod === 'week'
        ? item.date >= weekStart && item.date <= weekEnd
        : item.date?.startsWith(state.month))
  const baseItems = state.transactions.filter(
    item =>
      (typeFilter === 'all' || item.type === typeFilter) &&
      inSearchPeriod(item) &&
      (state.accountFilter === 'all' ||
        item.accountId === state.accountFilter ||
        item.toAccountId === state.accountFilter)
  )
  const matchedItems = baseItems.filter(
    item =>
      (!query ||
        [item.payee, item.place, item.description, item.note].some(value =>
          String(value || '')
            .toLocaleLowerCase()
            .includes(query)
        )) &&
      categoryMatches(item)
  )
  const hasSearchFilters = Boolean(query || selectedCategoryKeys.size || typeFilter !== 'all')
  const sortedItems = matchedItems.slice().sort(compareTransactionsNewestFirst)
  const items =
    state.txSearchPeriod === 'all' && !hasSearchFilters ? sortedItems.slice(0, 250) : sortedItems
  const periodLabel =
    searchPeriodOptions.find(([value]) => value === state.txSearchPeriod)?.[1] ||
    t('transactions.period.monthly')
  const typeSummary =
    typeFilter !== 'all' ? ` · ${typeOptions.find(([value]) => value === typeFilter)[1]}` : ''
  const categorySummary =
    typeFilter !== 'transfer' && selectedCategoryKeys.size
      ? ` · ${selectedCategoryKeys.size} ${selectedCategoryKeys.size === 1 ? t('transactions.categoryFilter.one') : t('transactions.categoryFilter.many')}`
      : ''
  const resultText = hasSearchFilters
    ? t('transactions.results.matching', {
        count: matchedItems.length,
        period: periodLabel,
        typeSummary,
        categorySummary,
      })
    : rawSearch
      ? t('transactions.results.minChars', { period: periodLabel })
      : state.txSearchPeriod === 'all'
        ? t('transactions.results.latest', {
            shown: items.length,
            total: matchedItems.length,
          })
        : t('transactions.results.period', { period: periodLabel })
  const clearSearchHtml =
    selectedCategoryKeys.size || rawSearch || typeFilter !== 'all'
      ? `<button class="link-btn" id="tx-clear-search">${escapeHtml(t('transactions.search.clear'))}</button>`
      : ''
  return {
    typeOptions,
    typeFilter,
    rawSearch,
    searchPeriodOptions,
    categoryGroups,
    categoryFilterKey,
    selectedCategoryKeys,
    expandedCategoryIds,
    expandedCategoryGroups,
    items,
    resultText,
    clearSearchHtml,
  }
}

function bindTransactionResultInteractions() {
  document.querySelectorAll('[data-tx-splits]').forEach(button =>
    button.addEventListener('click', e => {
      const id = e.currentTarget.dataset.txSplits
      state.activeTxSplit = state.activeTxSplit === id ? '' : id
      render()
      ;[...document.querySelectorAll('[data-tx-splits]')]
        .find(next => next.dataset.txSplits === id)
        ?.focus({ preventScroll: true })
    })
  )
  document.querySelectorAll('[data-tx-description]').forEach(button =>
    button.addEventListener('click', e => {
      const id = e.currentTarget.dataset.txDescription
      state.activeTxDescription = state.activeTxDescription === id ? '' : id
      render()
    })
  )
  // Search refresh replaces list rows without a full render(); rebind edit here too.
  document.querySelectorAll('[data-edit-tx]').forEach(
    button =>
      (button.onclick = () =>
        transactionModal(state.transactions.find(tx => tx.id === button.dataset.editTx)))
  )
}

function clearTransactionSearch() {
  state.txSearch = ''
  state.txTypeFilter = 'all'
  state.txCategoryFilters = []
  state.txSearchPeriod = 'month'
  render()
}

function refreshTransactionSearchResults() {
  if (state.page !== 'transactions') return false
  const status = $('#tx-search-status')
  const list = $('#tx-results')
  if (!status || !list) return false
  const model = transactionSearchModel()
  status.textContent = model.resultText
  list.innerHTML = txList(model.items, { groupByDay: true })
  const clearSlot = $('#tx-clear-search-slot')
  if (clearSlot) {
    clearSlot.innerHTML = model.clearSearchHtml
    $('#tx-clear-search')?.addEventListener('click', clearTransactionSearch)
  }
  const periodSelect = $('#tx-search-period')
  if (periodSelect) periodSelect.value = state.txSearchPeriod
  const periodNav = $('#tx-period-nav')
  if (periodNav) {
    periodNav.innerHTML = txPeriodControl()
    bindTxPeriod()
  }
  const filtersToggle = $('#tx-toggle-filters')
  if (filtersToggle) {
    const activeFilterCount =
      (model.typeFilter !== 'all' ? 1 : 0) +
      (state.accountFilter !== 'all' ? 1 : 0) +
      model.selectedCategoryKeys.size
    const filtersExpanded = state.txSearchFiltersExpanded === true
    const hint = filtersExpanded
      ? t('transactions.search.hideFilters')
      : activeFilterCount
        ? t('transactions.search.filtersActive', { count: activeFilterCount })
        : t('transactions.search.showFilters')
    const hintEl = filtersToggle.querySelector('small')
    if (hintEl) hintEl.textContent = hint
  }
  bindTransactionResultInteractions()
  return true
}

function transactions() {
  const {
    typeOptions,
    typeFilter,
    searchPeriodOptions,
    categoryGroups,
    categoryFilterKey,
    selectedCategoryKeys,
    expandedCategoryIds,
    expandedCategoryGroups,
    items,
    resultText,
    clearSearchHtml,
  } = transactionSearchModel()
  const categoryBadge = option => `
    <label
      class="category-check ${option.isSubcategory ? 'subcategory' : ''} ${selectedCategoryKeys.has(option.key) ? 'selected' : ''}"
    >
      <input
        type="checkbox"
        data-tx-category="${escapeHtml(option.key)}"
        ${selectedCategoryKeys.has(option.key) ? 'checked' : ''}
      />
      <span style="--category-color:${option.color}">${escapeHtml(option.icon)}</span>${escapeHtml(option.label)}
    </label>
  `
  const renderCategory = c => {
    const subcategories = (c.subcategories || []).slice().sort(sortByOrderThenName)
    const expanded = expandedCategoryIds.has(c.id)
    const parent = categoryBadge({
      key: categoryFilterKey(c.id),
      label: c.name,
      icon: c.icon || '◈',
      color: c.color || '#3479f4',
    })
    const expand = subcategories.length
      ? `
        <button
          class="category-expand ${expanded ? 'open' : ''}"
          data-tx-category-expand="${c.id}"
          type="button"
          title="${escapeHtml(expanded ? t('transactions.hideSubcategories') : t('transactions.showSubcategories'))}"
        >
          ${expanded ? '−' : '+'}
        </button>
      `
      : ''
    const children = expanded
      ? `
        <div class="subcategory-options">
          ${subcategories
            .map(s =>
              categoryBadge({
                key: categoryFilterKey(c.id, s.id),
                label: s.name,
                icon: s.icon || c.icon || '◦',
                color: s.color || c.color || '#3479f4',
                isSubcategory: true,
              })
            )
            .join('')}
        </div>
      `
      : ''
    return `
      <div class="category-filter-item">
        <div class="category-main">${parent}${expand}</div>
        ${children}
      </div>
    `
  }
  const renderGroup = group => {
    const expanded = expandedCategoryGroups.has(group.type)
    const count = group.items.reduce((sum, c) => sum + 1 + (c.subcategories?.length || 0), 0)
    const options = expanded
      ? `
        <div class="category-filter-options">
          ${group.items.length ? group.items.map(renderCategory).join('') : `<p class="form-hint">${escapeHtml(t('transactions.noCategories'))}</p>`}
        </div>
      `
      : ''
    return `
      <div class="category-filter-group ${expanded ? 'open' : ''}">
        <button class="category-group-toggle" data-tx-category-group="${group.type}" type="button">
          <span>${group.label}</span>
          <small>${escapeHtml(count === 1 ? t('transactions.categoryFilter.one', { count }) : t('transactions.categoryFilter.many', { count }))}</small>
          <b>${expanded ? '−' : '+'}</b>
        </button>
        ${options}
      </div>
    `
  }
  const typeSelectOptions = typeOptions
    .map(
      ([value, label]) =>
        `<option value="${value}" ${typeFilter === value ? 'selected' : ''}>${label}</option>`
    )
    .join('')
  const periodSelectOptions = searchPeriodOptions
    .map(
      ([value, label]) =>
        `<option value="${value}" ${state.txSearchPeriod === value ? 'selected' : ''}>${label}</option>`
    )
    .join('')
  const categoryFilter =
    typeFilter === 'transfer'
      ? ''
      : `
        <div class="category-filter">
          <span>${escapeHtml(t('transactions.filter.categories'))}</span>
          <div class="category-filter-groups">${categoryGroups.map(renderGroup).join('')}</div>
        </div>
      `
  const filtersExpanded = state.txSearchFiltersExpanded === true
  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (state.accountFilter !== 'all' ? 1 : 0) +
    selectedCategoryKeys.size
  const filtersToggleHint = filtersExpanded
    ? t('transactions.search.hideFilters')
    : activeFilterCount
      ? t('transactions.search.filtersActive', { count: activeFilterCount })
      : t('transactions.search.showFilters')
  return `
    <div class="toolbar">
      <div>
        <h2>${escapeHtml(t('transactions.title'))}</h2>
        <p class="muted">${escapeHtml(t('transactions.subtitle'))}</p>
      </div>
      <button class="btn" data-add="transaction">${escapeHtml(t('transactions.newTransaction'))}</button>
    </div>
    <section class="search-panel ${filtersExpanded ? 'filters-open' : ''}">
      <div class="search-panel-head">
        <h3>${escapeHtml(t('transactions.search.title'))}</h3>
        <p>${escapeHtml(t('transactions.search.subtitle'))}</p>
      </div>
      <div class="search-grid">
        <label class="search-field search-query">
          <span>${escapeHtml(t('transactions.search.label'))}</span>
          <input
            id="tx-search"
            type="search"
            value="${escapeHtml(state.txSearch)}"
            placeholder="${escapeHtml(t('transactions.search.placeholder'))}"
          />
        </label>
        <button
          type="button"
          class="search-filters-toggle"
          id="tx-toggle-filters"
          aria-expanded="${filtersExpanded ? 'true' : 'false'}"
          aria-controls="tx-search-filters"
        >
          <span>${escapeHtml(t('transactions.search.filters'))}</span>
          <small>${escapeHtml(filtersToggleHint)}</small>
          <b aria-hidden="true">${filtersExpanded ? '−' : '+'}</b>
        </button>
        <div class="search-filters" id="tx-search-filters">
          <label class="search-field">
            <span>${escapeHtml(t('transactions.filter.type'))}</span>
            <select id="tx-type-filter">${typeSelectOptions}</select>
          </label>
          <label class="search-field search-period">
            <span>${escapeHtml(t('transactions.filter.period'))}</span>
            <select id="tx-search-period">${periodSelectOptions}</select>
          </label>
          <label class="search-field">
            <span>${escapeHtml(t('transactions.filter.account'))}</span>
            ${accountSelect()}
          </label>
        </div>
      </div>
      ${categoryFilter}
      <div id="tx-clear-search-slot" class="search-clear-slot">${clearSearchHtml}</div>
    </section>
    <div id="tx-period-nav">${txPeriodControl()}</div>
    <p class="form-hint" id="tx-search-status">${escapeHtml(resultText)}</p>
    <section class="table-list" id="tx-results">${txList(items, { groupByDay: true })}</section>
  `
}

function statistics() {
  const ts = txs(),
    tot = totals()
  const filterLabel =
    state.accountFilter === 'all'
      ? t('common.allAccounts')
      : account(state.accountFilter)?.name || t('statistics.selectedAccount')
  const categoryRows = spendingByCategory(ts).length
    ? spendingByCategory(ts)
        .map(
          x => `
            <div class="budget-row">
              <div class="head">
                <b>${escapeHtml(x.name)}</b>
                <b>${money(x.value, base())}</b>
              </div>
              <div class="progress">
                <span
                  style="width:${tot.expense ? Math.min(100, (x.value / tot.expense) * 100) : 0}%;background:${x.color}"
                ></span>
              </div>
            </div>
          `
        )
        .join('')
    : empty(
        t('statistics.empty.noSpending.title'),
        t('statistics.empty.noSpending.desc'),
        icons.statistics
      )
  return `
    <div class="toolbar">
      <div>
        <h2>${escapeHtml(t('statistics.title'))}</h2>
        <p class="muted">${escapeHtml(t('statistics.subtitle'))}</p>
      </div>
      <div class="filter-row">${monthControl()}${accountSelect()}</div>
    </div>
    <div class="grid summary-grid">
      <section class="balance-card">
        <p>${escapeHtml(t('statistics.netCashFlow'))}</p>
        <h2>${money(tot.income - tot.expense, base())}</h2>
        <footer>${escapeHtml(filterLabel)} · ${escapeHtml(t('statistics.incomeMinusExpenses'))}</footer>
      </section>
      <section class="stat-card">
        <div class="label">${escapeHtml(t('statistics.income'))}</div>
        <div class="stat-value income">${money(tot.income, base())}</div>
      </section>
      <section class="stat-card">
        <div class="label">${escapeHtml(t('statistics.expenses'))}</div>
        <div class="stat-value expense">${money(tot.expense, base())}</div>
      </section>
    </div>
    <div class="section-grid">
      <section class="panel">
        <div class="panel-head"><h3>${escapeHtml(t('statistics.expensesByCategory'))}</h3></div>
        ${donut(ts)}
      </section>
      <section class="panel">
        <div class="panel-head"><h3>${escapeHtml(t('statistics.categoryDetails'))}</h3></div>
        ${categoryRows}
      </section>
    </div>
    <p class="muted" style="margin-top:15px">
      ${escapeHtml(t('statistics.crossCurrencyNotice'))}
    </p>
  `
}

function accounts() {
  const active = state.accounts.filter(a => !a.archived),
    archived = state.accounts.filter(a => a.archived)
  const managementHidden = state.accountsEditing ? '' : 'hidden'
  const visibilityIcon = visible =>
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${visible ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>' : '<path d="m3 3 18 18M10.6 5.1A12 12 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 3.9M6.2 6.2A19 19 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.7M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'}</svg>`
  const archiveIcon =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v13h14V7M10 11h4"/></svg>'
  const row = (a, group, index, count) => {
    const hiddenBadge = a.archived
      ? ''
      : `
        <span
          class="account-hidden-badge${!isSelectableAccount(a) ? '' : ' account-hidden-badge-placeholder'}"
          ${!isSelectableAccount(a) ? '' : ' aria-hidden="true"'}
        >
          ${escapeHtml(t('accounts.hidden'))}
        </span>
      `
    const visibilityButton = a.archived
      ? ''
      : `
        <button
          type="button"
          class="mini-btn account-visibility"
          data-visibility="${a.id}"
          aria-label="${escapeHtml(a.visible === false ? t('accounts.showInSelectors') : t('accounts.hideFromSelectors'))}"
          title="${escapeHtml(a.visible === false ? t('accounts.showInSelectors') : t('accounts.hideFromSelectors'))}"
          aria-pressed="${isSelectableAccount(a)}"
        >
          ${visibilityIcon(isSelectableAccount(a))}
        </button>
      `
    return `
      <div class="account-row">
        <div class="tx-icon">${icons.accounts}</div>
        <div class="tx-main">
          <b>
            <span>${escapeHtml(a.name)}</span>
            ${a.archived ? `<span class="account-archived-badge">${escapeHtml(t('accounts.archived'))}</span>` : ''}
            ${hiddenBadge}
          </b>
          <small>${escapeHtml(accountTypeLabel(a.type))} · ${a.currency}</small>
        </div>
        <strong>${money(balance(a), a.currency)}</strong>
        <div class="account-actions" ${managementHidden}>
          <button
            class="mini-btn"
            data-move-account="${a.id}"
            data-direction="-1"
            title="${escapeHtml(t('accounts.moveUpInGroup', { group: accountTypeLabel(group) }))}"
            ${index === 0 ? 'disabled' : ''}
          >
            ↑
          </button>
          <button
            class="mini-btn"
            data-move-account="${a.id}"
            data-direction="1"
            title="${escapeHtml(t('accounts.moveDownInGroup', { group: accountTypeLabel(group) }))}"
            ${index === count - 1 ? 'disabled' : ''}
          >
            ↓
          </button>
          <button class="mini-btn" data-edit-account="${a.id}" title="${escapeHtml(t('accounts.editTitle'))}">✎</button>
          ${visibilityButton}
          <button
            type="button"
            class="mini-btn account-archive-button"
            data-archive="${a.id}"
            title="${escapeHtml(a.archived ? t('accounts.restore') : t('accounts.archive'))}"
            aria-label="${escapeHtml(a.archived ? t('accounts.restoreAccount') : t('accounts.archiveAccount'))}"
          >
            ${a.archived ? '↩' : archiveIcon}
          </button>
        </div>
      </div>
    `
  }
  const sections = items =>
    accountGroups(items)
      .map(
        ([type, group], index, groups) => `
          <section class="account-group">
            <div class="account-group-head">
              <h3>${escapeHtml(accountTypeLabel(type))}</h3>
              <div class="account-group-controls">
                <span>${group.length} ${escapeHtml(group.length === 1 ? t('accounts.accountCount.one') : t('accounts.accountCount.many'))}</span>
                <button
                  type="button"
                  class="mini-btn"
                  ${managementHidden}
                  data-move-account-type="${escapeHtml(type)}"
                  data-direction="-1"
                  data-archived="${Boolean(group[0].archived)}"
                  aria-label="${escapeHtml(t('accounts.moveTypeGroupUp', { type: accountTypeLabel(type) }))}"
                  title="${escapeHtml(t('accounts.moveGroupUp'))}"
                  ${index === 0 ? 'disabled' : ''}
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="mini-btn"
                  ${managementHidden}
                  data-move-account-type="${escapeHtml(type)}"
                  data-direction="1"
                  data-archived="${Boolean(group[0].archived)}"
                  aria-label="${escapeHtml(t('accounts.moveTypeGroupDown', { type: accountTypeLabel(type) }))}"
                  title="${escapeHtml(t('accounts.moveGroupDown'))}"
                  ${index === groups.length - 1 ? 'disabled' : ''}
                >
                  ↓
                </button>
              </div>
            </div>
            <div class="account-list">
              ${group.map((a, rowIndex) => row(a, type, rowIndex, group.length)).join('')}
            </div>
          </section>
        `
      )
      .join('')
  const activeSection = active.length
    ? `<div class="account-sections">${sections(active)}</div>`
    : empty(t('accounts.empty.first.title'), t('accounts.empty.first.desc'), icons.accounts)
  const archivedSection = archived.length
    ? `
       <details
        class="account-archive"
        id="archived-accounts"
        ${state.archivedAccountsExpanded ? 'open' : ''}
      >
        <summary>  
          <span class="account-archive-label">
            <span>${escapeHtml(t('accounts.archived.title'))}</span>
            <small>
              <span class="account-archive-expand">${escapeHtml(t('accounts.archived.expand'))}</span>
              <span class="account-archive-collapse">${escapeHtml(t('accounts.archived.collapse'))}</span>
            </small>
          </span>
          <span class="pill">${archived.length}</span>
        </summary>
        <div class="account-sections">${sections(archived)}</div>
      </details>
    `
    : ''
  return `
    <div class="toolbar">
      <div>
        <h2>${escapeHtml(t('accounts.title'))}</h2>
        <p class="muted">${escapeHtml(t('accounts.subtitle'))}</p>
      </div>
      <div class="account-toolbar-actions">
        <button
          type="button"
          class="btn secondary"
          id="toggle-account-edit"
          aria-pressed="${Boolean(state.accountsEditing)}"
        >
          ${escapeHtml(state.accountsEditing ? t('accounts.done') : t('accounts.manage'))}
        </button>
        <button class="btn" data-add="account">${escapeHtml(t('accounts.addAccount'))}</button>
      </div>
    </div>
    ${activeSection}
    ${archivedSection}
  `
}

function orderedBudgets(items) {
  return items.slice().sort((a, b) => {
    if (!a.categoryId !== !b.categoryId) return a.categoryId ? 1 : -1
    const categoryA = cat(a.categoryId),
      categoryB = cat(b.categoryId)
    if (Boolean(categoryA) !== Boolean(categoryB)) return categoryA ? -1 : 1
    return (
      sortByOrderThenName(categoryA || {}, categoryB || {}) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    )
  })
}

function more() {
  const current = orderedBudgets(state.budgets.filter(b => b.month === state.month))
  const budgetRows = current.length
    ? current
        .map(b => {
          const spent = state.transactions
            .filter(t => t.type === 'expense' && t.date.startsWith(state.month))
            .reduce(
              (s, t) =>
                s +
                (t.splits?.length
                  ? t.splits
                      .filter(x => x.categoryId === b.categoryId)
                      .reduce(
                        (a, x) =>
                          a +
                          convertedTransactionAmount(
                            t,
                            x.amount,
                            account(t.accountId)?.currency || 'EUR'
                          ),
                        0
                      )
                  : t.categoryId === b.categoryId
                    ? convertedTransactionAmount(t)
                    : 0),
              0
            )
          return `
            <div class="budget-row">
              <div class="head">
                <b>${escapeHtml(cat(b.categoryId)?.name || t('more.overallBudget'))}</b>
                <b>${money(spent, base())} / ${money(b.limit, base())}</b>
              </div>
              <div class="progress">
                <span
                  style="width:${Math.min(100, (spent / b.limit) * 100)}%;background:${spent > b.limit ? '#f16a76' : '#3479f4'}"
                ></span>
              </div>
            </div>
          `
        })
        .join('')
    : empty(t('more.empty.noBudgets.title'), t('more.empty.noBudgets.desc'), icons.budget)
  return `
    <div class="toolbar">
      <div>
        <h2>${escapeHtml(t('more.title'))}</h2>
        <p class="muted">${escapeHtml(t('more.subtitle'))}</p>
      </div>
    </div>
    <div class="settings-grid">
      <section class="settings-tile">
        <h3><span class="settings-tile-icon">${icons.budget}</span>${escapeHtml(t('more.budgets.title'))}</h3>
        <p>${escapeHtml(t('more.budgets.desc'))}</p>
        <button class="btn secondary" id="open-budgets">${escapeHtml(t('more.budgets.button'))}</button>
      </section>
      <section class="settings-tile">
        <h3><span class="settings-tile-icon">${icons.categories}</span>${escapeHtml(t('more.categories.title'))}</h3>
        <p>${escapeHtml(t('more.categories.desc'))}</p>
        <button class="btn secondary" id="open-categories">${escapeHtml(t('more.categories.button'))}</button>
      </section>
      <section class="settings-tile">
        <h3><span class="settings-tile-icon">${icons.recurring}</span>${escapeHtml(t('more.recurring.title'))}</h3>
        <p>${escapeHtml(t('more.recurring.desc'))}</p>
        <button class="btn secondary" id="open-recurring">${escapeHtml(t('more.recurring.button'))}</button>
      </section>
      <section class="settings-tile">
        <h3><span class="settings-tile-icon">${icons.settings}</span>${escapeHtml(t('more.settings.title'))}</h3>
        <p>${escapeHtml(t('more.settings.desc'))}</p>
        <button class="btn secondary" id="open-settings">${escapeHtml(t('more.settings.button'))}</button>
      </section>
    </div>
    <section class="panel" style="margin-top:20px">
      <div class="panel-head">
        <h3>${escapeHtml(t('more.budgetOverview', { month: monthLabel(state.month) }))}</h3>
        <button class="link-btn" id="budget-quick">${escapeHtml(t('more.budgetOverviewManage'))}</button>
      </div>
      ${budgetRows}
    </section>
  `
}

function render() {
  if (state.page !== 'accounts') {
    state.accountsEditing = false
    state.archivedAccountsExpanded = false
  }
  if (state.page !== 'transactions') state.txSearchFiltersExpanded = false
  if (
    state.accountFilter !== 'all' &&
    !state.accounts.some(a => a.id === state.accountFilter && isSelectableAccount(a))
  )
    state.accountFilter = 'all'
  nav()
  $('#page-title').textContent = pageNames()[state.page]
  $('#view').innerHTML = { home, transactions, statistics, accounts, more }[state.page]()
  bindMonth()
  bindTxPeriod()
  $('#archived-accounts')?.addEventListener('toggle', e => {
    if (e.currentTarget === $('#archived-accounts'))
      state.archivedAccountsExpanded = e.currentTarget.open
  })
  $('#toggle-account-edit')?.addEventListener('click', () => {
    state.accountsEditing = !state.accountsEditing
    render()
    $('#toggle-account-edit')?.focus({ preventScroll: true })
  })
  $('#toggle-total-balance')?.addEventListener('click', async e => {
    const button = e.currentTarget
    button.disabled = true
    try {
      await put('settings', { id: 'hideTotalBalance', value: !totalBalanceHidden() })
      await reload()
    } catch (error) {
      console.error(error)
      toast(t('toasts.balanceVisibilityFailed'))
      button.disabled = false
    }
  })
  $('#account-filter')?.addEventListener('change', e => {
    state.accountFilter = e.target.value
    render()
  })
  $('#tx-search')?.addEventListener('input', e => {
    const value = e.target.value,
      hadSearch = Boolean(state.txSearch.trim())
    clearTimeout(txSearchTimer)
    // Keep the focused input mounted. Full render() remounts it and drops fast iOS keystrokes.
    if (!value.trim()) {
      state.txSearch = ''
      if (hadSearch) state.txSearchPeriod = 'month'
      if (!refreshTransactionSearchResults()) render()
      return
    }
    txSearchTimer = setTimeout(() => {
      const live = $('#tx-search')
      const latest = live ? live.value : value
      if (!latest.trim()) {
        state.txSearch = ''
        if (hadSearch) state.txSearchPeriod = 'month'
        if (!refreshTransactionSearchResults()) render()
        return
      }
      const startingSearch = !state.txSearch.trim()
      state.txSearch = latest
      if (startingSearch) state.txSearchPeriod = 'all'
      if (!refreshTransactionSearchResults()) render()
    }, 350)
  })
  $('#tx-toggle-filters')?.addEventListener('click', () => {
    state.txSearchFiltersExpanded = !state.txSearchFiltersExpanded
    render()
    $('#tx-toggle-filters')?.focus({ preventScroll: true })
  })
  $('#tx-type-filter')?.addEventListener('change', e => {
    state.txTypeFilter = e.target.value
    if (state.txTypeFilter === 'transfer') state.txCategoryFilters = []
    render()
  })
  $('#tx-search-period')?.addEventListener('change', e => {
    state.txSearchPeriod = e.target.value
    if (state.txSearchPeriod === 'week' && !state.txSearchWeekStart)
      state.txSearchWeekStart = startOfWeek(today())
    if (state.txSearchPeriod === 'year' && !state.txSearchYear)
      state.txSearchYear = today().slice(0, 4)
    render()
  })
  document.querySelectorAll('[data-tx-category]').forEach(input =>
    input.addEventListener('change', e => {
      const selected = new Set(state.txCategoryFilters || [])
      const key = e.target.dataset.txCategory
      const [, categoryId] = key.split(':')
      if (e.target.checked) {
        if (key.startsWith('cat:')) {
          ;[...selected]
            .filter(item => item.startsWith(`sub:${categoryId}:`))
            .forEach(item => selected.delete(item))
          selected.add(key)
        } else {
          selected.delete(`cat:${categoryId}`)
          selected.add(key)
        }
      } else {
        selected.delete(key)
      }
      state.txCategoryFilters = [...selected]
      render()
    })
  )
  document.querySelectorAll('[data-tx-category-expand]').forEach(button =>
    button.addEventListener('click', e => {
      const expanded = new Set(state.txExpandedCategories || []),
        id = e.currentTarget.dataset.txCategoryExpand
      if (expanded.has(id)) expanded.delete(id)
      else expanded.add(id)
      state.txExpandedCategories = [...expanded]
      render()
    })
  )
  document.querySelectorAll('[data-tx-category-group]').forEach(button =>
    button.addEventListener('click', e => {
      const expanded = new Set(state.txExpandedCategoryGroups || []),
        type = e.currentTarget.dataset.txCategoryGroup
      if (expanded.has(type)) expanded.delete(type)
      else expanded.add(type)
      state.txExpandedCategoryGroups = [...expanded]
      render()
    })
  )
  bindTransactionResultInteractions()
  $('#tx-clear-search')?.addEventListener('click', clearTransactionSearch)
  document.querySelectorAll('[data-page]').forEach(
    b =>
      (b.onclick = () => {
        state.page = b.dataset.page
        render()
      })
  )
  document.querySelectorAll('[data-add]').forEach(
    b =>
      (b.onclick = () => {
        if (b.dataset.add === 'account') accountModal()
        else transactionModal(null, b.dataset.add === 'transaction' ? 'expense' : b.dataset.add)
      })
  )
  document
    .querySelectorAll('[data-edit-account]')
    .forEach(b => (b.onclick = () => accountModal(account(b.dataset.editAccount))))
  document.querySelectorAll('[data-move-account-type]').forEach(
    button =>
      (button.onclick = async () => {
        button.disabled = true
        try {
          await moveAccountType(
            button.dataset.moveAccountType,
            Number(button.dataset.direction),
            button.dataset.archived === 'true'
          )
        } catch (error) {
          console.error(error)
          toast(t('toasts.accountTypeOrderFailed'))
          button.disabled = false
        }
      })
  )
  document.querySelectorAll('[data-move-account]').forEach(
    b =>
      (b.onclick = async () => {
        const current = account(b.dataset.moveAccount)
        if (!current) return
        const items = orderedAccounts(
          state.accounts.filter(
            a => a.type === current.type && Boolean(a.archived) === Boolean(current.archived)
          )
        )
        const index = items.findIndex(a => a.id === current.id),
          next = index + Number(b.dataset.direction)
        if (next < 0 || next >= items.length) return
        ;[items[index], items[next]] = [items[next], items[index]]
        await Promise.all(items.map((item, sortOrder) => put('accounts', { ...item, sortOrder })))
        await reload()
      })
  )
  document.querySelectorAll('[data-visibility]').forEach(
    button =>
      (button.onclick = async () => {
        const current = account(button.dataset.visibility)
        if (!current || current.archived) return
        button.disabled = true
        try {
          await put('accounts', { ...current, visible: current.visible === false })
          await reload()
        } catch (error) {
          console.error(error)
          toast(t('toasts.accountVisibilityFailed'))
          button.disabled = false
        }
      })
  )
  document.querySelectorAll('[data-archive]').forEach(
    b =>
      (b.onclick = async () => {
        const a = account(b.dataset.archive)
        const archived = !a.archived
        confirmAction({
          title: archived ? t('accounts.confirm.archiveTitle') : t('accounts.confirm.restoreTitle'),
          message: archived
            ? t('accounts.confirm.archiveMessage', { name: a.name })
            : t('accounts.confirm.restoreMessage', { name: a.name }),
          confirmText: archived
            ? t('accounts.confirm.archiveButton')
            : t('accounts.confirm.restoreButton'),
          onCancel: closeModal,
          onConfirm: async () => {
            await put('accounts', { ...a, archived, visible: !archived })
            closeModal()
            await reload()
          },
        })
      })
  )
  $('#open-categories')?.addEventListener('click', categoriesModal)
  $('#open-budgets')?.addEventListener('click', budgetsModal)
  $('#budget-quick')?.addEventListener('click', budgetsModal)
  $('#open-recurring')?.addEventListener('click', recurringModal)
  $('#open-settings')?.addEventListener('click', settingsModal)
  applyShellI18n()
}
