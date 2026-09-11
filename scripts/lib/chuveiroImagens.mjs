/**
 * Resolve imagens de chuveiros Lorenzetti, Japi e Astra.
 * Fontes: site Lorenzetti, loja Japi (VTEX), Telhanorte (VTEX fallback).
 */
import { execFileSync } from 'node:child_process';

const JAPI_SEARCH = 'https://www.lojajapi.com.br/api/catalog_system/pub/products/search';
const LOREN_BASE = 'https://www.lorenzetti.com.br';
const TELHA_SEARCH = 'https://www.telhanorte.com.br/api/catalog_system/pub/products/search';

/** Slugs oficiais Lorenzetti (ordem: nomes mais específicos primeiro). */
const LORENZETTI_LINE_SLUGS = [
  ['ACQUA DUO FLEX', 'acqua-duo-flex'],
  ['ACQUA DUO', 'acqua-duo'],
  ['ACQUA STORM', 'acqua-storm'],
  ['ACQUA WAVE', 'acqua-wave'],
  ['LOREN BELLO', 'loren-bello'],
  ['ADVANCED MULTITEMPERATURAS', 'advanced-multitemperaturas'],
  ['ADVANCED MULTITEMPERATURA', 'advanced-multitemperaturas'],
  ['DUO SHOWER', null],
  ['LOREN SHOWER', null],
  ['ADVANCED BLINDADO', null],
  ['ADVANCED ELETR', null],
  ['ADVANCED TURBO', null],
  ['VERSÁTIL', null],
  ['VERSATIL', null],
];

const JAPI_REF_ALIASES = {
  '1158MS (UP)': '1158IHP',
  '1195HB': '1195SHB',
};

/** Ref. Japi inferida pelo nome quando campo_hierarquico_4 está vazio. */
const JAPI_NAME_REFS = [
  { test: (n) => /REDONDO.*10.*CROMAD/i.test(n), ref: 'CVR10' },
  { test: (n) => /QUADRADO.*15/i.test(n), ref: 'CVQ15' },
  { test: (n) => /PL[AÁ]STICO.*4.*CROMAD/i.test(n), ref: 'CVCPB' },
  { test: (n) => /PL[AÁ]STICO.*PAREDE.*CROMAD/i.test(n), ref: 'CVCPB' },
  { test: (n) => /PL[AÁ]STICO.*CROMAD/i.test(n) && /JAPI/i.test(n), ref: 'CVCPB' },
  { test: (n) => /ABS BRANCO.*8/i.test(n), ref: 'NCPSR' },
  { test: (n) => /CHUVEIRO ABS BRANCO/i.test(n), ref: 'NCPSR' },
  { test: (n) => /PL[AÁ]STICO.*8.*BRANC/i.test(n), ref: 'NCPSR' },
  { test: (n) => /PL[AÁ]STICO.*7.*BRANC/i.test(n), ref: 'NCPSR' },
  { test: (n) => /PL[AÁ]STICO.*9.*BRANC/i.test(n), ref: 'NCPSR' },
  { test: (n) => /PVC COM REGISTRO/i.test(n), ref: 'NCPCR' },
  { test: (n) => /8.*COMBRA[CÇ]O.*30/i.test(n), ref: 'NCPSR' },
];

let lastRemoteFetchMs = 0;

function sleep(ms) {
  execFileSync('sleep', [`${Math.max(ms, 0) / 1000}`], { stdio: 'ignore' });
}

async function throttleRemote(minGapMs = 250) {
  const wait = minGapMs - (Date.now() - lastRemoteFetchMs);
  if (wait > 0) sleep(wait);
  lastRemoteFetchMs = Date.now();
}

const MANUAL_URLS = {
  CVCPB: 'https://japisa.vteximg.com.br/arquivos/ids/161509/CVCPB.jpg?v=637121169018030000',
  NCPSR: 'https://japisa.vteximg.com.br/arquivos/ids/162000/NCPCR.jpg?v=637121171010400000',
  NCPCR: 'https://japisa.vteximg.com.br/arquivos/ids/162001/NCPCR.jpg?v=637121171014330000',
};

function curl(url) {
  return execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0', url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function curlJson(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      throttleRemote();
      const raw = curl(url);
      if (!raw.trim().startsWith('[') && !raw.trim().startsWith('{')) {
        throw new Error(raw.slice(0, 120));
      }
      return JSON.parse(raw);
    } catch (err) {
      if (attempt === retries - 1) return null;
      sleep(400 * (attempt + 1));
    }
  }
  return null;
}

function normNome(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
}

const KNOWN_BRANDS = ['LORENZETTI', 'JAPI', 'ASTRA', 'TIGRE', 'DECA', 'DOCOL', 'TRAMONTINA'];

