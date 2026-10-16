#!/usr/bin/env node
/**
 * Aplica regras de formato/fabricante (João André) + busca URL oficial quando possível.
 * node scripts/catalogo/pagleve-aplicar-regras-joao.mjs
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import {
  buildSnapshot as buildFormigresSnapshot,
  fetchAllProdutos as fetchFormigresProdutos,
  findInSnapshot as findInFormigresSnapshot,
} from '../lib/formigresSnapshot.mjs';
import { stripAccents } from '../lib/formigresCatalog.mjs';
import { raioXProdutoDescricao } from '../lib/raioXProdutoDescricao.mjs';

const CSV = process.env.PAGLEVE_OUT || '/opt/cursor/artifacts/raio-x-pagleve-site-verificado.csv';
const ROCHA = 'https://www.portalgruporocha.com.br';
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

function ogTitle(html) {
  return html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] || '';
}

/** PR70001 no SIAH → slug pr7000 no portal (descarta 1 final + 4 dígitos). */
export function rochaSlugFromSiahDesc(desc) {
  const m = String(desc || '').match(/\b(PR|R)(\d{4,})\b/i);
  if (!m) return '';
  let digits = m[2];
  if (digits.length >= 5 && digits.endsWith('1')) digits = digits.slice(0, -1);
  const core = digits.length > 4 ? digits.slice(0, 4) : digits;
  return `${m[1].toLowerCase()}${core}`;
}

function tryRochaSlug(slug) {
  if (!slug) return null;
  const url = `${ROCHA}/produtos/${slug}`;
  const html = curl(url);
  const title = ogTitle(html);
  if (!title || html.length < 500) return null;
  return {
    fabricante_grupo: 'Grupo Rocha',
    marca_no_site: 'Rochaforte / Rochamaxx (portal)',
    descricao_no_site: title.replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim(),
    evidencia_url: url,
    status: 'confirmado_site',
    match_metodo: `rocha_portal_codigo:${slug}`,
  };
}

function lumePortfolioSearch(q) {
  const html = curl(`${LUME}/?s=${encodeURIComponent(q)}`);
  const m = html.match(/href="(https:\/\/lumeceramica\.com\.br\/portfolio-item\/[^"]+)"/i);
  if (!m) return null;
  const title = html.match(new RegExp(`>${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]{0,40}<`, 'i'));
  return {
    fabricante_grupo: 'Lume Cerâmica',
    marca_no_site: 'Lume',
    evidencia_url: m[1],
    descricao_no_site: title ? title[0].replace(/[<>]/g, '').trim() : q,
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

function tryCarmeloSlug(slug) {
  const url = `${CF}/produto/${slug}`;
  const html = curl(url);
  if (!html || html.length < 800) return null;
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  if (!/carmelo|fior|arielle/i.test(title) && !/produto/i.test(html)) return null;
  return {
    fabricante_grupo: 'Carmelo Fior',
    marca_no_site: 'Carmelo Fior',
    evidencia_url: url,
    descricao_no_site: title.split('|')[0].trim(),
    status: 'confirmado_site',
    match_metodo: `carmelo_slug:${slug}`,
  };
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

  const fmtFix = {
    '0x50': '50x50',
    '7x57': '57x57',
    '8x58': '58x58',
    '2x57': '32x57',
    '0x90': '90x90',
    '2x82': '82x82',
    '5x75': '75x75',
    '6x75': '75x75',
    '9x75': '39x75',
    '0x70': '70x70',
  };

  for (const r of rows) {
    if (fmtFix[r.formato]) r.formato = fmtFix[r.formato];
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
    const slug = rocha82[r.codigo] || (modeloNome(r).toLowerCase().includes('loft bege') ? 'loft-bege-ext' : modeloNome(r).toLowerCase().includes('loft cinza') ? 'loft-cinza-ext' : '');
    const hit = slug ? tryRochaSlug(slug) : null;
    if (hit) applyHit(r, hit);
    else indicacao(r, 'Grupo Rocha', 'Rochamaxx', '82x82');
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
  };
  for (const r of rows.filter((x) => x.formato === '74x74' && x.status !== 'confirmado_site')) {
    const n = stripAccents(r.descricao_erp).toLowerCase();
    let slug = cf74[r.codigo] || '';
    if (!slug && n.includes('alaska')) slug = 'alaska-po-rt';
    if (!slug && n.includes('gales')) slug = 'gales-po-rt';
    if (!slug && n.includes('sicilia')) slug = 'sicilia-po-rt';
    if (!slug && n.includes('breda')) slug = 'breda-po-rt';
    const hit = slug ? tryCarmeloSlug(slug) : null;
    if (hit) applyHit(r, hit);
    else indicacao(r, 'Carmelo Fior', 'Carmelo Fior', '74x74');
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
    const hit = slug ? tryCarmeloSlug(slug) : null;
    if (hit) applyHit(r, hit);
    else indicacao(r, 'Carmelo Fior', 'Carmelo Fior', '90x90');
  }

  // 75x75 — Lume
  const lume75 = {
    'INDF-031': 'monterrey-grigio-75x75',
    35507: 'monterrey-grigio-75x75',
  };
  for (const r of rows.filter((x) => x.formato === '75x75' && x.status !== 'confirmado_site')) {
    const n = stripAccents(r.descricao_erp).toLowerCase();
    let q = lume75[r.codigo] ? 'monterrey grigio' : n.includes('monterrey') ? 'monterrey grigio' : n.includes('asphalt') ? 'asphalt' : n.includes('petra') ? 'petra nat' : n.includes('portorio') ? 'nero portorio' : n.includes('avorio') ? 'avorio cinza' : '';
    let hit = null;
    if (lume75[r.codigo]) {
      hit = {
        fabricante_grupo: 'Lume Cerâmica',
        marca_no_site: 'Lume',
        evidencia_url: `${LUME}/portfolio-item/${lume75[r.codigo]}/`,
        descricao_no_site: 'Monterrey Grigio 75×75',
        status: 'confirmado_site',
        match_metodo: 'lume_url_fixa',
      };
    } else if (q) hit = lumePortfolioSearch(q);
    if (hit) applyHit(r, hit);
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
  for (const r of rows.filter((x) => x.formato === '45x89')) {
    const hit = lumePortfolioSearch('nero portorio 45x89') || lumePortfolioSearch('portorio');
    if (hit) applyHit(r, hit);
    else indicacao(r, 'Lume Cerâmica', 'Lume', '45x89');
  }

  // 57x57 — Cecafi (todos)
  for (const r of rows.filter((x) => x.formato === '57x57')) {
    if (r.status === 'confirmado_site' && r.fabricante_grupo === 'Cecafi') continue;
    indicacao(r, 'Cecafi', 'Cecafi', '57x57', 'buscar ficha Etna/Cecafi ou Formigres');
  }

  // 58x58 — Incopisos
  for (const r of rows.filter((x) => x.formato === '58x58')) {
    indicacao(r, 'Grupo Incopisos', 'Incopisos', '58x58');
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
