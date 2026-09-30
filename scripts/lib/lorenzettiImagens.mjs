/**
 * Resolve imagens oficiais Lorenzetti para o pacote mapeado (chuveiros + Waterfall).
 * Quando a página tem produto + ambiente, devolve as duas.
 */
import { execFileSync } from 'node:child_process';

const BASE = 'https://www.lorenzetti.com.br';

/** @type {Record<string, { page?: string, picks?: Array<{ match: RegExp, tipo: 'principal' | 'ambiente' }>, urls?: Array<{ url: string, tipo: 'principal' | 'ambiente' }> }>} */
export const LORENZETTI_PACK = {
  '016-P70': {
    page: '/produto/aquecedor-versatil',
    picks: [
      { match: /aquecedores-eletricos\/aquecedor-versatil\.png$/i, tipo: 'principal' },
      { match: /banheiro-amb/i, tipo: 'ambiente' },
    ],
  },
  'KI1-4E5': {
    page: '/produtos/duchas-e-chuveiros-eletricos/acqua-storm',
    picks: [
      { match: /acqua-storm-branco\.png$/i, tipo: 'principal' },
      { match: /stormamb/i, tipo: 'ambiente' },
    ],
  },
  'MS9-D8N': {
    urls: [
      {
        url: `${BASE}/images/default-source/produtos-png/chuveiros-eletricos/acqua-duo-branco-cromado.png`,
        tipo: 'principal',
      },
    ],
  },
  'MVY-J8B': {
    page: '/produtos/duchas-e-chuveiros-eletricos/acqua-storm',
    picks: [
      { match: /acqua-storm-preto\.png$/i, tipo: 'principal' },
      { match: /stormamb/i, tipo: 'ambiente' },
    ],
  },
  'TF3-3VS': {
    page: '/produtos/duchas-e-chuveiros-eletricos/acqua-storm',
    picks: [
      { match: /acqua-storm-preto-cromado\.png$/i, tipo: 'principal' },
      { match: /stormamb/i, tipo: 'ambiente' },
    ],
  },
  'SZ9-IRE': {
    page: '/produtos/duchas-e-chuveiros-eletricos/acqua-wave',
    picks: [
      { match: /acqua-wave-branco\.png$/i, tipo: 'principal' },
      { match: /acquawaveamb/i, tipo: 'ambiente' },
    ],
  },
  'T59-6G3': {
    page: '/produtos/duchas-e-chuveiros-eletricos/loren-bello',
    picks: [{ match: /loren-bello-branco\.png$/i, tipo: 'principal' }],
  },
  '4JX-CIO': {
    page: '/produtos/duchas-e-chuveiros-eletricos/advanced',
    picks: [{ match: /advanced-eletronica---com-haste\.png$/i, tipo: 'principal' }],
  },
  'P7R-FNU': {
    page: '/produtos/duchas-e-chuveiros-eletricos/advanced',
    picks: [{ match: /advanced-eletronica---com-haste\.png$/i, tipo: 'principal' }],
  },
  'W0B-9C4': {
    page: '/produtos/duchas-e-chuveiros-eletricos/advanced',
    picks: [{ match: /advanced-multi\.png$/i, tipo: 'principal' }],
  },
  'E5R-MMT': {
    page: '/produtos/duchas-e-chuveiros-eletricos/loren-shower-ultra',
    picks: [{ match: /loren-shower-eletronica\.png$/i, tipo: 'principal' }],
  },
  'T6O-V8F': {
    page: '/produtos/duchas-e-chuveiros-eletricos/duo-shower-quadra',
    picks: [{ match: /duo-shower-quadra-eletronica\.png$/i, tipo: 'principal' }],
  },
  'P85-O76': {
    urls: [
      {
        url: `${BASE}/images/default-source/produtos-png/metais/2877-c70.png`,
        tipo: 'principal',
      },
    ],
  },
};

let lastRemoteFetchMs = 0;

function sleep(ms) {
  execFileSync('sleep', [`${Math.max(ms, 0) / 1000}`], { stdio: 'ignore' });
}

function throttleRemote(minGapMs = 250) {
  const wait = minGapMs - (Date.now() - lastRemoteFetchMs);
  if (wait > 0) sleep(wait);
  lastRemoteFetchMs = Date.now();
}

function curl(url) {
  throttleRemote();
  return execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0', '--max-time', '20', url], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
}

function extractImageUrls(html) {
  const urls = [...html.matchAll(/https:\/\/(?:www\.)?lorenzetti\.com\.br\/images\/default-source\/([^?"'\s]+\.(?:png|jpg|webp))/gi)]
    .map((m) => ({
      path: m[1].replace(/&#225;/g, 'á').replace(/&amp;/g, '&'),
      url: m[0].split('?')[0],
    }))
    .filter((x) => !/logo|flagcdn|certificados|curva|selo|etiq|flowcurve|technical|desktop|\.tmb-/i.test(x.path));

  const seen = new Set();
  return urls.filter((x) => {
    if (seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });
}

function resolveFromPage(config, sku) {
  const html = curl(`${BASE}${config.page}`);
  const candidates = extractImageUrls(html);
  const imagens = [];

  for (const pick of config.picks || []) {
    const hit = candidates.find((c) => pick.match.test(c.path) || pick.match.test(c.url));
    if (hit) {
      imagens.push({
        url: hit.url,
        tipo: pick.tipo,
        fonte: 'import',
        fonte_ref: `lorenzetti:${sku}:${pick.tipo}`,
        resolver: 'lorenzetti-site',
      });
    }
  }

  return imagens;
}

function resolveFromUrls(config, sku) {
  return (config.urls || []).map((img) => ({
    url: img.url,
    tipo: img.tipo,
    fonte: 'import',
    fonte_ref: `lorenzetti:${sku}:${img.tipo}`,
    resolver: 'lorenzetti-cdn',
  }));
}

/** @param {{ codigo_interno: string }} produto */
export function resolveLorenzettiImagens(produto) {
  const sku = String(produto.codigo_interno || '').trim();
  const config = LORENZETTI_PACK[sku];
  if (!config) return [];

  if (config.urls?.length) return resolveFromUrls(config, sku);
  if (config.page && config.picks?.length) return resolveFromPage(config, sku);
  return [];
}

export function isLorenzettiPackTarget(produto) {
  return Boolean(LORENZETTI_PACK[String(produto.codigo_interno || '').trim()]);
}
