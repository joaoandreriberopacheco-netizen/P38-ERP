/**
 * Bloqueia rotação para retrato (comportamento histórico do PWA Android).
 * Manifest: portrait-primary. Sem overlay de mensagem.
 */
const PORTRAIT_LOCK = 'portrait-primary';

function isCoarsePointer() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function canUseScreenOrientationLock() {
  return typeof screen !== 'undefined' && typeof screen.orientation?.lock === 'function';
}

export async function lockPortraitOrientation() {
  if (!canUseScreenOrientationLock()) return false;
  try {
    await screen.orientation.lock(PORTRAIT_LOCK);
    return true;
  } catch {
    try {
      await screen.orientation.lock('portrait');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Mantém retrato em dispositivos touch (PWA Android / Chrome).
 * Re-tenta após gesto, ao voltar ao app e se a orientação mudar.
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
