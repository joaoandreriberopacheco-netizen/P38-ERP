#!/usr/bin/env node
/**
 * Pipeline unificado PagLeve (228):
 * formato + descrição ERP → busca no fabricante → página do produto → ficha + imagens + LU NBR.
 * Saída JSON consolidado em /opt/cursor/artifacts (não altera CSV nem preços).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  buildSnapshot as buildFormigresSnapshot,
  fetchAllProdutos as fetchFormigresProdutos,
  findInSnapshot as findInFormigresSnapshot,
} from '../lib/formigresSnapshot.mjs';
import {
  buildSnapshot as buildCarmeloSnapshot,
  fetchAllProdutos as fetchCarmeloProdutos,
} from '../lib/carmeloFiorSnapshot.mjs';
import {
  buildSnapshot as buildCerbrasSnapshot,
  fetchSitemapUrls,
  normalizeFromUrl,
} from '../lib/cerbrasSnapshot.mjs';
import { stripAccents } from '../lib/formigresCatalog.mjs';
import { raioXProdutoDescricao } from '../lib/raioXProdutoDescricao.mjs';
import { extractFichaFromOfficialSite } from '../lib/pagleveFichaFromSite.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CSV = path.join(ROOT, 'files/pagleve/raio-x-pagleve-site-verificado.csv');
const PILOT_MODE = process.env.PAGLEVE_PIPELINE_PILOTO === '1';
/** Um item por formato — ordem embaralhada a cada corrida */
const PILOT_FORMATOS = ['90x90', '22x90', '82x82', '88x88', '62x62'];
const PILOT_FORMATO_FALLBACK = { '62x62': '62x119' };
const LIMIT = Number(process.env.PAGLEVE_PIPELINE_LIMIT || 0) || 0;
const PILOT_CODIGOS = (process.env.PAGLEVE_PIPELINE_CODIGOS || '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);
const OUT =
  process.env.PAGLEVE_SWEEP_OUT ||
  (PILOT_MODE || PILOT_CODIGOS.length
    ? '/opt/cursor/artifacts/pagleve-pipeline-piloto-5-2026-11-21.json'
    : '/opt/cursor/artifacts/pagleve-pipeline-228-consolidado-2026-11-21.json');
const ROCHA_BASE = 'https://www.portalgruporocha.com.br';
const LUME_BASE = 'https://lumeceramica.com.br';
const UA = 'P38-PagLeve-pipeline/3.0';

const OFFICIAL = new Set([
  'formigres.com.br',
  'portalgruporocha.com.br',
  'carmelofior.com.br',
  'lumeceramica.com.br',
  'grupoincopisos.com.br',
  'novo.cerbras.com',
  'cedasa.com.br',
]);

const URL_OVERRIDES = {
  '35486': 'https://www.portalgruporocha.com.br/produtos/loft-beg-ext',
  '35487': 'https://www.portalgruporocha.com.br/produtos/loft-cinza-ext',
};

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

function curl(url) {
  const k = url.includes('lumeceramica') ? '-k ' : '';
  try {
    return execSync(`curl ${k}-sL --max-time 30 -A ${JSON.stringify(UA)} ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      maxBuffer: 12 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isOfficial(url) {
  if (!url) return false;
  const h = hostOf(url);
  return [...OFFICIAL].some((d) => h === d.replace(/^www\./, '') || h === d);
}

function canonicalProductUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return String(url).split('?')[0].split('#')[0];
  }
}

function metaOg(html, prop) {
  const re = new RegExp(`<meta property="${prop}" content="([^"]+)"`, 'i');
  return html.match(re)?.[1] || '';
}

function pageIs404(html) {
  if (!html || html.length < 300) return true;
  if (/"statusCode":\s*404/.test(html)) return true;
  if (/Página não encontrada|Page not found|404 Not Found/i.test(html)) return true;
  const title = metaOg(html, 'og:title');
  if (title && /not found/i.test(title)) return true;
  return false;
}

function nameSlug(text) {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

function modeloParaBusca(row) {
  const desc = row.descricao_erp || row.descricao_original || '';
  const rx = raioXProdutoDescricao(row.codigo, desc);
  let modelo = rx.modelo || row.modelo || '';
  modelo = modelo
    .replace(/\([^)]*$/g, ' ')
    .replace(/\(\d+[,.]?\d*\)?/g, ' ')
    .replace(/\b0X\d+\b/gi, ' ')
    .replace(/\b(PR\d{3,}|R\d{3,})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!modelo || modelo.length < 4) {
    modelo = stripAccents(desc)
      .replace(/\b\d{2,5}\b/g, ' ')
      .replace(/\b(PR\d+|R\d+)\b/gi, ' ')
      .replace(/[^a-zA-Z ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !/^(PISO|ROCHAPRIME|ROCHAMAXX|HD|MRE)$/i.test(w))
      .slice(0, 4)
      .join(' ');
  }
  return modelo;
}

function temNomeComercial(row) {
  const m = modeloParaBusca(row);
  if (!m || m.length < 4) return false;
  const tokens = m.split(/\s+/).filter((t) => t.length >= 4 && !/^(rochaprime|rochamaxx)$/i.test(t));
  return tokens.length > 0;
}

function rochaSlugFromSiahDesc(desc) {
  const m = String(desc || '').match(/\b(PR|R)(\d{4,})\b/i);
  if (!m) return '';
  let digits = m[2];
  if (digits.length >= 5 && digits.endsWith('1')) digits = digits.slice(0, -1);
  const core = digits.length > 4 ? digits.slice(0, 4) : digits;
  return `${m[1].toLowerCase()}${core}`;
}

function rochaSlugCandidates(row) {
  const modelo = modeloParaBusca(row);
  const out = [];
  const ns = nameSlug(modelo);
  if (ns.length >= 4) out.push(ns);
  const words = stripAccents(modelo)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(rocha|prime|hd|mre|rochaprime)$/i.test(w));
  if (words.length >= 2) out.push(`${words[0]}-${words[1]}`);
  for (const w of words) {
    if (w.length >= 5) out.push(w);
  }
  const desc = stripAccents(row.descricao_erp || '').toLowerCase();
  if (desc.includes('loft bege')) out.push('loft-beg-ext', 'loft-bege-ext');
  if (desc.includes('loft cinza')) out.push('loft-cinza-ext');
  if (/^metrop/.test(stripAccents(modelo).toLowerCase())) out.push('metropole');
  return [...new Set(out)];
}

function siteTryOrderForRow(row) {
  const g = stripAccents(row.fabricante_grupo || '').toLowerCase();
  const desc = stripAccents(row.descricao_erp || '').toLowerCase();
  const fmt = (row.formato || '').toLowerCase();
  if (g.includes('incopisos') || fmt === '32x58' || fmt === '39x75') {
    return ['incopisos', 'formigres', 'carmelo', 'lume', 'rocha', 'cerbras'];
  }
  if (g.includes('lume') || fmt === '45x89' || fmt === '62x119' || fmt === '22x90') {
    return ['lume', 'formigres', 'carmelo', 'rocha', 'cerbras'];
  }
  if (g.includes('carmelo') || g.includes('arielle')) {
    return ['carmelo', 'formigres', 'lume', 'rocha', 'cerbras'];
  }
  if (g.includes('rocha') || desc.includes('rochamaxx') || desc.includes('rochaprime')) {
    if (
      fmt === '90x90' &&
      /plus|albury|narbona|sidney|vinci|amon|dream|fortunata|cronos|dacito|pissis|solaria|alaska|verne|panis|lelis|varena/i.test(
        desc,
      )
    ) {
      return ['carmelo', 'formigres', 'lume', 'rocha', 'cerbras'];
    }
    return ['rocha', 'formigres', 'lume', 'carmelo', 'cerbras'];
  }
  if (g.includes('cecafi') || fmt === '38x75' || fmt === '57x57') {
    return ['formigres', 'carmelo', 'cerbras', 'lume', 'rocha'];
  }
  if (fmt === '58x58') return ['cerbras', 'formigres', 'incopisos', 'carmelo', 'lume', 'rocha'];
  if (desc.includes('rochaprime') || desc.includes('rochamaxx')) {
    if (fmt === '61x116' || fmt === '82x82' || fmt === '37x59' || fmt === '76x76') {
      return ['rocha', 'formigres', 'lume', 'carmelo', 'cerbras'];
    }
    return ['formigres', 'carmelo', 'lume', 'rocha', 'cerbras'];
  }
  return ['formigres', 'rocha', 'lume', 'carmelo', 'cerbras', 'incopisos'];
}

async function loadRochaSlugIndex() {
  const html = curl(`${ROCHA_BASE}/produtos`);
  const slugs = new Set();
  const re = /\/produtos\/([a-z0-9-]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].length >= 3) slugs.add(m[1].toLowerCase());
  }
  return { slugs };
}

