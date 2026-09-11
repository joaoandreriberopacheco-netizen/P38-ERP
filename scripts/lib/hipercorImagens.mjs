/**
 * Hipercor — imagens oficiais + cores do catálogo (hipercor.com.br).
 */

export const HIPERCOR_BASE_IMAGES = {
  acrilica: {
    url: 'https://hipercor.com.br/wp-content/uploads/2019/05/Hipercor-HiperD-15L-1.png',
    fonte_ref: 'hipercor:hiper-d-acrilica-economica',
  },
  esmalte: {
    url: 'https://hipercor.com.br/wp-content/uploads/2019/05/Hipercor-Hiperlar-Madeiras-e-Metais-3L-4.png',
    fonte_ref: 'hipercor:hiperlar-esmalte-standard',
  },
  'massa-acrilica': {
    url: 'https://hipercor.com.br/wp-content/uploads/2019/05/Hipercor-Massa-Acrilica-5kg.png',
    fonte_ref: 'hipercor:massa-acrilica',
    background: '#f5f5f5',
  },
  'massa-corrida': {
    url: 'https://hipercor.com.br/wp-content/uploads/2019/05/Hipercor-Massa-Corrida-5kg.png',
    fonte_ref: 'hipercor:massa-corrida',
    background: '#f5f5f5',
  },
};

/** Cores oficiais Hiper D+ / Hiperlar (hipercor.com.br). */
export const HIPERCOR_CORES = {
  'BRANCO NEVE': { acrilica: '#F5F4F2', esmalte: '#f1f8ff' },
  AREIA: { acrilica: '#E0CDB4', esmalte: '#dbd2b5' },
  AMARELO: { esmalte: '#ffac00' },
  PRETO: { esmalte: '#1a1a1a' },
  TABACO: { esmalte: '#573512' },
  'AZUL DEL REY': { esmalte: '#00315c' },
};

/**
 * SKU P38 → definição de imagem.
 * Tintas: fundo na cor; massas: fundo neutro.
 */
export const HIPERCOR_SKUS = {
  '95B-U2J': { base: 'massa-acrilica' },
  'I4Z-LYJ': { base: 'massa-acrilica' },
  'YCF-12J': { base: 'massa-corrida' },
  'GTU-H4G': { base: 'massa-corrida' },
  'IPN-14G': { base: 'acrilica', cor: 'BRANCO NEVE' },
  'OXV-JK1': { base: 'acrilica', cor: 'AREIA' },
  'SQ9-R06': { base: 'acrilica', cor: 'BRANCO NEVE' },
  'U56-2UW': { base: 'esmalte', cor: 'AMARELO' },
  'M30-4N1': { base: 'esmalte', cor: 'PRETO' },
  '41Z-4IR': { base: 'esmalte', cor: 'TABACO' },
  '4JR-4KJ': { base: 'esmalte', cor: 'AMARELO' },
  'CNH-7FX': { base: 'esmalte', cor: 'AZUL DEL REY' },
  '97B-63F': { base: 'esmalte', cor: 'BRANCO NEVE' },
};

export function resolveHipercorHex(def) {
  const base = HIPERCOR_BASE_IMAGES[def.base];
  if (!base) return null;
  if (!def.cor) return base.background || '#ffffff';
  const palette = HIPERCOR_CORES[def.cor];
  if (!palette) return '#ffffff';
  return palette[def.base] || palette.acrilica || palette.esmalte || '#ffffff';
}

export function resolveHipercorFonteRef(def) {
  const base = HIPERCOR_BASE_IMAGES[def.base];
  if (!base) return null;
  if (!def.cor) return base.fonte_ref;
  const slug = def.cor.toLowerCase().replace(/\s+/g, '-');
  return `${base.fonte_ref}:${slug}`;
}
