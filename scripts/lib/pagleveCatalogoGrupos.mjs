/**
 * Agrupamento PagLeve: texturas (balde) e formatos régua (razão menor/maior < 1/3).
 */

import { isClasseUsoPei } from './paglevePeiResistencia.mjs';

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
function inferTexturaFromBlob(blob = '') {
  if (/\bantiderrap/.test(blob) || /\bgranilh/.test(blob)) return 'antiderrapante';
  if (/\bsemiderrap/.test(blob) || /\bprotetiva\b/.test(blob) || /\baderente\b/.test(blob) || /\bgotej/.test(blob) || /\bmre\b/.test(blob)) {
    return 'semiderrapante';
  }
  if (/\bmate\b/.test(blob) || /\bacetinad/.test(blob)) return 'mate';
  if (/\bbrilh/.test(blob) || /\besmalt/.test(blob)) return 'brilhante';
  if (/\bpolid/.test(blob) || /\brt\s*polid/.test(blob)) return 'polido';
  return '';
}

export function acabamentoGrupoPagLeve(item = {}) {
  const rawLabel = String(item.acabamento_label || item.formigres_acabamento || '').trim();
  const label = isClasseUsoPei(rawLabel) ? '' : normPagLeveText(rawLabel);
  const blob = normPagLeveText(
    [item.descricao, item.formigres_titulo, item.rotulo, item.subtipo].filter(Boolean).join(' '),
  );
  const inferred = !label ? inferTexturaFromBlob(blob) : '';

  if (
    label.includes('antiderrap') ||
    label.includes('granilh') ||
    item.subtipo === 'antiderrapante' ||
    inferred === 'antiderrapante'
  ) {
    return 'Antiderrapante';
  }
  if (
    label.includes('semiderrap') ||
    item.subtipo === 'semiderrapante' ||
    label.includes('protetiva') ||
    label.includes('aderente') ||
    label.includes('gotej') ||
    /\bmre\b/.test(blob) ||
    inferred === 'semiderrapante'
  ) {
    return 'Semiderrapante · Protetiva · MRE';
  }
  if (label.includes('mate') || label.includes('acetinad') || inferred === 'mate') {
    return 'Mate · Acetinado';
  }
  if (label.includes('brilh') || label.includes('esmalt') || inferred === 'brilhante') {
    return 'Brilhante · Esmaltado';
  }
  if (label.includes('polid') || item.linha === 'polida' || item.subtipo === 'polida' || inferred === 'polido') {
    return 'Polido';
  }
  if (rawLabel && !isClasseUsoPei(rawLabel)) return rawLabel;
  return 'Outros';
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