function tryRocha(row, rochaSlugs) {
  const candidates = rochaSlugCandidates(row);
  const codeSlug = rochaSlugFromSiahDesc(row.descricao_erp);
  if (codeSlug) candidates.unshift(codeSlug);
  if (URL_OVERRIDES[row.codigo]) candidates.unshift(URL_OVERRIDES[row.codigo].split('/').pop());

  const desc = stripAccents(row.descricao_erp || '').toLowerCase();
  for (let c of [...new Set(candidates)]) {
    if (/^(pr|r)\d+$/i.test(c) && !rochaSlugs.has(c)) continue;
    const url = `${ROCHA_BASE}/produtos/${c}`;
    const html = curl(url);
    if (pageIs404(html)) continue;
    const title = metaOg(html, 'og:title').replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim();
    if (!title) continue;
    return {
      siteKey: 'rocha',
      fabricante_grupo: 'Grupo Rocha',
      marca_no_site: desc.includes('rochamaxx') ? 'Rochamaxx' : 'Rochaforte / portal',
      descricao_no_site: title,
      evidencia_url: url,
      html,
      status: 'confirmado_site',
      match_metodo: `rocha_slug:${c}`,
    };
  }
  return null;
}

async function tryFormigres(row, snap) {
  if (!temNomeComercial(row)) return null;
  const desc = `${row.formato} ${modeloParaBusca(row)}`;
  const { match, score } = findInFormigresSnapshot(snap, desc, { minScore: 45, requireFormato: true });
  if (!match) return null;
  return {
    siteKey: 'formigres',
    fabricante_grupo: 'Grupo Formigres',
    marca_no_site: match.marca_nome || 'Formigres',
    descricao_no_site: [match.titulo, match.formato, match.tipo].filter(Boolean).join(' · '),
    evidencia_url: match.produto_url,
    formigres_id: String(match.id),
    match_formigres: match,
    status: 'confirmado_site',
    match_metodo: `formigres_snapshot:${score}`,
    match_score: String(score),
  };
}

