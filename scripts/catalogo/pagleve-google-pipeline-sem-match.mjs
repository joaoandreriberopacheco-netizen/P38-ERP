#!/usr/bin/env node
/**
 * PagLeve diagnóstico: Excel verbatim → busca (Serper Google API ou DDG Lite) → site oficial → foto.
 * Não altera CSV/catálogo.
 *
 * Serper: SERPER_API_KEY + POST https://google.serper.dev/search (organic[]).
 * DDG legacy: PAGLEVE_SEARCH_PROVIDER=ddg (Playwright).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { setTimeout as sleepP } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { extractFichaFromOfficialSite } from '../lib/pagleveFichaFromSite.mjs';
import { stripAccents } from '../lib/formigresCatalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ART = process.env.PAGLEVE_ARTIFACTS_DIR || '/opt/cursor/artifacts';
const LISTA =
  process.env.PAGLEVE_SEM_MATCH_LISTA ||
  path.join(ART, 'pagleve-sem-match-29-lista.json');
const OUT_JSON =
  process.env.PAGLEVE_GOOGLE_OUT ||
  path.join(ART, 'pagleve-sem-match-30-google-cascata.json');
const OUT_MD =
  process.env.PAGLEVE_GOOGLE_MD ||
  path.join(ART, 'pagleve-sem-match-30-referencia-google.md');
const SWEEP_PATH =
  process.env.PAGLEVE_SWEEP_JSON || path.join(ART, 'pagleve-official-sweep-2026-11-21.json');
const EXCEL = 'docs/ESTOQUE PARA CASA ISRAEL ATE 19112026.XLSX';
const SEARCH_PROVIDER = (process.env.PAGLEVE_SEARCH_PROVIDER || 'serper').toLowerCase();
const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const SERPER_URL = process.env.PAGLEVE_SERPER_URL || 'https://google.serper.dev/search';
const SERPER_NUM = Number(process.env.PAGLEVE_SERPER_NUM || 10);
const SLEEP_MS = Number(process.env.PAGLEVE_SERPER_SLEEP_MS || process.env.PAGLEVE_DDG_SLEEP_MS || 800);

const OFFICIAL = [
  { host: 'grupoincopisos.com.br', grupo: 'Grupo Incopisos', siteKey: 'incopisos' },
  { host: 'formigres.com.br', grupo: 'Grupo Formigres', siteKey: 'formigres' },
  { host: 'carmelofior.com.br', grupo: 'Carmelo Fior', siteKey: 'carmelo' },
  { host: 'lumeceramica.com.br', grupo: 'Lume Cerâmica', siteKey: 'lume' },
  { host: 'portalgruporocha.com.br', grupo: 'Grupo Rocha', siteKey: 'rocha' },
  { host: 'novo.cerbras.com', grupo: 'Cerbras', siteKey: 'cerbras' },
];

function curl(url) {
  const UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    return execSync(`curl -sL --max-time 35 -A ${JSON.stringify(UA)} ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function excelQuery(medida, desc) {
  const m = String(medida || '')
    .replace(/x/gi, ' por ')
    .replace(/X/g, ' por ');
  return `${m} ${desc || ''}`.replace(/\s+/g, ' ').trim();
}

function compactQuery(medida, desc) {
  const fmt = String(medida || '').trim();
  const tokens = modeloTokens(desc);
  return `${fmt} ${tokens.join(' ')}`.replace(/\s+/g, ' ').trim();
}

function norm(s) {
  return stripAccents(String(s || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function modeloTokens(desc) {
  const skip =
    /^(piso|semi|gres|rev|ld|porcelanat|porcellanat|relev|outs|outside|ret|rt|hd|mre|plus|bold|esm|esmal|acet|pld|po|pei|junta|mm|a)$/i;
  return norm(desc)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !skip.test(w))
    .slice(0, 6);
}

function parseOrganicHits(organic) {
  const out = [];
  const seen = new Set();
  for (const row of organic || []) {
    const url = row?.link || row?.url;
    if (!url || !url.startsWith('http')) continue;
    try {
      const u = new URL(url);
      const key = u.origin + u.pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        url: url.split('#')[0],
        title: String(row.title || '').slice(0, 120),
        snippet: String(row.snippet || '').slice(0, 200),
      });
    } catch {
      /* */
    }
  }
  return out.slice(0, 25);
}

