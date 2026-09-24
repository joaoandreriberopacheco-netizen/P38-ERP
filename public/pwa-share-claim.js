/**
 * Marca partilha pendente antes do React hidratar (evita perder query no caminho).
 */
(function p38ShareClaimEarly() {
  if (typeof window === 'undefined') return;
  try {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('shared-id');
    var now = String(Date.now());
    if (id) {
      sessionStorage.setItem('p38-share-pending', id);
      sessionStorage.setItem('p38-share-active', '1');
      sessionStorage.setItem('p38-share-active-at', now);
      try {
        localStorage.setItem('p38_share_id', id);
        localStorage.setItem('p38-share-active-at', now);
      } catch (_) {}
      document.cookie = 'p38_share_id=' + encodeURIComponent(id) + '; Path=/; Max-Age=900; SameSite=Lax';
    }
    if (params.get('share-target') === '1') {
      sessionStorage.setItem('p38-share-active', '1');
      sessionStorage.setItem('p38-share-active-at', now);
    }
  } catch (_) {}
})();