function tryCarmelo(row, snap) {
  if (!temNomeComercial(row)) return null;
  const desc = `${row.formato} ${modeloParaBusca(row)}`;
  const { match, score } = findInFormigresSnapshot(snap, desc, { minScore: 32, requireFormato: true });
  if (!match) return null;
  return {
    siteKey: 'carmelo',
    fabricante_grupo: 'Carmelo Fior',
    marca_no_site: match.marca_nome || 'Arielle',
    descricao_no_site: [match.titulo, match.formato, match.tipo].filter(Boolean).join(' · '),
    evidencia_url: match.produto_url,
    carmelo_prod: match,
    status: 'confirmado_site',
    match_metodo: `carmelo_snapshot:${score}`,
    match_score: String(score),
  };
}

function tryLume(row) {
  if (!temNomeComercial(row)) return null;
  const nome = modeloParaBusca(row);
  const q = [row.formato, nome].filter(Boolean).join(' ').trim();
  const html = curl(`${LUME_BASE}/?s=${encodeURIComponent(q.split(/\s+/).slice(0, 5).join(' '))}`);
  if (!html || /0\s+resultados|Nenhum resultado/i.test(html)) return null;
  const want = stripAccents(nome).toLowerCase().split(/\s+/).filter((w) => w.length > 3)[0];
  const linkRe = /href="(https:\/\/lumeceramica\.com\.br\/portfolio-item\/[^"]+)"/gi;
  let best = null;
  let m;
  while ((m = linkRe.exec(html))) {
    if (want && !stripAccents(m[1]).toLowerCase().includes(want.slice(0, Math.min(5, want.length)))) continue;
    best = m[1];
    break;
  }
  if (!best) return null;
  const pageHtml = curl(best);
  return {
    siteKey: 'lume',
    fabricante_grupo: 'Lume Cerâmica',
    marca_no_site: 'Lume',
    descricao_no_site: nome,
    evidencia_url: best,
    html: pageHtml,
    status: 'confirmado_site',
    match_metodo: `lume_busca:${q}`,
  };
}

