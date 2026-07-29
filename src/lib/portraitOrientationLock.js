/**
 * Bloqueia rotação para retrato (sem mensagem / overlay).
 * Eficaz sobretudo em PWA instalado (atalho no ecrã) e browsers Android.
 * Em aba normal do Safari iOS o sistema pode ignorar o lock — limitação da plataforma.
 */
const PORTRAIT_LOCKS = ['portrait', 'portrait-primary'];

function isCoarsePointer() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function canUseScreenOrientationLock() {
  return typeof screen !== 'undefined' && typeof screen.orientation?.lock === 'function';
}

export async function lockPortraitOrientation() {
  if (!canUseScreenOrientationLock()) return false;

  for (const type of PORTRAIT_LOCKS) {
    try {
      await screen.orientation.lock(type);
      return true;
    } catch {
      /* tenta o próximo tipo / browser pode exigir gesto do utilizador */
    }
  }
  return false;
}

/**
 * Instala tentativas de lock em retrato:
 * - ao carregar
 * - após o primeiro toque (gesto — exigido por vários browsers)
 * - ao voltar ao app / mudança de orientação
 */
export function installPortraitOrientationLock() {
  if (typeof window === 'undefined' || !isCoarsePointer()) return undefined;

  let disposed = false;

  const tryLock = () => {
    if (disposed) return;
    lockPortraitOrientation();
  };

  tryLock();

  const onVisibility = () => {
    if (document.visibilityState === 'visible') tryLock();
  };

  /** Um gesto do utilizador desbloqueia o lock em Chrome/Android. */
  const onFirstGesture = () => {
    tryLock();
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('touchstart', onFirstGesture, true);
  };

  window.addEventListener('orientationchange', tryLock);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('touchstart', onFirstGesture, true);

  if (screen.orientation?.addEventListener) {
    screen.orientation.addEventListener('change', tryLock);
  }

  return () => {
    disposed = true;
    window.removeEventListener('orientationchange', tryLock);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('touchstart', onFirstGesture, true);
    if (screen.orientation?.removeEventListener) {
      screen.orientation.removeEventListener('change', tryLock);
    }
  };
}
