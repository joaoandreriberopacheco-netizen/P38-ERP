/**
 * Referência de agrupamento Leroy Merlin (BR) para benchmark do catálogo P38.
 * Fonte: URLs públicas leroymerlin.com.br (ferragens / fixação / barras-roscadas / parafusos).
 *
 * Uso: comparar família LM vs LINHA portal inferida — não é scrape automático.
 */

function trim(s) {
  return String(s ?? '').trim();
}

function norm(s) {
  return trim(s).replace(/\s+/g, ' ').toUpperCase();
}

function textBlob(row) {
  return norm([row.h1, row.h2, row.h3, row.sku_atual, row.novo_sku].filter(Boolean).join(' '));
}

/** @typedef {{ departamento: string, caminho: string, familiaLm: string, linhaPortalSugerida: string, lmUrl: string, nota?: string }} LmRef */

/** Regras ordenadas — primeira match ganha. */
const REGRAS_LM = [
  {
    test: (t) => /\bBARRA ROSC/.test(t),
    ref: {
      departamento: 'Ferragens',
      caminho: 'Ferragens > Fixação e Montagem > Barras Roscadas',
      familiaLm: 'Barras Roscadas',
      linhaPortalSugerida: 'PARAFUSO',
      nota: 'LM agrupa com parafusos/fixação; não é Material de Construção',
    },
  },
  {
    test: (t) => /^PARAFUSO\b|\bPARAFUSO P\//.test(t),
    ref: {
      departamento: 'Ferragens',
      caminho: 'Ferragens > Fixação e Montagem > Parafusos',
      familiaLm: 'Parafusos',
      linhaPortalSugerida: 'PARAFUSO',
    },
  },
  {
    test: (t) => /\bBUCHA PL[AÁ]STICA\b|\bBUCHA QU[IÍ]MICA\b/.test(t),
    ref: {
      departamento: 'Ferragens',
      caminho: 'Ferragens > Fixação e Montagem > Buchas de Parafuso',
      familiaLm: 'Buchas de Parafuso',
      linhaPortalSugerida: 'PARAFUSO',
    },
  },
  {
    test: (t) => /^PREGO\b/.test(t),
    ref: {
      departamento: 'Ferragens',
      caminho: 'Ferragens > Fixação e Montagem > Pregos',
      familiaLm: 'Pregos',
      linhaPortalSugerida: 'PREGO',
    },
  },
  {
    test: (t) => /\bPORCA\b|\bARRUELA\b/.test(t) && !/ELETRODUTO/.test(t),
    ref: {
      departamento: 'Ferragens',
      caminho: 'Ferragens > Fixação e Montagem > Porcas e Arruelas',
      familiaLm: 'Porcas e Arruelas',
      linhaPortalSugerida: 'PARAFUSO',
    },
  },
  {
    test: (t) => /\bTHINNER\b/.test(t),
    ref: {
      departamento: 'Tintas e Acessórios',
      caminho: 'Tintas > Complementos > Thinner',
      familiaLm: 'Thinner',
      linhaPortalSugerida: 'THINNER',
    },
  },
  {
    test: (t) => /\bVERNIZ\b/.test(t),
    ref: {
      departamento: 'Tintas e Acessórios',
      caminho: 'Tintas > Vernizes',
      familiaLm: 'Vernizes',
      linhaPortalSugerida: 'VERNIZ',
    },
  },
  {
    test: (t) => /\bTINTA\b|\bMASSA CORRIDA\b|\bMASSA ACR/.test(t),
    ref: {
      departamento: 'Tintas e Acessórios',
      caminho: 'Tintas > Tintas e Complementos',
      familiaLm: 'Tintas e Complementos',
      linhaPortalSugerida: 'TINTA',
    },
  },
  {
    test: (t) => /\bREJUNTE\b/.test(t) && !/LIMPADOR DE REJUNTE/.test(t),
    ref: {
      departamento: 'Pisos e Revestimentos',
      caminho: 'Pisos e Revestimentos > Rejuntes',
      familiaLm: 'Rejuntes',
      linhaPortalSugerida: 'REJUNTE',
    },
  },
  {
    test: (t) => /\bTUBO ESGOTO\b|^CAP ESGOTO|\bJOELHO ESGOTO|\bLUVA ESGOTO|\bTE ESGOTO/.test(t) || (/\bESGOTO\b/.test(t) && /\bTUBO|JOELHO|LUVA|TE |CAP /.test(t)),
    ref: {
      departamento: 'Hidráulica',
      caminho: 'Hidráulica > Esgoto',
      familiaLm: 'Tubos e Conexões Esgoto',
      linhaPortalSugerida: 'ESGOTO',
    },
  },
  {
    test: (t) => /\bSOLD[AÁ]VEL\b/.test(t) && /\bTUBO|JOELHO|LUVA|TE |CAP |ADAPTADOR|BUCHA RED/.test(t),
    ref: {
      departamento: 'Hidráulica',
      caminho: 'Hidráulica > Água Fria > Soldável',
      familiaLm: 'Soldável',
      linhaPortalSugerida: 'SOLDÁVEL',
    },
  },
  {
    test: (t) => /\bROSC[AÁ]VEL\b/.test(t) && /\bTUBO|JOELHO|LUVA|TE |CAP |NIPEL|PLUG|UNIAO|UNIÃO/.test(t),
    ref: {
      departamento: 'Hidráulica',
      caminho: 'Hidráulica > Água Fria > Roscável',
      familiaLm: 'Roscável',
      linhaPortalSugerida: 'ROSCÁVEL',
    },
  },
  {
    test: (t) => /\bELETRODUTO\b/.test(t),
    ref: {
      departamento: 'Materiais Elétricos',
      caminho: 'Materiais Elétricos > Eletrodutos e Conexões',
      familiaLm: 'Eletroduto',
      linhaPortalSugerida: 'ELETRODUTO',
    },
  },
  {
    test: (t) => /^CIMENTO\b|\bARGAMASSA\b/.test(t),
    ref: {
      departamento: 'Materiais de Construção',
      caminho: 'Materiais de Construção > Cimentos e Argamassas',
      familiaLm: 'Cimentos e Argamassas',
      linhaPortalSugerida: 'CIMENTO',
    },
  },
];

