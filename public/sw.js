const CACHE_NAME = 'p38-erp-v20';
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

function isShareTargetPostUrl(url) {
  return isAnexoCompartilhadoPath(url.pathname) && url.origin === self.location.origin;
}

function isSharedFileGetUrl(url) {
  return url.origin === self.location.origin && normalizePathname(url.pathname).startsWith('/shared/');
}

/** Chrome/Android podem usar "files", "file" ou outro nome no multipart. */
function collectFilesFromFormData(formData) {
  const out = [];
  const add = (v) => {
    if (v instanceof File && v.size > 0) out.push(v);
  };
  try {
    formData.getAll('files').forEach(add);
  } catch (_) {}
  try {
    formData.getAll('file').forEach(add);
  } catch (_) {}
  if (out.length === 0) {
    try {
      for (const [, val] of formData.entries()) add(val);
    } catch (_) {}
  }
  return out;
}

/**
 * Web Share Target: POST multipart → Cache API (Request explícito) → redirect GET.
 */
async function handleShareTargetPost(request) {
  const url = new URL(request.url);
  const formData = await request.formData();
  const title = (formData.get('title') && String(formData.get('title'))) || '';
  const text = (formData.get('text') && String(formData.get('text'))) || '';
  const urlParam = (formData.get('url') && String(formData.get('url'))) || '';

  const cache = await caches.open(SHARED_CACHE);
  const files = collectFilesFromFormData(formData);
  let lastCachePath = '';

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
  else if (lastCachePath) redirectParams.set('shared', lastCachePath);

  const destPath = normalizePathname(url.pathname) || '/AnexoCompartilhado';
  const dest = `${self.location.origin}${destPath}?${redirectParams.toString()}`;
  return Response.redirect(dest, 303);
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
