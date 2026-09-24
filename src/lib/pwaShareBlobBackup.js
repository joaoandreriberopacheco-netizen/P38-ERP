const BACKUP_KEY = 'p38-share-blob-backup';
const MAX_BYTES = 4 * 1024 * 1024;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64) {
  const binary = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function bufferToShareBlob(buffer, type) {
  if (!buffer || !buffer.byteLength) return null;
  const slice = new Uint8Array(buffer);
  return new Blob([slice], { type: type || 'application/octet-stream' });
}

export function writeShareBlobBackup({ id, name, type, buffer }) {
  if (typeof sessionStorage === 'undefined' || !buffer?.byteLength) return false;
  if (buffer.byteLength > MAX_BYTES) return false;
  try {
    const payload = {
      id: id || '',
      name: name || 'arquivo',
      type: type || 'application/octet-stream',
      savedAt: Date.now(),
      base64: arrayBufferToBase64(buffer),
    };
    sessionStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
}

export function readShareBlobBackup(maxAgeMs = 15 * 60 * 1000) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload?.base64 || !payload.savedAt) return null;
    if (Date.now() - payload.savedAt > maxAgeMs) {
      sessionStorage.removeItem(BACKUP_KEY);
      return null;
    }
    const buffer = base64ToArrayBuffer(payload.base64);
    const blob = bufferToShareBlob(buffer, payload.type);
    if (!blob?.size) return null;
    return {
      blob,
      name: payload.name || 'arquivo',
      type: payload.type || blob.type,
      id: payload.id || '',
      source: 'session-backup',
    };
  } catch (_) {
    return null;
  }
}

export function clearShareBlobBackup() {
  try {
    sessionStorage.removeItem(BACKUP_KEY);
  } catch (_) {
    /* ignore */
  }
}
