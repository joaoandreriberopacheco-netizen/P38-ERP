import {
  peekShareTargetFileAsBlob,
  peekNewestShareTargetFileAsBlob,
  mirrorShareTargetFileToSessionBackup,
  deleteShareTargetFile,
  markShareTargetDelivered,
} from '@/lib/pwaShareTargetStorage';
import { readShareBlobBackup, clearShareBlobBackup } from '@/lib/pwaShareBlobBackup';
import {
  readSharePendingId,
  clearSharePendingMarkers,
  hasSharePendingMarkers,
} from '@/lib/pwaSharePendingMarkers';

const SHARED_FILES_CACHE = 'VarejoSync-shared-files';

export { readSharePendingId as readShareIdFromSession, hasSharePendingMarkers };
export function readShareIdFromCookie() {
  return readSharePendingId();
}
export function clearSharePendingSession() {
  clearSharePendingMarkers();
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
function resolveShareSearchParams(params) {
  if (params?.get?.('share-target')) return params;
  try {
    const stored = sessionStorage.getItem('p38-share-query');
    if (stored) return new URLSearchParams(stored.startsWith('?') ? stored.slice(1) : stored);
  } catch (_) {
    /* ignore */
  }
  return params || new URLSearchParams();
}

export async function claimSharePackageForTorre(params) {
  const resolved = resolveShareSearchParams(params);
  const shareTarget = resolved?.get?.('share-target') === '1';
  let sharedPath = resolved?.get?.('shared') || '';
  try {
    if (!sharedPath) sharedPath = sessionStorage.getItem('p38-share-path') || '';
  } catch (_) {
    /* ignore */
  }
  const ids = [
    resolved?.get?.('shared-id'),
    readSharePendingId(),
  ].filter(Boolean);

  const fromBackup = readShareBlobBackup();
  if (fromBackup?.blob?.size) {
    return fromBackup;
  }

  if (sharedPath) {
    const fromFetch = await fetchSharedPath(sharedPath);
    if (fromFetch) {
      const { writeShareBlobBackupFromBlob } = await import('@/lib/pwaShareBlobBackup');
      await writeShareBlobBackupFromBlob({
        id: ids[0] || '',
        name: fromFetch.name,
        type: fromFetch.type,
        blob: fromFetch.blob,
      });
      return { source: 'fetch-priority', ...fromFetch, id: ids[0] || '' };
    }
  }

  for (const id of ids) {
    await mirrorShareTargetFileToSessionBackup(id);
    const fromBackupAfterMirror = readShareBlobBackup();
    if (fromBackupAfterMirror?.blob?.size) {
      return fromBackupAfterMirror;
    }
    const fromIdb = await peekShareTargetFileAsBlob(id);
    if (fromIdb?.blob?.size) {
      await mirrorShareTargetFileToSessionBackup(id);
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

  const recentWindow = hasSharePendingMarkers() || shareTarget ? 15 * 60 * 1000 : 3 * 60 * 1000;
  const newest = await peekNewestShareTargetFileAsBlob(recentWindow);
  if (newest?.blob?.size) {
    await mirrorShareTargetFileToSessionBackup(newest.id);
    return { source: 'idb-recent', ...newest };
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
  clearShareBlobBackup();
  clearSharePendingMarkers();
}
