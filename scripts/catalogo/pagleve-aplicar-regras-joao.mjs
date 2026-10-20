#!/usr/bin/env node
/**
 * Aplica regras de formato/fabricante (João André) + busca URL oficial quando possível.
 * node scripts/catalogo/pagleve-aplicar-regras-joao.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  buildSnapshot as buildFormigresSnapshot,
  fetchAllProdutos as fetchFormigresProdutos,
  findInSnapshot as findInFormigresSnapshot,
} from '../lib/formigresSnapshot.mjs';
import { stripAccents } from '../lib/formigresCatalog.mjs';
import { raioXProdutoDescricao } from '../lib/raioXProdutoDescricao.mjs';
import {
  acabamentoFromErpDesc,
  carmeloSlugCandidates,
  cecafiCarmeloSlugCandidates,
  parseCarmeloProdutoHtml,
} from '../lib/carmeloPaginaProduto.mjs';
import { extrairClassificacaoPei } from '../lib/paglevePeiResistencia.mjs';
import {
  imagensJsonFromLumeFicha,
  lumePortfolioSlugFromRow,
  lumePortfolioUrl,
  parseLumePortfolioHtml,
} from '../lib/lumePaginaProduto.mjs';
import { resolveFormatoPagLeve } from '../lib/pagleveFormatoOcr.mjs';
import {
  hdCodigoSlugCandidatesFromErp,
  incopisosProdutoUrl,
  incopisosSlugCandidates,
  parseIncopisosOembedJson,
  parseIncopisosProdutoHtml,
} from '../lib/incopisosPaginaProduto.mjs';
import {
  ROCHA_PORTAL_BASE,
  isRochaProductHtmlValid,
  parseRochaCMapFromProdutosHtml,
  rochaProductUrl,
  rochaSlugFromSiahDesc,
  rochaTitleFromHtml,
  rochaCatalogFallbackHit,
} from '../lib/rochaPortalPagina.mjs';

export { rochaSlugFromSiahDesc };

const ROOT = process.cwd();
const CSV = process.env.PAGLEVE_OUT || path.join(ROOT, 'files', 'pagleve', 'raio-x-pagleve-site-verificado.csv');
const ROCHA = ROCHA_PORTAL_BASE;
const LUME = 'https://lumeceramica.com.br';
const CF = 'https://www.carmelofior.com.br';
const UA = 'P38-PagLeve-regras/1.0';

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseLine(line);
    const o = {};
    headers.forEach((h, i) => {
      o[h] = cols[i] ?? '';
    });
    return o;
  });
}

function parseLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(path, rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  fs.writeFileSync(path, lines.join('\n') + '\n');
}

function curl(url) {
  const k = url.includes('lumeceramica') ? '-k ' : '';
  try {
    return execSync(`curl ${k}-sL --max-time 20 -A ${JSON.stringify(UA)} ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      maxBuffer: 6 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

let rochaCMapCache = null;

function loadRochaCMap() {
  if (rochaCMapCache) return rochaCMapCache;
  const html = curl(`${ROCHA}/produtos`);
  rochaCMapCache = parseRochaCMapFromProdutosHtml(html);
  return rochaCMapCache;
}

function tryRochaSlug(slug, cOverride) {
  if (!slug) return null;
  const cMap = loadRochaCMap();
  const url = rochaProductUrl(slug, cMap, cOverride);
  const html = curl(url);
  if (isRochaProductHtmlValid(html)) {
    const title = rochaTitleFromHtml(html);
    return {
      fabricante_grupo: 'Grupo Rocha',
      marca_no_site: 'Rochaforte / Rochamaxx (portal)',
      descricao_no_site: title,
      evidencia_url: url,
      status: 'confirmado_site',
      match_metodo: `rocha_portal:${slug}`,
    };
  }
  return rochaCatalogFallbackHit(slug, cMap);
}

function tryLumePortfolioForRow(row) {
  const slug = lumePortfolioSlugFromRow(row);
  if (!slug) return null;
  const url = lumePortfolioUrl(slug);
  const html = curl(url);
  const ficha = parseLumePortfolioHtml(html, url);
  if (!ficha) return null;
  return {
    fabricante_grupo: 'Lume Cerâmica',
    marca_no_site: 'Lume',
    evidencia_url: url,
    descricao_no_site: ficha.descricao_no_site,
    imagem_url: ficha.imagem_url || '',
    imagens_json: imagensJsonFromLumeFicha(ficha),
    status: 'confirmado_site',
    match_metodo: `lume_portfolio:${slug}`,
  };
}

function lumePortfolioSearch(q) {
  const html = curl(`${LUME}/?s=${encodeURIComponent(q)}`);
  const m = html.match(/href="(https:\/\/lumeceramica\.com\.br\/portfolio-item\/[^"]+)"/i);
  if (!m) return null;
  const ficha = parseLumePortfolioHtml(curl(m[1]), m[1]);
  if (ficha) {
    return {
      fabricante_grupo: 'Lume Cerâmica',
      marca_no_site: 'Lume',
      evidencia_url: m[1],
      descricao_no_site: ficha.descricao_no_site,
      imagem_url: ficha.imagem_url || '',
      imagens_json: imagensJsonFromLumeFicha(ficha),
      status: 'confirmado_site',
      match_metodo: `lume_busca:${q}`,
    };
  }
  return {
    fabricante_grupo: 'Lume Cerâmica',
    marca_no_site: 'Lume',
    evidencia_url: m[1],
    descricao_no_site: q,
    status: 'confirmado_site',
    match_metodo: `lume_busca:${q}`,
  };
}

function carmeloSlugFromName(name) {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

const CF_SLUG_BY_CODE = {
  'INDF-117': 'alaska-plus-32-75',
  'INDF-119': 'alvor',
  'INDF-035': 'solaria-plus-rt-90x90',
  'INDF-137': 'dream-plus-rt-90x90',
  'INDF-157': 'cronos-plus-mre-rt-90x90',
  'INDF-118': 'selena-cinza',
  'INDF-004': 'bellavista-po-rt',
  'INDF-011': 'georgia-po-rt',
  'INDF-033': 'venezia-po-rt',
  'INDF-036': 'pissis-plus-mre-rt',
  'INDF-136': 'elemento-cinza-plus-rt-90x90',
};

const INCOPISOS_SLUG_BY_CODE = {
  31929: 'ladrillo-red',
  31930: 'minerale-beige',
  'INDF-078': 'square-mont-blanc',
  'INDF-102': 'studio-cotto',
  'INDF-079': 'hd-160101',
  'INDF-047': 'puglia-grigio-2',
  'INDF-046': 'hd-90070',
  'INDF-048': 'hd-170048',
  'INDF-103': 'esmal',
  'INDF-110': 'cimento',
};

/** Slug no portalgruporocha.com.br (índice /produtos traz ?c= quando necessário). */
const ROCHA_SLUG_BY_CODE = {
  'INDF-023': 'pr70100',
  'INDF-040': 'marmo-douro',
  'INDF-129': 'bianco-supreme',
  'INDF-149': 'oro-realle',
  35039: 'fenix',
  35447: 'breccia-lux',
  35486: 'loft-bege-ext',
  35509: 'r4076',
};

