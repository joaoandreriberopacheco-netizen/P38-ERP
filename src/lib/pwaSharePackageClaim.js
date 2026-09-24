import {
  peekShareTargetFileAsBlob,
  peekNewestShareTargetFileAsBlob,
  deleteShareTargetFile,
  markShareTargetDelivered,
} from '@/lib/pwaShareTargetStorage';

const SHARED_FILES_CACHE = 'VarejoSync-shared-files';
const COOKIE_ID = 'p38_share_id';

export function readShareIdFromCookie() {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_ID}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

export function clearShareIdCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_ID}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readShareIdFromSession() {
  try {
    return sessionStorage.getItem('p38-share-pending') || '';
  } catch (_) {
    return '';
  }
}

export function clearSharePendingSession() {
  try {
    sessionStorage.removeItem('p38-share-pending');
  } catch (_) {
    /* ignore */
  }
}

function extrairTimestampCachePath(req) {
  const url = typeof req === 'string' ? req : req.url;
  const m = String(url).match(/\/shared\/(\d+)-/);
  return m ? parseInt(m[1], 10) : 0;
}

async function peekNewestFromShareCache() {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(SHARED_FILES_CACHE);
    const keys = await cache.keys();
    if (!keys.length) return null;
    let melhorReq = null;
    let melhorTs = -1;
    for (const req of keys) {
      const ts = extrairTimestampCachePath(req);
      if (ts >= melhorTs) {
        melhorTs = ts;
        melhorReq = req;
      }
    }
    if (!melhorTs || Date.now() - melhorTs > 10 * 60 * 1000) return null;
    const resp = await cache.match(melhorReq);
    if (!resp) return null;
    const blob = await resp.blob();
    if (!blob.size) return null;
    const url = typeof melhorReq === 'string' ? melhorReq : melhorReq.url;
    const name = url.split('/').pop().replace(/^\d+-/, '') || 'arquivo';
    return { blob, name, type: blob.type, cacheRequest: melhorReq };
  } catch (_) {
    return null;
  }
}

async function fetchSharedPath(sharedPath) {
  if (!sharedPath || typeof fetch === 'undefined') return null;
  try {
    const fetchUrl = sharedPath.startsWith('/')
      ? `${window.location.origin}${sharedPath}`
      : sharedPath;
    const resp = await fetch(fetchUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (!blob.size) return null;
    const name = String(sharedPath).split('/').pop().replace(/^\d+-/, '') || 'arquivo';
    return { blob, name, type: blob.type };
  } catch (_) {
    return null;
  }
}

/**
 * Tenta recuperar o pacote partilhado sem apagar até confirmação na Torre.
 */
export async function claimSharePackageForTorre(params) {
  const shareTarget = params?.get?.('share-target') === '1';
  const sharedPath = params?.get?.('shared') || '';
  const ids = [
    params?.get?.('shared-id'),
    readShareIdFromSession(),
    readShareIdFromCookie(),
  ].filter(Boolean);

  for (const id of ids) {
    const fromIdb = await peekShareTargetFileAsBlob(id);
    if (fromIdb?.blob?.size) {
      return { source: 'idb', ...fromIdb };
    }
  }

  if (sharedPath) {
    const fromFetch = await fetchSharedPath(sharedPath);
    if (fromFetch) return { source: 'fetch', ...fromFetch };
  }

  const fromCache = await peekNewestFromShareCache();
  if (fromCache) return { source: 'cache', ...fromCache };

  if (shareTarget || ids.length || sharedPath) {
    const newest = await peekNewestShareTargetFileAsBlob();
    if (newest?.blob?.size) return { source: 'idb-newest', ...newest };
  }

  if (!shareTarget && !ids.length && !sharedPath) {
    const newest = await peekNewestShareTargetFileAsBlob(2 * 60 * 1000);
    if (newest?.blob?.size) return { source: 'idb-recent', ...newest };
  }

  return null;
}

export async function confirmSharePackageConsumed(claimed) {
  if (!claimed) return;
  if (claimed.id) {
    await markShareTargetDelivered(claimed.id);
    await deleteShareTargetFile(claimed.id);
  }
  if (claimed.cacheRequest && typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(SHARED_FILES_CACHE);
      await cache.delete(claimed.cacheRequest);
    } catch (_) {
      /* ignore */
    }
  }
  clearShareIdCookie();
  clearSharePendingSession();
}
