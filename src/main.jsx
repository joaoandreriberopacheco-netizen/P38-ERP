import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { installMobileFocusPolicy } from '@/lib/focusPolicy'
import { bootLandscapeFallbackFromStorage, installPortraitOrientationLock } from '@/lib/portraitOrientationLock'
import { uppercaseInputValue } from '@/lib/uppercaseInputHandlers'
import { installChunkErrorHandlers, reloadOnceOnChunkError } from '@/lib/lazyPage'
import { shouldRegisterServiceWorker } from '@/lib/pwaServiceWorkerEnv'
import { injectSpeedInsights } from '@vercel/speed-insights'

// Tema antes da primeira pintura (splash, login, etc.)
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch (_) {
  /* ignore */
}
bootLandscapeFallbackFromStorage()

// Select-on-focus global: seleciona o texto ao clicar/focar em qualquer input numérico ou de texto
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (
    el.tagName === 'INPUT' &&
    ['text', 'number', 'tel', 'email', 'search', 'password', 'date', ''].includes(el.type)
  ) {
    if (el.dataset?.p38SkipSelectOnFocus === 'true') return;
    setTimeout(() => el.select(), 0);
  }
});

// Maiúsculas ao sair do campo — evita piscar minúscula/maiúscula a cada tecla (visual via CSS).
document.addEventListener('blur', (e) => uppercaseInputValue(e.target), true);

installMobileFocusPolicy();
installPortraitOrientationLock();
installChunkErrorHandlers();
injectSpeedInsights();

/** Remove SW antigo no preview/dev (cache de /src/*.jsx quebrava HMR). Produção p38.base44.app mantém SW. */
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !shouldRegisterServiceWorker()) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  }).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnceOnChunkError();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

/** Remover após executar one-offs com sessão Base44. */
if (import.meta.env.DEV) {
  import('@/api/base44Client').then(({ base44 }) =>
    Promise.all([
      import('@/lib/oneOffCorrigirRecepcaoPedido.js'),
      import('@/lib/oneOffRecepcionarPedidoArbitrario.js'),
    ]).then(([corr, recep]) => {
      window.__corrigirRecepcaoPedido = (opts) => corr.corrigirRecepcaoPedido(base44, opts);
      window.__corrigirRecepcaoWX7A5N = (apply = false) =>
        corr.corrigirRecepcaoPedido(base44, { numero: 'WX7-A5N', apply: Boolean(apply) });
      window.__recepcionarPedidoArbitrario = (opts) => recep.recepcionarPedidoArbitrario(base44, opts);
      window.__recepcionarDT88B8 = (apply = false) => recep.recepcionarDT88B8(base44, apply);
    })
  );
}

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
