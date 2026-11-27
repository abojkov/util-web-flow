const CACHE_NAME = 'flow-shell-v2'
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/css/styles.css',
  './assets/fonts/DM-Sans.ttf',
  './assets/fonts/Plus-Jakarta-Sans.ttf',
  './assets/js/storage.js',
  './assets/js/state.js',
  './assets/js/i18n.js',
  './assets/js/currency-sync.js',
  './assets/js/views.js',
  './assets/js/modals.js',
  './assets/js/app.js',
  './assets/js/pwa.js',
  './assets/locales/en.js',
  './assets/locales/es.js',
  './assets/locales/mk.js',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names =>
        Promise.all(names.filter(name => name.startsWith('flow-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async response => {
          if (response.ok) {
            await caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone()))
          }
          return response
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('./index.html')))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