function tryIncopisos(row) {
  if (!temNomeComercial(row)) return null;
  const nome = modeloParaBusca(row);
  const q = [row.formato, nome].filter(Boolean).join(' ').trim();
  const html = curl(`https://grupoincopisos.com.br/?s=${encodeURIComponent(q.split(/\s+/).slice(0, 4).join(' '))}`);
  if (!html) return null;
  const linkRe = /href="(https:\/\/grupoincopisos\.com\.br\/produto\/[^"?#]+)/gi;
  let best = null;
  let m;
  const want = stripAccents(nome).toLowerCase().split(/\s+/).filter((w) => w.length > 3)[0];
  while ((m = linkRe.exec(html))) {
    const url = m[1].replace(/\/$/, '') + '/';
    if (want && !stripAccents(url).toLowerCase().includes(want.slice(0, 5))) continue;
    best = url;
    break;
  }
  if (!best) return null;
  const pageHtml = curl(best);
  return {
    siteKey: 'incopisos',
    fabricante_grupo: 'Grupo Incopisos',
    marca_no_site: 'Incopisos',
    descricao_no_site: nome,
    evidencia_url: best,
    html: pageHtml,
    status: 'confirmado_site',
    match_metodo: 'incopisos_busca',
  };
}

async function tryMatchersForRow(row, ctx) {
  const order = siteTryOrderForRow(row);
  for (const key of order) {
    let hit = null;
    if (key === 'rocha') hit = tryRocha(row, ctx.rochaSlugs);
    else if (key === 'formigres') hit = await tryFormigres(row, ctx.snapFg);
    else if (key === 'lume') hit = tryLume(row);
    else if (key === 'carmelo' && ctx.snapCf) hit = tryCarmelo(row, ctx.snapCf);
    else if (key === 'incopisos') hit = tryIncopisos(row);
    if (hit?.status === 'confirmado_site') return hit;
  }
  return null;
}

