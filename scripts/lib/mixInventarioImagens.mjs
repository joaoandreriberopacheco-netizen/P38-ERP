/**
 * Resolve imagens de produto do mix inventário por ref. de fabricante.
 */
import { execFileSync } from 'node:child_process';

const JAPI_SEARCH = 'https://www.lojajapi.com.br/api/catalog_system/pub/products/search';
const LOREN_BASE = 'https://www.lorenzetti.com.br';
const TIGRE_MEDIA = 'https://qfzo0q7soc.execute-api.us-east-1.amazonaws.com/master/new/media/catalog/product//3/0';

const LOREN_SLUGS = {
  '7110015': '1195f31',
  'Acqua Due': 'acqua-due-para-mesa',
  'Acqua Bella': null,
};

const MANUAL_URLS = {
  'Acqua Bella': 'https://lorenzetti.com.br/images/default-source/produtos-png/purificadores/acqua-bella-parede-branco.png',
  '1195HB': null, // resolvido via search 1195SHB
  '1158MS (UP)': 'https://japisa.vteximg.com.br/arquivos/ids/161345/1158IHP.jpg?v=637121167465300000',
  JSMG: 'https://japisa.vteximg.com.br/arquivos/ids/172029/FLCRP20.jpg?v=638582045598970000',
  JSIF3AS: 'https://japisa.vteximg.com.br/arquivos/ids/161978/KSVPK.jpg?v=637121170926670000',
  JSIF2AS: 'https://japisa.vteximg.com.br/arquivos/ids/161978/KSVPK.jpg?v=637121170926670000',
};

const JAPI_SEARCH_ALIASES = {
  '1195HB': '1195SHB',
  '1158MS (UP)': '1158IHP',
};

const TIGRE_SLUGS = {
  300000461: 'torneira-para-cozinha-mesa-bica-alta-movel-tigre-orbe',
  300000453: 'torneira-para-tanque-ou-maquina-de-lavar-tigre-cross',
};

const AVULSO_SEARCH = {
  '4KW-7YB': 'jardim preto parede',
  '6TE-3PD': 'torneira filtro bebedouro',
  'OM3-A0I': 'cozinha bica curva',
  'NUP-7QS': 'tanque parede branca cross',
  'IMN-IN8': 'tanque parede branca 15cm',
};

function curl(url) {
  return execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0', url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function curlJson(url) {
  const raw = curl(url);
  return JSON.parse(raw);
}

function normalizeRef(ref) {
  return String(ref || '').trim();
}

function pickLorenzettiImage(html, variant = 'cromado') {
  const imgs = [...html.matchAll(/https:\/\/(?:www\.)?lorenzetti\.com\.br\/images\/default-source\/[^"']+\.(?:png|jpg)/gi)]
    .map((m) => m[0])
    .filter((u) => !/logo|flagcdn/i.test(u));

  if (variant === 'cromado') {
    const cromado = imgs.find((u) => /cromad/i.test(u));
    if (cromado) return cromado.split('?')[0];
  }

  const og = html.match(/property="og:image" content="([^"]+)"/i);
  if (og?.[1] && !/logo/i.test(og[1])) return og[1].split('?')[0];

  return imgs[0]?.split('?')[0] || null;
}

function resolveJapi(ref, searchTerm) {
  const term = encodeURIComponent(searchTerm || JAPI_SEARCH_ALIASES[ref] || ref);
  const data = curlJson(`${JAPI_SEARCH}?ft=${term}`);
  if (!Array.isArray(data) || !data.length) return null;

  const wanted = normalizeRef(ref).toUpperCase();
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

function resolveLorenzetti(ref, slug, variant = 'cromado') {
  if (MANUAL_URLS[ref]) {
    return { url: MANUAL_URLS[ref], fonte: 'import', fonte_ref: `lorenzetti-manual:${ref}`, resolver: 'manual' };
  }

  const pageSlug = slug || LOREN_SLUGS[ref];
  if (!pageSlug) return null;

  const html = curl(`${LOREN_BASE}/produto/${pageSlug}`);
  const url = pickLorenzettiImage(html, variant);
  if (!url) return null;
  return { url, fonte: 'import', fonte_ref: `lorenzetti:${pageSlug}`, resolver: 'lorenzetti-site' };
}

function resolveTigre(ref) {
  const code = normalizeRef(ref);
  const slug = TIGRE_SLUGS[code];
  if (slug) {
    const html = curl(`https://www.tigre.com.br/produto/${slug}`);
    const match = html.match(new RegExp(`https://qfzo0q7soc[^"']+${code}[^"']+\\.jpg`, 'i'));
    if (match) {
      return { url: match[0], fonte: 'import', fonte_ref: `tigre:${code}`, resolver: 'tigre-site' };
    }
  }

  const guessed = `${TIGRE_MEDIA}/${code}_torneira_para_tanque_ou_maquina_de_lavar_tigre_cross_iso.jpg`;
  try {
    const head = execFileSync('curl', ['-sI', '-A', 'Mozilla/5.0', guessed], { encoding: 'utf8' });
    if (/^HTTP\/\S+ 200/.test(head)) {
      return { url: guessed, fonte: 'import', fonte_ref: `tigre:${code}`, resolver: 'tigre-media-guess' };
    }
  } catch { /* ignore */ }

  if (code === '300000461') {
    const url = `${TIGRE_MEDIA}/300000461_torneira_para_cozinha_mesa_bica_alta_m_vel_tigre_orbe_iso.jpg`;
    return { url, fonte: 'import', fonte_ref: `tigre:${code}`, resolver: 'tigre-media' };
  }

  return null;
}

/**
 * @param {{ codigo_interno: string, marca?: string|null, campo_hierarquico_4?: string|null, nome?: string }} produto
 */
export function resolveMixProdutoImagem(produto) {
  const ref = normalizeRef(produto.campo_hierarquico_4);
  const marca = String(produto.marca || '').toLowerCase();
  const codigo = produto.codigo_interno;

  if (ref && MANUAL_URLS[ref]) {
    return { url: MANUAL_URLS[ref], fonte: 'import', fonte_ref: `manual:${ref}`, resolver: 'manual' };
  }

  if (!ref || /^avulso$/i.test(ref)) {
    const term = AVULSO_SEARCH[codigo];
    if (term) {
      const hit = resolveJapi(codigo, term);
      if (hit) return hit;
    }
    return null;
  }

  if (/lorenzetti/i.test(marca) || ref === '7110015' || /^acqua /i.test(ref)) {
    const variant = /cromad/i.test(produto.nome || '') ? 'cromado' : 'default';
    const hit = resolveLorenzetti(ref, LOREN_SLUGS[ref], variant);
    if (hit) return hit;
  }

  if (/tigre/i.test(marca) || /^300000\d+$/.test(ref)) {
    const hit = resolveTigre(ref);
    if (hit) return hit;
  }

  if (/japi/i.test(marca) || /^[A-Z0-9]/i.test(ref)) {
    const hit = resolveJapi(ref);
    if (hit) return hit;
  }

  return null;
}
