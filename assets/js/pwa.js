// Service workers require HTTPS or localhost and are unavailable under file://.
const serviceWorkerUrl = new URL('../../service-worker.js', document.currentScript.src)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerUrl).catch(error => {
      console.warn('Flow offline support could not be enabled.', error)
    })
  })
}
