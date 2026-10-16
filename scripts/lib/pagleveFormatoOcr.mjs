/**
 * Formatos no relatório SIAH / fornecedor: primeiro dígito cortado (5x45 → 45x45, 2x90 → 22x90).
 */

/** Mapa explícito (chave já normalizada: NxN minúsculo). */
export const PAGLEVE_FORMATO_OCR_FIX = {
  '0x50': '50x50',
  '0x70': '70x70',
  '0x90': '90x90',
  '1x81': '81x81',
  '1x116': '61x116',
  '2x57': '32x57',
  '2x82': '82x82',
  '2x90': '22x90',
  '4x74': '74x74',
  '5x45': '45x45',
  '5x75': '75x75',
  '5x89': '45x89',
  '6x66': '66x66',
  '6x75': '75x75',
  '7x57': '57x57',
  '8x58': '58x58',
  '9x75': '39x75',
};

export function normalizeFormatoKey(fmt = '') {
  const m = String(fmt || '').match(/(\d{1,3})\s*[x×]\s*(\d{1,3})/i);
  return m ? `${m[1]}x${m[2]}`.toLowerCase() : String(fmt || '').trim().toLowerCase();
}

/** Corrige um formato já extraído (coluna CSV ou primeiro match na descrição). */
export function fixPagLeveFormatoOcr(fmt = '') {
  const key = normalizeFormatoKey(fmt);
  if (!key) return '';
  return PAGLEVE_FORMATO_OCR_FIX[key] || key;
}

function formatoScore(fmt) {
  const [a, b] = String(fmt).split('x').map((n) => parseInt(n, 10));
  if (!a || !b) return 0;
  let s = a + b;
  if (a >= 20 && b >= 20) s += 120;
  else if (a >= 10 && b >= 10) s += 40;
  if (a === b) s += 8;
  return s;
}

/** Escolhe o melhor formato na descrição + coluna (após correção OCR). */
export function resolveFormatoPagLeve(descricao = '', formatoColuna = '') {
  const candidates = [];
  const raw = String(descricao || '');
  const re = /(\d{1,3})\s*[x×]\s*(\d{1,3})/gi;
  let m;
  while ((m = re.exec(raw)) !== null) {
    candidates.push(fixPagLeveFormatoOcr(`${m[1]}x${m[2]}`));
  }
  const fromCol = fixPagLeveFormatoOcr(formatoColuna);
  if (fromCol) candidates.push(fromCol);

  const uniq = [...new Set(candidates.filter(Boolean))];
  if (!uniq.length) return fromCol || '';
  uniq.sort((a, b) => formatoScore(b) - formatoScore(a));
  return uniq[0];
}
