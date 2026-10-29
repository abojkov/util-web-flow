function modal(title, body, { restoreView = null } = {}) {
  $('#modal-root').innerHTML =
    `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="close" id="close-modal" aria-label="${escapeHtml(t('modals.close'))}">×</button></div><div class="modal-body">${body}</div></div></div>`
  $('#close-modal').onclick = closeModal
  bindModalNumberInputs()
  const modalBody = $('.modal-body')
  requestAnimationFrame(() => {
    // Ignore focus work queued for a dialog that has since been replaced or closed.
    if ($('.modal-body') !== modalBody) return
    const body = modalBody
    if (restoreView) {
      const focused = restoreView.focusId ? document.getElementById(restoreView.focusId) : null
      const target =
        focused && body.contains(focused) && !focused.disabled ? focused : $('#close-modal')
      target?.focus({ preventScroll: true })
      body.scrollTop = restoreView.scrollTop
      return
    }
    const firstField = body?.querySelector(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)'
    )
    const firstAction = body?.querySelector(
      'button:not(:disabled), [href], input[type="checkbox"]:not(:disabled), input[type="radio"]:not(:disabled)'
    )
    // Keep dialog focus accessible without opening a keyboard or picker on touch devices.
    const initialFocus = window.matchMedia('(any-pointer: coarse)').matches
      ? $('#close-modal')
      : firstField || firstAction
    initialFocus?.focus({ preventScroll: true })
  })
}

function bindModalNumberInputs() {
  document.querySelectorAll('.modal input[data-decimal-input]').forEach(input => {
    if (input.dataset.decimalInputsBound) return
    input.dataset.decimalInputsBound = 'true'
    input.addEventListener(
      'wheel',
      e => {
        if (document.activeElement === input) e.preventDefault()
      },
      { passive: false }
    )
    input.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) e.preventDefault()
    })
  })
}

function closeModal() {
  $('#modal-root').innerHTML = ''
}

function confirmAction({
  title,
  message,
  confirmText = t('modals.confirm'),
  onConfirm,
  onCancel = closeModal,
}) {
  modal(
    title,
    `<p class="notice">${escapeHtml(message)}</p><div class="modal-footer"><button type="button" class="btn ghost" id="confirm-cancel">${escapeHtml(t('modals.cancel'))}</button><button type="button" class="btn danger" id="confirm-ok">${escapeHtml(confirmText)}</button></div>`
  )
  $('#confirm-cancel').onclick = onCancel
  $('#confirm-ok').onclick = async () => {
    await onConfirm()
  }
}

function toast(s) {
  $('#toast-root').innerHTML = `<div class="toast">${escapeHtml(s)}</div>`
  setTimeout(() => {
    $('#toast-root').innerHTML = ''
  }, 3500)
}