function slugBusca(text) {
  return norm(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * @param {object} row — linha do export (h1, linha, sku_atual, …)
 * @returns {LmRef & { slug: string }}
 */
export function sugerirReferenciaLeroyMerlin(row = {}) {
  const t = textBlob(row);
  for (const { test, ref } of REGRAS_LM) {
    if (test(t)) {
      const slug = slugBusca(row.h1 || row.sku_atual || ref.familiaLm);
      return {
        ...ref,
        slug,
        lmUrl: slug ? `https://www.leroymerlin.com.br/search?term=${encodeURIComponent(slug.replace(/-/g, ' '))}` : '',
      };
    }
  }

  const cat = norm(row.categoria_atual || '');
  if (cat.includes('PINTURA') || cat.includes('QUIMIC')) {
    return {
      departamento: 'Tintas e Acessórios',
      caminho: 'Tintas (ver subcategoria no site)',
      familiaLm: 'Tintas',
      linhaPortalSugerida: '',
      slug: slugBusca(row.h1 || row.sku_atual),
      lmUrl: `https://www.leroymerlin.com.br/search?term=${encodeURIComponent(trim(row.h1 || row.sku_atual).slice(0, 40))}`,
      nota: 'Inferido pela categoria ERP P38',
    };
  }
  if (cat.includes('HIDR')) {
    return {
      departamento: 'Hidráulica',
      caminho: 'Hidráulica (ver subcategoria)',
      familiaLm: 'Hidráulica',
      linhaPortalSugerida: '',
      slug: slugBusca(row.h1 || row.sku_atual),
      lmUrl: `https://www.leroymerlin.com.br/search?term=${encodeURIComponent(trim(row.h1 || row.sku_atual).slice(0, 40))}`,
      nota: 'Inferido pela categoria ERP P38',
    };
  }

  const slug = slugBusca(row.h1 || row.sku_atual);
  return {
    departamento: '',
    caminho: '',
    familiaLm: '',
    linhaPortalSugerida: '',
    slug,
    lmUrl: slug ? `https://www.leroymerlin.com.br/search?term=${encodeURIComponent(slug.replace(/-/g, ' '))}` : '',
    nota: 'Sem regra LM — pesquisar manualmente',
  };
}

export function linhasEquivalentes(linhaNossa, linhaSugerida) {
  const a = norm(linhaNossa);
  const b = norm(linhaSugerida);
  if (!b) return true;
  if (!a) return false;
  if (a === b) return true;
  // LM: barra roscada / bucha / porca → família parafusos; FERRAGEM genérica ≠ PARAFUSO
  if (b === 'PARAFUSO' && a === 'FERRAGEM') return false;
  // Pintura: LM agrupa tudo em "Tintas" — nossas LINHAs são mais granulares
  if (b === 'TINTA' && ['VERNIZ', 'THINNER', 'MASSA CORRIDA', 'MASSA ACRÍLICA', 'PINTURA E QUÍMICOS'].includes(a)) return true;
  if (b === 'VERNIZ' && a === 'VERNIZ') return true;
  if (b === 'THINNER' && a === 'THINNER') return true;
  // LM agrupa argamassa com cimentos — nós mantemos LINHA ARGAMASSA
  if (b === 'CIMENTO' && a === 'ARGAMASSA') return true;
  if (b === 'ESGOTO' && a === 'ESGOTO') return true;
  return false;
}

export const LEROY_MERLIN_ARVORE_FIXACAO = [
  'Ferragens',
  '  Ferragens para Fixação e Montagem',
  '    Parafusos',
  '    Barras Roscadas',
  '    Buchas de Parafuso',
  '    Porcas e Arruelas',
  '    Pregos',
  '    Chumbadores / Parabolt',
];
