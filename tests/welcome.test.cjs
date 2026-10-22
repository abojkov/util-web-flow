const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { source, createAppHarness, createModalHarness } = require('./helpers/app-harness.cjs')

test('full reset clears the welcome preference and shows welcome without financial records', async () => {
  const s = createAppHarness()
  s.run("state.accounts=[{id:'old',currency:'USD'}]")
  s.run("state.settings.push({id:'welcomeSeen',value:true})")
  vm.runInContext(source('modals'), s.context)
  let confirmation,
    replacement,
    welcomes = 0,
    id = 0
  Object.assign(s.context, {
    crypto: { randomUUID: () => `starter-${++id}` },
    confirmAction: options => {
      confirmation = options
    },
    replaceAll: async data => {
      replacement = data
    },
    welcomeModal: () => {
      welcomes++
    },
    toast() {},
  })
  s.run('resetDataModal()')
  await confirmation.onConfirm()
  assert.ok(replacement.categories.length > 0)
  assert.equal(welcomes, 1)
  assert.equal(s.run('state.accounts.length'), 0)
  assert.equal(s.run('state.settings.length'), 0)
  assert.equal(s.run('JSON.stringify(availableCurrencies())'), '["EUR"]')
})

test('welcome appears after local startup until dismissed and does not replace an open dialog', async () => {
  for (const [seen, openDialog] of [
    [false, false],
    [true, false],
    [false, true],
  ]) {
    const s = createAppHarness()
    s.run(`state.categories=[{id:'starter'}];state.settings=[{id:'welcomeSeen',value:${seen}}]`)
    if (openDialog) s.context.document.querySelector('#modal-root').innerHTML = 'Existing dialog'
    const calls = []
    Object.assign(s.context, {
      settingsModal() {},
      reload: async () => {
        calls.push('local')
      },
      processRecurring: async () => {
        calls.push('recurring')
      },
      welcomeModal: () => {
        calls.push('welcome')
      },
      syncCurrencyRates: async () => {
        calls.push('sync')
      },
    })
    vm.runInContext(source('app'), s.context)
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(
      calls,
      !seen && !openDialog
        ? ['local', 'recurring', 'local', 'welcome', 'sync']
        : ['local', 'recurring', 'local', 'sync']
    )
  }
})

test('both welcome dismissal controls persist the preference without adding financial data', async () => {
  for (const id of ['welcome-start', 'close-modal']) {
    const s = createModalHarness()
    s.run('welcomeModal()')
    assert.ok(s.root.innerHTML.includes('Welcome to Flow'))
    assert.ok(s.root.innerHTML.includes('JSON backup'))
    await s.control(id).onclick()
    assert.equal(s.body(), null)
    assert.equal(s.run("getSetting('welcomeSeen',false)"), true)
    assert.equal(
      s.run('JSON.stringify([state.accounts,state.transactions,state.budgets,state.recurring])'),
      '[[],[],[],[]]'
    )
  }
})

test('welcome dismissal ignores repeated clicks and remains dismissible when storage fails', async () => {
  const s = createModalHarness()
  let finish,
    writes = 0
  s.context.putSettings = async () => {
    writes++
    await new Promise(resolve => {
      finish = resolve
    })
  }
  s.run('welcomeModal()')
  const pending = s.control('welcome-start').onclick()
  await s.control('close-modal').onclick()
  assert.equal(writes, 1)
  finish()
  await pending
  assert.equal(s.run("getSetting('welcomeSeen',false)"), true)
  assert.equal(s.body(), null)
  const failed = createModalHarness()
  let message
  failed.context.putSettings = async () => {
    throw Error('quota')
  }
  failed.context.toast = value => {
    message = value
  }
  failed.run('welcomeModal()')
  await failed.control('close-modal').onclick()
  assert.equal(failed.run("getSetting('welcomeSeen',false)"), false)
  assert.equal(failed.body(), null)
  assert.match(message, /Could not save/)
})
