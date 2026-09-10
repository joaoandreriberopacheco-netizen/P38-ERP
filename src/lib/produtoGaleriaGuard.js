/** Evita fechar listas de busca / activar linhas ao fechar a galeria de fotos (portal no body). */
let suppressRowActivationUntil = 0;

export function armProdutoGaleriaRowGuard(ms = 450) {
  suppressRowActivationUntil = Date.now() + ms;
}

export function shouldSuppressProductRowActivation() {
  return Date.now() < suppressRowActivationUntil;
}

export function isProdutoGaleriaOpen() {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('[data-produto-galeria-modal]'));
}

export function isProdutoGaleriaInteraction(event) {
  if (shouldSuppressProductRowActivation()) return true;
  if (isProdutoGaleriaOpen()) return true;
  return Boolean(event?.target?.closest?.('[data-produto-galeria-modal]'));
}

const closeListeners = new Set();

/** Permite reabrir sugestões de busca após fechar a galeria (ex.: PDV). */
export function onProdutoGaleriaClosed(listener) {
  closeListeners.add(listener);
  return () => closeListeners.delete(listener);
}

export function notifyProdutoGaleriaClosed() {
  armProdutoGaleriaRowGuard();
  closeListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}