/** Ficha oficial fora dos conectores habituais — só códigos validados manualmente (busca agressiva). */
const MANUAL_SITE_BY_CODE = {
  'INDF-077': {
    fabricante_grupo: 'Delta Cerâmica',
    marca_no_site: 'Delta Porcelanato Intense',
    descricao_no_site: 'SALINAS-84 IN · 84×84 · acetinado',
    evidencia_url: 'https://deltaceramica.com.br/produto-in.php?id=460',
    status: 'confirmado_site',
    match_metodo: 'manual_agressivo:delta_salinas_84',
  },
};

function acabamentoLabelFromSuperficie(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (/^mre$/i.test(t) || /escorregamento/i.test(t)) return 'MRE';
  if (/^brilhante$/i.test(t)) return 'Brilhante';
  if (/^mate$/i.test(t)) return 'Mate';
  if (/^acetinado$/i.test(t)) return 'Acetinado';
  if (/^polido$/i.test(t)) return 'Polido';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function tryCarmeloSlug(slug) {
  const url = `${CF}/produto/${slug}`;
  const html = curl(url);
  if (!html || html.length < 800) return null;
  const ficha = parseCarmeloProdutoHtml(html);
  if (!ficha) return null;
  const acab = acabamentoLabelFromSuperficie(ficha.superficie);
  const marca = ficha.marca_site || 'Carmelo Fior';
  const gallery = ficha.imagens_urls?.length ? ficha.imagens_urls : (ficha.imagem_url ? [ficha.imagem_url] : []);
  const imagem_url = gallery[0] || '';
  return {
    fabricante_grupo: 'Carmelo Fior',
    marca_no_site: marca,
    evidencia_url: url,
    descricao_no_site: ficha.descricao_no_site,
    imagem_url,
    imagens_json: gallery.length ? JSON.stringify(gallery) : '',
    site_superficie: ficha.superficie || '',
    site_linha: ficha.linha_site || '',
    site_classificacao_pei: ficha.classificacao_uso || '',
    site_acabamento_label: acab,
    status: 'confirmado_site',
    match_metodo: `carmelo_slug:${slug}`,
  };
}

function enrichCarmeloHitFromErp(row, hit) {
  const pei = extrairClassificacaoPei(row.descricao_erp);
  const erpAcab = acabamentoFromErpDesc(row.descricao_erp);
  if (erpAcab) hit.site_acabamento_label = erpAcab;
  const titulo = String(hit.descricao_no_site || '').split(' · ')[0] || hit.descricao_no_site;
  const fmt = String(row.formato || '').replace(/x/i, '×');
  const parts = [titulo];
  if (fmt) parts.push(`${fmt} cm`);
  if (hit.site_linha) parts.push(hit.site_linha);
  if (hit.site_acabamento_label) parts.push(hit.site_acabamento_label);
  if (pei) {
    hit.site_classificacao_pei = pei;
    parts.push(pei);
  }
  hit.descricao_no_site = parts.join(' · ');
  return hit;
}

/** No ERP muitas linhas Etna/Cecafi; no site a marca vem da ficha Carmelo (Cecafi, Fiorano, Idealle…). */
function isCecafiRow(row) {
  const blob = `${row.fabricante_grupo || ''} ${row.marca_no_site || ''} ${row.descricao_erp || ''}`;
  if (/cecafi|etna/i.test(blob)) return true;
  return String(row.match_metodo || '').startsWith('carmelo_grupo:');
}

/** Fichas no portal Carmelo (slug fixo) mesmo quando o ERP só diz “Carmelo Fior” (ex. Selena → selena-cinza). */
function isCarmeloGrupoCatalogRow(row) {
  if (isCecafiRow(row)) return true;
  if (!/carmelo/i.test(String(row.fabricante_grupo || row.marca_no_site || ''))) return false;
  const blob = stripAccents(`${row.descricao_erp || ''} ${row.modelo || ''} ${modeloNome(row)}`).toLowerCase();
  return /selena|noble|branco neve|clean|alvor|selah|vino|melinda|theo|bolt|dritto|minerati/.test(blob);
}

function applyCarmeloGrupoLoop(rows) {
  for (const r of rows.filter(
    (x) =>
      isCarmeloGrupoCatalogRow(x) &&
      (x.formato === '57x57' || x.formato === '38x75' || x.formato === '32x57') &&
      x.status !== 'confirmado_site',
  )) {
    let hit = tryCarmeloCecafiRow(r) || tryCarmeloForRow(r);
    if (hit) {
      const slug = (hit.match_metodo || '').split(':').pop() || '';
      if (hit.evidencia_url?.includes('carmelofior.com.br') && !String(hit.match_metodo).startsWith('carmelo_grupo:')) {
        hit = applyCarmeloGrupoHit(r, hit, slug);
      }
      applyHit(r, hit, 'Grupo Carmelo Fior — marca na ficha do site');
    } else {
      indicacao(r, 'Carmelo Fior', 'Cecafi', r.formato, 'buscar slug em carmelofior.com.br/produto/…');
    }
  }
}

function applyCarmeloGrupoHit(row, hit, slug) {
  const out = enrichCarmeloHitFromErp(row, hit);
  out.fabricante_grupo = 'Carmelo Fior';
  if (!out.marca_no_site || out.marca_no_site === 'Carmelo Fior') {
    out.marca_no_site = hit.marca_no_site || 'Cecafi';
  }
  out.match_metodo = `carmelo_grupo:${slug}`;
  return out;
}

function tryCarmeloCecafiRow(row) {
  const modelo = modeloNome(row) || row.modelo || '';
  const slugs = cecafiCarmeloSlugCandidates(row, modelo);
  for (const slug of slugs) {
    const hit = tryCarmeloSlug(slug);
    if (!hit) continue;
    return applyCarmeloGrupoHit(row, hit, slug);
  }
  return null;
}

function tryIncopisosSlug(slug) {
  const url = incopisosProdutoUrl(slug);
  const html = curl(url);
  let ficha = parseIncopisosProdutoHtml(html);
  if (!ficha && (/^\d+$/.test(String(slug)) || /^hd-\d+$/i.test(String(slug)))) {
    const oembedUrl = `https://grupoincopisos.com.br/wp-json/oembed/1.0/embed?url=${encodeURIComponent(url)}`;
    const oembed = curl(oembedUrl);
    ficha = parseIncopisosOembedJson(oembed, url);
  }
  if (!ficha) return null;
  return {
    fabricante_grupo: 'Grupo Incopisos',
    marca_no_site: ficha.marca_site,
    evidencia_url: url,
    descricao_no_site: ficha.descricao_no_site,
    imagem_url: ficha.imagem_url || '',
    status: 'confirmado_site',
    match_metodo: `incopisos_slug:${slug}`,
  };
}

function isIncopisosErpRow(row) {
  const blob = `${row.fabricante_grupo || ''} ${row.marca_no_site || ''}`;
  return /incopisos/i.test(blob) || String(row.match_metodo || '').startsWith('incopisos_slug:');
}

function tryIncopisosForRow(row) {
  const fixed = INCOPISOS_SLUG_BY_CODE[row.codigo];
  if (fixed) {
    const hit = tryIncopisosSlug(fixed);
    if (hit) return hit;
  }
  const modelo = modeloNome(row) || row.modelo || '';
  for (const slug of incopisosSlugCandidates(row, modelo)) {
    const hit = tryIncopisosSlug(slug);
    if (hit) return hit;
  }
  return null;
}

function tryCarmeloForRow(row) {
  const fixed = CF_SLUG_BY_CODE[row.codigo];
  if (fixed) {
    const hit = tryCarmeloSlug(fixed);
    if (hit) return enrichCarmeloHitFromErp(row, hit);
  }
  const modelo = modeloNome(row);
  for (const slug of carmeloSlugCandidates(row, modelo)) {
    const hit = tryCarmeloSlug(slug);
    if (hit) return enrichCarmeloHitFromErp(row, hit);
  }
  return null;
}

function modeloNome(row) {
  const rx = raioXProdutoDescricao(row.codigo, row.descricao_erp);
  return rx.modelo || '';
}

function applyHit(row, hit, obs = '') {
  Object.assign(row, hit);
  row.observacao = obs || 'regra João André + URL site';
}

function indicacao(row, grupo, marca, fmt, obs = '') {
  row.formato = fmt;
  row.fabricante_grupo = grupo;
  row.marca_no_site = marca;
  row.status = 'indicacao_joao';
  row.match_metodo = 'regra_joao';
  row.observacao = `regra João André; ${obs || 'pendente URL'}`;
}

async function main() {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const byCode = new Map(rows.map((r) => [r.codigo, r]));
  const fg = buildFormigresSnapshot(await fetchFormigresProdutos());

  for (const r of rows) {
    const resolved = resolveFormatoPagLeve(r.descricao_erp || r.modelo || '', r.formato);
    if (resolved) r.formato = resolved;
  }

  for (const [codigo, hit] of Object.entries(MANUAL_SITE_BY_CODE)) {
    const r = byCode.get(codigo);
    if (!r || r.status === 'confirmado_site') continue;
    applyHit(r, { ...hit }, 'busca agressiva — ficha oficial validada');
  }

  for (const [codigo, slug] of Object.entries(ROCHA_SLUG_BY_CODE)) {
    const r = byCode.get(codigo);
    if (!r || r.status === 'confirmado_site') continue;
    const hit = tryRochaSlug(slug);
    if (hit) {
      if (/rochamaxx|loft|fenix|breccia|bianco|oro|marmo/i.test(r.descricao_erp || '')) {
        hit.marca_no_site = 'Rochamaxx';
      }
      applyHit(r, hit, `portal Rocha slug ${slug}`);
    }
  }

  // 70x70 — Rocha por código portal
  for (const r of rows.filter((x) => x.formato === '70x70' && x.status !== 'confirmado_site')) {
    const slug = rochaSlugFromSiahDesc(r.descricao_erp);
    const hit = tryRochaSlug(slug);
    if (hit) applyHit(r, hit, `portal slug ${slug} (SIAH→site)`);
    else indicacao(r, 'Grupo Rocha', 'Rochaforte / Rochaprime (portal)', '70x70', `slug tentado: ${slug}`);
  }

  // 82x82 — Rocha (loft)
  const rocha82 = {
    '35486': 'loft-bege-ext',
    '35487': 'loft-cinza-ext',
  };
  for (const r of rows.filter((x) => x.formato === '82x82')) {
    if (r.status === 'confirmado_site') continue;
    const n = stripAccents(`${r.descricao_erp || ''} ${modeloNome(r)}`).toLowerCase();
    const slug =
      rocha82[r.codigo] ||
      (n.includes('loft bege') ? 'loft-bege-ext' : '') ||
      (n.includes('loft cinza') ? 'loft-cinza-ext' : '') ||
      (n.includes('bianco supreme') ? 'bianco-supreme' : '') ||
      (n.includes('oro realle') ? 'oro-realle' : '') ||
      (n.includes('marmo duro') || n.includes('marmo douro') ? 'marmo-douro' : '');
    const hit = slug ? tryRochaSlug(slug) : null;
    if (hit) {
      hit.marca_no_site = 'Rochamaxx';
      applyHit(r, hit);
    } else indicacao(r, 'Grupo Rocha', 'Rochamaxx', '82x82');
  }

  // 61x116 — Rocha
  for (const r of rows.filter((x) => x.formato === '61x116' && x.status !== 'confirmado_site')) {
    const n = stripAccents(r.descricao_erp).toLowerCase();
    const slug = n.includes('fenix') ? 'fenix' : n.includes('breccia') ? 'breccia-lux' : '';
    const hit = slug ? tryRochaSlug(slug) : null;
    if (hit) {
      hit.marca_no_site = 'Rochamaxx';
      applyHit(r, hit);
    } else indicacao(r, 'Grupo Rocha', 'Rochamaxx', '61x116');
  }

  // 60x60 Graffiato — ficha legada marca.php (id 50)
  const graffiatoUrl = 'https://www.formigres.com.br/marca.php?marca=formigres&produto=50';
  for (const r of rows.filter((x) => x.codigo === 'INDF-054' || /graffiato/i.test(x.descricao_erp || ''))) {
    applyHit(r, {
      fabricante_grupo: 'Grupo Formigres',
      marca_no_site: 'Formigres',
      descricao_no_site: 'GRAFFIATO BG EXT 60x60',
      evidencia_url: graffiatoUrl,
      status: 'confirmado_site',
      match_metodo: 'formigres:marca.php:50',
    }, 'Graffiato 60x60 — URL João André');
  }

  // 74x74 — Carmelo (ex. alaska)
  const cf74 = {
    'INDF-001': 'gales-po-rt',
    'INDF-010': 'alaska-po-rt',
    34860: 'alaska-po-rt',
    'INDF-004': 'bellavista-po-rt',
    'INDF-011': 'georgia-po-rt',
    'INDF-033': 'venezia-po-rt',
  };
  for (const r of rows.filter((x) => x.formato === '74x74' && x.status !== 'confirmado_site')) {
    const n = stripAccents(r.descricao_erp).toLowerCase();
    let slug = cf74[r.codigo] || '';
    if (!slug && n.includes('alaska')) slug = 'alaska-po-rt';
    if (!slug && n.includes('gales')) slug = 'gales-po-rt';
    if (!slug && n.includes('sicilia')) slug = 'sicilia-po-rt';
    if (!slug && n.includes('breda')) slug = 'breda-po-rt';
    if (!slug && n.includes('bellavista')) slug = 'bellavista-po-rt';
    if (!slug && n.includes('georgia')) slug = 'georgia-po-rt';
    if (!slug && n.includes('venezia')) slug = 'venezia-po-rt';
    const hit = slug ? tryCarmeloSlug(slug) : null;
    if (hit) applyHit(r, hit);
    else indicacao(r, 'Carmelo Fior', 'Carmelo Fior', '74x74');
  }

  // 32×57 / 38×75 / 57×57 — slugs grupo (noble-57x57, selena-cinza…) antes do genérico 32×57
  applyCarmeloGrupoLoop(rows);

  // 32x57 — Carmelo Fior (ex. Alaska Plus → alaska-plus-32-75)
  for (const r of rows.filter((x) => x.formato === '32x57' && x.status !== 'confirmado_site')) {
    const hit = tryCarmeloForRow(r);
    if (hit) applyHit(r, hit, 'Carmelo 32×57 — ficha oficial');
    else indicacao(r, 'Carmelo Fior', 'Carmelo Fior', '32x57');
  }

  // 90x90 — Carmelo
  for (const r of rows.filter((x) => x.formato === '90x90' && x.status !== 'confirmado_site')) {
    const n = stripAccents(r.descricao_erp).toLowerCase();
    let slug = '';
    if (n.includes('narbona')) slug = 'narbona-plus-rt-90x90';
    else if (n.includes('albury')) slug = 'albury-plus-rt-90x90';
    else if (n.includes('sidney')) slug = 'sidney-plus-rt-90x90';
    else if (n.includes('vinci')) slug = 'vinci-plus-rt-90x90';
    else if (n.includes('amon')) slug = 'amon-plus-rt-90x90';
    else if (n.includes('pissis')) slug = 'pissis-plus-mre-rt';
    else if (n.includes('elemento') && n.includes('cinza')) slug = 'elemento-cinza-plus-rt-90x90';
    const hit = slug ? tryCarmeloSlug(slug) : null;
    if (hit) applyHit(r, hit);
    else indicacao(r, 'Carmelo Fior', 'Carmelo Fior', '90x90');
  }

  // Slugs Incopisos por código (ex. Puglia 90×90 no grupoincopisos, não Carmelo)
  for (const r of rows.filter((x) => INCOPISOS_SLUG_BY_CODE[x.codigo] && x.status !== 'confirmado_site')) {
    const hit = tryIncopisosForRow(r);
    if (hit) applyHit(r, hit, 'Grupo Incopisos — slug indicado');
  }

  // 75x75 — Lume
  const lume75 = {
    'INDF-031': 'monterrey-grigio-75x75',
    35507: 'monterrey-grigio-75x75',
  };
  for (const r of rows.filter((x) => x.formato === '75x75' && x.status !== 'confirmado_site')) {
    const n = stripAccents(r.descricao_erp).toLowerCase();
    let hit = tryLumePortfolioForRow(r);
    if (!hit && lume75[r.codigo]) {
      const slug = lume75[r.codigo];
      const url = lumePortfolioUrl(slug);
      const ficha = parseLumePortfolioHtml(curl(url), url);
      if (ficha) {
        hit = {
          fabricante_grupo: 'Lume Cerâmica',
          marca_no_site: 'Lume',
          evidencia_url: url,
          descricao_no_site: ficha.descricao_no_site,
          imagem_url: ficha.imagem_url || '',
          imagens_json: imagensJsonFromLumeFicha(ficha),
          status: 'confirmado_site',
          match_metodo: `lume_portfolio:${slug}`,
        };
      }
    }
    const q = n.includes('monterrey')
      ? 'monterrey grigio'
      : n.includes('asphalt')
        ? 'asphalt'
        : n.includes('petra')
          ? 'petra nat'
          : n.includes('portor')
            ? 'nero portorio'
            : n.includes('avorio')
              ? 'avorio cinza'
              : '';
    if (!hit && q) hit = lumePortfolioSearch(q);
    if (hit) applyHit(r, hit, 'Lume — ficha lumeceramica.com.br');
    else indicacao(r, 'Lume Cerâmica', 'Lume', '75x75');
  }

  // 62x119 — Lume
  for (const r of rows.filter((x) => x.formato === '62x119' && x.status !== 'confirmado_site')) {
    const n = stripAccents(r.descricao_erp).toLowerCase();
    const terms = ['arcadia', 'taurus', 'limestone', 'patagonia', 'capadocia', 'capadócia'];
    const term = terms.find((t) => n.includes(t)) || '';
    const hit = term ? lumePortfolioSearch(`62x119 ${term}`) || lumePortfolioSearch(term) : null;
    if (hit) applyHit(r, hit);
    else indicacao(r, 'Lume Cerâmica', 'Lume', '62x119');
  }

  // 45x89 — Lume
  for (const r of rows.filter((x) => x.formato === '45x89' && x.status !== 'confirmado_site')) {
    const hit =
      tryLumePortfolioForRow(r) || lumePortfolioSearch('nero portorio 45x89') || lumePortfolioSearch('portorio');
    if (hit) applyHit(r, hit, 'Lume — ficha lumeceramica.com.br');
    else indicacao(r, 'Lume Cerâmica', 'Lume', '45x89');
  }

  // 90×90 — Carmelo Fior (ex. /produto/solaria-plus-rt-90x90)
  for (const r of rows.filter((x) => x.formato === '90x90' && /carmelo/i.test(String(x.fabricante_grupo || x.marca_no_site || '')))) {
    const hit = tryCarmeloForRow(r);
    if (hit) applyHit(r, hit, 'Carmelo Fior — slug 90×90 no site');
    else if (r.status !== 'confirmado_site') {
      indicacao(r, 'Carmelo Fior', 'Carmelo Fior', '90x90', 'buscar slug …-rt-90x90 em carmelofior.com.br');
    }
  }

  // 32×58 — Incopisos por código HD (ex. /produto/160101/)
  for (const r of rows.filter((x) => isIncopisosErpRow(x) && x.formato === '32x58')) {
    const hit = tryIncopisosForRow(r);
    if (hit) applyHit(r, hit, 'Grupo Incopisos — ficha por código HD');
    else if (r.status !== 'confirmado_site') {
      indicacao(r, 'Grupo Incopisos', 'Incopisos', '32x58', 'buscar /produto/hd-{código sem ponto} em grupoincopisos.com.br');
    }
  }

  // 39×75 — Grupo Incopisos (ex. /produto/ladrillo-red/)
  for (const r of rows.filter((x) => isIncopisosErpRow(x) && x.formato === '39x75')) {
    const hit = tryIncopisosForRow(r);
    if (hit) applyHit(r, hit, 'Grupo Incopisos — ficha grupoincopisos.com.br');
    else if (r.status !== 'confirmado_site') {
      indicacao(r, 'Grupo Incopisos', 'Incopisos', '39x75', 'buscar slug em grupoincopisos.com.br/produto/…');
    }
  }

  // 58×58 — Incopisos (não sobrescrever fichas já confirmadas)
  for (const r of rows.filter((x) => x.formato === '58x58' && x.status !== 'confirmado_site')) {
    const hit = tryIncopisosForRow(r);
    if (hit) applyHit(r, hit, 'Grupo Incopisos — 58×58');
    else indicacao(r, 'Grupo Incopisos', 'Incopisos', '58x58');
  }

  // Busca agressiva Incopisos: HD / código entre parênteses na descrição (ex. HD 170048 → /produto/hd-170048/)
  for (const r of rows.filter((x) => /incopisos/i.test(String(x.fabricante_grupo || x.marca_no_site || '')) && x.status !== 'confirmado_site')) {
    const slugs = [
      ...hdCodigoSlugCandidatesFromErp(r.descricao_erp || ''),
      ...incopisosSlugCandidates(r, modeloNome(r) || r.modelo || ''),
    ];
    for (const slug of [...new Set(slugs)]) {
      const hit = tryIncopisosSlug(slug);
      if (hit) {
        applyHit(r, hit, `Incopisos — código ERP → ${slug}`);
        break;
      }
    }
  }

  const incopisos56 = {
    'INDF-055': 'divina-luz',
    'INDF-056': 'iluminado',
    'INDF-057': 'nossa-senhora',
    'INDF-058': 'maranata',
    'INDF-059': 'leao-de-juda-2',
  };
  for (const [codigo, slug] of Object.entries(incopisos56)) {
    const r = byCode.get(codigo);
    if (!r) continue;
    applyHit(
      r,
      {
        fabricante_grupo: 'Grupo Incopisos',
        marca_no_site: 'Incopisos',
        descricao_no_site: r.descricao_erp?.slice(0, 40) || slug,
        evidencia_url: `https://grupoincopisos.com.br/produto/${slug}/`,
        status: 'confirmado_site',
        match_metodo: `incopisos:${slug}`,
      },
      '56×113 religioso — Incopisos',
    );
  }

  for (const codigo of Object.keys(CF_SLUG_BY_CODE)) {
    const r = byCode.get(codigo);
    if (!r) continue;
    let hit = tryCarmeloForRow(r);
    if (!hit) continue;
    const slugFixo = CF_SLUG_BY_CODE[codigo];
    const slug = slugFixo || hit.match_metodo?.split(':').pop() || '';
    if (isCecafiRow(r) || codigo === 'INDF-119') {
      applyHit(r, applyCarmeloGrupoHit(r, hit, slug), 'Grupo Carmelo Fior — marca na ficha do site');
    } else {
      applyHit(r, enrichCarmeloHitFromErp(r, hit), 'Carmelo — URL João André / ficha oficial');
    }
  }

  writeCsv(CSV, rows);
  const st = {};
  for (const r of rows) st[r.status] = (st[r.status] || 0) + 1;
  console.log('Status:', st);
  console.log('Salvo:', CSV);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
