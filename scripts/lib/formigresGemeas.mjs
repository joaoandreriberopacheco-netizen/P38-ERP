/**
 * Gêmeas Formigres — mesmo modelo/título+formato em várias marcas.
 * Mantém uma linha canónica no catálogo e lista as restantes em `gemeas[]`.
 */
import { stripAccents } from './formigresCatalog.mjs';

export function gemeasKey(item) {
  const fmt = stripAccents(String(item.formato || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  const tit = stripAccents(String(item.formigres_titulo || item.descricao || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return `${fmt}|${tit}`;
}

function canonicalRank(item) {
  const marca = stripAccents(String(item.marca_nome || '')).toLowerCase();
  if (marca.includes('formigres')) return 0;
  if (marca.includes('marcel')) return 1;
  return 2;
}

function sortGemeasGroup(group) {
  return [...group].sort((a, b) => {
    const r = canonicalRank(a) - canonicalRank(b);
    if (r !== 0) return r;
    return Number(a.codigo_tintao) - Number(b.codigo_tintao);
  });
}

export function dedupeFormigresGemeas(itens) {
  const groups = new Map();
  for (const item of itens) {
    const k = gemeasKey(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }

  const visible = [];
  let hidden = 0;
  let twinGroups = 0;

  for (const group of groups.values()) {
    const sorted = sortGemeasGroup(group);
    const canonical = { ...sorted[0] };
    const gemeas = sorted.map((g) => ({
      codigo: String(g.codigo_tintao),
      marca: String(g.marca_nome || '—').trim() || '—',
      referencia: String(g.referencia || '—').trim() || '—',
    }));

    if (gemeas.length > 1) {
      twinGroups += 1;
      hidden += gemeas.length - 1;
      canonical.gemeas = gemeas;
    } else {
      canonical.gemeas = [];
    }
    visible.push(canonical);
  }

  return {
    itens: visible,
    stats: {
      total: itens.length,
      visible: visible.length,
      hidden,
      twinGroups,
    },
  };
}