/** Passo único: descoberta + ficha + imagens na mesma corrida. */
async function discoverAndEnrich(row, ctx) {
  const consulta = {
    formato: row.formato,
    modelo: modeloParaBusca(row),
    descricao_erp: row.descricao_erp,
  };

  if (URL_OVERRIDES[row.codigo]) {
    const url = canonicalProductUrl(URL_OVERRIDES[row.codigo]);
    const html = curl(url);
    if (!pageIs404(html)) {
      const { ficha, imagens, extracao } = await extractFichaFromOfficialSite({
        url,
        fabricante_grupo: 'Grupo Rocha',
        siteKey: 'rocha',
        html,
        carmeloBySlug: ctx.carmeloBySlug,
      });
      return {
        status: 'confirmado_site',
        consulta,
        fabricante_grupo: 'Grupo Rocha',
        marca_no_site: 'Rochamaxx',
        descricao_no_site: metaOg(html, 'og:title').replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim(),
        produto_url: url,
        match_metodo: `override_url:${row.codigo}`,
        ficha,
        imagens,
        extracao,
      };
    }
  }

  const hit = await tryMatchersForRow(row, ctx);
  if (!hit) {
    return {
      status: 'nao_encontrado',
      consulta,
      produto_url: '',
      motivo: 'nenhum_fabricante_confirmou',
      ficha: {},
      imagens: [],
    };
  }

  const url = canonicalProductUrl(hit.evidencia_url);
  let html = hit.html || '';
  if (!html && hit.siteKey !== 'formigres' && hit.siteKey !== 'carmelo') {
    html = curl(url);
  }
  if (html && pageIs404(html)) {
    return {
      status: 'nao_encontrado',
      consulta,
      produto_url: url,
      motivo: 'pagina_404_apos_match',
      ficha: {},
      imagens: [],
      match_metodo: hit.match_metodo,
    };
  }

  const { ficha, imagens, extracao, erro } = await extractFichaFromOfficialSite({
    url,
    fabricante_grupo: hit.fabricante_grupo,
    siteKey: hit.siteKey,
    hit,
    html,
    carmeloBySlug: ctx.carmeloBySlug,
  });

  return {
    status: 'confirmado_site',
    consulta,
    fabricante_grupo: hit.fabricante_grupo,
    marca_no_site: hit.marca_no_site || '',
    descricao_no_site: hit.descricao_no_site || '',
    produto_url: url,
    match_metodo: hit.match_metodo || '',
    match_score: hit.match_score || '',
    ficha,
    imagens,
    extracao,
    extracao_erro: erro || '',
    motivo: imagens.length ? '' : 'galeria_vazia',
  };
}

function buildCarmeloSlugIndex(snap) {
  const map = new Map();
  for (const p of snap?.produtos || []) {
    const slug = p.slug || p.produto_url?.match(/produto\/([^/]+)/i)?.[1];
    if (slug) map.set(String(slug).toLowerCase(), p);
  }
  return map;
}

