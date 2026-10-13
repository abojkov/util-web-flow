function modal(title, body) {
    $('#modal-root').innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="close" id="close-modal" aria-label="Close">×</button></div><div class="modal-body">${body}</div></div></div>`;
    $('#close-modal').onclick = closeModal
  }

  function closeModal() {
    $('#modal-root').innerHTML = ''
  }

  function confirmAction({title, message, confirmText = 'Confirm', onConfirm, onCancel = closeModal}) {
    modal(title, `<p class="notice">${escapeHtml(message)}</p><div class="modal-footer"><button type="button" class="btn ghost" id="confirm-cancel">Cancel</button><button type="button" class="btn danger" id="confirm-ok">${escapeHtml(confirmText)}</button></div>`);
    $('#confirm-cancel').onclick = onCancel;
    $('#confirm-ok').onclick = async () => {
      await onConfirm();
    }
  }

  function toast(s) {
    $('#toast-root').innerHTML = `<div class="toast">${escapeHtml(s)}</div>`;
    setTimeout(() => {
      $('#toast-root').innerHTML = ''
    }, 3500)
  }

  const currencies = ['EUR', 'USD', 'GBP', 'MKD', 'CHF', 'SEK'];

  function currencyOptions(current) {
    return currencies.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('')
  }

  function exchangeRateRows() {
    const configured = exchangeRates();
    const editable = usedCurrencies().length ? usedCurrencies() : currencies;
    return editable.map(currency => `<div class="rate-row"><label><span>${currency}</span><small>1 EUR =</small></label><input class="rate-input" name="${currency}" type="number" min="0.000001" step="0.000001" value="${configured[currency] ?? ''}" ${currency === 'EUR' ? 'readonly' : ''}><b>${currency}</b></div>`).join('')
  }

  function payeeAutocompleteInput(value = '', id = 'payee-input') {
    return `<div class="payee-autocomplete"><input id="${id}" name="payee" autocomplete="off" maxlength="120" value="${escapeHtml(value)}" placeholder="Merchant, person, ATM, or place"><div class="payee-suggestions" data-payee-suggestions hidden></div></div>`
  }

  function bindPayeeAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const panel = input.closest('.payee-autocomplete')?.querySelector('[data-payee-suggestions]');
    if (!panel) return;
    const options = payeeOptions();
    const hide = () => {
      panel.hidden = true;
      panel.innerHTML = ''
    };
    const show = () => {
      const query = input.value.trim().toLocaleLowerCase();
      if (!query) return hide();
      const matches = options.filter(payee => payee.toLocaleLowerCase().includes(query) && payee !== input.value).slice(0, 8);
      if (!matches.length) return hide();
      panel.innerHTML = matches.map(payee => `<button type="button" data-payee="${escapeHtml(payee)}">${escapeHtml(payee)}</button>`).join('');
      panel.hidden = false
    };
    input.addEventListener('input', show);
    input.addEventListener('focus', show);
    panel.addEventListener('pointerdown', e => {
      const option = e.target.closest('[data-payee]');
      if (!option) return;
      input.value = option.dataset.payee;
      hide();
      input.focus()
    });
    document.addEventListener('pointerdown', e => {
      if (!input.closest('.payee-autocomplete').contains(e.target)) hide()
    });
    input.form?.addEventListener('submit', hide)
  }

  function accountModal(a) {
    modal(a ? 'Edit account' : 'New account', `<form id="account-form"><div class="field"><label>Account name</label><input name="name" required maxlength="70" value="${escapeHtml(a?.name || '')}" placeholder="e.g. Main bank account"></div><div class="field-row"><div class="field"><label>Account type</label><select name="type">${['Bank', 'Cash', 'Savings', 'Investment', 'Loan', 'Other'].map(x => `<option ${a?.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>Currency</label><select name="currency" ${a ? 'disabled' : ''}>${currencyOptions(a?.currency || base())}</select></div></div><div class="field"><label>Opening balance</label><input type="number" step="0.01" name="opening" value="${a?.opening ?? 0}" required></div><div class="notice">Opening balances are used to calculate your balance. Currency cannot be changed after account creation.</div><div class="modal-footer"><button class="btn ghost" type="button" id="cancel">Cancel</button><button class="btn" type="submit">Save account</button></div></form>`);
    $('#cancel').onclick = closeModal;
    $('#account-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      await put('accounts', {
        id: a?.id || uid(),
        name: f.get('name').trim(),
        type: f.get('type'),
        currency: a?.currency || f.get('currency'),
        opening: amount(f.get('opening')),
        archived: a?.archived || false
      });
      closeModal();
      await reload();
      toast('Account saved')
    }
  }

  function transactionModal(t, initial = 'expense') {
    const active = state.accounts.filter(a => !a.archived);
    if (!active.length) {
      toast('Create an account first');
      return accountModal()
    }
    const type = t?.type || initial;
    const accountOpts = (sel) => active.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${escapeHtml(a.name)} (${a.currency})</option>`).join('');
    modal(t ? 'Edit transaction' : 'New transaction', `<form id="tx-form"><div class="segmented">${['expense', 'income', 'transfer'].map(x => `<button type="button" data-type="${x}" class="${x === type ? 'active' : ''}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div><div class="field-row"><div class="field"><label>Amount</label><input id="tx-amount" type="number" name="amount" min="0.01" step="0.01" value="${t?.amount ?? ''}" required placeholder="0.00"></div><div class="field"><label>Date</label><input type="date" name="date" value="${t?.date || today()}" required></div></div><div class="field-row"><div class="field"><label>Time</label><input type="time" name="time" value="${t?.time || currentTime()}" required></div><div class="field"><label>Account</label><select name="accountId" id="tx-account">${accountOpts(t?.accountId || active[0].id)}</select></div></div><div class="field" id="tx-rate-field" hidden><label id="tx-rate-label">Exchange rate</label><input id="tx-rate" name="exchangeRateSource" type="number" min="0.000001" step="0.000001"></div><div class="notice conversion-preview" id="tx-conversion" hidden></div><div id="tx-extra"></div><div class="field"><label>Payee</label>${payeeAutocompleteInput(t?.payee ?? t?.place ?? '', 'tx-payee')}</div><div class="field"><label>Description (optional)</label><input name="description" maxlength="180" value="${escapeHtml(t?.description ?? t?.note ?? '')}" placeholder="What was this for?"></div><div class="modal-footer"><button type="button" class="btn ghost" id="cancel">Cancel</button><button class="btn" type="submit">Save transaction</button></div></form>`);
    bindPayeeAutocomplete('tx-payee');
    let chosen = type;
    let lastRateCurrency = '';
    const currentTransactionRates = () => {
      const selected = account($('#tx-account')?.value);
      const snapshot = {...exchangeRates()};
      const rateValue = Number($('#tx-rate')?.value);
      if (selected?.currency && Number.isFinite(rateValue) && rateValue > 0) snapshot[selected.currency] = rateValue;
      return snapshot
    };
    const updateConversionPreview = () => {
      const selected = account($('#tx-account')?.value);
      const value = amount($('#tx-amount')?.value);
      const box = $('#tx-conversion'), rateBox = $('#tx-rate-field'), rateInput = $('#tx-rate'), rateLabel = $('#tx-rate-label');
      if (selected && rateBox && rateInput && rateLabel) {
        const snapshot = t?.exchangeRates || exchangeRates();
        if (selected.currency !== lastRateCurrency) {
          rateInput.value = snapshot[selected.currency] || exchangeRates()[selected.currency] || '';
          lastRateCurrency = selected.currency
        }
        rateLabel.textContent = `Exchange rate: 1 EUR = ${selected.currency}`;
        rateBox.hidden = selected.currency === 'EUR'
      }
      if (!box || !selected || !value || selected.currency === base()) {
        if (box) box.hidden = true;
        return
      }
      box.textContent = `Reporting estimate: ${conversionNoteWithRates(value, selected.currency, base(), currentTransactionRates())}. This transaction keeps its own rate snapshot for historical reports.`;
      box.hidden = false
    };
    const extra = () => {
      const options = state.categories.filter(c => c.type === chosen).map(c => `<option value="${c.id}" ${c.id === t?.categoryId ? 'selected' : ''}>${escapeHtml(c.icon + ' ' + c.name)}</option>`).join('');
      $('#tx-extra').innerHTML = chosen === 'transfer' ? `<div class="field"><label>Destination account</label><select name="toAccountId" id="tx-to">${accountOpts(t?.toAccountId || active.find(a => a.id !== $('#tx-account').value)?.id || '')}</select></div><div class="field"><label>Amount received (destination currency)</label><input type="number" name="received" min="0.01" step="0.01" value="${t?.received ?? ''}" required placeholder="0.00"></div><p class="form-hint">For same-currency transfers, enter the same amount. For different currencies, enter the actual received amount.</p>` : `<div class="field"><label>Category</label><select name="categoryId">${options}</select></div><div class="field" id="split-container"><label><input type="checkbox" id="enable-splits" ${t?.splits?.length ? 'checked' : ''} style="width:auto"> Split into categories</label><div id="split-fields"></div></div>`;
      if (chosen !== 'transfer') {
        const toggle = $('#enable-splits'), container = $('#split-fields');
        const draw = () => {
          container.innerHTML = toggle.checked ? `<div id="split-rows"></div><button type="button" class="btn secondary" id="add-split" style="margin-top:9px">+ Add split</button><p class="form-hint">Split amounts must equal the transaction total.</p>` : '';
          if (toggle.checked) {
            let rows = t?.splits?.length ? t.splits : [{
              categoryId: state.categories.find(c => c.type === chosen)?.id,
              amount: ''
            }, {categoryId: state.categories.find(c => c.type === chosen)?.id, amount: ''}];
            const addRow = s => {
              const el = document.createElement('div');
              el.className = 'field-row split-row';
              el.innerHTML = `<div class="field"><label>Category</label><select class="split-cat">${state.categories.filter(c => c.type === chosen).map(c => `<option value="${c.id}" ${c.id === s.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div><div class="field"><label>Amount</label><input class="split-amount" type="number" min="0.01" step="0.01" value="${s.amount ?? ''}" required></div>`;
              $('#split-rows').append(el)
            };
            rows.forEach(addRow);
            $('#add-split').onclick = () => addRow({})
          }
        };
        toggle.onchange = draw;
        draw()
      }
    };
    extra();
    document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
      chosen = b.dataset.type;
      document.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('active', x === b));
      extra()
    });
    $('#cancel').onclick = closeModal;
    $('#tx-amount')?.addEventListener('input', updateConversionPreview);
    $('#tx-account')?.addEventListener('change', updateConversionPreview);
    $('#tx-rate')?.addEventListener('input', updateConversionPreview);
    updateConversionPreview();
    $('#tx-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target), from = account(f.get('accountId'));
      if (!from) return toast('Select an account');
      const v = amount(f.get('amount'));
      if (v <= 0) return toast('Enter a valid amount');
      let record = {
        id: t?.id || uid(),
        type: chosen,
        amount: v,
        date: f.get('date'),
        time: f.get('time'),
        accountId: from.id,
        payee: String(f.get('payee') || '').trim(),
        description: String(f.get('description') || '').trim(),
        exchangeRates: currentTransactionRates(),
        createdAt: t?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      record.exchangeRateFrom = from.currency;
      record.exchangeRateTo = base();
      record.exchangeRate = conversionRate(from.currency, base()) || null;
      if (record.exchangeRates[from.currency] && record.exchangeRates[base()]) record.exchangeRate = record.exchangeRates[base()] / record.exchangeRates[from.currency];
      if (chosen === 'transfer') {
        const to = account(f.get('toAccountId'));
        if (!to || to.id === from.id) return toast('Select a different destination account');
        record.toAccountId = to.id;
        record.received = amount(f.get('received'));
        if (record.received <= 0) return toast('Enter the amount received')
      } else {
        record.categoryId = f.get('categoryId');
        if ($('#enable-splits')?.checked) {
          record.splits = [...document.querySelectorAll('.split-row')].map(row => ({
            categoryId: row.querySelector('.split-cat').value,
            amount: amount(row.querySelector('.split-amount').value)
          }));
          if (Math.round(record.splits.reduce((s, x) => s + x.amount, 0) * 100) !== Math.round(v * 100)) return toast('Split amounts must equal the total');
          record.categoryId = null
        }
      }
      await put('transactions', record);
      closeModal();
      await reload();
      toast('Transaction saved')
    }
  }

  function categoriesModal() {
    modal('Manage categories', `<div class="toolbar"><span class="muted">Organize your income and expenses</span><button class="btn" id="new-category">+ New</button></div><div class="table-list">${state.categories.map(c => `<div class="transaction"><div class="tx-icon" style="background:${c.color}20;color:${c.color}">${escapeHtml(c.icon)}</div><div class="tx-main"><b>${escapeHtml(c.name)}</b><small>${c.type}</small></div><button class="mini-btn" data-edit-category="${c.id}">✎</button><button class="mini-btn" data-remove-category="${c.id}">×</button></div>`).join('')}</div>`);
    $('#new-category').onclick = () => categoryEdit();
    document.querySelectorAll('[data-edit-category]').forEach(b => b.onclick = () => categoryEdit(cat(b.dataset.editCategory)));
    document.querySelectorAll('[data-remove-category]').forEach(b => b.onclick = async () => {
      if (state.transactions.some(t => t.categoryId === b.dataset.removeCategory || t.splits?.some(s => s.categoryId === b.dataset.removeCategory))) return toast('Category is in use');
      confirmAction({
        title: 'Delete category',
        message: 'Delete this category? This cannot be undone.',
        confirmText: 'Delete category',
        onCancel: categoriesModal,
        onConfirm: async () => {
          await del('categories', b.dataset.removeCategory);
          await reload();
          categoriesModal()
        }
      })
    })
  }

  function categoryEdit(c) {
    modal(c ? 'Edit category' : 'New category', `<form id="category-form"><div class="field"><label>Name</label><input name="name" required maxlength="45" value="${escapeHtml(c?.name || '')}"></div><div class="field-row"><div class="field"><label>Type</label><select name="type" ${c ? 'disabled' : ''}><option value="expense" ${c?.type === 'expense' ? 'selected' : ''}>Expense</option><option value="income" ${c?.type === 'income' ? 'selected' : ''}>Income</option></select></div><div class="field"><label>Icon (emoji or symbol)</label><input name="icon" maxlength="4" value="${escapeHtml(c?.icon || '◈')}"></div></div><div class="field"><label>Color</label><input name="color" type="color" value="${c?.color || '#3b82f6'}" style="height:48px"></div><div class="modal-footer"><button type="button" class="btn ghost" id="cancel">Cancel</button><button class="btn">Save category</button></div></form>`);
    $('#cancel').onclick = categoriesModal;
    $('#category-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      await put('categories', {
        id: c?.id || uid(),
        name: f.get('name').trim(),
        type: c?.type || f.get('type'),
        icon: f.get('icon') || '◈',
        color: f.get('color')
      });
      await reload();
      categoriesModal()
    }
  }

  function budgetsModal() {
    const items = state.budgets.filter(b => b.month === state.month);
    modal('Monthly budgets', `<div class="toolbar">${monthControl()}<button class="btn" id="new-budget">+ Add budget</button></div><div class="table-list">${items.length ? items.map(b => `<div class="transaction"><div class="tx-icon">◉</div><div class="tx-main"><b>${escapeHtml(cat(b.categoryId)?.name || 'Overall budget')}</b><small>${monthLabel(b.month)}</small></div><b>${money(b.limit, base())}</b><button class="mini-btn" data-remove-budget="${b.id}">×</button></div>`).join('') : empty('No budgets this month', 'Add a limit for your spending.')}</div>`);
    bindMonth();
    $('#prev-month').onclick = () => {
      shiftBudget(-1)
    };
    $('#next-month').onclick = () => {
      shiftBudget(1)
    };
    $('#new-budget').onclick = budgetEdit;
    document.querySelectorAll('[data-remove-budget]').forEach(b => b.onclick = async () => {
      await del('budgets', b.dataset.removeBudget);
      await reload();
      budgetsModal()
    })
  }

  function shiftBudget(n) {
    state.month = shiftMonth(state.month, n);
    render();
    budgetsModal()
  }

  function budgetEdit() {
    modal('Add monthly budget', `<form id="budget-form"><div class="field"><label>Month</label><input name="month" type="month" value="${state.month}" required></div><div class="field"><label>Category</label><select name="categoryId"><option value="">Overall budget</option>${state.categories.filter(c => c.type === 'expense').map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div><div class="field"><label>Monthly limit (${base()})</label><input name="limit" type="number" min="0.01" step="0.01" required></div><div class="notice">Budgets reset each month. No unused amount is carried forward.</div><div class="modal-footer"><button type="button" class="btn ghost" id="cancel">Cancel</button><button class="btn">Save budget</button></div></form>`);
    $('#cancel').onclick = budgetsModal;
    $('#budget-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target), month = f.get('month'), categoryId = f.get('categoryId');
      const old = state.budgets.find(b => b.month === month && b.categoryId === categoryId);
      await put('budgets', {id: old?.id || uid(), month, categoryId, limit: amount(f.get('limit'))});
      await reload();
      budgetsModal()
    }
  }

  function recurringModal() {
    modal('Recurring transactions', `<div class="toolbar"><span class="muted">Scheduled items are added when you open the app.</span><button class="btn" id="new-recurring">+ New</button></div><div class="table-list">${state.recurring.length ? state.recurring.map(r => `<div class="transaction"><div class="tx-icon">↻</div><div class="tx-main"><b>${escapeHtml(r.payee || r.place || r.description || r.note || cat(r.categoryId)?.name || 'Recurring')}</b><small>${r.frequency} · next ${r.nextDate}${r.time ? ' at ' + r.time : ''} · ${r.paused ? 'Paused' : 'Active'}</small></div><b>${money(r.amount, account(r.accountId)?.currency || base())}</b><button class="mini-btn" data-pause="${r.id}">${r.paused ? '▶' : 'Ⅱ'}</button><button class="mini-btn" data-remove-recurring="${r.id}">×</button></div>`).join('') : empty('No recurring transactions', 'Add regular salary, rent, or subscriptions.', '↻')}</div>`);
    $('#new-recurring').onclick = recurringEdit;
    document.querySelectorAll('[data-pause]').forEach(b => b.onclick = async () => {
      const r = state.recurring.find(x => x.id === b.dataset.pause);
      await put('recurring', {...r, paused: !r.paused});
      await reload();
      recurringModal()
    });
    document.querySelectorAll('[data-remove-recurring]').forEach(b => b.onclick = async () => {
      confirmAction({
        title: 'Remove schedule',
        message: 'Remove this recurring schedule? Existing transactions stay intact.',
        confirmText: 'Remove schedule',
        onCancel: recurringModal,
        onConfirm: async () => {
          await del('recurring', b.dataset.removeRecurring);
          await reload();
          recurringModal()
        }
      })
    })
  }

  function recurringEdit() {
    const active = state.accounts.filter(a => !a.archived);
    if (!active.length) return accountModal();
    modal('New recurring transaction', `<form id="rec-form"><div class="field-row"><div class="field"><label>Type</label><select name="type" id="rec-type"><option value="expense">Expense</option><option value="income">Income</option></select></div><div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required></div></div><div class="field"><label>Account</label><select name="accountId">${active.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${a.currency})</option>`).join('')}</select></div><div class="field"><label>Category</label><select name="categoryId" id="rec-cat"></select></div><div class="field-row"><div class="field"><label>Frequency</label><select name="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option><option value="yearly">Yearly</option></select></div><div class="field"><label>First date</label><input name="nextDate" type="date" value="${today()}" required></div></div><div class="field"><label>Time</label><input name="time" type="time" value="${currentTime()}" required></div><div class="field"><label>Payee</label>${payeeAutocompleteInput('', 'rec-payee')}</div><div class="field"><label>Description</label><input name="description" maxlength="180"></div><div class="modal-footer"><button type="button" class="btn ghost" id="cancel">Cancel</button><button class="btn">Create schedule</button></div></form>`);
    bindPayeeAutocomplete('rec-payee');
    const fill = () => {
      $('#rec-cat').innerHTML = state.categories.filter(c => c.type === $('#rec-type').value).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
    };
    $('#rec-type').onchange = fill;
    fill();
    $('#cancel').onclick = recurringModal;
    $('#rec-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      await put('recurring', {
        id: uid(),
        type: f.get('type'),
        amount: amount(f.get('amount')),
        accountId: f.get('accountId'),
        categoryId: f.get('categoryId'),
        frequency: f.get('frequency'),
        nextDate: f.get('nextDate'),
        time: f.get('time'),
        payee: String(f.get('payee') || '').trim(),
        description: String(f.get('description') || '').trim(),
        paused: false
      });
      await reload();
      recurringModal()
    }
  }

  function nextDate(date, freq) {
    const d = new Date(date + 'T12:00:00');
    const day = d.getDate();
    if (freq === 'daily') d.setDate(day + 1);
    if (freq === 'weekly') d.setDate(day + 7);
    if (freq === 'monthly') {
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    }
    if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('en-CA')
  }

  async function processRecurring() {
    const rs = await all('recurring'), existing = await all('transactions');
    let changed = false;
    for (const r of rs) {
      if (r.paused) continue;
      let count = 0;
      while (r.nextDate <= today() && count++ < 120) {
        const key = `rec-${r.id}-${r.nextDate}`;
        if (!existing.some(t => t.id === key)) {
          const from = account(r.accountId), snapshot = exchangeRates();
          await put('transactions', {
            id: key,
            type: r.type,
            amount: r.amount,
            date: r.nextDate,
            time: r.time || '12:00',
            accountId: r.accountId,
            categoryId: r.categoryId,
            payee: r.payee || r.place || '',
            description: r.description ?? r.note ?? '',
            exchangeRates: snapshot,
            exchangeRateFrom: from?.currency || 'EUR',
            exchangeRateTo: base(),
            exchangeRate: from?.currency && snapshot[from.currency] && snapshot[base()] ? snapshot[base()] / snapshot[from.currency] : null,
            createdAt: new Date().toISOString()
          })
        }
        r.nextDate = nextDate(r.nextDate, r.frequency);
        changed = true
      }
      if (count > 1) await put('recurring', r)
    }
    return changed
  }

  function download(content, filename, type) {
    const blob = new Blob([content], {type}), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  function settingsModal() {
    modal('Settings & backup', `<div class="field"><label>Base currency</label><select id="base-currency">${currencyOptions(base())}</select></div><div class="notice">Dashboard totals, charts, and budget comparisons convert non-${base()} account amounts with your configured reference rates. Formula: amount ÷ source rate × ${base()} rate. Rates are stored locally and are not live market rates.</div><form id="rates-form"><div class="rate-list">${exchangeRateRows()}</div><div class="modal-footer rate-actions"><button type="button" class="btn ghost" id="reset-rates">Reset rates</button><button class="btn secondary" type="submit">Save rates</button></div></form><div style="display:grid;gap:12px;margin-top:18px"><button class="btn secondary" id="export-json">↓ Export full JSON backup</button><button class="btn secondary" id="export-csv">↓ Export transactions as CSV</button><label class="btn ghost" style="text-align:center;cursor:pointer">↑ Import JSON backup<input id="import-json" type="file" accept="application/json,.json" hidden></label></div><p class="form-hint">Importing a backup replaces all existing data. Export a backup first.</p><div class="notice" style="margin-top:14px">Security: this version stores financial records locally in IndexedDB without encryption. PIN locking is planned for a later phase; do not treat browser storage as encrypted.</div>`);
    $('#base-currency').onchange = async e => {
      await put('settings', {id: 'baseCurrency', value: e.target.value});
      await reload();
      settingsModal()
    };
    $('#rates-form').onsubmit = async e => {
      e.preventDefault();
      const next = {...exchangeRates()};
      for (const input of e.target.querySelectorAll('.rate-input')) {
        const value = Number(input.value);
        if (!Number.isFinite(value) || value <= 0) return toast(`Enter a valid rate for ${input.name}`);
        next[input.name] = Math.round(value * 1000000) / 1000000
      }
      next.EUR = 1;
      await put('settings', {id: 'exchangeRates', value: next});
      await reload();
      settingsModal();
      toast('Exchange rates saved')
    };
    $('#reset-rates').onclick = async () => {
      await put('settings', {id: 'exchangeRates', value: {...defaultRates}});
      await reload();
      settingsModal();
      toast('Exchange rates reset')
    };
    $('#export-json').onclick = async () => {
      const data = {format: 'flow-backup', version: 1, exportedAt: new Date().toISOString()};
      for (const s of storeNames) data[s] = await all(s);
      download(JSON.stringify(data, null, 2), 'flow-backup-' + today() + '.json', 'application/json');
      toast('Backup exported')
    };
    $('#export-csv').onclick = () => {
      const fields = ['date', 'time', 'type', 'account', 'currency', 'amount', 'category', 'payee', 'description', 'exchange_rate_from', 'exchange_rate_to', 'exchange_rate', 'destination', 'received'];
      const csv = [fields, ...state.transactions.map(t => [t.date, t.time || '', t.type, account(t.accountId)?.name || '', account(t.accountId)?.currency || '', t.amount, cat(t.categoryId)?.name || '', t.payee ?? t.place ?? '', t.description ?? t.note ?? '', t.exchangeRateFrom || '', t.exchangeRateTo || '', t.exchangeRate || '', account(t.toAccountId)?.name || '', t.received || ''])].map(row => row.map(x => '"' + String(x ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
      download('\ufeff' + csv, 'flow-transactions-' + today() + '.csv', 'text/csv;charset=utf-8');
      toast('CSV exported')
    };
    $('#import-json').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.format !== 'flow-backup' || data.version !== 1 || !storeNames.every(s => Array.isArray(data[s]))) throw Error('Unsupported backup format');
        confirmAction({
          title: 'Replace all data',
          message: 'Replace all current data with this backup? Export a backup first if you need to keep the current data.',
          confirmText: 'Replace data',
          onCancel: settingsModal,
          onConfirm: async () => {
            await replaceAll(data);
            closeModal();
            await reload();
            toast('Backup restored')
          }
        })
      } catch (err) {
        toast('Import failed: ' + err.message)
      }
    }
  }
