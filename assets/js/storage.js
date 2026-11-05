const NAME = 'flow-money-manager',
  VERSION = 1
const STORES = ['accounts', 'categories', 'transactions', 'budgets', 'recurring', 'settings']
let dbPromise

function openDB() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(NAME, VERSION)
      r.onupgradeneeded = () => {
        for (const name of STORES)
          if (!r.result.objectStoreNames.contains(name))
            r.result.createObjectStore(name, { keyPath: 'id' })
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
  return dbPromise
}

async function all(store) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).getAll()
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function put(store, item) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(item)
    tx.oncomplete = () => res(item)
    tx.onerror = () => rej(tx.error)
  })
}

async function del(store, id) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(id)
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
  })
}

// Atomic multi-store writes for related financial records (put and/or delete).
async function putAll(writes) {
  if (!writes.length) return
  const db = await openDB()
  return new Promise((res, rej) => {
    const stores = [...new Set(writes.map(write => write.store))]
    const tx = db.transaction(stores, 'readwrite')
    for (const write of writes) {
      if (write.delete) tx.objectStore(write.store).delete(write.id)
      else tx.objectStore(write.store).put(write.item)
    }
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
    tx.onabort = () => rej(tx.error || new Error('Update was aborted'))
  })
}

async function replaceAll(data) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORES, 'readwrite')
    for (const store of STORES) {
      tx.objectStore(store).clear()
      for (const item of data[store] || []) tx.objectStore(store).put(item)
    }
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
    tx.onabort = () => rej(tx.error || new Error('Data replacement was aborted'))
  })
}
const storeNames = STORES

async function putSettings(values) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite')
    for (const [id, value] of Object.entries(values)) tx.objectStore('settings').put({ id, value })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Settings update was aborted'))
  })
}
