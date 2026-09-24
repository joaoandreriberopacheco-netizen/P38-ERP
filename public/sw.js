const CACHE_NAME = 'p38-erp-v24';
const SHARE_IDB_NAME = 'p38-share-target';
const SHARE_IDB_STORE = 'files';
const SHARED_CACHE = 'VarejoSync-shared-files';
/** Ícone P38 (raio) — alinhado ao manifest; pré-cache para instalação PWA / notificações. */
const APP_ICON_PATH = '/brand/p38-app-icon.png';
const SHORTCUT_NOVO_LANCAMENTO_ICON = '/brand/shortcut-novo-lancamento-192.png';
const SHORTCUT_TORRE_CONTROLE_ICON = '/brand/shortcut-torre-controle-192.png';
const SHORTCUT_NOVO_COMPROMISSO_ICON = '/brand/shortcut-novo-compromisso-192.png';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', APP_ICON_PATH, SHORTCUT_NOVO_LANCAMENTO_ICON, SHORTCUT_TORRE_CONTROLE_ICON, SHORTCUT_NOVO_COMPROMISSO_ICON];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== SHARED_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function normalizePathname(pathname) {
  const p = String(pathname || '/');
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

function isAnexoCompartilhadoPath(pathname) {
  const p = normalizePathname(pathname).toLowerCase();
  return p === '/anexocompartilhado' || p.endsWith('/anexocompartilhado');
}

function isShareTargetApiPath(pathname) {
  const p = normalizePathname(pathname).toLowerCase();
  return p === '/api/pwa-share-target';
}

function isShareTargetPostUrl(url) {
  if (url.origin !== self.location.origin) return false;
  return isAnexoCompartilhadoPath(url.pathname) || isShareTargetApiPath(url.pathname);
}

function isSharedFileGetUrl(url) {
  return url.origin === self.location.origin && normalizePathname(url.pathname).startsWith('/shared/');
}