function normFmtKey(fmt) {
  return String(fmt || '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .trim();
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Piloto: 1 código por formato (90x90, 22x90, 82x82, 88x88, 62x62), ordem aleatória.
 * 62x62 não existe no CSV atual → fallback 62x119 (documentado).
 */
function selectPilotRowsByFormat(allRows) {
  const byFmt = new Map();
  for (const row of allRows) {
    const k = normFmtKey(row.formato);
    if (!byFmt.has(k)) byFmt.set(k, []);
    byFmt.get(k).push(row);
  }
  const formatOrder = shuffleInPlace([...PILOT_FORMATOS]);
  const selecao = [];
  for (const alvo of formatOrder) {
    let fmtUsado = alvo;
    let pool = byFmt.get(alvo);
    let fallback = false;
    if (!pool?.length && PILOT_FORMATO_FALLBACK[alvo]) {
      fmtUsado = PILOT_FORMATO_FALLBACK[alvo];
      pool = byFmt.get(fmtUsado);
      fallback = true;
    }
    if (!pool?.length) {
      selecao.push({ formato_alvo: alvo, codigo: null, motivo: 'formato_ausente_no_csv' });
      continue;
    }
    const row = pool[Math.floor(Math.random() * pool.length)];
    selecao.push({
      formato_alvo: alvo,
      formato_csv: row.formato,
      formato_resolvido: fmtUsado,
      fallback,
      codigo: row.codigo,
      modelo: row.modelo,
    });
  }
  const rows = shuffleInPlace(
    selecao.filter((s) => s.codigo).map((s) => allRows.find((r) => r.codigo === s.codigo)).filter(Boolean),
  );
  return { rows, selecao, ordem_formatos_sorteada: formatOrder };
}

async function main() {
  let rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  let pilotoMeta = null;

  if (PILOT_CODIGOS.length) {
    const set = new Set(PILOT_CODIGOS);
    rows = rows.filter((r) => set.has(String(r.codigo)));
    pilotoMeta = { modo: 'codigos_fixos', codigos: PILOT_CODIGOS };
  } else if (PILOT_MODE) {
    const picked = selectPilotRowsByFormat(rows);
    rows = picked.rows;
    pilotoMeta = {
      modo: 'um_por_formato',
      formatos_alvo: PILOT_FORMATOS,
      ordem_formatos_sorteada: picked.ordem_formatos_sorteada,
      selecao: picked.selecao,
    };
    console.log('Piloto formatos:', pilotoMeta.selecao.map((s) => `${s.formato_alvo}→${s.codigo || '—'}`).join(' | '));
  } else if (LIMIT > 0) {
    rows = rows.slice(0, LIMIT);
  }

  console.log('Loading catalogs...');
  const snapFg = buildFormigresSnapshot(await fetchFormigresProdutos());
  let snapCf = null;
  try {
    snapCf = buildCarmeloSnapshot(await fetchCarmeloProdutos());
  } catch (e) {
    console.warn('Carmelo:', e.message);
  }
  const cbUrls = await fetchSitemapUrls();
  buildCerbrasSnapshot(cbUrls.map((u) => normalizeFromUrl(u)).filter(Boolean));
  const { slugs: rochaSlugs } = await loadRochaSlugIndex();
  const carmeloBySlug = buildCarmeloSlugIndex(snapCf);
  const ctx = { snapFg, snapCf, rochaSlugs, carmeloBySlug };

  const report = [];
  let n = 0;
  for (const row of rows) {
    n++;
    const enriched = await discoverAndEnrich(row, ctx);
    const imagens = enriched.imagens || [];
    report.push({
      codigo: row.codigo,
      formato: row.formato,
      descricao_erp: row.descricao_erp,
      consulta: enriched.consulta,
      status: enriched.status,
      fabricante_grupo: enriched.fabricante_grupo || '—',
      marca_no_site: enriched.marca_no_site || '',
      nome_comercial: enriched.descricao_no_site || enriched.consulta?.modelo || '',
      produto_url: enriched.produto_url || '',
      url_e_oficial: isOfficial(enriched.produto_url),
      match_metodo: enriched.match_metodo || '',
      match_score: enriched.match_score || '',
      ficha: enriched.ficha || {},
      imagens,
      imagens_count: imagens.length,
      extracao: enriched.extracao || '',
      sem_foto_motivo: enriched.motivo || (imagens.length ? '' : enriched.status === 'confirmado_site' ? 'galeria_vazia' : enriched.motivo),
      pipeline: 'unificado_v3',
      csv_status_anterior: row.status,
    });
    if (n % 25 === 0) console.log(`... ${n}/${rows.length}`);
  }

  const comFoto = report.filter((r) => r.status === 'confirmado_site' && r.imagens_count > 0);
  const semFoto = report.filter(
    (r) => r.status !== 'confirmado_site' || !r.imagens_count,
  );

  const summary = {
    geradoEm: new Date().toISOString(),
    pipeline: 'unificado_v3',
    piloto: pilotoMeta,
    total: report.length,
    confirmados_site: report.filter((r) => r.status === 'confirmado_site').length,
    com_foto: comFoto.length,
    sem_foto: semFoto.length,
    sem_foto_detalhe: semFoto.map((r) => ({
      codigo: r.codigo,
      motivo: r.sem_foto_motivo || r.status,
      produto_url: r.produto_url,
    })),
    itens: report,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));

  console.log('Done.', {
    confirmados: summary.confirmados_site,
    com_foto: summary.com_foto,
    sem_foto: summary.sem_foto,
    out: OUT,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});