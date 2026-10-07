/**
 * Iquine + Verbras — latas oficiais + fundo na cor do produto.
 */
import { normalizeCorKey, resolveTintaHex } from './tintasCores.mjs';

export const IQUINE_BASE_IMAGES = {
  esmalte: {
    url: 'https://www.iquine.com.br/storage/media/dialine_seca_rapido.png',
    fonte_ref: 'iquine:dialine-seca-rapido',
  },
  verniz: {
    url: 'https://www.iquine.com.br/storage/media/selador_incolor.png',
    fonte_ref: 'iquine:verniz-selador-ref',
    background: '#f5f0e8',
  },
  piso: {
    url: 'https://www.iquine.com.br/storage/media/diapiso_super_res.png',
    fonte_ref: 'iquine:diapiso-super-res',
  },
  anticorrosiva: {
    url: 'https://www.iquine.com.br/storage/media/Zarcofer.png',
    fonte_ref: 'iquine:zarcofer',
  },
  selador: {
    url: 'https://www.iquine.com.br/storage/media/selador_incolor.png',
    fonte_ref: 'iquine:selador-incolor',
    background: '#f5f5f5',
  },
  colorante: {
    url: 'https://www.iquine.com.br/storage/media/dialine_topa_tudo.png',
    fonte_ref: 'iquine:colorante-base-agua',
  },
  cola: {
    url: 'https://www.iquine.com.br/storage/media/dialine_topa_tudo.png',
    fonte_ref: 'iquine:cola-branca',
    background: '#f5f5f5',
  },
};

export const VERBRAS_BASE_IMAGES = {
  esmalte: {
    url: 'https://verbrascorp.com.br/home/wp-content/uploads/2023/01/ESMALTE-STANDARD-3L.png',
    fonte_ref: 'verbras:esmalte-secagem-rapida',
  },
  verniz: {
    url: 'https://verbrascorp.com.br/home/wp-content/uploads/2023/01/VERNIZ_TRIPLO_3L-e-750ml.png',
    fonte_ref: 'verbras:verniz-triplo-filtro-solar',
    background: '#f5f0e8',
  },
  'poupe-fosco': {
    url: 'https://verbrascorp.com.br/home/wp-content/uploads/2023/02/STANDARD_FOSCO.png',
    fonte_ref: 'verbras:linha-poupe-standard-fosco',
  },
};