async function searchSerperOnce(query) {
  if (!SERPER_API_KEY) {
    return { query, hits: [], error: true, motivo: 'serper_sem_api_key' };
  }
  const res = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': SERPER_API_KEY,
    },
    body: JSON.stringify({
      q: query,
      num: SERPER_NUM,
      gl: 'br',
      hl: 'pt-br',
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return { query, hits: [], error: true, motivo: `serper_http_${res.status}`, raw: text.slice(0, 200) };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { query, hits: [], error: true, motivo: 'serper_json_invalido' };
  }
  const hits = parseOrganicHits(data.organic);
  return { query, hits, error: false, motivo: hits.length ? '' : 'serper_sem_resultados' };
}

async function searchSerper(queryExcel, queryCompact) {
  const attempts = [queryCompact, queryExcel].filter((q, i, arr) => q && arr.indexOf(q) === i);
  let last = {
    query: queryCompact,
    hits: [],
    error: false,
    motivo: 'serper_sem_resultados',
    fonte: 'serper_google',
  };
  for (const query of attempts) {
    const res = await searchSerperOnce(query);
    last = {
      ...res,
      fonte: 'serper_google',
      query_usada: query,
      query_excel: queryExcel,
      query_compact: queryCompact,
    };
    if (res.error && res.motivo === 'serper_sem_api_key') break;
    if (res.hits.length) break;
    await sleepP(300);
  }
  return last;
}

