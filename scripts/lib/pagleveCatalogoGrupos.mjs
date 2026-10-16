/**
 * Agrupamento PagLeve: texturas (balde) e formatos régua (razão menor/maior < 1/3).
 */

export const PAGLEVE_ACAB_GRUPO_ORDER = [
  'Brilhante · Esmaltado',
  'Mate · Acetinado',
  'Semiderrapante · Protetiva · MRE',
  'Antiderrapante',
  'Polido',
  'Outros',
];

export function normPagLeveText(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function parseFormatoDim(fmt = '') {
  const m = String(fmt).match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!a || !b) return null;
  return { a, b, min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * Ex.: 45×45 (1) → não; 22×90 (~0,24) e 30×90 (1/3) → régua;
 * 62×119 (~0,52) e 39×75 → não (razão acima de 1/3).
 */
export function isReguaFormato(fmt = '') {
  const d = parseFormatoDim(fmt);
  if (!d) return false;
  return d.min / d.max <= 1 / 3;
}

export function formatoTreeKeyPagLeve(fmt = '') {
  const raw = String(fmt || '—').trim();
  if (!raw || raw === '—') return '—';
  const norm = raw.replace(/×/gi, 'x').toLowerCase();
  return isReguaFormato(norm) ? `regua:${norm}` : norm;
}

/**
 * @param {{ acabamento_label?: string, formigres_acabamento?: string, descricao?: string, formigres_titulo?: string, rotulo?: string, subtipo?: string, linha?: string }} item
 */
export function acabamentoGrupoPagLeve(item = {}) {
  const label = normPagLeveText(item.acabamento_label || item.formigres_acabamento || '');
  const blob = normPagLeveText(
    [item.descricao, item.formigres_titulo, item.rotulo, item.subtipo].filter(Boolean).join(' '),
  );

  if (label.includes('antiderrap') || item.subtipo === 'antiderrapante') {
    return 'Antiderrapante';
  }
  if (
    label.includes('semiderrap') ||
    item.subtipo === 'semiderrapante' ||
    label.includes('protetiva') ||
    label.includes('aderente') ||
    label.includes('granilh') ||
    label.includes('gotej') ||
    /\bmre\b/.test(blob)
  ) {
    return 'Semiderrapante · Protetiva · MRE';
  }
  if (label.includes('mate') || label.includes('acetinad')) {
    return 'Mate · Acetinado';
  }
  if (label.includes('brilh') || label.includes('esmalt')) {
    return 'Brilhante · Esmaltado';
  }
  if (label.includes('polid') || item.linha === 'polida' || item.subtipo === 'polida') {
    return 'Polido';
  }

  const raw = String(item.acabamento_label || item.formigres_acabamento || '').trim();
  return raw || 'Outros';
}

export function parseFormatoTreeKey(key = '') {
  const s = String(key || '');
  if (s.startsWith('regua:')) return { isRegua: true, fmt: s.slice(6) };
  return { isRegua: false, fmt: s };
}

export function compareFormatoTreeKey(a, b, compareFormatoFn) {
  const pa = parseFormatoTreeKey(a);
  const pb = parseFormatoTreeKey(b);
  if (pa.isRegua !== pb.isRegua) return pa.isRegua ? 1 : -1;
  return compareFormatoFn(pa.fmt, pb.fmt);
}

export function labelFormatoTreeKey(key = '') {
  const s = String(key || '');
  if (s.startsWith('regua:')) return s.slice(6).replace(/x/g, '×');
  return `Formato ${s.replace(/x/g, '×')}`;
}