function stripVolume(nome) {
  return String(nome || '')
    .replace(/\(.*?L\)/gi, '')
    .replace(/\d+[,.]?\d*\s*L/gi, '')
    .replace(/\d+\s*ML/gi, '')
    .replace(/\s+#G\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCorAfter(marker, nome) {
  const n = String(nome || '').toUpperCase();
  const idx = n.indexOf(marker);
  if (idx < 0) return null;
  let tail = stripVolume(n.slice(idx + marker.length));
  tail = tail.replace(/^VERBRAS\s+/i, '').replace(/^IQUINE\s+/i, '').trim();
  return tail || null;
}

function extractEsmalteIquineCor(nome) {
  const n = stripVolume(String(nome || '').toUpperCase());
  const m = n.match(/ESMALTE\s+IQUINE\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/**
 * @param {{ nome: string, codigo_interno?: string|null }} produto
 * @returns {{ marca: 'iquine'|'verbras', base: string, cor: string|null, tipo: 'tinta'|'madeira'|'neutro', fonte_ref: string }|null}
 */
export function resolveIquineVerbrasImagemDef(produto) {
  const nome = String(produto?.nome || '').toUpperCase();
  const isIquineLine = nome.includes('IQUINE') || nome.includes('ZARCOFER');
  if (!isIquineLine && !nome.includes('VERBRAS')) return null;

  if (nome.includes('VERBRAS')) {
    if (nome.includes('VERNIZ')) {
      const cor = extractCorAfter('VERNIZ', nome);
      const base = VERBRAS_BASE_IMAGES.verniz;
      return { marca: 'verbras', base: 'verniz', cor, tipo: 'madeira', fonte_ref: base.fonte_ref };
    }
    if (nome.includes('POUPE+') || nome.includes('STANDARD POUPE')) {
      const cor = extractCorAfter('VERBRAS', nome);
      const base = VERBRAS_BASE_IMAGES['poupe-fosco'];
      return { marca: 'verbras', base: 'poupe-fosco', cor, tipo: 'tinta', fonte_ref: base.fonte_ref };
    }
    if (nome.includes('ESMALTE')) {
      const cor = extractCorAfter('ESMALTE', nome);
      const base = VERBRAS_BASE_IMAGES.esmalte;
      return { marca: 'verbras', base: 'esmalte', cor, tipo: 'tinta', fonte_ref: base.fonte_ref };
    }
    return null;
  }

  // IQUINE
  if (nome.includes('VERNIZ')) {
    const cor = extractCorAfter('VERNIZ', nome);
    const base = IQUINE_BASE_IMAGES.verniz;
    return { marca: 'iquine', base: 'verniz', cor, tipo: 'madeira', fonte_ref: base.fonte_ref };
  }
  if (nome.includes('P/ PISO') || nome.includes('PISO IQUINE')) {
    const cor = extractCorAfter('PISO', nome) || extractCorAfter('P/ PISO', nome);
    const base = IQUINE_BASE_IMAGES.piso;
    return { marca: 'iquine', base: 'piso', cor, tipo: 'tinta', fonte_ref: base.fonte_ref };
  }
  if (nome.includes('ANTICORROSIV') || nome.includes('ZARCOFER')) {
    let cor = extractCorAfter('ANTICORROSIVA', nome)
      || extractCorAfter('ANTICORROSIV', nome);
    if (!cor && nome.includes('ZARCOFER')) {
      cor = extractCorAfter('ZARCOFER', nome);
    }
    const base = IQUINE_BASE_IMAGES.anticorrosiva;
    return { marca: 'iquine', base: 'anticorrosiva', cor, tipo: 'tinta', fonte_ref: base.fonte_ref };
  }
  if (nome.includes('SELADOR')) {
    const base = IQUINE_BASE_IMAGES.selador;
    return { marca: 'iquine', base: 'selador', cor: null, tipo: 'neutro', fonte_ref: base.fonte_ref };
  }
  if (nome.includes('COLORANTE')) {
    const cor = extractCorAfter('IQUINE', nome) || 'PRETO';
    const base = IQUINE_BASE_IMAGES.colorante;
    return { marca: 'iquine', base: 'colorante', cor, tipo: 'tinta', fonte_ref: base.fonte_ref };
  }
  if (nome.includes('COLA BRANCA')) {
    const base = IQUINE_BASE_IMAGES.cola;
    return { marca: 'iquine', base: 'cola', cor: null, tipo: 'neutro', fonte_ref: base.fonte_ref };
  }
  if (nome.includes('ESMALTE')) {
    const cor = extractEsmalteIquineCor(produto.nome);
    const base = IQUINE_BASE_IMAGES.esmalte;
    return { marca: 'iquine', base: 'esmalte', cor, tipo: 'tinta', fonte_ref: base.fonte_ref };
  }

  return null;
}

export function resolveIquineVerbrasHex(def) {
  const bases = def.marca === 'verbras' ? VERBRAS_BASE_IMAGES : IQUINE_BASE_IMAGES;
  const base = bases[def.base];
  if (!base) return '#ffffff';
  if (!def.cor) return base.background || '#f5f5f5';
  return resolveTintaHex(def.cor);
}

export function resolveIquineVerbrasFonteRef(def) {
  if (!def.cor) return def.fonte_ref;
  const slug = normalizeCorKey(def.cor).toLowerCase().replace(/\s+/g, '-');
  return `${def.fonte_ref}:${slug}`;
}

export function getIquineVerbrasBaseUrl(def) {
  const bases = def.marca === 'verbras' ? VERBRAS_BASE_IMAGES : IQUINE_BASE_IMAGES;
  return bases[def.base]?.url || null;
}
