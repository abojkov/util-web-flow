const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { source } = require('./helpers/app-harness.cjs')

test('rates and metadata use a single settings transaction; abort rejects', async () => {
  let transaction,
    puts = []
  const db = {
    transaction(store, mode) {
      assert.equal(store, 'settings')
      assert.equal(mode, 'readwrite')
      transaction = {
        objectStore() {
          return {
            put(item) {
              puts.push(item)
            },
          }
        },
      }
      return transaction
    },
  }
  const c = vm.createContext({ Error })
  vm.runInContext(source('storage'), c)
  c.openDB = async () => db
  const pending = c.putSettings({
    exchangeRates: { USD: 1.2 },
    currencySync: { updatedAt: 'today' },
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(puts.length, 2)
  transaction.oncomplete()
  await pending
  const aborted = c.putSettings({ exchangeRates: { USD: 2 } })
  await new Promise(resolve => setImmediate(resolve))
  transaction.onabort()
  await assert.rejects(aborted, /aborted/)
})
