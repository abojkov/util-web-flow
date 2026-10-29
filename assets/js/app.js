$('#settings-shortcut').onclick = settingsModal
;(async () => {
  try {
    await reload()
    if (!state.categories.length) {
      for (const [nameKey, icon, color, type] of defaults)
        await put('categories', { id: uid(), name: t(nameKey), icon, color, type })
    }
    await processRecurring()
    await reload()
    if (!getSetting('welcomeSeen', false) && !$('#modal-root').innerHTML) welcomeModal()
    if (getSetting('syncCurrenciesOnStartup', true)) void syncCurrencyRates()
  } catch (err) {
    console.error(err)
    $('#view').innerHTML =
      '<div class="panel">Could not open local database. Try opening the app through localhost or HTTPS and check browser storage permissions.</div>'
  }
})()
