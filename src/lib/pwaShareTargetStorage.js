const DB_NAME = 'p38-share-target';
const DB_VERSION = 1;
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeShareTargetFile(id, { buffer, name, type }) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ buffer, name, type, savedAt: Date.now() }, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readShareTargetFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteShareTargetFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function takeShareTargetFileAsBlob(id) {
  const rec = await readShareTargetFile(id);
  if (!rec?.buffer) return null;
  await deleteShareTargetFile(id);
  const blob = new Blob([rec.buffer], { type: rec.type || 'application/octet-stream' });
  return { blob, name: rec.name || 'arquivo', type: rec.type || blob.type };
}

async function listShareTargetRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out = [];
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push({ id: cursor.key, rec: cursor.value });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Último ficheiro gravado pelo SW ou pelo fallback POST (IndexedDB). */
export async function takeNewestShareTargetFileAsBlob(maxAgeMs = 5 * 60 * 1000) {
  const entries = await listShareTargetRecords();
  const cutoff = Date.now() - maxAgeMs;
  let best = null;
  for (const { id, rec } of entries) {
    if (!rec?.buffer || rec.savedAt < cutoff) continue;
    if (!best || rec.savedAt > best.rec.savedAt) best = { id, rec };
  }
  if (!best) return null;
  await deleteShareTargetFile(best.id);
  const blob = new Blob([best.rec.buffer], { type: best.rec.type || 'application/octet-stream' });
  return { blob, name: best.rec.name || 'arquivo', type: best.rec.type || blob.type };
}
