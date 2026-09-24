const COOKIE_ID = 'p38_share_id';
const LS_ID = 'p38_share_id';

export function persistSharePendingId(id) {
  if (!id) return;
  try {
    sessionStorage.setItem('p38-share-pending', id);
    sessionStorage.setItem('p38-share-active', '1');
    sessionStorage.setItem('p38-share-active-at', String(Date.now()));
  } catch (_) {
    /* ignore */
  }
  try {
    localStorage.setItem(LS_ID, id);
    localStorage.setItem('p38-share-active-at', String(Date.now()));
  } catch (_) {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_ID}=${encodeURIComponent(id)}; Path=/; Max-Age=900; SameSite=Lax`;
  }
}

export function readSharePendingId() {
  try {
    const fromSession = sessionStorage.getItem('p38-share-pending');
    if (fromSession) return fromSession;
  } catch (_) {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_ID}=([^;]*)`));
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  try {
    return localStorage.getItem(LS_ID) || '';
  } catch (_) {
    return '';
  }
}

export function hasSharePendingMarkers() {
  if (readSharePendingId()) return true;
  try {
    if (sessionStorage.getItem('p38-share-active') === '1') return true;
    if (sessionStorage.getItem('p38-share-blob-backup')) return true;
  } catch (_) {
    /* ignore */
  }
  try {
    const at = Number(localStorage.getItem('p38-share-active-at') || 0);
    if (at && Date.now() - at < 15 * 60 * 1000) return true;
  } catch (_) {
    /* ignore */
  }
  return false;
}

export function clearSharePendingMarkers() {
  try {
    sessionStorage.removeItem('p38-share-pending');
    sessionStorage.removeItem('p38-share-active');
    sessionStorage.removeItem('p38-share-active-at');
  } catch (_) {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_ID);
    localStorage.removeItem('p38-share-active-at');
  } catch (_) {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_ID}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}
