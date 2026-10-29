function getLanguage() {
  const saved = typeof getSetting === 'function' ? getSetting('language', '') : ''
  if (saved && FLOW_LOCALES[saved]) return saved
  const browser = (
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en'
  )
    .slice(0, 2)
    .toLowerCase()
  return FLOW_LOCALES[browser] ? browser : 'en'
}

function localeTag(code = getLanguage()) {
  const tags = { en: 'en-GB', es: 'es-ES', mk: 'mk-MK' }
  return tags[code] || 'en-GB'
}

function t(key, params = {}) {
  const lang = getLanguage()
  let str = FLOW_LOCALES[lang]?.[key] ?? FLOW_LOCALES.en?.[key] ?? key
  for (const [name, value] of Object.entries(params))
    str = str.replaceAll(`{${name}}`, String(value ?? ''))
  return str
}

function supportedLanguages() {
  return Object.keys(FLOW_LOCALES).map(code => ({
    code,
    label: FLOW_LANGUAGE_META[code]?.label || code.toUpperCase(),
  }))
}

function languageOptions(current = getLanguage()) {
  return supportedLanguages()
    .map(
      ({ code, label }) =>
        `<option value="${escapeHtml(code)}" ${code === current ? 'selected' : ''}>${escapeHtml(label)}</option>`
    )
    .join('')
}

const ACCOUNT_TYPES = ['Bank', 'Card', 'Cash', 'Savings', 'Investment', 'Loan', 'Other']

const ACCOUNT_TYPE_KEYS = {
  Cash: 'accountTypes.cash',
  Bank: 'accountTypes.bank',
  Card: 'accountTypes.card',
  Savings: 'accountTypes.savings',
  Investment: 'accountTypes.investment',
  Loan: 'accountTypes.loan',
  Other: 'accountTypes.other',
}

function accountTypeLabel(type) {
  const key = ACCOUNT_TYPE_KEYS[type || 'Other'] || ACCOUNT_TYPE_KEYS.Other
  return t(key)
}

function txTypeLabel(type) {
  const keys = {
    expense: 'txTypes.expense',
    income: 'txTypes.income',
    transfer: 'txTypes.transfer',
  }
  return t(keys[type] || 'common.other')
}

function applyShellI18n() {
  document.documentElement.lang = getLanguage()
  const map = {
    '.side-caption': 'shell.caption',
    '.top-left .eyebrow': 'shell.caption',
    '.sidebar-foot b': 'shell.workspace',
    '.sidebar-foot small': 'shell.workspaceSubtitle',
    '.offline': 'shell.offlineBadge',
  }
  for (const [selector, key] of Object.entries(map)) {
    const el = document.querySelector(selector)
    if (!el) continue
    if (selector === '.offline') {
      const dot = el.querySelector('.dot')
      el.textContent = ''
      if (dot) el.appendChild(dot)
      el.append(' ' + t(key))
    } else el.textContent = t(key)
  }
  const settingsBtn = $('#settings-shortcut')
  if (settingsBtn) {
    settingsBtn.title = t('shell.settingsTitle')
    settingsBtn.setAttribute('aria-label', t('shell.settingsAriaLabel'))
  }
}

async function setLanguage(code) {
  if (!FLOW_LOCALES[code]) return
  await put('settings', { id: 'language', value: code })
  await reload()
}
