/** Campos de performance (ABCD / IEP) — usados em relatórios e ordenação fora do catálogo. */

import { resolveProdutoAbcdClasse } from '@/lib/catalogAbcdEnrichment';

export const ABCD_RANK = { A: 5, B: 4, C: 3, D: 2, E: 1 };

function confiancaSymbolFromIndex(indice) {
  const value = Number(indice);
  if (!Number.isFinite(value)) return '';
  if (value >= 70) return '++';
  if (value >= 40) return '+';
  return '-';
}

export const CATALOG_SORT_OPTIONS = [
  { id: 'az', label: 'Nome A → Z' },
  { id: 'za', label: 'Nome Z → A' },
  { id: 'abcd_desc', label: 'Classe ABCD (A primeiro)' },
  { id: 'abcd_asc', label: 'Classe ABCD (E primeiro)' },
];

export function getAbcdRank(letter) {
  return ABCD_RANK[String(letter || '').toUpperCase()] ?? 0;
}

/**
 * Letra ABCD de um grupo (linha h2 ou h1 sem h2) no tree grid.
 * A curva Pareto (A–D) é por subtipo (h1+h2, ou só h1); E é só SKU sem venda.
 * Na agregação, não misturar os E dos filhos — usar a letra do grupo (A–D).
 */
export function resolveAbcdDominanteGrupo(skus) {
  const letters = (skus || [])
    .map((p) => resolveProdutoAbcdClasse(p))
    .filter(Boolean);
  const paretoLetters = letters.filter((l) => String(l).toUpperCase() !== 'E');
  if (paretoLetters.length > 0) {
    const freq = {};
    for (const l of paretoLetters) {
      const u = String(l).toUpperCase();
      freq[u] = (freq[u] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }
  return letters.some((l) => String(l).toUpperCase() === 'E') ? 'E' : '';
}

export function getProdutoPerformanceValue(produto, fieldId) {
  if (!produto || !fieldId) return null;
  if (fieldId === 'abcd') return getAbcdRank(resolveProdutoAbcdClasse(produto));
  const raw = produto[fieldId];
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

export function parseCatalogSortOrder(sortOrder) {
  if (!sortOrder || sortOrder === 'az' || sortOrder === 'za') {
    return { mode: 'name', direction: sortOrder === 'za' ? 'desc' : 'asc' };
  }
  const match = String(sortOrder).match(/^(.+)_(asc|desc)$/);
  if (!match) return { mode: 'name', direction: 'asc' };
  return { mode: match[1], direction: match[2] };
}

export function compareProdutosForCatalogSort(a, b, sortOrder) {
  const parsed = parseCatalogSortOrder(sortOrder);
  if (parsed.mode === 'name') {
    const cmp = (a?.nome || '').localeCompare(b?.nome || '', 'pt-BR', { sensitivity: 'base' });
    return parsed.direction === 'desc' ? -cmp : cmp;
  }

  const aVal = getProdutoPerformanceValue(a, parsed.mode);
  const bVal = getProdutoPerformanceValue(b, parsed.mode);
  if (aVal !== bVal) {
    return parsed.direction === 'asc' ? aVal - bVal : bVal - aVal;
  }
  return (a?.nome || '').localeCompare(b?.nome || '', 'pt-BR', { sensitivity: 'base' });
}

export function aggregatePerformanceFromSkus(skus) {
  if (!skus?.length) {
    return {
      abcdRankMedio: 0,
      abcdDominante: '',
      iepScoreMedio: 0,
      iepConfiancaMedia: 0,
      iepConfiancaSimbolo: '',
      iepCodigoComportamentoDominante: '',
      iepScoreNivel1Medio: 0,
      iepScoreNivel2Medio: 0,
      iepScoreNivel3Medio: 0,
      iepScoreNivel4Medio: 0,
      iepScoreNivel5Medio: 0,
    };
  }

  const ranks = skus.map((p) => getAbcdRank(resolveProdutoAbcdClasse(p)));
  const abcdRankMedio = ranks.reduce((s, v) => s + v, 0) / ranks.length;

  const abcdDominante = resolveAbcdDominanteGrupo(skus);
  const perfFreq = {};
  for (const p of skus) {
    const code = String(p?.iep_codigo_comportamento || '').toUpperCase().trim();
    if (!code) continue;
    perfFreq[code] = (perfFreq[code] || 0) + 1;
  }

  const avg = (field) => {
    const vals = skus.map((p) => Number(p[field]) || 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const iepConfiancaMedia = avg('iep_confianca_indice');

  return {
    abcdRankMedio,
    abcdDominante,
    iepScoreMedio: avg('iep_score'),
    iepConfiancaMedia,
    iepConfiancaSimbolo: confiancaSymbolFromIndex(iepConfiancaMedia),
    iepCodigoComportamentoDominante:
      Object.entries(perfFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    iepScoreNivel1Medio: avg('iep_score_nivel_1'),
    iepScoreNivel2Medio: avg('iep_score_nivel_2'),
    iepScoreNivel3Medio: avg('iep_score_nivel_3'),
    iepScoreNivel4Medio: avg('iep_score_nivel_4'),
    iepScoreNivel5Medio: avg('iep_score_nivel_5'),
  };
}

export function getGroupPerformanceSortValue(agg, sortOrder) {
  const parsed = parseCatalogSortOrder(sortOrder);
  if (parsed.mode === 'name') return agg?.label || '';
  if (parsed.mode === 'abcd') return agg?.abcdRankMedio ?? 0;
  const map = {
    iep_score: 'iepScoreMedio',
    iep_score_nivel_1: 'iepScoreNivel1Medio',
    iep_score_nivel_2: 'iepScoreNivel2Medio',
    iep_score_nivel_3: 'iepScoreNivel3Medio',
    iep_score_nivel_4: 'iepScoreNivel4Medio',
    iep_score_nivel_5: 'iepScoreNivel5Medio',
  };
  return agg?.[map[parsed.mode]] ?? 0;
}

export function compareCatalogSortValues(aVal, bVal, sortOrder) {
  const parsed = parseCatalogSortOrder(sortOrder);
  if (parsed.mode === 'name') {
    const cmp = String(aVal).localeCompare(String(bVal), 'pt-BR', { sensitivity: 'base' });
    return parsed.direction === 'desc' ? -cmp : cmp;
  }
  const aNum = Number(aVal) || 0;
  const bNum = Number(bVal) || 0;
  if (aNum !== bNum) return parsed.direction === 'asc' ? aNum - bNum : bNum - aNum;
  return 0;
}