/** Chrome/Android/WhatsApp podem usar nomes diferentes no multipart. */
function collectFilesFromFormData(formData) {
  const out = [];
  const seen = new Set();
  const add = (v) => {
    if (!v) return;
    let file = null;
    if (v instanceof File && v.size > 0) {
      file = v;
    } else if (typeof Blob !== 'undefined' && v instanceof Blob && v.size > 0) {
      const nome = v.name || 'arquivo';
      try {
        file = new File([v], nome, { type: v.type || 'application/octet-stream' });
      } catch (_) {
        file = v;
      }
    }
    if (!file || file.size === 0) return;
    const key = `${file.name}|${file.size}|${file.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  const fieldNames = [
    'files',
    'file',
    'files[]',
    'image',
    'media',
    'attachment',
    'share',
    'documents',
    'images',
    'photos',
    'picture',
  ];
  for (const name of fieldNames) {
    try {
      formData.getAll(name).forEach(add);
    } catch (_) {}
  }

  if (out.length === 0) {
    try {
      for (const [key, val] of formData.entries()) {
        if (key === 'title' || key === 'text' || key === 'url') continue;
        add(val);
      }
    } catch (_) {}
  }
  return out;
}

const SHARE_LEDGER_STORE = 'ledger';

function openShareIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_IDB_STORE)) {
        db.createObjectStore(SHARE_IDB_STORE);
      }
      if (!db.objectStoreNames.contains(SHARE_LEDGER_STORE)) {
        db.createObjectStore(SHARE_LEDGER_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notifySharePackageReady(id) {
  try {
    const ch = new BroadcastChannel('p38-share-package');
    ch.postMessage({ type: 'SHARE_PACKAGE_READY', id });
    ch.close();
  } catch (_) {}
}

async function persistShareFileToIdb(file) {
  const id = `share-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const buffer = await file.arrayBuffer();
  const savedAt = Date.now();
  const db = await openShareIdb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([SHARE_IDB_STORE, SHARE_LEDGER_STORE], 'readwrite');
    tx.objectStore(SHARE_IDB_STORE).put(
      { buffer, name: file.name || 'arquivo', type: file.type || 'application/octet-stream', savedAt },
      id
    );
    tx.objectStore(SHARE_LEDGER_STORE).put({ id, savedAt, status: 'pending' }, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifySharePackageReady(id);
  return id;
}

function fileFromDataUrlText(text) {
  const s = String(text || '').trim();
  const m = s.match(/^data:((?:image\/[a-z0-9.+-]+)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const b64 = m[2].replace(/\s/g, '');
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = type === 'application/pdf' ? '.pdf' : type.includes('png') ? '.png' : '.jpg';
    return new File([bytes], `partilha${ext}`, { type });
  } catch (_) {
    return null;
  }
}

/**
 * Web Share Target: POST multipart → Cache API + IndexedDB → redirect GET.
 */
async function handleShareTargetPost(request) {
  const url = new URL(request.url);
  const formData = await request.formData();
  const title = (formData.get('title') && String(formData.get('title'))) || '';
  const text = (formData.get('text') && String(formData.get('text'))) || '';
  const urlParam = (formData.get('url') && String(formData.get('url'))) || '';

  const cache = await caches.open(SHARED_CACHE);
  let files = collectFilesFromFormData(formData);
  if (files.length === 0 && text) {
    const fromDataUrl = fileFromDataUrlText(text);
    if (fromDataUrl) files = [fromDataUrl];
  }
  let lastCachePath = '';
  let lastShareId = '';

  for (const file of files) {
    const safeName = (file.name || 'arquivo').replace(/[^\w.\-()+ ]/g, '_');
    const cachePath = `/shared/${Date.now()}-${safeName}`;
    lastCachePath = cachePath;
    const cacheUrl = `${self.location.origin}${cachePath}`;
    const req = new Request(cacheUrl, { method: 'GET' });
    const res = new Response(file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    await cache.put(req, res);
    try {
      lastShareId = await persistShareFileToIdb(file);
    } catch (_) {
      /* cache continua como fallback */
    }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((c) =>
      c.postMessage({
        type: 'SHARED_FILES',
        files: [{ url: cacheUrl, name: file.name || safeName, textContent: null }],
      })
    );
  }

  const redirectParams = new URLSearchParams();
  if (title) redirectParams.set('title', title);
  if (text) redirectParams.set('text', text);
  if (urlParam) redirectParams.set('url', urlParam);
  redirectParams.set('share-target', '1');
  if (files.length === 0) redirectParams.set('share-error', 'no-files');
  else {
    if (lastCachePath) redirectParams.set('shared', lastCachePath);
    if (lastShareId) redirectParams.set('shared-id', lastShareId);
  }

  const landing = `${self.location.origin}/pwa-share-landing.html?${redirectParams.toString()}`;
  const headers = { Location: landing };
  if (lastShareId) {
    headers['Set-Cookie'] = `p38_share_id=${encodeURIComponent(lastShareId)}; Path=/; Max-Age=900; SameSite=Lax`;
  }
  return new Response(null, { status: 303, headers });
}

async function serveSharedFileFromCache(request) {
  const cache = await caches.open(SHARED_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  return new Response('Arquivo partilhado não encontrado', { status: 404 });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && isShareTargetPostUrl(url)) {
    event.respondWith(
      handleShareTargetPost(event.request).catch(() =>
        Response.redirect(`${self.location.origin}/AnexoCompartilhado?share-error=1`, 303)
      )
    );
    return;
  }

  if (event.request.method === 'GET' && isSharedFileGetUrl(url)) {
    event.respondWith(serveSharedFileFromCache(event.request));
    return;
  }

  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Vite dev / HMR — nunca interceptar (evita módulos .jsx em cache desatualizado).
  const path = url.pathname || '';
  if (
    path.startsWith('/src/') ||
    path.startsWith('/@') ||
    path.includes('/node_modules/') ||
    path.endsWith('.jsx') ||
    path.endsWith('.tsx')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
      )
  );
});