async function loadDdgSearch() {
  const { chromium } = await import('playwright');
  const DDG_HEADLESS = process.env.PAGLEVE_DDG_HEADLESS === '1';
  const browser = await chromium.launch({
    headless: DDG_HEADLESS,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  return {
    browser,
    search: async (queryExcel, queryCompact) => {
      const attempts = [queryCompact, queryExcel].filter((q, i, arr) => q && arr.indexOf(q) === i);
      let last = { hits: [], motivo: 'ddg_sem_resultados', fonte: 'ddg_lite_playwright' };
      for (const query of attempts) {
        await page.goto('https://lite.duckduckgo.com/lite/', { waitUntil: 'domcontentloaded' });
        await page.locator('input[name="q"]').first().fill(query);
        await Promise.all([page.waitForNavigation({ timeout: 45000 }).catch(() => null), page.keyboard.press('Enter')]);
        await sleepP(800);
        const hits = await page.$$eval('a', (anchors) => {
          const out = [];
          const seen = new Set();
          for (const a of anchors) {
            const href = a.href || '';
            if (!href.startsWith('http') || /duckduckgo/i.test(href)) continue;
            try {
              const u = new URL(href);
              const key = u.origin + u.pathname;
              if (seen.has(key)) continue;
              seen.add(key);
              const title = (a.innerText || '').trim().slice(0, 120);
              if (title.length < 2) continue;
              out.push({ url: href.split('#')[0], title });
            } catch {
              /* */
            }
          }
          return out.slice(0, 25);
        });
        last = { query, hits, motivo: hits.length ? '' : 'ddg_sem_resultados', fonte: 'ddg_lite_playwright', query_usada: query, query_excel: queryExcel, query_compact: queryCompact };
        if (hits.length) break;
      }
      return last;
    },
  };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchOfficial(host) {
  return OFFICIAL.find((o) => host === o.host || host.endsWith(`.${o.host}`));
}

function scoreUrlForItem(url, item) {
  const tokens = modeloTokens(item.desc_excel);
  const u = norm(url);
  let score = 0;
  for (const t of tokens) {
    if (t.length >= 4 && u.includes(t)) score += 3;
    else if (t.length >= 3 && u.includes(t)) score += 1;
  }
  const med = norm(item.medida).replace(/ por /g, 'x');
  if (med && u.includes(med.replace(/\s/g, ''))) score += 2;
  return score;
}

function inferFromHits(serp, item) {
  const fabricantes = new Map();
  const oficial = [];
  for (const h of serp.hits || []) {
    const url = h.url || h;
    const host = hostOf(url);
    const off = matchOfficial(host);
    if (off) {
      oficial.push({ url, ...off, score: scoreUrlForItem(url, item) });
      fabricantes.set(off.grupo, (fabricantes.get(off.grupo) || 0) + 1);
    }
    const low = url.toLowerCase();
    if (/incopisos/i.test(low)) fabricantes.set('Grupo Incopisos', (fabricantes.get('Grupo Incopisos') || 0) + 1);
    if (/carmelo\s*fior|carmelofior/i.test(low))
      fabricantes.set('Carmelo Fior', (fabricantes.get('Carmelo Fior') || 0) + 1);
    if (/lume\s*ceramica|lumeceramica/i.test(low))
      fabricantes.set('Lume Cerâmica', (fabricantes.get('Lume Cerâmica') || 0) + 1);
    if (/grupo\s*rocha|portalgruporocha|rochamaxx/i.test(low))
      fabricantes.set('Grupo Rocha', (fabricantes.get('Grupo Rocha') || 0) + 1);
    if (/formigres/i.test(low)) fabricantes.set('Grupo Formigres', (fabricantes.get('Grupo Formigres') || 0) + 1);
    if (/cerbras/i.test(low)) fabricantes.set('Cerbras', (fabricantes.get('Cerbras') || 0) + 1);
  }
  oficial.sort((a, b) => b.score - a.score);
  const fab = [...fabricantes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return { fabricante_inferido: fab, urls_oficiais: oficial, fabricante_votes: Object.fromEntries(fabricantes) };
}

function metaOg(html, prop) {
  const re = new RegExp(`<meta property="${prop}" content="([^"]+)"`, 'i');
  return html.match(re)?.[1] || '';
}

function pageIs404(html) {
  if (!html || html.length < 300) return true;
  if (/404|not found|não encontrad/i.test(html) && html.length < 8000) return true;
  return false;
}

function textoConfirmaProduto(html, item) {
  const tokens = modeloTokens(item.desc_excel);
  const body = norm(html);
  let hits = 0;
  for (const t of tokens) {
    if (t.length >= 4 && body.includes(t)) hits++;
  }
  return {
    token_hits: hits,
    tokens,
    ok: hits >= 1 || (tokens.length === 1 && tokens[0].length >= 5 && body.includes(tokens[0])),
  };
}

async function confirmarSite(url, off, item) {
  const html = curl(url);
  if (pageIs404(html)) {
    return { status: 'nao_encontrado', motivo: 'pagina_404', produto_url: url, imagens_count: 0 };
  }
  const conf = textoConfirmaProduto(html, item);
  if (!conf.ok) {
    return {
      status: 'nao_encontrado',
      motivo: 'site_sem_tokens_do_excel',
      produto_url: url,
      token_hits: conf.token_hits,
      imagens_count: 0,
    };
  }
  const { ficha, imagens, extracao } = await extractFichaFromOfficialSite({
    url,
    fabricante_grupo: off.grupo,
    siteKey: off.siteKey,
    html,
  });
  let imgs = imagens || [];
  if (!imgs.length) {
    const og = metaOg(html, 'og:image');
    if (og) imgs = [{ url: og, tipo: 'principal' }];
    const extra = [...html.matchAll(/wp-content\/uploads\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)].map((m) => {
      const host = off.host || hostOf(url);
      return `https://${host}/${m[0].replace(/^\/+/, '')}`;
    });
    for (const u of extra.slice(0, 8)) {
      if (!imgs.some((i) => i.url === u)) imgs.push({ url: u, tipo: 'galeria' });
    }
    const fg = [...html.matchAll(/formigres\.com\.br\/uploads\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)].map(
      (m) => `https://www.${m[0]}`,
    );
    for (const u of fg.slice(0, 6)) {
      if (!imgs.some((i) => i.url === u)) imgs.push({ url: u, tipo: 'galeria' });
    }
  }
  const title = metaOg(html, 'og:title') || metaOg(html, 'og:description') || '';
  return {
    status: 'confirmado_site',
    motivo: imgs.length ? '' : 'confirmado_sem_galeria_extraida',
    produto_url: url,
    nome_no_site: title.slice(0, 120),
    fabricante_grupo: off.grupo,
    siteKey: off.siteKey,
    ficha: ficha || {},
    imagens: imgs,
    imagens_count: imgs.length,
    token_hits: conf.token_hits,
    extracao,
  };
}

function erpDiverge(item) {
  const tokA = modeloTokens(item.desc_excel);
  const tokB = modeloTokens(item.desc_erp);
  const overlap = tokA.filter((t) => tokB.includes(t)).length;
  const diverge =
    item.desc_erp && overlap < Math.min(tokA.length, tokB.length) * 0.4 && item.desc_erp !== item.desc_excel;
  return {
    diverge,
    desc_excel: item.desc_excel,
    desc_erp: item.desc_erp,
    overlap_tokens: overlap,
    causa_raiz_cascata_antiga: diverge
      ? 'CSV/cascata usou descricao_erp ou modelo derivado do ERP, nao o Excel verbatim'
      : false,
  };
}

function motiFinal(serp, inf, confirm) {
  if (confirm.status === 'confirmado_site') return confirm.motivo || '';
  if (serp.error && serp.motivo) return serp.motivo;
  if (confirm.motivo && confirm.motivo !== 'ddg_sem_url_oficial' && confirm.motivo !== 'serper_sem_url_oficial') {
    return confirm.motivo;
  }
  if (!inf.fabricante_inferido) {
    return serp.hits?.length ? 'serp_sem_fabricante_claro' : serp.motivo || 'serper_sem_resultados';
  }
  if (!inf.urls_oficiais.length) return 'serp_sem_url_oficial_no_fabricante';
  return confirm.motivo || 'nao_confirmado';
}

function loadSweepMap() {
  if (!fs.existsSync(SWEEP_PATH)) return new Map();
  const j = JSON.parse(fs.readFileSync(SWEEP_PATH, 'utf8'));
  return new Map((j.itens || []).map((i) => [String(i.codigo), i]));
}

async function trySweepOfficialUrl(item, sweepRow) {
  const url = sweepRow?.url_oficial?.trim();
  if (!url) return null;
  const off = matchOfficial(hostOf(url));
  if (!off) return null;
  const res = await confirmarSite(url, off, item);
  if (res.status === 'confirmado_site') {
    return { ...res, match_metodo: 'sweep_url_oficial_revalidado' };
  }
  return res;
}

function mdReport(summary) {
  const buscador = summary.buscador || SEARCH_PROVIDER;
  let md = `# PagLeve — pipeline ${buscador}\n\n`;
  md += `Metodologia: Excel Casa Israel verbatim → **${buscador}** → fabricante → site oficial + foto.\n\n`;
  md += `**Excel:** \`${EXCEL}\`  \n**Entrada:** \`${LISTA}\`  \n**JSON:** \`${OUT_JSON}\`  \n\n`;
  md += `**Resumo:** ${summary.confirmados_site}/${summary.total} confirmados · ${summary.com_foto} com foto · ${summary.sem_match} sem match\n\n`;
  md += `| Código | Lote | Fabricante | Status | URL | Fotos | Motivo |\n`;
  md += `|--------|------|------------|--------|-----|-------|--------|\n`;
  for (const it of summary.itens) {
    md += `| **${it.codigo}** | ${it.lote} | ${it.fabricante_inferido || '—'} | ${it.status} | ${it.produto_url ? `[link](${it.produto_url})` : '—'} | ${it.imagens_count ?? 0} | ${it.motivo || '—'} |\n`;
  }
  return md;
}

async function main() {
  if (SEARCH_PROVIDER === 'serper' && !SERPER_API_KEY) {
    console.error('SERPER_API_KEY em falta. Defina no ambiente do agente ou PAGLEVE_SEARCH_PROVIDER=ddg.');
    process.exit(2);
  }

  const items = JSON.parse(fs.readFileSync(LISTA, 'utf8'));
  const sweepMap = loadSweepMap();
  let ddg;
  if (SEARCH_PROVIDER === 'ddg') {
    ddg = await loadDdgSearch();
  }

  const report = [];
  let n = 0;
  try {
    for (const item of items) {
      n++;
      const queryExcel = excelQuery(item.medida, item.desc_excel);
      const queryCompact = compactQuery(item.medida, item.desc_excel);
      const serp =
        SEARCH_PROVIDER === 'ddg' ? await ddg.search(queryExcel, queryCompact) : await searchSerper(queryExcel, queryCompact);
      const inf = inferFromHits(serp, item);
      const erp_audit = erpDiverge(item);

      let confirm = {
        status: 'nao_encontrado',
        motivo: serp.motivo || 'serp_sem_url_oficial',
        produto_url: '',
        imagens_count: 0,
        imagens: [],
      };

      for (const cand of inf.urls_oficiais.slice(0, 6)) {
        const tryConfirm = await confirmarSite(cand.url, cand, item);
        if (tryConfirm.status === 'confirmado_site') {
          confirm = tryConfirm;
          break;
        }
        if (!confirm.produto_url) confirm = { ...tryConfirm, motivo: tryConfirm.motivo };
      }

      if (confirm.status !== 'confirmado_site') {
        const sweepTry = await trySweepOfficialUrl(item, sweepMap.get(String(item.codigo)));
        if (sweepTry?.status === 'confirmado_site') confirm = sweepTry;
        else if (sweepTry?.produto_url && !confirm.produto_url) confirm = { ...sweepTry, motivo: sweepTry.motivo };
      }

      const motivo = motiFinal(serp, inf, confirm);

      report.push({
        codigo: item.codigo,
        lote: item.lote,
        medida: item.medida,
        desc_excel: item.desc_excel,
        desc_erp: item.desc_erp,
        erp_audit,
        serp: {
          query_excel: queryExcel,
          query_compact: queryCompact,
          query_usada: serp.query_usada || serp.query,
          fonte: serp.fonte,
          error: !!serp.error,
          hits: (serp.hits || []).slice(0, 10).map((h) => ({
            url: typeof h === 'string' ? h : h.url,
            title: h.title,
          })),
          hits_count: serp.hits?.length || 0,
          fabricante_votes: inf.fabricante_votes,
        },
        fabricante_inferido: inf.fabricante_inferido,
        status: confirm.status,
        motivo,
        produto_url: confirm.produto_url || '',
        nome_no_site: confirm.nome_no_site || '',
        fabricante_grupo: confirm.fabricante_grupo || inf.fabricante_inferido || '',
        imagens_count: confirm.imagens_count ?? 0,
        imagens: (confirm.imagens || []).slice(0, 6).map((i) => i.url || i),
        ficha: confirm.ficha || {},
        pipeline: SEARCH_PROVIDER === 'serper' ? 'excel_serper_oficial_v1' : 'excel_ddg_oficial_v1',
      });

      console.log(
        `[${n}/${items.length}]`,
        item.codigo,
        confirm.status,
        inf.fabricante_inferido || '—',
        confirm.imagens_count ?? 0,
      );
      await sleepP(SLEEP_MS);
    }
  } finally {
    if (ddg?.browser) await ddg.browser.close();
  }

  const summary = {
    geradoEm: new Date().toISOString(),
    metodologia: `excel_verbatim → ${SEARCH_PROVIDER} → site_oficial`,
    buscador: SEARCH_PROVIDER === 'serper' ? 'serper.dev (google organic)' : 'lite.duckduckgo.com (playwright)',
    excel_arquivo: EXCEL,
    lista_entrada: LISTA,
    total: report.length,
    confirmados_site: report.filter((r) => r.status === 'confirmado_site').length,
    com_foto: report.filter((r) => r.status === 'confirmado_site' && r.imagens_count > 0).length,
    sem_match: report.filter((r) => r.status !== 'confirmado_site').length,
    erp_diverge_count: report.filter((r) => r.erp_audit?.diverge).length,
    itens: report,
  };

  fs.mkdirSync(ART, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
  fs.writeFileSync(OUT_MD, mdReport(summary));
  console.log('Done', {
    confirmados: summary.confirmados_site,
    com_foto: summary.com_foto,
    sem_match: summary.sem_match,
    out: OUT_JSON,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});