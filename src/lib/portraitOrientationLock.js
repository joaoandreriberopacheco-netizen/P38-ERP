/** Bloqueia rotação para retrato em dispositivos touch (PWA / browsers compatíveis). */
const PORTRAIT_LOCK = 'portrait';

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
    return false;
  }
}

/**
 * Tenta manter retrato no mobile/tablet touch.
 * Em Safari iOS o lock só funciona em PWA instalado; o overlay CSS cobre o resto.
 */
export function installPortraitOrientationLock() {
  if (typeof window === 'undefined' || !isCoarsePointer()) return undefined;

  const tryLock = () => {
    lockPortraitOrientation();
  };

  tryLock();
  window.addEventListener('orientationchange', tryLock);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryLock();
  });

  return () => {
    window.removeEventListener('orientationchange', tryLock);
  };
}
