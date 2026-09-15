/**
 * Registo precoce do service worker (Web Share Target).
 * Manter alinhado com src/lib/pwaServiceWorkerEnv.js
 */
(function registerP38ServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  var loc = window.location;
  var host = loc.hostname || '';
  var port = loc.port || '';

  if (host === 'localhost' || host === '127.0.0.1' || port === '5173') return;

  var onBase44 = host === 'base44.app' || host.endsWith('.base44.app');
  var productionHosts = ['p38.base44.app'];
  if (onBase44 && productionHosts.indexOf(host) === -1) return;

  navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(function (registration) {
      registration.update();
      console.log('[PWA] Service worker registado:', registration.scope);
    })
    .catch(function (err) {
      console.warn('[PWA] Falha ao registar service worker:', err);
    });
})();
