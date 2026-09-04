/** Filtro tipo LINHA — portfolio inclui portfolio_kit (forro PVC). */
export function matchesLinhaTipoFilter(linhaTipo, filtroTipos) {
  if (!filtroTipos?.size) return true;
  if (filtroTipos.has(linhaTipo)) return true;
  if (linhaTipo === 'portfolio_kit' && filtroTipos.has('portfolio')) return true;
  return false;
}