function detectBrand(produto) {
  const nome = normNome(produto.nome);
  const h2 = normNome(produto.campo_hierarquico_2);
  const h5 = normNome(produto.campo_hierarquico_5);
  if (/REBOUCAS|TRAMONTINA|DECA|DOCOL|TIGRE|FANI|KRONA|SOCEL/.test(nome)) return null;

  const marcaRaw = String(produto.marca || '').trim();
  if (marcaRaw) return marcaRaw.split('/')[0].trim();

  for (const brand of KNOWN_BRANDS) {
    if (nome.includes(brand) || h2.includes(brand) || h5.includes(brand)) {
      if (brand === 'LORENZETTI') return 'Lorenzetti';
      if (brand === 'JAPI') return 'Japi';
      if (brand === 'ASTRA') return 'Astra';
      return brand.charAt(0) + brand.slice(1).toLowerCase();
    }
  }

  if (/CHUVEIRO (REDONDO|QUADRADO|PLASTICO|PLASTICO|ABS|PVC)/i.test(produto.nome || '')) return 'Japi';
  return null;
}

function pickLorenzettiVariant(html, nome) {
  const n = normNome(nome);
  const imgs = [...html.matchAll(/https:\/\/(?:www\.)?lorenzetti\.com\.br\/images\/default-source\/[^"']+\.(?:png|jpg)/gi)]
    .map((m) => m[0].split('?')[0])
    .filter((u) => /chuveiros-eletricos|produtos-png/i.test(u) && !/logo|flagcdn|certificados|curva_vazao/i.test(u));

  const colorHints = [
    ['PRETO CROMAD', 'preto-cromad'],
    ['BRANCO CROMAD', 'branco-cromad'],
    ['MATTE BLACK', 'matte-black'],
    ['PRETO', 'preto'],
    ['CROMAD', 'cromad'],
    ['BRANC', 'branco'],
  ];
  for (const [hint, token] of colorHints) {
    if (n.includes(hint)) {
      const hit = imgs.find((u) => u.toLowerCase().includes(token));
      if (hit) return hit;
    }
  }

  const og = html.match(/property="og:image" content="([^"]+)"/i);
  if (og?.[1] && !/logo/i.test(og[1])) return og[1].split('?')[0];
  return imgs[0] || null;
}

function resolveLorenzettiSite(nome) {
  const n = normNome(nome);
  const line = LORENZETTI_LINE_SLUGS.find(([token]) => n.includes(token));
  if (!line || !line[1]) return null;

  throttleRemote();
  const html = curl(`${LOREN_BASE}/produto/${line[1]}`);
  const url = pickLorenzettiVariant(html, nome);
  if (!url) return null;
  return {
    url,
    fonte: 'import',
    fonte_ref: `lorenzetti:${line[1]}`,
    resolver: 'lorenzetti-site',
  };
}

function resolveJapi(ref, searchTerm) {
  const wanted = String(ref || '').trim().toUpperCase();
  const term = encodeURIComponent(searchTerm || JAPI_REF_ALIASES[ref] || ref);
  const data = curlJson(`${JAPI_SEARCH}?ft=${term}`);
  if (!Array.isArray(data) || !data.length) return null;

  for (const product of data) {
    for (const sku of product.items || []) {
      const refId = (sku.referenceId || []).find((r) => r.Key === 'RefId')?.Value || '';
      const name = `${product.productName || ''} ${sku.name || ''}`;
      if (
        refId.toUpperCase() === wanted
        || wanted.replace(/\s*\(.*\)/, '') === refId.toUpperCase()
        || (wanted && name.toUpperCase().includes(wanted.replace(/\s*\(.*\)/, '')))
      ) {
        const img = sku.images?.[0]?.imageUrl;
        if (img) {
          return { url: img, fonte: 'import', fonte_ref: `japi:${refId || ref}`, resolver: 'japi-vtex' };
        }
      }
    }
  }

  const fallback = data[0]?.items?.[0]?.images?.[0]?.imageUrl;
  if (fallback) {
    return { url: fallback, fonte: 'import', fonte_ref: `japi-search:${term}`, resolver: 'japi-vtex-fallback' };
  }
  return null;
}

function sanitizeSearchTerm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/["'`]/g, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function buildTelhanorteTerm(produto, brand) {
  const nome = String(produto.nome || '').trim();
  const cleaned = nome
    .replace(/CHUVEIRO EL[EÉ]TRICO\s+127\s*V\s*\/\s*5500W/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitizeSearchTerm(`${cleaned} ${brand}`);
}

function resolveTelhanorte(produto, brand) {
  const term = buildTelhanorteTerm(produto, brand);
  if (!term) return null;
  const data = curlJson(`${TELHA_SEARCH}?ft=${encodeURIComponent(term)}&_from=0&_to=15`);
  if (!Array.isArray(data) || !data.length) return null;

  const brandLower = brand.toLowerCase();
  const ranked = data
    .map((p) => {
      const name = String(p.productName || '');
      const img = p.items?.[0]?.images?.[0]?.imageUrl;
      if (!img) return null;
      let score = 0;
      if ((p.brand || '').toLowerCase().includes(brandLower)) score += 5;
      if (/chuveir|ducha/i.test(name)) score += 3;
      if (/resist|sifao|registro|botao|valvula|cabide/i.test(name)) score -= 8;
      if (/resist/i.test(name)) score -= 4;
      if (normNome(name).includes(normNome(produto.nome).split(' ').slice(0, 4).join(' '))) score += 2;
      return { score, url: img, productId: p.productId, name };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 3) return null;
  return {
    url: best.url,
    fonte: 'import',
    fonte_ref: `telhanorte:${best.productId}`,
    resolver: 'telhanorte-vtex',
  };
}

function normalizeManufacturerRef(value) {
  const ref = String(value || '').trim();
  if (!ref || /^avulso$/i.test(ref)) return null;
  if (/[\\/]|BRA[CÇ]O|REGISTRO|PL[AÁ]STICO/i.test(ref)) return null;
  return ref;
}

function inferJapiRef(produto) {
  const nome = normNome(produto.nome);
  const hit = JAPI_NAME_REFS.find((row) => row.test(nome));
  return hit?.ref || null;
}

/**
 * @param {{ codigo_interno?: string, nome?: string, marca?: string|null, campo_hierarquico_1?: string|null, campo_hierarquico_2?: string|null, campo_hierarquico_4?: string|null, campo_hierarquico_5?: string|null }} produto
 */
export function resolveChuveiroImagem(produto) {
  const brand = detectBrand(produto);
  const nome = produto.nome || '';
  const ref = normalizeManufacturerRef(produto.campo_hierarquico_4);

  if (ref && MANUAL_URLS[ref]) {
    return { url: MANUAL_URLS[ref], fonte: 'import', fonte_ref: `manual:${ref}`, resolver: 'manual' };
  }

  if (brand === 'Japi' || (!brand && inferJapiRef(produto))) {
    const japiRef = ref || inferJapiRef(produto);
    if (japiRef) {
      if (MANUAL_URLS[japiRef]) {
        return { url: MANUAL_URLS[japiRef], fonte: 'import', fonte_ref: `manual:${japiRef}`, resolver: 'manual' };
      }
      const hit = resolveJapi(japiRef);
      if (hit) return hit;
    }
  }

  if (brand === 'Lorenzetti' || normNome(nome).includes('LORENZETTI')) {
    const site = resolveLorenzettiSite(nome);
    if (site) return site;
    const retail = resolveTelhanorte(produto, 'Lorenzetti');
    if (retail) return retail;
  }

  if (brand === 'Astra' || normNome(nome).includes('ASTRA')) {
    if (/CHUVEIRO/i.test(nome)) {
      return {
        url: 'https://telhanorte.vteximg.com.br/arquivos/ids/403954/Chuveiro-4--com-Haste-Branco-Astra-1734032.jpg?v=637315562383200000',
        fonte: 'import',
        fonte_ref: 'telhanorte:1734032',
        resolver: 'telhanorte-astra-fallback',
      };
    }
    const retail = resolveTelhanorte(produto, 'Astra');
    if (retail) return retail;
    return {
      url: 'https://telhanorte.vteximg.com.br/arquivos/ids/403954/Chuveiro-4--com-Haste-Branco-Astra-1734032.jpg?v=637315562383200000',
      fonte: 'import',
      fonte_ref: 'telhanorte:1734032',
      resolver: 'telhanorte-astra-fallback',
    };
  }

  if (brand === 'Japi') {
    const retail = resolveTelhanorte(produto, 'Japi');
    if (retail) return retail;
  }

  return null;
}

export function isChuveiroTarget(produto) {
  const nome = normNome(produto.nome);
  const h1 = normNome(produto.campo_hierarquico_1);
  if (h1.includes('CHUVEIRO')) return true;
  if (/CHUVEIRO|ACQUA DUO|ACQUA STORM|ACQUA WAVE|DUO SHOWER|LOREN BELLO/.test(nome)) return true;
  if (/VERSATIL LORENZETTI|VERSÁTIL LORENZETTI/.test(nome)) return true;
  return false;
}

export function isChuveiroBrandTarget(produto) {
  const brand = detectBrand(produto);
  if (brand && ['Lorenzetti', 'Japi', 'Astra'].includes(brand)) return true;
  if (isChuveiroTarget(produto) && inferJapiRef(produto)) return true;
  return false;
}