function currencyOptions(current) {
  return availableCurrencies()
    .map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`)
    .join('')
}

function exchangeRateRow(currency) {
  const configured = exchangeRates()
  return `<div class="rate-row" data-rate-currency="${currency}"><label><span>${currency}</span><small>1 EUR =</small><small data-currency-rate-source="${currency}">${currencyRateSource(currency)}</small></label><input class="rate-input" data-original-rate="${configured[currency] ?? ''}" name="${currency}" type="text" inputmode="decimal" data-decimal-input pattern="-?[0-9]+([.,][0-9]+)?" value="${configured[currency] ?? ''}" ${currency === 'EUR' ? 'readonly' : ''}><b>${currency}</b></div>`
}

function exchangeRateRows() {
  return availableCurrencies().map(exchangeRateRow).join('')
}

function payeeAutocompleteInput(value = '', id = 'payee-input') {
  return `<div class="payee-autocomplete"><input id="${id}" name="payee" autocomplete="off" maxlength="120" value="${escapeHtml(value)}" placeholder="${escapeHtml(t('modals.transaction.payeePlaceholder'))}"><div class="payee-suggestions" data-payee-suggestions hidden></div></div>`
}

function bindPayeeAutocomplete(inputId) {
  const input = document.getElementById(inputId)
  if (!input) return
  const panel = input.closest('.payee-autocomplete')?.querySelector('[data-payee-suggestions]')
  if (!panel) return
  const options = payeeOptions()
  const hide = () => {
    panel.hidden = true
    panel.innerHTML = ''
  }
  const show = () => {
    const query = input.value.trim().toLocaleLowerCase()
    if (!query) return hide()
    const matches = options
      .filter(payee => payee.toLocaleLowerCase().includes(query) && payee !== input.value)
      .slice(0, 8)
    if (!matches.length) return hide()
    panel.innerHTML = matches
      .map(
        payee =>
          `<button type="button" data-payee="${escapeHtml(payee)}">${escapeHtml(payee)}</button>`
      )
      .join('')
    panel.hidden = false
  }
  input.addEventListener('input', show)
  input.addEventListener('focus', show)
  panel.addEventListener('pointerdown', e => {
    const option = e.target.closest('[data-payee]')
    if (!option) return
    input.value = option.dataset.payee
    hide()
    input.focus()
  })
  document.addEventListener('pointerdown', e => {
    if (!input.closest('.payee-autocomplete').contains(e.target)) hide()
  })
  input.form?.addEventListener('submit', hide)
}

function categoryChoiceValue(categoryId, subcategoryId = '') {
  return subcategoryId ? `sub:${categoryId}:${subcategoryId}` : `cat:${categoryId}`
}

function parseCategoryChoice(value) {
  const [kind, categoryId, subcategoryId] = String(value || '').split(':')
  return kind === 'sub'
    ? { categoryId, subcategoryId }
    : { categoryId: categoryId || value, subcategoryId: '' }
}

function sortByOrderThenName(a, b) {
  const orderA = Number.isFinite(Number(a.sortOrder))
    ? Number(a.sortOrder)
    : Number.MAX_SAFE_INTEGER
  const orderB = Number.isFinite(Number(b.sortOrder))
    ? Number(b.sortOrder)
    : Number.MAX_SAFE_INTEGER
  return (
    orderA - orderB ||
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  )
}

function categoryPicker(id, type, categoryId = '', subcategoryId = '', name = '', inputClass = '') {
  const categories = state.categories.filter(c => c.type === type).sort(sortByOrderThenName)
  const selected = categories.find(c => c.id === categoryId) || categories[0]
  const child = selected?.subcategories?.find(s => s.id === subcategoryId)
  const value = selected ? categoryChoiceValue(selected.id, child?.id) : ''
  const label = selected
    ? [selected.name, child?.name].filter(Boolean).join(' / ')
    : t('modals.chooseCategory')
  const choice = (category, subcategory) => {
    const key = categoryChoiceValue(category.id, subcategory?.id)
    return `<button type="button" class="category-choice" data-category-choice="${escapeHtml(key)}" aria-pressed="${key === value}"><span aria-hidden="true">${escapeHtml(subcategory?.icon || category.icon || '◈')}</span><span>${escapeHtml(subcategory?.name || category.name)}</span></button>`
  }
  return `<div class="field"><label for="${id}-toggle" id="${id}-label">${escapeHtml(t('modals.categoryOrSubcategory'))}</label><input type="hidden" id="${id}" name="${name}" class="${inputClass}" value="${escapeHtml(value)}"><button type="button" class="account-picker-toggle" id="${id}-toggle" aria-expanded="false" aria-controls="${id}-picker"><span id="${id}-selection">${escapeHtml(label)}</span></button><div class="category-picker" id="${id}-picker" hidden role="group" aria-labelledby="${id}-label">${
    categories.length
      ? categories
          .map((category, index) => {
            const children = (category.subcategories || []).slice().sort(sortByOrderThenName)
            const expanded = category.id === selected?.id && Boolean(child)
            return `<div class="category-picker-group"><div class="category-picker-parent">${choice(category)}${children.length ? `<button type="button" class="category-expand" data-category-expand="${id}-children-${index}" aria-controls="${id}-children-${index}" aria-expanded="${expanded}" aria-label="${escapeHtml(t('modals.showSubcategoriesOf', { name: category.name }))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>` : ''}</div>${children.length ? `<div class="category-picker-children" id="${id}-children-${index}" ${expanded ? '' : 'hidden'}>${children.map(subcategory => choice(category, subcategory)).join('')}</div>` : ''}</div>`
          })
          .join('')
      : `<p class="form-hint">${escapeHtml(t('modals.noCategoriesHint'))}</p>`
  }</div></div>`
}

function bindCategoryPicker(id) {
  const input = $('#' + id),
    picker = $('#' + id + '-picker'),
    toggle = $('#' + id + '-toggle')
  const setExpanded = expanded => {
    picker.hidden = !expanded
    toggle.setAttribute('aria-expanded', String(expanded))
  }
  toggle.onclick = () => setExpanded(picker.hidden)
  picker.onkeydown = event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setExpanded(false)
      toggle.focus()
    }
  }
  picker.querySelectorAll('[data-category-expand]').forEach(
    button =>
      (button.onclick = () => {
        const children = document.getElementById(button.dataset.categoryExpand)
        const expand = children.hidden
        picker.querySelectorAll('[data-category-expand]').forEach(other => {
          const expanded = other === button && expand
          document.getElementById(other.dataset.categoryExpand).hidden = !expanded
          other.setAttribute('aria-expanded', String(expanded))
        })
      })
  )
  picker.querySelectorAll('[data-category-choice]').forEach(
    button =>
      (button.onclick = () => {
        input.value = button.dataset.categoryChoice
        const selected = parseCategoryChoice(input.value)
        $('#' + id + '-selection').textContent = categoryLabel(
          selected.categoryId,
          selected.subcategoryId
        )
        picker
          .querySelectorAll('[data-category-choice]')
          .forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)))
        setExpanded(false)
        toggle.focus()
      })
  )
}

async function moveCategory(id, direction) {
  const current = cat(id)
  if (!current) return
  const items = state.categories.filter(c => c.type === current.type).sort(sortByOrderThenName)
  const index = items.findIndex(c => c.id === id),
    next = index + direction
  if (next < 0 || next >= items.length) return
  const scrollTop = $('.modal-body')?.scrollTop ?? 0
  ;[items[index], items[next]] = [items[next], items[index]]
  await Promise.all(items.map((item, sortOrder) => put('categories', { ...item, sortOrder })))
  await reload()
  categoriesModal()
  // Rebuilding the dialog replaces its scroll container; retain the user's place.
  const body = $('.modal-body')
  if (body) body.scrollTop = scrollTop
  requestAnimationFrame(() => {
    if (!body || body !== $('.modal-body')) return
    const button = [...body.querySelectorAll('[data-move-category]')].find(
      button => button.dataset.moveCategory === id && Number(button.dataset.direction) === direction
    )
    button?.focus({ preventScroll: true })
  })
}

function accountModal(a) {
  modal(
    a ? t('modals.account.editTitle') : t('modals.account.newTitle'),
    `<form id="account-form"><div class="field"><label>${escapeHtml(t('modals.account.name'))}</label><input name="name" required maxlength="70" value="${escapeHtml(a?.name || '')}" placeholder="${escapeHtml(t('modals.account.namePlaceholder'))}"></div><div class="field-row"><div class="field"><label>${escapeHtml(t('modals.account.type'))}</label><select name="type">${['Bank', 'Cash', 'Savings', 'Investment', 'Loan', 'Other'].map(x => `<option value="${x}" ${a?.type === x ? 'selected' : ''}>${escapeHtml(accountTypeLabel(x))}</option>`).join('')}</select></div><div class="field"><label>${escapeHtml(t('modals.account.currency'))}</label><select name="currency" ${a ? 'disabled' : ''}>${currencyOptions(a?.currency || base())}</select></div></div><div class="field"><label>${escapeHtml(t('modals.account.openingBalance'))}</label><input type="text" inputmode="decimal" data-decimal-input pattern="-?[0-9]+([.,][0-9]+)?" name="opening" value="${a?.opening ?? 0}" required></div><div class="field"><label><input type="checkbox" name="visible" ${!a?.archived && a?.visible !== false ? 'checked' : ''} ${a?.archived ? 'disabled' : ''}> ${escapeHtml(t('modals.account.visibleInSelectors'))}</label><p class="form-hint">${escapeHtml(a?.archived ? t('modals.account.visibleHint.archived') : t('modals.account.visibleHint.active'))}</p></div><div class="notice">${escapeHtml(t('modals.account.notice'))}</div><div class="modal-footer">${a ? `<button type="button" class="btn danger" id="delete-account">${escapeHtml(t('modals.account.delete'))}</button>` : ''}<button class="btn" type="submit">${escapeHtml(t('modals.account.save'))}</button></div></form>`
  )
  $('#delete-account')?.addEventListener('click', () => {
    if (state.transactions.some(t => t.accountId === a.id || t.toAccountId === a.id))
      return toast(t('toasts.accountHasTransactions'))
    confirmAction({
      title: t('modals.account.confirmDeleteTitle'),
      message: t('modals.account.confirmDeleteMessage', { name: a.name }),
      confirmText: t('modals.account.confirmDeleteButton'),
      onCancel: () => accountModal(a),
      onConfirm: async () => {
        await del('accounts', a.id)
        closeModal()
        await reload()
      },
    })
  })
  $('#account-form').onsubmit = async e => {
    e.preventDefault()
    const f = new FormData(e.target)
    await put('accounts', {
      id: a?.id || uid(),
      name: f.get('name').trim(),
      type: f.get('type'),
      currency: a?.currency || f.get('currency'),
      opening: amount(f.get('opening')),
      archived: a?.archived || false,
      visible: !a?.archived && f.get('visible') === 'on',
      sortOrder: a?.sortOrder ?? state.accounts.filter(x => x.type === f.get('type')).length,
    })
    closeModal()
    await reload()
    toast(t('toasts.accountSaved'))
  }
}

function copyTransactionDateChoice(tx) {
  if (!tx) return toast(t('toasts.transactionNotFound'))
  modal(
    t('modals.transaction.copyTitle'),
    `<p class="notice">${escapeHtml(t('modals.transaction.copyNotice'))}</p><div class="modal-footer"><button type="button" class="btn secondary" id="copy-original-datetime">${escapeHtml(t('modals.transaction.copySameDateTime'))}</button><button type="button" class="btn" id="copy-current-datetime">${escapeHtml(t('modals.transaction.copyCurrentDateTime'))}</button></div>`
  )
  $('#copy-original-datetime').onclick = () => copyTransactionDraft(tx, false)
  $('#copy-current-datetime').onclick = () => copyTransactionDraft(tx, true)
}

function copyTransactionDraft(tx, useCurrentDateTime = false) {
  if (!tx) return toast(t('toasts.transactionNotFound'))
  const copy = JSON.parse(JSON.stringify(tx))
  delete copy.id
  delete copy.createdAt
  delete copy.updatedAt
  delete copy.recurringRuleId
  delete copy.occurrenceKey
  if (useCurrentDateTime) {
    copy.date = today()
    copy.time = currentTime()
  }
  transactionModal(copy, copy.type, { copy: true })
}

function transactionModal(tx, initial = 'expense', options = {}) {
  const active = orderedAccounts(state.accounts.filter(isSelectableAccount))
  if (!active.length && !account(tx?.accountId)) {
    if (!state.accounts.length) {
      toast(t('toasts.createAccountFirst'))
      return accountModal()
    }
    return toast(t('toasts.noVisibleAccountsForTx'))
  }
  const isCopy = Boolean(options.copy)
  const isExisting = Boolean(tx?.id) && !isCopy
  const type = tx?.type || initial
  const accountPicker = (id, name, label, selected) => {
    const selectedId = account(selected) ? selected : active[0]?.id || ''
    const selectedAccount = account(selectedId)
    return `<div class="field"><label id="${id}-label" for="${id}-toggle">${escapeHtml(label)}</label><input type="hidden" name="${name}" id="${id}" value="${escapeHtml(selectedId)}"><button type="button" class="account-picker-toggle" id="${id}-toggle" aria-expanded="false" aria-controls="${id}-picker"><span id="${id}-selection">${escapeHtml(selectedAccount?.name || t('modals.chooseAccount'))}</span></button><div class="account-picker" id="${id}-picker" hidden role="group" aria-labelledby="${id}-label">${active.map(a => `<button type="button" class="account-choice" data-account-id="${escapeHtml(a.id)}" aria-pressed="${a.id === selectedId}"><span class="account-choice-name">${escapeHtml(a.name)}</span><small>${escapeHtml(a.currency)}</small></button>`).join('')}</div></div>`
  }
  const bindAccountPicker = id => {
    const input = $('#' + id),
      picker = $('#' + id + '-picker'),
      toggle = $('#' + id + '-toggle')
    const setExpanded = expanded => {
      picker.hidden = !expanded
      toggle.setAttribute('aria-expanded', String(expanded))
    }
    toggle.onclick = () => setExpanded(picker.hidden)
    picker.onkeydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setExpanded(false)
        toggle.focus()
      }
    }
    picker.querySelectorAll('[data-account-id]').forEach(button => {
      button.onclick = () => {
        input.value = button.dataset.accountId
        picker
          .querySelectorAll('[data-account-id]')
          .forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)))
        const selected = account(input.value)
        $('#' + id + '-selection').textContent = selected.name
        setExpanded(false)
        toggle.focus()
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
  }
  modal(
    isExisting ? t('modals.transaction.editTitle') : t('modals.transaction.newTitle'),
    `<form id="tx-form"><div class="segmented">${['expense', 'income', 'transfer'].map(x => `<button type="button" data-type="${x}" class="${x === type ? 'active' : ''}">${escapeHtml(txTypeLabel(x))}</button>`).join('')}</div><div class="field-row"><div class="field"><label for="tx-datetime">${escapeHtml(t('modals.transaction.dateTime'))}</label><input id="tx-datetime" type="datetime-local" name="datetime" value="${escapeHtml((tx?.date || today()) + 'T' + (tx?.time || currentTime()))}" required></div><div class="field"><label>${escapeHtml(t('modals.amount'))}</label><input id="tx-amount" type="text" inputmode="decimal" data-decimal-input pattern="-?[0-9]+([.,][0-9]+)?" name="amount" value="${tx?.amount ?? ''}" required placeholder="0.00"></div></div>${accountPicker('tx-account', 'accountId', t('modals.transaction.account'), tx?.accountId || active[0]?.id || '')}<div class="field" id="tx-rate-field" hidden><label id="tx-rate-label">${escapeHtml(t('modals.transaction.exchangeRate'))}</label><input id="tx-rate" name="exchangeRateSource" type="text" inputmode="decimal" data-decimal-input pattern="-?[0-9]+([.,][0-9]+)?"></div><div class="notice conversion-preview" id="tx-conversion" hidden></div><div id="tx-extra"></div><div class="field"><label>${escapeHtml(t('modals.transaction.payee'))}</label>${payeeAutocompleteInput(tx?.payee ?? tx?.place ?? '', 'tx-payee')}</div><div class="field"><label>${escapeHtml(t('modals.transaction.description'))}</label><textarea name="description" maxlength="1200" rows="4" placeholder="${escapeHtml(t('modals.transaction.descriptionPlaceholder'))}">${escapeHtml(tx?.description ?? tx?.note ?? '')}</textarea></div><div class="modal-footer">${isExisting ? `<button type="button" class="btn danger" id="delete-tx">${escapeHtml(t('modals.transaction.delete'))}</button><button type="button" class="btn secondary" id="copy-tx">${escapeHtml(t('modals.transaction.copy'))}</button>` : ''}<button class="btn" type="submit">${escapeHtml(t('modals.transaction.save'))}</button></div></form>`
  )
  bindPayeeAutocomplete('tx-payee')
  let chosen = type
  let lastRateCurrency = ''
  let lastTransferPair = ''
  const currentTransactionRates = () => {
    const selected = account($('#tx-account')?.value)
    const snapshot = rateSnapshotForCurrencies([selected?.currency, base()])
    const rateValue = decimalValue($('#tx-rate')?.value)
    if (chosen !== 'transfer' && selected?.currency && Number.isFinite(rateValue) && rateValue > 0)
      snapshot[selected.currency] = rateValue
    return snapshot
  }
  const updateConversionPreview = event => {
    const selected = account($('#tx-account')?.value)
    const value = amount($('#tx-amount')?.value)
    const box = $('#tx-conversion'),
      rateBox = $('#tx-rate-field'),
      rateInput = $('#tx-rate'),
      rateLabel = $('#tx-rate-label')
    if (chosen === 'transfer') {
      const destination = account($('#tx-to')?.value)
      const crossCurrency = destination && selected && destination.currency !== selected.currency
      rateBox.hidden = true
      rateInput.required = false
      const transferField = $('#tx-transfer-rate-field'),
        transferInput = $('#tx-transfer-rate')
      const pair = `${selected?.currency}:${destination?.currency}`
      const originalPair =
        tx?.type === 'transfer' &&
        tx.accountId === selected?.id &&
        tx.toAccountId === destination?.id
      const historicalRate =
        originalPair && tx.amount > 0 && tx.received > 0 ? tx.received / tx.amount : null
      const inverseRate = inverseTransferQuote(
        selected?.currency,
        destination?.currency,
        historicalRate,
        { ...exchangeRates(), ...(tx?.exchangeRates || {}) }
      )
      let originalReceived = null
      const editableReceived = Boolean(crossCurrency)
      const receivedInput = $('#tx-received')
      $('#tx-received-field').hidden = !editableReceived
      receivedInput.required = Boolean(editableReceived)
      $('#tx-received-label').textContent = destination?.currency
        ? t('modals.transaction.amountReceived', { currency: destination.currency })
        : t('modals.transaction.amountReceivedFallback')
      if (transferField && transferInput) {
        transferField.hidden = !crossCurrency
        transferInput.required = Boolean(crossCurrency)
        if (pair !== lastTransferPair) {
          const rates = exchangeRates()
          const sourceRate = rates[selected?.currency],
            destinationRate = rates[destination?.currency]
          const configuredRate =
            Number.isFinite(sourceRate) &&
            sourceRate > 0 &&
            Number.isFinite(destinationRate) &&
            destinationRate > 0
              ? inverseRate
                ? sourceRate / destinationRate
                : destinationRate / sourceRate
              : null
          const initialRate =
            originalPair && tx.amount > 0 && tx.received > 0
              ? inverseRate
                ? tx.amount / tx.received
                : tx.received / tx.amount
              : configuredRate
          transferInput.value = formatTransferRate(initialRate)
          if (originalPair && tx.amount > 0 && tx.received > 0) originalReceived = tx.received
          lastTransferPair = pair
        }
        $('#tx-transfer-rate-label').textContent = t('modals.transaction.exchangeRateTransfer', {
          from: inverseRate ? destination?.currency || '' : selected?.currency || '',
          to: inverseRate ? selected?.currency : destination?.currency || '',
        })
      }
      if (editableReceived && event?.target === receivedInput) {
        const received = amount(receivedInput.value)
        transferInput.value =
          Number.isFinite(received) && received > 0 && Number.isFinite(value) && value > 0
            ? formatTransferRate(inverseRate ? value / received : received / value)
            : ''
      }
      const rate = decimalValue(transferInput?.value)
      if (event?.target !== receivedInput) {
        const received = amount(inverseRate ? value / rate : value * rate)
        receivedInput.value =
          originalReceived ??
          (Number.isFinite(rate) && rate > 0 && Number.isFinite(received) && received > 0
            ? received
            : '')
      }
      box.hidden = true
      box.textContent = ''
      return
    }
    if (selected && rateBox && rateInput && rateLabel) {
      const snapshot = tx?.exchangeRates || exchangeRates()
      if (selected.currency !== lastRateCurrency) {
        rateInput.value = snapshot[selected.currency] || exchangeRates()[selected.currency] || ''
        lastRateCurrency = selected.currency
      }
      rateLabel.textContent = t('modals.transaction.exchangeRateEur', {
        currency: selected.currency,
      })
      rateBox.hidden = selected.currency === 'EUR'
    }
    if (!box || !selected || !value || selected.currency === base()) {
      if (box) box.hidden = true
      return
    }
    box.textContent = t('modals.transaction.conversionPreview', {
      note: conversionNoteWithRates(
        value,
        selected.currency,
        base(),
        currentTransactionRates()
      ),
    })
    box.hidden = false
  }
  let splitPickerSequence = 0
  const extra = () => {
    $('#tx-extra').innerHTML =
      chosen === 'transfer'
        ? `${accountPicker('tx-to', 'toAccountId', t('modals.transaction.destinationAccount'), tx?.toAccountId || active.find(a => a.id !== $('#tx-account').value)?.id || '')}<div class="field" id="tx-transfer-rate-field" hidden><label id="tx-transfer-rate-label" for="tx-transfer-rate">${escapeHtml(t('modals.transaction.exchangeRate'))}</label><input id="tx-transfer-rate" name="transferRate" type="text" inputmode="decimal" data-decimal-input pattern="[0-9]+([.,][0-9]+)?" placeholder="${escapeHtml(t('modals.transaction.transferRatePlaceholder'))}"></div><div class="field" id="tx-received-field" hidden><label id="tx-received-label" for="tx-received">${escapeHtml(t('modals.transaction.amountReceivedFallback'))}</label><input id="tx-received" name="received" type="text" inputmode="decimal" data-decimal-input pattern="[0-9]+([.,][0-9]+)?" placeholder="${escapeHtml(t('modals.transaction.amountPlaceholder'))}"></div>`
        : `<div id="tx-category-field">${categoryPicker('tx-category', chosen, tx?.categoryId, tx?.subcategoryId, 'categoryChoice')}</div><div class="field" id="split-container"><label><input type="checkbox" id="enable-splits" ${tx?.splits?.length ? 'checked' : ''} style="width:auto"> ${escapeHtml(t('modals.transaction.splitIntoCategories'))}</label><div id="split-fields"></div></div>`
    if (chosen === 'transfer') {
      lastTransferPair = ''
      $('#tx-to').onchange = updateConversionPreview
      bindAccountPicker('tx-to')
      $('#tx-transfer-rate').oninput = updateConversionPreview

      $('#tx-received').oninput = updateConversionPreview
    }
    if (chosen !== 'transfer') {
      bindCategoryPicker('tx-category')
      const toggle = $('#enable-splits'),
        container = $('#split-fields')
      const draw = () => {
        $('#tx-category-field').hidden = toggle.checked
        $('#tx-category').disabled = toggle.checked
        if (toggle.checked) {
          $('#tx-category-picker').hidden = true
          $('#tx-category-toggle').setAttribute('aria-expanded', 'false')
        }
        container.innerHTML = toggle.checked
          ? `<div id="split-rows"></div><button type="button" class="btn secondary" id="add-split" style="margin-top:9px">${escapeHtml(t('modals.transaction.addSplit'))}</button><p class="form-hint">${escapeHtml(t('modals.transaction.splitHint'))}</p>`
          : ''
        if (toggle.checked) {
          let rows = tx?.splits?.length
            ? tx.splits
            : [
                {
                  categoryId: state.categories.find(c => c.type === chosen)?.id,
                  subcategoryId: '',
                  amount: '',
                },
                {
                  categoryId: state.categories.find(c => c.type === chosen)?.id,
                  subcategoryId: '',
                  amount: '',
                },
              ]
          const addRow = s => {
            const el = document.createElement('div')
            const pickerId = 'tx-split-category-' + ++splitPickerSequence
            el.className = 'field-row split-row'
            el.innerHTML = `${categoryPicker(pickerId, chosen, s.categoryId, s.subcategoryId, '', 'split-cat')}<div class="field"><label>${escapeHtml(t('modals.amount'))}</label><input class="split-amount" type="text" inputmode="decimal" data-decimal-input pattern="-?[0-9]+([.,][0-9]+)?" value="${s.amount ?? ''}" required></div>`
            $('#split-rows').append(el)
            bindCategoryPicker(pickerId)
          }
          rows.forEach(addRow)
          $('#add-split').onclick = () => addRow({})
        }
      }
      toggle.onchange = draw
      draw()
    }
  }
  extra()
  document.querySelectorAll('[data-type]').forEach(
    b =>
      (b.onclick = () => {
        chosen = b.dataset.type
        document.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('active', x === b))
        extra()
        updateConversionPreview()
      })
  )
  $('#delete-tx')?.addEventListener('click', () => {
    confirmAction({
      title: t('modals.transaction.confirmDeleteTitle'),
      message: t('modals.transaction.confirmDeleteMessage'),
      confirmText: t('modals.transaction.confirmDeleteButton'),
      onCancel: () => transactionModal(tx),
      onConfirm: async () => {
        await del('transactions', tx.id)
        closeModal()
        await reload()
      },
    })
  })
  $('#copy-tx')?.addEventListener('click', () => copyTransactionDateChoice(tx))
  $('#tx-amount')?.addEventListener('input', updateConversionPreview)
  $('#tx-account')?.addEventListener('change', updateConversionPreview)
  bindAccountPicker('tx-account')
  $('#tx-rate')?.addEventListener('input', updateConversionPreview)
  updateConversionPreview()
  $('#tx-form').onsubmit = async e => {
    e.preventDefault()
    const f = new FormData(e.target),
      from = account(f.get('accountId'))
    if (!from) return toast(t('toasts.selectAccount'))
    const v = amount(f.get('amount'))
    if (v <= 0) return toast(t('toasts.validAmount'))
    const dateTime = String(f.get('datetime') || '')
    const parts = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(
      dateTime
    )
    if (!parts) return toast(t('toasts.validDateTime'))
    const year = Number(parts[1]),
      month = Number(parts[2]),
      day = Number(parts[3])
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1])
      return toast(t('toasts.validDateTime'))
    // Keep local calendar values intact: converting to UTC could change the reporting day.
    const [date, time] = dateTime.split('T')
    let record = {
      id: isExisting ? tx.id : uid(),
      type: chosen,
      amount: v,
      date,
      time,
      accountId: from.id,
      payee: String(f.get('payee') || '').trim(),
      description: String(f.get('description') || '').trim(),
      exchangeRates: currentTransactionRates(),
      createdAt: isExisting ? tx.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    record.exchangeRateFrom = from.currency
    record.exchangeRateTo = base()
    record.exchangeRate = conversionRate(from.currency, base()) || null
    if (record.exchangeRates[from.currency] && record.exchangeRates[base()])
      record.exchangeRate = record.exchangeRates[base()] / record.exchangeRates[from.currency]
    if (chosen === 'transfer') {
      const to = account(f.get('toAccountId'))
      if (!to || to.id === from.id) return toast(t('toasts.selectDestinationAccount'))
      record.toAccountId = to.id
      const transferRate = from.currency === to.currency ? 1 : decimalValue(f.get('transferRate'))
      if (!Number.isFinite(transferRate) || transferRate <= 0)
        return toast(t('toasts.validExchangeRate'))
      const crossCurrency = from.currency !== to.currency
      record.received = crossCurrency ? amount(f.get('received')) : v
      if (!Number.isFinite(record.received) || record.received <= 0)
        return toast(t('toasts.validReceivedAmount'))
      // Keep the stored rate in destination units per source unit for compatibility.
      record.transferRate = crossCurrency ? record.received / v : 1
      record.exchangeRates = rateSnapshotForCurrencies([from.currency, to.currency, base()], {
        ...exchangeRates(),
        ...record.exchangeRates,
      })
    } else {
      const validCategory = selection => {
        const category = cat(selection.categoryId)
        return (
          category?.type === chosen &&
          (!selection.subcategoryId ||
            category.subcategories?.some(child => child.id === selection.subcategoryId))
        )
      }
      if ($('#enable-splits')?.checked) {
        record.splits = [...document.querySelectorAll('.split-row')].map(row => {
          const selected = parseCategoryChoice(row.querySelector('.split-cat').value)
          return {
            categoryId: selected.categoryId,
            subcategoryId: selected.subcategoryId || null,
            amount: amount(row.querySelector('.split-amount').value),
          }
        })
        if (record.splits.some(split => !validCategory(split)))
          return toast(t('toasts.validSplitCategory'))
        if (record.splits.some(split => split.amount <= 0))
          return toast(t('toasts.validSplitAmount'))
        if (
          Math.round(record.splits.reduce((s, x) => s + x.amount, 0) * 100) !== Math.round(v * 100)
        )
          return toast(t('toasts.splitMustEqualTotal'))
        record.categoryId = null
        record.subcategoryId = null
      } else {
        const selectedCategory = parseCategoryChoice(f.get('categoryChoice'))
        if (!validCategory(selectedCategory))
          return toast(t('toasts.selectCategory'))
        record.categoryId = selectedCategory.categoryId
        record.subcategoryId = selectedCategory.subcategoryId || null
      }
    }
    await put('transactions', record)
    closeModal()
    await reload()
    toast(t('toasts.transactionSaved'))
  }
}

function categoriesModal() {
  const categoryRow = c =>
    `<div class="category-item"><div class="transaction"><div class="tx-icon" style="background:${c.color}20;color:${c.color}">${escapeHtml(c.icon)}</div><div class="tx-main"><b>${escapeHtml(c.name)}</b><small>${escapeHtml(txTypeLabel(c.type))}${c.subcategories?.length ? ` · ${escapeHtml(t('modals.categories.subcategoryCount', { count: c.subcategories.length }))}` : ''}</small></div><div class="category-actions"><button class="mini-btn" data-move-category="${c.id}" data-direction="-1" title="${escapeHtml(t('modals.moveUp'))}">↑</button><button class="mini-btn" data-move-category="${c.id}" data-direction="1" title="${escapeHtml(t('modals.moveDown'))}">↓</button><button class="mini-btn" data-edit-category="${c.id}" title="${escapeHtml(t('modals.categories.editTitle'))}">✎</button><button class="mini-btn" data-remove-category="${c.id}" title="${escapeHtml(t('modals.remove'))}">×</button></div></div>${
      c.subcategories?.length
        ? `<div class="subcategory-list">${c.subcategories
            .slice()
            .sort(sortByOrderThenName)
            .map(
              s =>
                `<span class="subcategory-chip">${escapeHtml((s.icon || '◦') + ' ' + s.name)}</span>`
            )
            .join('')}</div>`
        : ''
    }</div>`
  const categorySection = (type, title, description) => {
    const items = state.categories.filter(c => c.type === type).sort(sortByOrderThenName)
    return `<section class="category-group"><div class="category-group-head"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div><button class="btn secondary" data-new-category="${type}">${escapeHtml(t('modals.categories.new'))}</button></div><div class="table-list">${items.length ? items.map(categoryRow).join('') : empty(type === 'expense' ? t('modals.categories.empty.expense.title') : t('modals.categories.empty.income.title'), type === 'expense' ? t('modals.categories.empty.expense.desc') : t('modals.categories.empty.income.desc'), type === 'expense' ? '↗' : '↙')}</div></section>`
  }
  modal(
    t('modals.categories.title'),
    `<div class="category-manager">${categorySection('expense', t('modals.categories.expenseTitle'), t('modals.categories.expenseDesc'))}${categorySection('income', t('modals.categories.incomeTitle'), t('modals.categories.incomeDesc'))}</div>`
  )
  document
    .querySelectorAll('[data-new-category]')
    .forEach(b => (b.onclick = () => categoryEdit(null, b.dataset.newCategory)))
  document
    .querySelectorAll('[data-move-category]')
    .forEach(
      b => (b.onclick = () => moveCategory(b.dataset.moveCategory, Number(b.dataset.direction)))
    )
  document
    .querySelectorAll('[data-edit-category]')
    .forEach(b => (b.onclick = () => categoryEdit(cat(b.dataset.editCategory))))
  document.querySelectorAll('[data-remove-category]').forEach(
    b =>
      (b.onclick = async () => {
        if (
          state.transactions.some(
            t =>
              t.categoryId === b.dataset.removeCategory ||
              t.splits?.some(s => s.categoryId === b.dataset.removeCategory)
          )
        )
          return toast(t('toasts.categoryInUse'))
        confirmAction({
          title: t('modals.categories.deleteCategoryTitle'),
          message: t('modals.categories.confirmDeleteMessage'),
          confirmText: t('modals.categories.confirmDeleteButton'),
          onCancel: categoriesModal,
          onConfirm: async () => {
            await del('categories', b.dataset.removeCategory)
            await reload()
            categoriesModal()
          },
        })
      })
  )
}

function categoryEdit(c, initialType = 'expense') {
  const selectedType = c?.type || initialType
  const subcategoryRows = (c?.subcategories || [])
    .slice()
    .sort(sortByOrderThenName)
    .map(
      s =>
        `<div class="field-row subcategory-row" data-subcategory-id="${s.id}"><div class="field"><label>${escapeHtml(t('modals.categories.subcategoryName'))}</label><input class="subcategory-name" maxlength="45" value="${escapeHtml(s.name || '')}"></div><div class="field"><label>${escapeHtml(t('modals.categories.icon'))}</label><div class="inline-field"><input class="subcategory-icon" maxlength="4" value="${escapeHtml(s.icon || '')}" placeholder="◦"><button type="button" class="mini-btn" data-move-subcategory="-1" title="${escapeHtml(t('modals.moveUp'))}">↑</button><button type="button" class="mini-btn" data-move-subcategory="1" title="${escapeHtml(t('modals.moveDown'))}">↓</button><button type="button" class="mini-btn" data-remove-subcategory title="${escapeHtml(t('modals.remove'))}">×</button></div></div></div>`
    )
    .join('')
  modal(
    c ? t('modals.categories.editCategoryTitle') : t('modals.categories.newTitle'),
    `<form id="category-form"><div class="field"><label>${escapeHtml(t('modals.categories.name'))}</label><input name="name" required maxlength="45" value="${escapeHtml(c?.name || '')}"></div><div class="field-row"><div class="field"><label>${escapeHtml(t('modals.categories.type'))}</label><select name="type" ${c ? 'disabled' : ''}><option value="expense" ${selectedType === 'expense' ? 'selected' : ''}>${escapeHtml(t('common.expense'))}</option><option value="income" ${selectedType === 'income' ? 'selected' : ''}>${escapeHtml(t('common.income'))}</option></select></div><div class="field"><label>${escapeHtml(t('modals.categories.icon'))}</label><input name="icon" maxlength="4" value="${escapeHtml(c?.icon || '◈')}"></div></div><div class="field"><label>${escapeHtml(t('modals.categories.color'))}</label><input name="color" type="color" value="${c?.color || '#3b82f6'}" style="height:48px"></div><div class="field"><label>${escapeHtml(t('modals.categories.subcategories'))}</label><div id="subcategory-rows">${subcategoryRows}</div><button type="button" class="btn secondary" id="add-subcategory">${escapeHtml(t('modals.categories.addSubcategory'))}</button><p class="form-hint">${escapeHtml(t('modals.categories.subcategoryHint'))}</p></div><div class="modal-footer"><button class="btn">${escapeHtml(t('modals.categories.save'))}</button></div></form>`
  )
  const addSubcategoryRow = (item = {}) => {
    const row = document.createElement('div')
    row.className = 'field-row subcategory-row'
    row.dataset.subcategoryId = item.id || ''
    row.innerHTML = `<div class="field"><label>${escapeHtml(t('modals.categories.subcategoryName'))}</label><input class="subcategory-name" maxlength="45" value="${escapeHtml(item.name || '')}"></div><div class="field"><label>${escapeHtml(t('modals.categories.icon'))}</label><div class="inline-field"><input class="subcategory-icon" maxlength="4" value="${escapeHtml(item.icon || '')}" placeholder="◦"><button type="button" class="mini-btn" data-move-subcategory="-1" title="${escapeHtml(t('modals.moveUp'))}">↑</button><button type="button" class="mini-btn" data-move-subcategory="1" title="${escapeHtml(t('modals.moveDown'))}">↓</button><button type="button" class="mini-btn" data-remove-subcategory title="${escapeHtml(t('modals.remove'))}">×</button></div></div>`
    $('#subcategory-rows').append(row)
  }
  $('#add-subcategory').onclick = () => addSubcategoryRow()
  $('#subcategory-rows').onclick = e => {
    const remove = e.target.closest('[data-remove-subcategory]')
    if (remove) return remove.closest('.subcategory-row')?.remove()
    const move = e.target.closest('[data-move-subcategory]')
    if (!move) return
    const row = move.closest('.subcategory-row'),
      sibling =
        Number(move.dataset.moveSubcategory) < 0
          ? row?.previousElementSibling
          : row?.nextElementSibling
    if (row && sibling)
      Number(move.dataset.moveSubcategory) < 0 ? sibling.before(row) : sibling.after(row)
  }
  $('#category-form').onsubmit = async e => {
    e.preventDefault()
    const f = new FormData(e.target)
    const usedSubcategoryIds = new Set(
      state.transactions
        .flatMap(t => [
          t.categoryId === c?.id && t.subcategoryId,
          ...(t.splits || []).filter(s => s.categoryId === c?.id).map(s => s.subcategoryId),
        ])
        .filter(Boolean)
    )
    const subcategories = [...document.querySelectorAll('.subcategory-row')]
      .map(row => ({
        id: row.dataset.subcategoryId || uid(),
        name: row.querySelector('.subcategory-name').value.trim(),
        icon: row.querySelector('.subcategory-icon').value.trim(),
        sortOrder: [...document.querySelectorAll('.subcategory-row')].indexOf(row),
      }))
      .filter(s => s.name)
    const keptIds = new Set(subcategories.map(s => s.id))
    if ((c?.subcategories || []).some(s => usedSubcategoryIds.has(s.id) && !keptIds.has(s.id)))
      return toast(t('toasts.subcategoryInUse'))
    await put('categories', {
      id: c?.id || uid(),
      name: f.get('name').trim(),
      type: c?.type || f.get('type'),
      icon: f.get('icon') || '◈',
      color: f.get('color'),
      sortOrder:
        c?.sortOrder ?? state.categories.filter(x => x.type === (c?.type || f.get('type'))).length,
      subcategories,
    })
    await reload()
    categoriesModal()
  }
}

function budgetsModal() {
  const items = orderedBudgets(state.budgets.filter(b => b.month === state.month))
  modal(
    t('modals.budgets.title'),
    `<div class="toolbar">${monthControl()}<button class="btn" id="new-budget">${escapeHtml(t('modals.budgets.add'))}</button></div><div class="table-list">${items.length ? items.map(b => `<div class="transaction"><div class="tx-icon">◉</div><div class="tx-main"><b>${escapeHtml(cat(b.categoryId)?.name || t('modals.budgets.overallBudget'))}</b><small>${escapeHtml(monthLabel(b.month))}</small></div><b>${money(b.limit, base())}</b><button class="mini-btn" data-remove-budget="${b.id}">×</button></div>`).join('') : empty(t('modals.budgets.empty.title'), t('modals.budgets.empty.desc'))}</div>`
  )
  bindMonth()
  $('#prev-month').onclick = () => {
    shiftBudget(-1)
  }
  $('#next-month').onclick = () => {
    shiftBudget(1)
  }
  $('#new-budget').onclick = budgetEdit
  document.querySelectorAll('[data-remove-budget]').forEach(
    b =>
      (b.onclick = async () => {
        await del('budgets', b.dataset.removeBudget)
        await reload()
        budgetsModal()
      })
  )
}

function shiftBudget(n) {
  state.month = shiftMonth(state.month, n)
  render()
  budgetsModal()
}

function budgetEdit() {
  modal(
    t('modals.budgets.addTitle'),
    `<form id="budget-form"><div class="field"><label>${escapeHtml(t('modals.budgets.month'))}</label><input name="month" type="month" value="${state.month}" required></div><div class="field"><label>${escapeHtml(t('modals.budgets.category'))}</label><select name="categoryId"><option value="">${escapeHtml(t('modals.budgets.overallBudget'))}</option>${state.categories
      .filter(c => c.type === 'expense')
      .sort(sortByOrderThenName)
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join(
        ''
      )}</select></div><div class="field"><label>${escapeHtml(t('modals.budgets.monthlyLimit', { currency: base() }))}</label><input name="limit" type="text" inputmode="decimal" data-decimal-input pattern="-?[0-9]+([.,][0-9]+)?" required></div><div class="notice">${escapeHtml(t('modals.budgets.notice'))}</div><div class="modal-footer"><button class="btn">${escapeHtml(t('modals.budgets.save'))}</button></div></form>`
  )
  $('#budget-form').onsubmit = async e => {
    e.preventDefault()
    const f = new FormData(e.target),
      month = f.get('month'),
      categoryId = f.get('categoryId')
    const limit = amount(f.get('limit'))
    if (limit <= 0) return toast(t('toasts.validBudgetAmount'))
    const old = state.budgets.find(b => b.month === month && b.categoryId === categoryId)
    await put('budgets', { id: old?.id || uid(), month, categoryId, limit })
    await reload()
    budgetsModal()
  }
}

function orderedRecurring(items) {
  const label = rule =>
    String(
      rule.payee ||
        rule.place ||
        rule.description ||
        rule.note ||
        cat(rule.categoryId)?.name ||
        'Recurring'
    )
  return items.slice().sort(
    (a, b) =>
      String(a.nextDate || '9999-12-31').localeCompare(String(b.nextDate || '9999-12-31')) ||
      String(a.time || '12:00')
        .padEnd(8, ':00')
        .localeCompare(String(b.time || '12:00').padEnd(8, ':00')) ||
      label(a).localeCompare(label(b), undefined, { sensitivity: 'base' }) ||
      String(a.id || '').localeCompare(String(b.id || ''))
  )
}

function recurringModal() {
  const items = orderedRecurring(state.recurring)
  modal(
    t('modals.recurring.title'),
    `<div class="toolbar"><span class="muted">${escapeHtml(t('modals.recurring.subtitle'))}</span><button class="btn" id="new-recurring">${escapeHtml(t('modals.recurring.new'))}</button></div><div class="table-list">${items.length ? items.map(r => `<div class="transaction"><div class="tx-icon">↻</div><div class="tx-main"><b>${escapeHtml(r.payee || r.place || r.description || r.note || cat(r.categoryId)?.name || t('modals.recurring.fallbackLabel'))}</b><small>${escapeHtml(t('modals.recurring.frequency.' + r.frequency))} · ${escapeHtml(t('modals.recurring.nextAt', { date: displayDate(r.nextDate) }))}${r.time ? escapeHtml(t('modals.recurring.atTime', { time: r.time })) : ''} · ${escapeHtml(r.paused ? t('modals.recurring.paused') : t('modals.recurring.active'))}</small></div><b>${money(r.amount, account(r.accountId)?.currency || base())}</b><button class="mini-btn" data-pause="${r.id}">${r.paused ? '▶' : 'Ⅱ'}</button><button class="mini-btn" data-remove-recurring="${r.id}">×</button></div>`).join('') : empty(t('modals.recurring.empty.title'), t('modals.recurring.empty.desc'), '↻')}</div>`
  )
  $('#new-recurring').onclick = recurringEdit
  document.querySelectorAll('[data-pause]').forEach(
    b =>
      (b.onclick = async () => {
        const r = state.recurring.find(x => x.id === b.dataset.pause)
        await put('recurring', { ...r, paused: !r.paused })
        await reload()
        recurringModal()
      })
  )
  document.querySelectorAll('[data-remove-recurring]').forEach(
    b =>
      (b.onclick = async () => {
        confirmAction({
          title: t('modals.recurring.confirmRemoveTitle'),
          message: t('modals.recurring.confirmRemoveMessage'),
          confirmText: t('modals.recurring.confirmRemoveButton'),
          onCancel: recurringModal,
          onConfirm: async () => {
            await del('recurring', b.dataset.removeRecurring)
            await reload()
            recurringModal()
          },
        })
      })
  )
}

function recurringEdit() {
  const active = orderedAccounts(state.accounts.filter(isSelectableAccount))
  if (!active.length) {
    if (!state.accounts.length) return accountModal()
    return toast(t('toasts.noVisibleAccountsForSchedule'))
  }
  modal(
    t('modals.recurring.newTitle'),
    `<form id="rec-form"><div class="field-row"><div class="field"><label>${escapeHtml(t('transactions.filter.type'))}</label><select name="type" id="rec-type"><option value="expense">${escapeHtml(t('txTypes.expense'))}</option><option value="income">${escapeHtml(t('txTypes.income'))}</option></select></div><div class="field"><label>${escapeHtml(t('modals.amount'))}</label><input name="amount" type="text" inputmode="decimal" data-decimal-input pattern="-?[0-9]+([.,][0-9]+)?" required></div></div><div class="field"><label>${escapeHtml(t('modals.transaction.account'))}</label><select name="accountId">${active.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${a.currency})</option>`).join('')}</select></div><div class="field"><label>${escapeHtml(t('modals.budgets.category'))}</label><select name="categoryId" id="rec-cat"></select></div><div class="field-row"><div class="field"><label>${escapeHtml(t('modals.recurring.frequency'))}</label><select name="frequency"><option value="daily">${escapeHtml(t('modals.recurring.frequency.daily'))}</option><option value="weekly">${escapeHtml(t('modals.recurring.frequency.weekly'))}</option><option value="monthly" selected>${escapeHtml(t('modals.recurring.frequency.monthly'))}</option><option value="yearly">${escapeHtml(t('modals.recurring.frequency.yearly'))}</option></select></div><div class="field"><label>${escapeHtml(t('modals.recurring.firstDate'))}</label><input name="nextDate" type="date" value="${today()}" required></div></div><div class="field"><label>${escapeHtml(t('modals.recurring.time'))}</label><input name="time" type="time" value="${currentTime()}" required></div><div class="field"><label>${escapeHtml(t('modals.recurring.payee'))}</label>${payeeAutocompleteInput('', 'rec-payee')}</div><div class="field"><label>${escapeHtml(t('modals.recurring.description'))}</label><input name="description" maxlength="180"></div><div class="modal-footer"><button class="btn">${escapeHtml(t('modals.recurring.create'))}</button></div></form>`
  )
  bindPayeeAutocomplete('rec-payee')
  const fill = () => {
    $('#rec-cat').innerHTML = state.categories
      .filter(c => c.type === $('#rec-type').value)
      .sort(sortByOrderThenName)
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join('')
  }
  $('#rec-type').onchange = fill
  fill()
  $('#rec-form').onsubmit = async e => {
    e.preventDefault()
    const f = new FormData(e.target)
    const value = amount(f.get('amount'))
    if (value <= 0) return toast(t('toasts.validAmount'))
    await put('recurring', {
      id: uid(),
      type: f.get('type'),
      amount: value,
      accountId: f.get('accountId'),
      categoryId: f.get('categoryId'),
      frequency: f.get('frequency'),
      nextDate: f.get('nextDate'),
      time: f.get('time'),
      payee: String(f.get('payee') || '').trim(),
      description: String(f.get('description') || '').trim(),
      paused: false,
    })
    await reload()
    recurringModal()
  }
}

