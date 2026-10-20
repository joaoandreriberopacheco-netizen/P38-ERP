/**
 * Validação leve de URLs de imagem (HEAD) para catálogo.
 */
import { execSync } from 'node:child_process';

const UA = 'P38-catalogo-imagem/1.0';

export function isPlaceholderImageUrl(url = '') {
  const u = String(url).toLowerCase();
  if (!u) return true;
  if (/\/sample\.webp$/i.test(u)) return true;
  if (u.includes('placeholder') || u.includes('no-image')) return true;
  return false;
}

export function probeImageUrlOk(url, timeoutSec = 12) {
  if (!url || isPlaceholderImageUrl(url)) return false;
  try {
    const tls = String(url).includes('lumeceramica.com.br') ? '-k ' : '';
    const out = execSync(
      `curl ${tls}-sL -o /dev/null -w "%{http_code}" --max-time ${timeoutSec} -A ${JSON.stringify(UA)} ${JSON.stringify(url)}`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 },
    ).trim();
    const code = Number(out);
    return code >= 200 && code < 400;
  } catch {
    return false;
  }
}

export async function filterReachableImageUrls(urls = [], { probe = probeImageUrlOk } = {}) {
  const out = [];
  for (const url of urls) {
    if (await probe(url)) out.push(url);
  }
  return out;
}

export function mapUrlsToImagensCatalogo(urls = []) {
  return urls.map((url, i) => ({
    url,
    tipo: i === 0 ? 'principal' : i === 1 ? 'ambiente' : 'detalhe',
  }));
}
