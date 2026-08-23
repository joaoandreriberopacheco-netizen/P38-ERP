/**
 * Destino de portais (busca, overlays) — dentro do stage de paisagem quando activo.
 */
export function getP38PortalRoot() {
  if (typeof document === 'undefined') return null;
  const stage = document.querySelector('.p38-orientation-rotated-stage');
  return stage || document.body;
}
