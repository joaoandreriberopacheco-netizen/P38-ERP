/**
 * Rotação do dispositivo no P38.
 *
 * - auto (rotação livre): o SO roda com o tablet/telemóvel — sem hack CSS.
 * - locked (bloqueado): trava na orientação actual (retrato por defeito no arranque).
 *
 * Migra preferência antiga `landscape` (Modo Paisagem CSS) → `auto`.
 */
const PORTRAIT_LOCK = 'portrait-primary';

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

/** @returns {'auto' | 'locked'} */
export function normalizeOrientationMode(raw) {
  if (raw === 'auto' || raw === 'landscape') return 'auto';
  return 'locked';
}

/** @returns {'auto' | 'locked'} */
export function getPreferredOrientation() {
  if (typeof window === 'undefined') return 'locked';
  try {
    return normalizeOrientationMode(window.localStorage.getItem(ORIENTATION_STORAGE_KEY));
  } catch {
    return 'locked';
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
  const next = normalizeOrientationMode(mode);
  try {
    window.localStorage.setItem(ORIENTATION_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(ORIENTATION_CHANGE_EVENT, { detail: { orientation: next } }));
}

async function unlockScreenOrientation() {
  if (!canUseScreenOrientationLock()) return false;
  try {
    await screen.orientation.unlock();
    return true;
  } catch {
    return false;
  }
}

function currentOrientationLockType() {
  const type = screen.orientation?.type;
  if (type && !['natural', 'any'].includes(type)) return type;
  return isPortraitViewport() ? PORTRAIT_LOCK : 'landscape-primary';
}

async function lockOrientationType(type) {
  if (!canUseScreenOrientationLock()) return false;
  try {
    await screen.orientation.lock(type);
    return true;
  } catch {
    return false;
  }
}

export async function lockPortraitOrientation() {
  return lockOrientationType(PORTRAIT_LOCK);
}

/** Remove fallback CSS legado (Modo Paisagem artificial). */
export function applyCssLandscapeFallback(enabled) {
  if (typeof document === 'undefined') return;
  if (enabled) return;
  const root = document.documentElement;
  root.removeAttribute(FORCE_LANDSCAPE_ATTR);
  root.style.removeProperty('--p38-force-landscape-shift');
  root.style.removeProperty('--p38-force-landscape-width');
  root.style.removeProperty('--p38-force-landscape-height');
  root.style.removeProperty('--p38-stage-height');
  root.style.removeProperty('--p38-stage-width');
}

export async function applyPreferredOrientation() {
  const mode = getPreferredOrientation();
  applyCssLandscapeFallback(false);

  if (mode === 'auto') {
    const unlocked = await unlockScreenOrientation();
    return { mode, locked: false, cssFallback: false, unlocked };
  }

  const lockType = currentOrientationLockType();
  let locked = await lockOrientationType(lockType);
  if (!locked && isCoarsePointer()) {
    locked = await lockPortraitOrientation();
  }
  return { mode, locked, cssFallback: false, unlocked: false };
}

export function setPreferredOrientation(mode) {
  const next = normalizeOrientationMode(mode);
  persistOrientation(next);
  return applyPreferredOrientation();
}

export function togglePreferredOrientation() {
  const current = getPreferredOrientation();
  return setPreferredOrientation(current === 'auto' ? 'locked' : 'auto');
}

/**
 * Aplica preferência gravada; re-tenta após gesto, visibilidade e rotação física.
 */
export function installPortraitOrientationLock() {
  if (typeof window === 'undefined') return undefined;

  let disposed = false;

  const tryLock = () => {
    if (disposed) return;
    applyPreferredOrientation();
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

/** Arranque: limpa hack CSS legado e migra `landscape` → `auto`. */
export function bootLandscapeFallbackFromStorage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(ORIENTATION_STORAGE_KEY);
    if (raw === 'landscape') {
      window.localStorage.setItem(ORIENTATION_STORAGE_KEY, 'auto');
    }
  } catch {
    /* ignore */
  }
  applyCssLandscapeFallback(false);
}