function nextDate(date, freq) {
  const d = new Date(date + 'T12:00:00')
  const day = d.getDate()
  if (freq === 'daily') d.setDate(day + 1)
  if (freq === 'weekly') d.setDate(day + 7)
  if (freq === 'monthly') {
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  }
  if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d.toLocaleDateString('en-CA')
}

async function processRecurring() {
  const rs = await all('recurring'),
    existing = await all('transactions')
  let changed = false
  for (const r of rs) {
    if (r.paused) continue
    let count = 0
    while (r.nextDate <= today() && count++ < 120) {
      const key = `rec-${r.id}-${r.nextDate}`
      if (!existing.some(t => t.id === key)) {
        const from = account(r.accountId),
          snapshot = rateSnapshotForCurrencies([account(r.accountId)?.currency, base()])
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
          exchangeRate:
            from?.currency && snapshot[from.currency] && snapshot[base()]
              ? snapshot[base()] / snapshot[from.currency]
              : null,
          createdAt: new Date().toISOString(),
        })
      }
      r.nextDate = nextDate(r.nextDate, r.frequency)
      changed = true
    }
    if (count > 1) await put('recurring', r)
  }
  return changed
}

function download(content, filename, type) {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function exportTimestamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function welcomeModal() {
  modal(
    t('welcome.modalTitle'),
    `<div class="welcome-content">
      <p>${escapeHtml(t('welcome.intro'))}</p>
      <ul class="welcome-steps">
        <li>${escapeHtml(t('welcome.step1'))}</li>
        <li>${escapeHtml(t('welcome.step2'))}</li>
        <li>${escapeHtml(t('welcome.step3'))}</li>
      </ul>
      <div class="notice">${escapeHtml(t('welcome.notice'))}</div>
      <button type="button" class="btn" id="welcome-start">${escapeHtml(t('welcome.getStarted'))}</button>
    </div>`
  )
  const start = $('#welcome-start')
  const close = $('#close-modal')
  const dismiss = async () => {
    if (start.disabled) return
    start.disabled = close.disabled = true
    try {
      await saveCurrencySettings({ welcomeSeen: true })
      if ($('#welcome-start') === start) closeModal()
    } catch (error) {
      console.error(error)
      if ($('#welcome-start') === start) closeModal()
      toast(t('toasts.welcomePreferenceFailed'))
    } finally {
      start.disabled = close.disabled = false
    }
  }
  start.onclick = dismiss
  close.onclick = dismiss
}

function resetDataModal() {
  confirmAction({
    title: t('modals.reset.title'),
    message: t('modals.reset.message'),
    confirmText: t('modals.reset.confirm'),
    onCancel: settingsModal,
    onConfirm: async () => {
      const buttons = ['#confirm-ok', '#confirm-cancel', '#close-modal'].map(selector =>
        $(selector)
      )
      if (buttons[0].disabled) return
      buttons.forEach(button => (button.disabled = true))
      try {
        const categories = defaults.map(([nameKey, icon, color, type]) => ({
          id: uid(),
          name: t(nameKey),
          icon,
          color,
          type,
        }))
        // Clear every store and restore starter categories in one atomic transaction.
        cancelCurrencySync()
        await replaceAll({ categories })
        clearTimeout(txSearchTimer)
        state = createInitialState()
        state.categories = categories
        closeModal()
        render()
        toast(t('toasts.dataReset'))
        welcomeModal()
      } catch (error) {
        console.error(error)
        toast(t('toasts.dataResetFailed'))
      } finally {
        buttons.forEach(button => (button.disabled = false))
      }
    },
  })
}

function updateAddCurrencyOptions() {
  const select = $('#new-currency-code')
  if (!select) return
  const codes = syncedCurrenciesToAdd()
  const selected = select.value
  const options = `<option value="">${escapeHtml(t('settings.addCurrency.select'))}</option>${codes.map(code => `<option value="${code}">${code}</option>`).join('')}`
  if (select.innerHTML !== options) select.innerHTML = options
  select.value = codes.includes(selected) ? selected : ''
  select.disabled = !codes.length
  const hint = $('#new-currency-hint')
  if (hint)
    hint.textContent =
      getSetting('currencySync', {}).provider !== 'exchangerate.fun'
        ? t('settings.addCurrency.hint.syncFirst')
        : codes.length
          ? t('settings.addCurrency.hint.choose')
          : t('settings.addCurrency.hint.allAdded')
}

function reportingCurrencyNotice() {
  return t('settings.reportingNotice', { base: base() })
}

function refreshSettingsCurrencyControls({ savedCodes = [] } = {}) {
  const content = $('.settings-content')
  if (!content?.querySelector) return
  const codes = availableCurrencies()
  const select = content.querySelector('#base-currency')
  if ([...select.options].map(option => option.value).join() !== codes.join()) {
    const selected = select.value
    select.innerHTML = currencyOptions(selected)
    select.value = selected
  }
  content.querySelector('#base-currency-notice').textContent = reportingCurrencyNotice()
  const list = content.querySelector('.rate-list')
  for (const code of codes) {
    if (list.querySelector(`[data-rate-currency="${code}"]`)) continue
    const nextRow = [...list.children].find(row => row.dataset.rateCurrency > code)
    if (nextRow) nextRow.insertAdjacentHTML('beforebegin', exchangeRateRow(code))
    else list.insertAdjacentHTML('beforeend', exchangeRateRow(code))
  }
  const rates = exchangeRates()
  for (const input of list.querySelectorAll('.rate-input')) {
    // Preserve dirty fields except those explicitly saved or reset by this action.
    if (
      savedCodes.includes(input.name) ||
      decimalValue(input.value) === Number(input.dataset.originalRate)
    ) {
      const value = String(rates[input.name] ?? '')
      if (input.value !== value) input.value = value
      input.dataset.originalRate = value
    }
  }
  bindModalNumberInputs()
  updateCurrencySyncStatus()
}

function settingsModal() {
  const previousBody = $('.modal-body')
  const restoreView = previousBody?.querySelector?.('.settings-content')
    ? { scrollTop: previousBody.scrollTop, focusId: document.activeElement?.id }
    : null
  modal(
    t('settings.title'),
    `<div class="settings-content">
      <section class="settings-section">
        <div class="field">
          <label for="app-language">${escapeHtml(t('settings.language'))}</label>
          <select id="app-language">${languageOptions()}</select>
          <p class="form-hint">${escapeHtml(t('settings.languageHint'))}</p>
        </div>
      </section>

      <section class="settings-section">
        <div class="field">
          <label for="base-currency">${escapeHtml(t('settings.baseCurrency'))}</label>
          <select id="base-currency">${currencyOptions(base())}</select>
        </div>
        <div class="notice" id="base-currency-notice">${escapeHtml(reportingCurrencyNotice())}</div>
      </section>

      <section class="settings-section" aria-labelledby="currency-sync-heading">
        <header class="settings-section-head">
          <h3 id="currency-sync-heading">${escapeHtml(t('settings.currencySync.title'))}</h3>
        </header>
        <div class="field">
          <label><input type="checkbox" id="sync-on-startup" ${getSetting('syncCurrenciesOnStartup', true) ? 'checked' : ''}> ${escapeHtml(t('settings.currencySync.syncOnStartup'))}</label>
          <p class="form-hint" id="currency-sync-status" role="status">${escapeHtml(currencySyncStatus())}</p>
        </div>
        <div class="settings-actions">
          <button type="button" class="btn secondary" id="sync-currencies" ${currencySyncRequest ? 'disabled' : ''}>${escapeHtml(t('settings.currencySync.syncNow'))}</button>
          <button type="button" class="btn ghost" id="use-synced-rates">${escapeHtml(t('settings.currencySync.useSyncedRates'))}</button>
        </div>
        <form id="rates-form" class="settings-section-form">
          <div class="rate-list">${exchangeRateRows()}</div>
          <div class="settings-actions">
            <button class="btn secondary" type="submit" id="save-rates">${escapeHtml(t('settings.currencySync.saveRates'))}</button>
          </div>
        </form>
      </section>

      <form id="add-currency-form" class="settings-section" aria-labelledby="add-currency-heading">
        <header class="settings-section-head">
          <h3 id="add-currency-heading">${escapeHtml(t('settings.addCurrency.title'))}</h3>
          <p class="form-hint" id="new-currency-hint"></p>
        </header>
        <div class="field-row">
          <div class="field">
            <label for="new-currency-code">${escapeHtml(t('settings.addCurrency.currency'))}</label>
            <select id="new-currency-code" name="code" required></select>
          </div>
          <div class="field">
            <label for="new-currency-rate">${escapeHtml(t('settings.addCurrency.unitsPerEur'))}</label>
            <input id="new-currency-rate" name="rate" type="text" inputmode="decimal" data-decimal-input pattern="[0-9]+([.,][0-9]+)?" placeholder="${escapeHtml(t('settings.addCurrency.ratePlaceholder'))}">
          </div>
        </div>
        <div class="settings-actions">
          <button class="btn secondary" type="submit" id="add-currency-submit">${escapeHtml(t('settings.addCurrency.submit'))}</button>
        </div>
      </form>

      <section class="settings-section" aria-labelledby="backup-heading">
        <header class="settings-section-head">
          <h3 id="backup-heading">${escapeHtml(t('settings.backup.title'))}</h3>
          <p class="form-hint">${escapeHtml(t('settings.backup.hint'))}</p>
        </header>
        <div class="settings-backup-actions">
          <button class="btn secondary" id="export-json">${escapeHtml(t('settings.backup.exportJson'))}</button>
          <button class="btn secondary" id="export-csv">${escapeHtml(t('settings.backup.exportCsv'))}</button>
          <label class="btn ghost" style="text-align:center;cursor:pointer">${escapeHtml(t('settings.backup.importJson'))}<input id="import-json" type="file" accept="application/json,.json" hidden></label>
        </div>
        <div class="notice">${escapeHtml(t('settings.backup.securityNotice'))}</div>
      </section>

      <section class="settings-section" aria-labelledby="reset-heading">
        <header class="settings-section-head">
          <h3 id="reset-heading">${escapeHtml(t('settings.reset.title'))}</h3>
          <p class="form-hint">${escapeHtml(t('settings.reset.hint'))}</p>
        </header>
        <button type="button" class="btn danger" id="reset-all-data">${escapeHtml(t('settings.reset.button'))}</button>
      </section>
    </div>
    <p class="settings-version">${escapeHtml(t('settings.version', { version: APP_VERSION }))}</p>`,
    { restoreView }
  )
  $('#app-language').onchange = async e => {
    if (e.target.value !== getLanguage()) await setLanguage(e.target.value)
  }
  updateAddCurrencyOptions()
  $('#add-currency-form').onsubmit = async e => {
    e.preventDefault()
    const form = e.target
    const code = form.elements.code.value.trim().toUpperCase()
    const manualRate = form.elements.rate.value.trim() !== ''
    const rate = manualRate
      ? decimalValue(form.elements.rate.value)
      : getSetting('currencySync', {}).rates?.[code]
    if (!syncedCurrenciesToAdd().includes(code))
      return toast(t('toasts.chooseSyncedCurrency'))
    if (!Number.isFinite(rate) || rate <= 0)
      return toast(t('toasts.positiveReferenceRate'))
    const button = form.querySelector('button[type="submit"]')
    if (button.disabled) return
    button.disabled = true
    try {
      await saveCurrencySettings({
        exchangeRates: { ...exchangeRates(), [code]: rate },
        manualCurrencyCodes: [
          ...new Set([...manualCurrencyCodes(), ...(manualRate ? [code] : [])]),
        ],
      })
      render()
      refreshSettingsCurrencyControls()
      form.elements.code.value = ''
      form.elements.rate.value = ''
      toast(t('toasts.currencyAdded', { code }))
    } catch (error) {
      console.error(error)
      toast(t('toasts.currencyAddFailed'))
    } finally {
      button.disabled = false
    }
  }
  $('#sync-currencies').onclick = syncCurrencyRates
  $('#sync-on-startup').onchange = async e => {
    try {
      await saveCurrencySettings({ syncCurrenciesOnStartup: e.target.checked })
    } catch (error) {
      e.target.checked = getSetting('syncCurrenciesOnStartup', true)
      toast(t('toasts.startupSyncFailed'))
    }
  }
  $('#use-synced-rates').onclick = async () => {
    const cached = getSetting('currencySync', {}).rates
    if (!cached) return toast(t('toasts.syncFirstForAutoRates'))
    const next = { ...exchangeRates() }
    const manual = manualCurrencyCodes().filter(code => !cached[code])
    for (const code of Object.keys(next)) if (cached[code]) next[code] = cached[code]
    try {
      await saveCurrencySettings({ exchangeRates: next, manualCurrencyCodes: manual })
      render()
      refreshSettingsCurrencyControls({
        savedCodes: Object.keys(next).filter(code => cached[code]),
      })
      toast(t('toasts.syncedRatesApplied'))
    } catch (error) {
      toast(t('toasts.syncedRatesFailed'))
    }
  }
  $('#reset-all-data').onclick = resetDataModal
  $('#base-currency').onchange = async e => {
    if (!canReportInCurrency(e.target.value)) {
      e.target.value = base()
      return toast(t('toasts.reportingCurrencyBlocked'))
    }
    await saveCurrencySettings({ baseCurrency: e.target.value })
    render()
    refreshSettingsCurrencyControls()
  }
  $('#rates-form').onsubmit = async e => {
    e.preventDefault()
    const next = { ...exchangeRates() }
    const manual = new Set(manualCurrencyCodes())
    for (const input of e.target.querySelectorAll('.rate-input')) {
      const value = decimalValue(input.value)
      if (!Number.isFinite(value) || value <= 0)
        return toast(t('toasts.validRateFor', { currency: input.name }))
      if (value !== Number(input.dataset.originalRate)) {
        manual.add(input.name)
        next[input.name] = value
      }
    }
    next.EUR = 1
    await saveCurrencySettings({ exchangeRates: next, manualCurrencyCodes: [...manual] })
    render()
    refreshSettingsCurrencyControls({
      savedCodes: [...e.target.querySelectorAll('.rate-input')].map(input => input.name),
    })
    toast(t('toasts.exchangeRatesSaved'))
  }
  $('#export-json').onclick = async () => {
    const data = { format: 'flow-backup', version: 1, exportedAt: new Date().toISOString() }
    for (const s of storeNames) data[s] = await all(s)
    const exportedAccounts = Object.fromEntries(data.accounts.map(a => [a.id, a]))
    const exportedRates =
      data.settings.find(s => s.id === 'exchangeRates')?.value || exchangeRates()
    data.transactions = data.transactions.map(t => {
      const from = exportedAccounts[t.accountId],
        to = exportedAccounts[t.toAccountId]
      return {
        ...t,
        exchangeRates: rateSnapshotForCurrencies([from?.currency, to?.currency, base()], {
          ...exportedRates,
          ...(t.exchangeRates || {}),
        }),
      }
    })
    download(
      JSON.stringify(data, null, 2),
      'flow-bckp-' + exportTimestamp() + '.json',
      'application/json'
    )
    toast(t('toasts.backupExported'))
  }
  $('#export-csv').onclick = () => {
    const fields = [
      'date',
      'time',
      'type',
      'account',
      'currency',
      'amount',
      'category',
      'subcategory',
      'payee',
      'description',
      'exchange_rate_from',
      'exchange_rate_to',
      'exchange_rate',
      'destination',
      'received',
    ]
    const csv = [
      fields,
      ...state.transactions
        .slice()
        .sort(compareTransactionsNewestFirst)
        .map(t => [
          t.date,
          t.time || '',
          t.type,
          account(t.accountId)?.name || '',
          account(t.accountId)?.currency || '',
          t.amount,
          cat(t.categoryId)?.name || '',
          subcat(t.categoryId, t.subcategoryId)?.name || '',
          t.payee ?? t.place ?? '',
          t.description ?? t.note ?? '',
          t.exchangeRateFrom || '',
          t.exchangeRateTo || '',
          t.exchangeRate || '',
          account(t.toAccountId)?.name || '',
          t.received || '',
        ]),
    ]
      .map(row => row.map(x => '"' + String(x ?? '').replaceAll('"', '""') + '"').join(','))
      .join('\r\n')
    download(
      '\ufeff' + csv,
      'flow-trns-' + exportTimestamp() + '.csv',
      'text/csv;charset=utf-8'
    )
    toast(t('toasts.csvExported'))
  }
  $('#import-json').onchange = async e => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (
        data.format !== 'flow-backup' ||
        data.version !== 1 ||
        !storeNames.every(s => Array.isArray(data[s]))
      )
        throw Error('Unsupported backup format')
      confirmAction({
        title: t('modals.import.title'),
        message: t('modals.import.message'),
        confirmText: t('modals.import.confirm'),
        onCancel: settingsModal,
        onConfirm: async () => {
          cancelCurrencySync()
          await replaceAll(data)
          closeModal()
          await reload()
          toast(t('toasts.backupRestored'))
        },
      })
    } catch (err) {
      toast(t('toasts.importFailed', { message: err.message }))
    }
  }
}
