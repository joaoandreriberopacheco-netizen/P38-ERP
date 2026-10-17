/**
 * Taxonomia canónica de categorias por etapa (TurboCharger / catálogo 4×3).
 * Números «01. …» alinham ao drill Excel.
 */
import { ETAPA } from './catalogo3x3Map.mjs';
import { legendaCaminho4x } from './catalogo3x3Map.mjs';

export const CATEGORIAS_CANONICAS_POR_ETAPA = {
  [ETAPA.EDIFICACOES]: ['01. Alvenaria', '02. Drywall', '03. Madeira', '04. Telhado'],
  [ETAPA.INSTALACOES]: ['01. Hidráulica', '02. Elétrica'],
  [ETAPA.ACABAMENTOS]: [
    '01. Pintura',
    '02. Elétrica',
    '03. Hidráulica',
    '04. Revestimentos',
    '05. Esquadrias',
  ],
};

/** Normaliza categoria legada → canónica (por etapa). */
export function normalizeCategoriaTurbo(etapa, categoria) {
  const cat = String(categoria ?? '').trim();
  const e = String(etapa ?? '').trim();
  if (!cat) return cat;

  if (e === ETAPA.ACABAMENTOS) {
    const acab = {
      '01. Revestimentos': '04. Revestimentos',
      '02. Forro': '04. Revestimentos',
      '03. Pintura': '01. Pintura',
      '04. Portas': '05. Esquadrias',
      '05. Hidráulica': '03. Hidráulica',
      '06. Elétrica': '02. Elétrica',
      '07. Calçamentos': '04. Revestimentos',
    };
    return acab[cat] ?? cat;
  }

  return cat;
}

export function normalizeFactRowTaxonomy(row) {
  const etapa = String(row.etapa ?? '').trim();
  row.categoria = normalizeCategoriaTurbo(etapa, row.categoria);
  row.legenda = legendaCaminho4x(row.etapa, row.categoria, row.subcategoria, row.linha);
  return row;
}

/** Garante pares etapa→categoria da taxonomia nas cascatas (inclui listas ainda sem SKU). */
export function mergeCanonEtapaCategoriaPairs(pairs) {
  const out = [...pairs];
  const seen = new Set(out.map((p) => `${p.parent}\x1f${p.child}`));

  for (const [etapa, categorias] of Object.entries(CATEGORIAS_CANONICAS_POR_ETAPA)) {
    for (const child of categorias) {
      const sig = `${etapa}\x1f${child}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({ parent: etapa, child });
    }
  }

  out.sort(
    (a, b) =>
      a.parent.localeCompare(b.parent, 'pt-BR') ||
      a.child.localeCompare(b.child, 'pt-BR'),
  );
  return out;
}
