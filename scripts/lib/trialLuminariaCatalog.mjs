/**
 * Catálogo Trial Elétricos (WooCommerce) — lâmpadas, luminárias e spots LED.
 * @see https://trialeletricos.com.br/wp-json/wc/store/products
 */

const TRIAL_API = 'https://trialeletricos.com.br/wp-json/wc/store/products';

const BULBO_A55 = 'lampada-bulbo-a55';
const CILINDRICA_T150 = 'lampada-cilindrica-t150';

/** SKU P38 → slug Trial (produto exato ou fallback documentado). */
export const TRIAL_LUMINARIA_SLUG_BY_SKU = {
  // Embutir — 06W usa foto 12W (Trial não lista 06W)
  'TA0-0YC': { slug: 'luminaria-led-embutir-12w-2', fallback: '12W quad embutir para 06W' },
  'VJG-A15': { slug: 'luminaria-led-embutir-12w-2' },
  '7LC-G3M': { slug: 'luminaria-led-embutir-18w' },
  '05G-YBN': { slug: 'luminaria-led-embutir-24w' },
  'T74-OVN': { slug: 'luminaria-led-embutir-12w', fallback: '12W red embutir para 06W' },
  'H5V-MQZ': { slug: 'luminaria-led-embutir-12w' },
  'Q8U-N66': { slug: 'luminaria-led-embutir-18w-2' },
  '44R-E44': { slug: 'luminaria-led-sobrepor-24w-redonda', fallback: 'Trial sem embutir 24W red' },

  // Sobrepor
  '53E-5PA': { slug: 'luminaria-led-sobrepor-12w-quadrada' },
  'YVS-BW9': { slug: 'luminaria-led-sobrepor-18w-quadrada' },
  'J8G-MSA': { slug: 'luminaria-led-sobrepor-24w-quadrada' },
  'F1S-6ZD': { slug: 'luminaria-led-sobrepor-12w-redonda' },
  'XFX-A5F': { slug: 'luminaria-led-sobrepor-12w-redonda-2' },
  'Q82-4MJ': { slug: 'luminaria-led-sobrepor-24w-redonda' },

  // Spots 03W
  'Z28-TGZ': { slug: '2484' },
  'D7Q-QQ2': { slug: 'spot-led-auxiliar-quadrado-luz-amarela' },

  // Spots 06W — Trial só lista 03W; foto do mesmo modelo
  'MNG-PX8': { slug: '2484', fallback: 'spot 03W quad branco para 06W' },
  'W70-3U1': { slug: 'spot-led-auxiliar-redondo-luz-amarela', fallback: 'spot 03W red 3000K para 06W' },

  // Bulbos A55 — Trial documenta 4,9W; mesma embalagem para todas as potências
  'R5D-PII': { slug: BULBO_A55 },
  'UZS-0GB': { slug: BULBO_A55, fallback: 'bulbo Trial 4,9W para 09W' },
  '43F-7ES': { slug: BULBO_A55, fallback: 'bulbo Trial 4,9W para 09W' },
  'H2H-D50': { slug: BULBO_A55, fallback: 'bulbo Trial 4,9W para 12W' },
  'D1N-BU0': { slug: BULBO_A55, fallback: 'bulbo Trial 4,9W para 15W' },
  'LJD-7QS': { slug: BULBO_A55, fallback: 'bulbo Trial 4,9W para 20W' },
  'W4Q-Y6I': { slug: BULBO_A55, fallback: 'bulbo Trial 4,9W para 40W' },

  // Cilíndricas — Trial lista T150 100W; mesma linha visual
  'T3D-4AN': { slug: CILINDRICA_T150, fallback: 'cilíndrica Trial 100W para 40W' },
  'PY4-X5U': { slug: CILINDRICA_T150, fallback: 'cilíndrica Trial 100W para 60W' },

  // T8 tubular — Trial não lista T8 na API; forma tubular da cilíndrica
  'Y9J-MZA': { slug: CILINDRICA_T150, fallback: 'cilíndrica Trial como referência tubular 09W' },
  'FAN-10A': { slug: CILINDRICA_T150, fallback: 'cilíndrica Trial como referência tubular 18W' },

  // Tartaruga — Trial não lista; luminária sobrepor redonda 12W equivalente
  '7X7-W6L': { slug: 'luminaria-led-sobrepor-12w-redonda', fallback: 'sobrepor red 12W para tartaruga 12W' },
};

export const TRIAL_LUMINARIA_SKUS = Object.keys(TRIAL_LUMINARIA_SLUG_BY_SKU);

function stripHtml(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchTrialCatalog() {
  const products = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetch(`${TRIAL_API}?per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`Trial API → ${res.status}`);
    const batch = await res.json();
    if (!batch.length) break;
    products.push(...batch);
  }

  const bySlug = new Map();
  for (const p of products) {
    const slug = String(p.permalink || '')
      .replace('https://trialeletricos.com.br/produtos/', '')
      .replace(/\/$/, '');
    bySlug.set(slug, {
      id: p.id,
      slug,
      name: stripHtml(p.name),
      url: p.images?.[0]?.src || null,
      permalink: p.permalink,
      description: stripHtml(p.short_description),
    });
  }
  return bySlug;
}

/**
 * @param {string} codigoInterno
 * @param {Map<string, object>} catalog
 */
export function resolveTrialLuminariaImagem(codigoInterno, catalog) {
  const key = String(codigoInterno || '').toUpperCase();
  const ref = TRIAL_LUMINARIA_SLUG_BY_SKU[key];
  if (!ref?.slug) return null;

  const hit = catalog.get(ref.slug);
  if (!hit?.url) return null;

  return {
    url: hit.url,
    fonte: 'import',
    fonte_ref: `trial:${ref.slug}`,
    label: hit.name,
    trial_slug: ref.slug,
    trial_permalink: hit.permalink,
    fallback: ref.fallback || null,
  };
}
