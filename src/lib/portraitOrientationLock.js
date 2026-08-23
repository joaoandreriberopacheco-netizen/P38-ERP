/**
 * Preferência de orientação do P38.
 * Por defeito mantém retrato (comportamento histórico do PWA Android).
 * O utilizador pode pedir paisagem no menu Perfil — telemóvel, tablet ou notebook.
 */
const PORTRAIT_LOCK = 'portrait-primary';
const LANDSCAPE_LOCK = 'landscape';

export const ORIENTATION_STORAGE_KEY = 'p38_orientation_mode';
export const ORIENTATION_CHANGE_EVENT = 'p38-orientation-change';
export const FORCE_LANDSCAPE_ATTR = 'data-p38-force-landscape';

/** Largura mínima típica de tablet. */
export const TABLET_MIN_DIMENSION = 768;

export function isCoarsePointer() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function isForceLandscapeCssActive() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(FORCE_LANDSCAPE_ATTR) === 'true';
}

export function isTabletSizedViewport() {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.min(w, h) >= TABLET_MIN_DIMENSION;
}

function canUseScreenOrientationLock() {
  return typeof screen !== 'undefined' && typeof screen.orientation?.lock === 'function';
}

export function getPreferredOrientation() {
  if (typeof window === 'undefined') return 'portrait';
  try {
    return window.localStorage.getItem(ORIENTATION_STORAGE_KEY) === 'landscape'
      ? 'landscape'
      : 'portrait';
  } catch {
    return 'portrait';
  }
}

export function isPortraitViewport() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia) {
    try {
      if (window.matchMedia('(orientation: landscape)').matches) return false;
      if (window.matchMedia('(orientation: portrait)').matches) return true;
    } catch {
      /* ignore */
    }
  }
  const vv = window.visualViewport;
  const width = vv?.width ?? window.innerWidth;
  const height = vv?.height ?? window.innerHeight;
  return height > width;
}

function persistOrientation(mode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ORIENTATION_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(ORIENTATION_CHANGE_EVENT, { detail: { orientation: mode } }));
}

async function unlockScreenOrientation() {
  if (!canUseScreenOrientationLock()) return;
  try {
    await screen.orientation.unlock();
  } catch {
    /* ignore */
  }
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

export async function lockLandscapeOrientation() {
  if (!canUseScreenOrientationLock()) return false;
  await unlockScreenOrientation();
  const attempts = [LANDSCAPE_LOCK, 'landscape-primary', 'landscape-secondary'];
  for (const type of attempts) {
    try {
      await screen.orientation.lock(type);
      if (!isPortraitViewport()) return true;
    } catch {
      /* try next */
    }
  }
  return !isPortraitViewport();
}

export function shouldUseCssLandscapeFallback() {
  return isPortraitViewport();
}

export function applyCssLandscapeFallback(enabled) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!enabled) {
    root.removeAttribute(FORCE_LANDSCAPE_ATTR);
    root.style.removeProperty('--p38-force-landscape-shift');
    root.style.removeProperty('--p38-force-landscape-width');
    root.style.removeProperty('--p38-force-landscape-height');
    return;
  }
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  root.setAttribute(FORCE_LANDSCAPE_ATTR, 'true');
  root.style.setProperty('--p38-force-landscape-shift', `${width}px`);
  root.style.setProperty('--p38-force-landscape-width', `${height}px`);
  root.style.setProperty('--p38-force-landscape-height', `${width}px`);
}

function syncCssLandscapeFallback() {
  if (getPreferredOrientation() !== 'landscape') {
    applyCssLandscapeFallback(false);
    return;
  }
  applyCssLandscapeFallback(shouldUseCssLandscapeFallback());
}

export async function applyPreferredOrientation() {
  const mode = getPreferredOrientation();
  if (mode === 'landscape') {
    const locked = await lockLandscapeOrientation();
    const cssFallback = !locked && shouldUseCssLandscapeFallback();
    applyCssLandscapeFallback(cssFallback);
    return { mode, locked, cssFallback };
  }

  applyCssLandscapeFallback(false);
  if (isCoarsePointer()) {
    const locked = await lockPortraitOrientation();
    return { mode, locked, cssFallback: false };
  }
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  return { mode, locked: false, cssFallback: false };
}

export function setPreferredOrientation(mode) {
  const next = mode === 'landscape' ? 'landscape' : 'portrait';
  persistOrientation(next);
  return applyPreferredOrientation();
}

export function togglePreferredOrientation() {
  return setPreferredOrientation(getPreferredOrientation() === 'landscape' ? 'portrait' : 'landscape');
}

/**
 * Aplica a preferência gravada e re-tenta após gesto, visibilidade e rotação.
 * Retrato por defeito só em dispositivos touch. Paisagem aplica-se em qualquer aparelho.
 */
export function installPortraitOrientationLock() {
  if (typeof window === 'undefined') return undefined;

  let disposed = false;

  const tryLock = () => {
    if (disposed) return;
    applyPreferredOrientation();
  };

  const syncCss = () => {
    if (disposed) return;
    syncCssLandscapeFallback();
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
  window.addEventListener('resize', syncCss);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('touchstart', onFirstGesture, true);
  window.visualViewport?.addEventListener('resize', syncCss);

  if (screen.orientation?.addEventListener) {
    screen.orientation.addEventListener('change', tryLock);
  }

  return () => {
    disposed = true;
    window.removeEventListener('orientationchange', tryLock);
    window.removeEventListener('resize', syncCss);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('touchstart', onFirstGesture, true);
    window.visualViewport?.removeEventListener('resize', syncCss);
    if (screen.orientation?.removeEventListener) {
      screen.orientation.removeEventListener('change', tryLock);
    }
  };
}

/** Antes da primeira pintura: evita flash em retrato quando a preferência já é paisagem. */
export function bootLandscapeFallbackFromStorage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    if (window.localStorage.getItem(ORIENTATION_STORAGE_KEY) !== 'landscape') return;
    if (shouldUseCssLandscapeFallback()) applyCssLandscapeFallback(true);
  } catch {
    /* ignore */
  }
}
