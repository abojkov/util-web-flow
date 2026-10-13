const NAME = 'flow-money-manager', VERSION = 1;
  const STORES = ['accounts', 'categories', 'transactions', 'budgets', 'recurring', 'settings'];
  let dbPromise;

  function openDB() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        for (const name of STORES) if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name, {keyPath: 'id'})
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error)
    });
    return dbPromise
  }

  async function all(store) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error)
    })
  }

  async function put(store, item) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(item);
      tx.oncomplete = () => res(item);
      tx.onerror = () => rej(tx.error)
    })
  }

  async function del(store, id) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error)
    })
  }

  async function replaceAll(data) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORES, 'readwrite');
      for (const store of STORES) {
        tx.objectStore(store).clear();
        for (const item of data[store] || []) tx.objectStore(store).put(item)
      }
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error)
    })
  }
const storeNames = STORES;
