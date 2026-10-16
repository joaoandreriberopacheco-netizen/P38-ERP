/**
 * Ficha pública Grupo Incopisos — /produto/{slug}/
 */
import { stripAccents } from './formigresCatalog.mjs';

export const INCOPISOS_BASE = 'https://grupoincopisos.com.br';

export function incopisosProdutoUrl(slug) {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return `${INCOPISOS_BASE}/produto/${s}/`;
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
  let modelo = String(modeloRaw || '');
  modelo = modelo.replace(/^9\s*x\s*75\s*/i, ' ');
  const blob = `${desc} ${modelo}`.toLowerCase();
  const slugs = new Set();
  const add = (s) => {
    if (s) slugs.add(s);
  };

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
  if (!titulo || titulo.length < 3) return null;

  const imagem_url = raw.match(/property="og:image"\s+content="([^"]+)"/i)?.[1]?.trim() || '';

  return {
    titulo,
    marca_site: marca_site || 'Incopisos',
    descricao_no_site: `${titulo} · ${marca_site || 'Incopisos'}`,
    imagem_url,
  };
}
