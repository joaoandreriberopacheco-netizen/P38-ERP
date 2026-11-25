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
  if (u.includes('gruporocha.com.br/_og/')) return true;
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
    tipo: tipoImagemCatalogoFromUrl(url, i),
  }));
}

/** Classifica URL da fábrica/portal para o lightbox do catálogo. */
export function tipoImagemCatalogoFromUrl(url = '', index = 0) {
  const u = String(url).toLowerCase();
  if (/ambiente|\/amb[-_]|imagem_amb|lifestyle|room|decor/.test(u)) return 'ambiente';
  if (/\/piso[-_]|imagem_piso|piso\./.test(u)) return 'piso';
  if (/face|faces|detalhe|detail|-f2-|-f3-|-f4-/.test(u)) return index === 0 ? 'principal' : 'detalhe';
  if (/-f1-|imgprincipal|principal|_f1\./.test(u)) return 'principal';
  if (index === 0) return 'principal';
  if (index === 1) return 'ambiente';
  return 'detalhe';
}
