/**
 * Ficha pública Grupo Incopisos — /produto/{slug}/
 */
import { stripAccents } from './formigresCatalog.mjs';

export const INCOPISOS_BASE = 'https://grupoincopisos.com.br';

export function incopisosProdutoUrl(slug) {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return `${INCOPISOS_BASE}/produto/${s}/`;
}

/** Código HD no ERP: (HD 160.101) → slug 160101 em /produto/160101/ (só tirar o ponto). */
export function hdCodigoSlugFromErp(descricao = '') {
  const m = String(descricao || '').match(/\(\s*HD\s+([0-9][0-9.]+)\s*\)/i)
    || String(descricao || '').match(/\bHD\s+([0-9][0-9.]+)/i);
  if (!m) return '';
  return m[1].replace(/\./g, '');
}

export function parseIncopisosOembedJson(jsonText, url) {
  try {
    const j = JSON.parse(String(jsonText || ''));
    if (j.code || !j.title) return null;
    const titulo = String(j.title).trim();
    if (!titulo) return null;
    const marca_site = titulo.includes(' - ') ? titulo.split(' - ').pop().trim() : 'Incopisos';
    const nome = titulo.includes(' - ') ? titulo.split(' - ')[0].trim() : titulo;
    return {
      titulo: nome,
      marca_site,
      descricao_no_site: `${nome} · ${marca_site}`,
      imagem_url: String(j.thumbnail_url || '').trim(),
    };
  } catch {
    return null;
  }
}

export function incopisosSlugFromText(text = '') {
  return stripAccents(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

/** Slugs conhecidos 39×75 (revestimento Marmocerâmica / Vivence no portal do grupo). */
export function incopisosSlugCandidates(row, modeloRaw = '') {
  const desc = String(row.descricao_erp || row.descricao || '');
  const fmt = String(row.formato || '').toLowerCase();
  let modelo = String(modeloRaw || '');
  modelo = modelo.replace(/^9\s*x\s*75\s*/i, ' ');
  const blob = `${desc} ${modelo}`.toLowerCase();
  const slugs = new Set();
  const add = (s) => {
    if (s) slugs.add(s);
  };

  const hd = hdCodigoSlugFromErp(desc);
  if (hd) add(hd);
  if (fmt === '32x58' && hd) return [hd];

  if (/ladrillo\s*red/.test(blob)) add('ladrillo-red');
  if (/minerale\s*beige/.test(blob)) add('minerale-beige');
  if (/square\s*mont\s*blanc/.test(blob)) add('square-mont-blanc');
  if (/studio\s*cotto/.test(blob)) add('studio-cotto');

  const cleaned = stripAccents(modelo)
    .toLowerCase()
    .replace(/\b(mru|vru|mac|mre|hd|rev|pei|la|lb|lc|ld|le|jun|ju|esm|bold|rt|a|r)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 3) add(words.slice(0, 3).join('-'));
  if (words.length >= 2) add(words.slice(0, 2).join('-'));
  if (words.length >= 1) add(words.join('-'));

  return [...slugs].filter(Boolean);
}

export function parseIncopisosProdutoHtml(html) {
  const raw = String(html || '');
  if (raw.length < 800) return null;

  const ogDesc =
    raw.match(/property="og:description"\s+content="([^"]+)"/i)?.[1]?.trim() ||
    raw.match(/content="([^"]+)"\s+property="og:description"/i)?.[1]?.trim() ||
    '';
  if (!ogDesc || /^home$/i.test(ogDesc)) return null;

  const dash = ogDesc.indexOf(' - ');
  const titulo = (dash > 0 ? ogDesc.slice(0, dash) : ogDesc).trim();
  const marca_site = (dash > 0 ? ogDesc.slice(dash + 3) : 'Incopisos').trim();
  if (!titulo || titulo.length < 1) return null;
  if (/^home$/i.test(titulo)) return null;

  const imagem_url = raw.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]?.trim() || '';

  return {
    titulo,
    marca_site: marca_site || 'Incopisos',
    descricao_no_site: `${titulo} · ${marca_site || 'Incopisos'}`,
    imagem_url,
  };
}
