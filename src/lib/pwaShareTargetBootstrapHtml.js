/**
 * Página mínima: grava partilha no IndexedDB (mesmo schema que o SW) e redireciona à Torre.
 */
export function buildShareTargetBootstrapHtml(origin, { id, name, type, base64, title, text, urlParam }) {
  const redirectParams = new URLSearchParams();
  redirectParams.set('share-target', '1');
  redirectParams.set('shared-id', id);
  if (title) redirectParams.set('title', title);
  if (text) redirectParams.set('text', text);
  if (urlParam) redirectParams.set('url', urlParam);
  const dest = `${origin}/AnexoCompartilhado?${redirectParams.toString()}`;

  const payload = JSON.stringify({
    id,
    name: name || 'arquivo',
    type: type || 'application/octet-stream',
    base64,
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>P38 — recebendo arquivo…</title>
</head>
<body>
<p style="font-family:system-ui,sans-serif;padding:1rem;">A preparar o arquivo na Torre…</p>
<script>
(function () {
  var DB_NAME = 'p38-share-target';
  var STORE = 'files';
  var payload = ${payload};
  var dest = ${JSON.stringify(dest)};

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function base64ToArrayBuffer(b64) {
    var binary = atob(b64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  openDb()
    .then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({
          buffer: base64ToArrayBuffer(payload.base64),
          name: payload.name,
          type: payload.type,
          savedAt: Date.now()
        }, payload.id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    })
    .then(function () {
      try { sessionStorage.setItem('p38-share-pending', payload.id); } catch (_) {}
      window.location.replace(dest);
    })
    .catch(function () {
      window.location.replace(dest + '&share-error=idb');
    });
})();
</script>
</body>
</html>`;
}
