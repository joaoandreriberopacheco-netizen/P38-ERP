/**
 * Extrai ficha + imagens tipadas a partir da URL oficial (uma passagem, pós-match).
 */
import {
  extractImagensFromDetalhe,
  fetchProdutoDetalhe,
} from './formigresCatalog.mjs';
import {
  extractImagensFromProduto,
  normalizeProdutoFromHtml,
} from './carmeloFiorCatalog.mjs';
import { normalizeLocalUsoNbr, fabricanteKeyFromGrupo } from './pagleveLocalUsoNbr.mjs';

function metaOg(html, prop) {
  const re = new RegExp(`<meta property="${prop}" content="([^"]+)"`, 'i');
  return html.match(re)?.[1] || '';
}

function rochaSlugFromUrl(url) {
  const m = String(url).match(/portalgruporocha\.com\.br\/produtos\/([a-z0-9-]+)/i);
  return m?.[1]?.toLowerCase() || '';
}

function parseRochaLu(html) {
  const m =
    html.match(
      /Locais de Uso \(LU\):<\/span><span[^>]*>([A-Z]{2})\s*-\s*([^<]+)</i,
    ) || html.match(/Locais de Uso \(LU\):([A-Z]{2})\s*-\s*([^<"\n]+)/i);
  if (!m) return { codigo: '', texto: '' };
  return { codigo: m[1].trim(), texto: m[2].trim() };
}

function parseRochaTipologia(html) {
  const m = html.match(/Tipologia:<\/span><span[^>]*>([^<]+)</i) || html.match(/Tipologia:([^<\n]+)/i);
  return m ? m[1].trim() : '';
}

function extractRochaImgs(html, url) {
  const slug = rochaSlugFromUrl(url);
  const title = metaOg(html, 'og:title').replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim();
  const out = [];
  const seen = new Set();

  function push(url, tipo) {
    const u = url.split('?')[0];
    if (seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, tipo });
  }

  if (title) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const altRe = new RegExp(`alt="${esc} - Imagem (\\d+)"`, 'gi');
    if (altRe.test(html)) {
      const imgRe =
        /https:\/\/api\.portalgruporocha\.com\.br\/storage\/images\/([^"'\\\s]+)\.(webp|jpg|jpeg|png)/gi;
      const start = html.search(new RegExp(`alt="${esc} - Imagem`, 'i'));
      const section = html.slice(start, start + 120_000);
      let m;
      while ((m = imgRe.exec(section))) {
        push(m[0], /-f\d+-/.test(m[1]) ? 'principal' : 'principal');
      }
    }
  }

  if (!out.length && slug) {
    const slugParts = slug.split('-').filter((p) => p.length >= 3);
    const imgRe =
      /https:\/\/api\.portalgruporocha\.com\.br\/storage\/images\/([^"'\\\s]+)\.(webp|jpg|jpeg|png)/gi;
    let m;
    while ((m = imgRe.exec(html))) {
      const fname = m[1].toLowerCase();
      if (/\.svg$/i.test(fname)) continue;
      const hits =
        fname.includes(slug) ||
        slugParts.filter((p) => p.length >= 4).every((p) => fname.includes(p === 'beg' ? 'bege' : p));
      if (!hits) continue;
      const tipo = /-f\d+-/.test(fname) ? 'principal' : /amb|ambiente/i.test(fname) ? 'ambiente' : 'principal';
      if (slug.startsWith('loft') && !/loft/.test(fname)) continue;
      push(m[0], tipo);
    }
    const hero = out.find((i) => !/-f\d+-/.test(i.url) && /loft-bege/.test(i.url));
    if (hero) hero.tipo = 'ambiente';
  }

  const og = metaOg(html, 'og:image');
  if (!out.length && og) push(og, 'principal');
  return out;
}

function parseLumeIndicacao(html) {
  const m = html.match(/Indica[cç][aã]o de Uso:.*?<strong[^>]*>\s*([A-Z]{2})\s*<\/strong>/is);
  return m ? m[1].trim().toUpperCase() : '';
}

function extractLumeImgs(html) {
  const out = [];
  const seen = new Set();
  const re =
    /https:\/\/lumeceramica\.com\.br\/wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[0].split('?')[0];
    if (/logo|icon|favicon|tabela-indicacao/i.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push({ url: u, tipo: /ambiente|AMBIENTE/i.test(html.slice(m.index - 80, m.index + 80)) ? 'ambiente' : 'principal' });
  }
  const og = metaOg(html, 'og:image');
  if (!out.length && og) out.push({ url: og, tipo: 'principal' });
  return out;
}

function parseIncopisosLu(html) {
  const m =
    html.match(/Local de Uso:<\/b>\s*&nbsp;([A-Z]{2})/i) ||
    html.match(/Local de Uso:\s*([A-Z]{2})\b/i);
  return m ? m[1].toUpperCase() : '';
}

function parseIncopisosRef(html) {
  const m = html.match(/\bRU\s*(\d{5,6})\b/i);
  return m ? `RU ${m[1]}` : '';
}

function slugHintFromIncopisosUrl(url) {
  const slug = String(url).match(/\/produto\/([^/]+)/i)?.[1]?.toLowerCase() || '';
  return slug ? slug.replace(/-/g, ' ') : '';
}

function extractIncopisosImgs(html, url = '') {
  const out = [];
  const seen = new Set();
  const slugHint = slugHintFromIncopisosUrl(url);
  const re = /https:\/\/grupoincopisos\.com\.br\/wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[0].split('?')[0];
    if (/logo|icon|cookie/i.test(u)) continue;
    if (slugHint && !u.toLowerCase().includes(slugHint.replace(/\s+/g, '-'))) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push({ url: u, tipo: 'principal' });
  }
  const og = metaOg(html, 'og:image');
  if (!out.length && og) out.push({ url: og, tipo: 'principal' });
  return out;
}

function carmeloLocalUsoCodigo(prod) {
  for (const a of prod?.attributes || []) {
    const t = String(a.option_title || a.text || '').trim();
    if (/^L[A-Z]{1,2}$/i.test(t)) return t.toUpperCase();
    if (/local de uso/i.test(a.attribute_title || a.title || '')) {
      const opt = String(a.option_title || a.text || '').trim();
      const code = opt.match(/^(L[A-Z]{1,2})/i);
      if (code) return code[1].toUpperCase();
    }
  }
  return '';
}

function carmeloSuperficie(prod) {
  const a = (prod?.attributes || []).find((x) => Number(x.id_attribute) === 2);
  return a?.option_title || a?.text || prod?.acabamento_info || '';
}

/**
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} opts.fabricante_grupo
 * @param {string} [opts.siteKey]
 * @param {object} [opts.hit] match payload (formigres id, carmelo prod, etc.)
 * @param {string} [opts.html] optional pre-fetched HTML
 * @param {Map} [opts.carmeloBySlug]
 */
export async function extractFichaFromOfficialSite(opts) {
  const { url, fabricante_grupo, hit = {}, html: htmlIn, carmeloBySlug } = opts;
  const siteKey = opts.siteKey || fabricanteKeyFromGrupo(fabricante_grupo);
  const ficha = {
    acabamento: '',
    tipo_borda: '',
    textura: '',
    tipologia: '',
    local_uso_fonte: '',
    local_uso_fonte_texto: '',
    local_uso_nbr: '',
    formato_site: '',
    formigres_id: '',
    referencia_api: '',
  };
  let imagens = [];

  try {
    if (siteKey === 'formigres' || url.includes('formigres.com.br')) {
      const id = hit.formigres_id || url.match(/produto\/(\d+)/i)?.[1];
      ficha.formigres_id = id || '';
      let det = id ? await fetchProdutoDetalhe(id) : null;
      if (!det && hit.match_formigres) det = hit.match_formigres;
      if (det) {
        ficha.acabamento = det.acabamento || '';
        ficha.textura = det.acabamento_info || det.acabamento || '';
        ficha.tipo_borda = det.tipo || '';
        ficha.formato_site = det.formato || '';
        ficha.referencia_api = det.referencia || '';
        const lu = normalizeLocalUsoNbr('formigres', det.referencia);
        ficha.local_uso_fonte = lu.local_uso_fonte;
        ficha.local_uso_nbr = lu.local_uso_nbr;
        imagens = extractImagensFromDetalhe(det).map((i) => ({
          url: i.url,
          tipo: i.tipo || (i.principal ? 'principal' : 'detalhe'),
        }));
      }
      return {
        ficha,
        imagens,
        extracao: det ? 'formigres_api' : 'formigres_sem_detalhe',
        motivo: imagens.length ? '' : 'formigres_sem_imagens',
      };
    }

    const html = htmlIn || '';

    if (siteKey === 'rocha' || url.includes('portalgruporocha')) {
      const lu = parseRochaLu(html);
      ficha.tipologia = parseRochaTipologia(html);
      ficha.textura = ficha.tipologia;
      const norm = normalizeLocalUsoNbr('rocha', lu.codigo);
      ficha.local_uso_fonte = norm.local_uso_fonte;
      ficha.local_uso_nbr = norm.local_uso_nbr;
      ficha.local_uso_fonte_texto = lu.texto;
      imagens = extractRochaImgs(html, url);
      return { ficha, imagens, extracao: 'rocha_html' };
    }

    if (siteKey === 'carmelo' || url.includes('carmelofior')) {
      const slug = url.match(/produto\/([^/]+)/i)?.[1]?.toLowerCase();
      let prod = hit.carmelo_prod || (slug && carmeloBySlug?.get(slug));
      if (!prod && html) prod = normalizeProdutoFromHtml(html);
      if (prod) {
        ficha.tipo_borda = prod.tipo || '';
        ficha.textura = carmeloSuperficie(prod) || prod.acabamento || '';
        ficha.formato_site = prod.formato || '';
        const code = carmeloLocalUsoCodigo(prod);
        const lu = normalizeLocalUsoNbr('carmelo', code);
        ficha.local_uso_fonte = lu.local_uso_fonte;
        ficha.local_uso_nbr = lu.local_uso_nbr;
        imagens = extractImagensFromProduto(prod).map((i) => ({
          url: i.url,
          tipo: i.tipo || 'principal',
        }));
      }
      const extracao = prod?.images?.length && !hit.carmelo_prod && html ? 'carmelo_html' : 'carmelo_snapshot';
      return { ficha, imagens, extracao };
    }

    if (siteKey === 'lume' || url.includes('lumeceramica')) {
      const code = parseLumeIndicacao(html);
      const lu = normalizeLocalUsoNbr('lume', code);
      ficha.local_uso_fonte = lu.local_uso_fonte;
      ficha.local_uso_nbr = lu.local_uso_nbr;
      const sup = html.match(/Superfície:<\/strong>\s*([^<]+)/i);
      ficha.textura = sup ? sup[1].trim() : '';
      imagens = extractLumeImgs(html);
      return { ficha, imagens, extracao: 'lume_html' };
    }

    if (siteKey === 'incopisos' || url.includes('incopisos')) {
      const code = parseIncopisosLu(html);
      const lu = normalizeLocalUsoNbr('incopisos', code);
      ficha.local_uso_fonte = lu.local_uso_fonte;
      ficha.local_uso_nbr = lu.local_uso_nbr;
      ficha.referencia_api = parseIncopisosRef(html);
      const fmt = html.match(/Tamanho:<\/b>\s*&nbsp;([^<]+)/i) || html.match(/Tamanho:\s*([\d,.]+x[\d,.]+)/i);
      ficha.formato_site = fmt ? fmt[1].trim() : '';
      const ac = html.match(/Acabamento:<\/b>\s*&nbsp;([^<]+)/gi) || html.match(/Acabamento:\s*([^<\n]+)/gi) || [];
      ficha.acabamento = [...new Set(ac.map((x) => x.replace(/Acabamento:<\/?b>\s*&nbsp;|Acabamento:\s*/i, '').trim()))]
        .filter(Boolean)
        .join('; ');
      ficha.textura = ficha.acabamento;
      imagens = extractIncopisosImgs(html, url);
      return { ficha, imagens, extracao: 'incopisos_html' };
    }
  } catch (e) {
    return { ficha, imagens, extracao: 'erro', erro: e.message, motivo: e.message };
  }

  return { ficha, imagens, extracao: 'desconhecido' };
}