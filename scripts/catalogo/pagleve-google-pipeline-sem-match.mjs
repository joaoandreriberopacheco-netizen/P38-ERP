#!/usr/bin/env node
/**
 * PagLeve diagnóstico: Excel verbatim → DuckDuckGo Lite (Playwright/Chromium) → site oficial → foto.
 * Não altera CSV/catálogo. Sem cache SERP / sem Google.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { setTimeout as sleepP } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { extractFichaFromOfficialSite } from '../lib/pagleveFichaFromSite.mjs';
import { stripAccents } from '../lib/formigresCatalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
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
const EXCEL = 'docs/ESTOQUE PARA CASA ISRAEL ATE 19112026.XLSX';
const SLEEP_MS = Number(process.env.PAGLEVE_DDG_SLEEP_MS || process.env.PAGLEVE_GOOGLE_SLEEP_MS || 4000);
const CAPTCHA_BACKOFF_MS = Number(process.env.PAGLEVE_DDG_CAPTCHA_BACKOFF_MS || 45000);
const DDG_HEADLESS = process.env.PAGLEVE_DDG_HEADLESS === '1';

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

/** Query de relatório: medida com "por" + descrição verbatim do Excel. */
function excelQuery(medida, desc) {
  const m = String(medida || '')
    .replace(/x/gi, ' por ')
    .replace(/X/g, ' por ');
  return `${m} ${desc || ''}`.replace(/\s+/g, ' ').trim();
}

/** Query curta para o motor DDG (medida + tokens modelo). */
function ddgCompactQuery(medida, desc) {
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

async function launchDdgBrowser() {
  const browser = await chromium.launch({
    headless: DDG_HEADLESS,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  return { browser, page };
}

async function parseDdgHits(page) {
  return page.$$eval('a', (anchors) => {
    const out = [];
    const seen = new Set();
    for (const a of anchors) {
      let href = a.href || '';
      if (!href.startsWith('http')) continue;
      try {
        const u = new URL(href);
        if (/duckduckgo\.com/i.test(u.hostname)) continue;
        const key = u.origin + u.pathname;
        if (seen.has(key)) continue;
        seen.add(key);
        const title = (a.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120);
        if (title.length < 2) continue;
        out.push({ url: href.split('#')[0], title });
      } catch {
        /* */
      }
    }
    return out.slice(0, 25);
  });
}

function bodyIsCaptcha(bodyText) {
  return /anomaly-modal|Select all squares containing a duck|challenge-form/i.test(bodyText);
}

async function ensureDdgHome(page) {
  const hasQ = (await page.locator('input[name="q"]').count()) > 0;
  if (page.url().includes('lite.duckduckgo.com/lite') && hasQ && !bodyIsCaptcha(await page.locator('body').innerText().catch(() => ''))) {
    return;
  }
  await page.goto('https://lite.duckduckgo.com/lite/', { waitUntil: 'domcontentloaded', timeout: 60000 });
}

async function ddgSearchOnce(page, query) {
  await ensureDdgHome(page);
  const body0 = await page.locator('body').innerText().catch(() => '');
  if (bodyIsCaptcha(body0)) {
    return { query, hits: [], captcha: true, motivo: 'ddg_captcha_bot' };
  }
  const qLoc = page.locator('input[name="q"]').first();
  if (!(await qLoc.count())) {
    return { query, hits: [], captcha: true, motivo: 'ddg_captcha_sem_campo_busca' };
  }
  await qLoc.fill(query);
  await Promise.all([page.waitForNavigation({ timeout: 45000 }).catch(() => null), page.keyboard.press('Enter')]);
  await sleepP(800);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hits = await parseDdgHits(page);
  const captcha = bodyIsCaptcha(bodyText) && !hits.length;
  if (captcha) {
    return { query, hits: [], captcha: true, motivo: 'ddg_captcha_bot' };
  }
  return { query, hits, captcha: false, motivo: hits.length ? '' : 'ddg_sem_resultados' };
}

async function searchDuckDuckGo(page, queryExcel, queryCompact) {
  const attempts = [queryCompact, queryExcel].filter((q, i, arr) => q && arr.indexOf(q) === i);
  let last = {
    query: queryCompact,
    hits: [],
    captcha: false,
    motivo: 'ddg_sem_resultados',
    fonte: 'ddg_lite_playwright',
  };
  for (const query of attempts) {
    let res = await ddgSearchOnce(page, query);
    if (res.captcha) {
      await sleepP(CAPTCHA_BACKOFF_MS);
      await page.goto('https://lite.duckduckgo.com/lite/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      res = await ddgSearchOnce(page, query);
    }
    last = {
      ...res,
      fonte: 'ddg_lite_playwright',
      query_usada: query,
      query_excel: queryExcel,
      query_compact: queryCompact,
    };
    if (res.hits.length) break;
    if (res.captcha) break;
    await sleepP(500);
  }
  return last;
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

function mdReport(summary) {
  let md = `# PagLeve — 30 sem match (lotes 8–17) — pipeline DuckDuckGo\n\n`;
  md += `Metodologia: Excel Casa Israel verbatim → **DuckDuckGo Lite (Playwright/Chromium)** → fabricante → site oficial + foto.\n\n`;
  md += `**Excel:** \`${EXCEL}\`  \n**Entrada:** \`${LISTA}\`  \n**JSON:** \`${OUT_JSON}\`  \n\n`;
  md += `## Causa raiz (cascata v3 / lotes 8–17)\n\n`;
  md += `A cascata antiga lia \`descricao_erp\` / \`modelo\` do CSV, não o Excel. Ex.: **31929** — Excel *Ladrilho Red MRU 39×75* vs ERP *Branco Neve 38×75* → \`nenhum_fabricante_confirmou\`. Com ERP alinhado, ainda falha por limitações de slug/snapshot (Fioranno 57×57 em PDF, Carmelo Plus 90×90, Rocha 61×116 por ID).\n\n`;
  md += `**Resumo:** ${summary.confirmados_site}/${summary.total} confirmados · ${summary.com_foto} com foto · ${summary.sem_match} sem match\n\n`;
  md += `| Código | Lote | Fabricante | Status | URL | Fotos | Motivo |\n`;
  md += `|--------|------|------------|--------|-----|-------|--------|\n`;
  for (const it of summary.itens) {
    md += `| **${it.codigo}** | ${it.lote} | ${it.fabricante_inferido || '—'} | ${it.status} | ${it.produto_url ? `[link](${it.produto_url})` : '—'} | ${it.imagens_count ?? 0} | ${it.motivo || '—'} |\n`;
  }
  return md;
}

async function main() {
  const items = JSON.parse(fs.readFileSync(LISTA, 'utf8'));
  const { browser, page } = await launchDdgBrowser();

  const report = [];
  let n = 0;
  try {
    for (const item of items) {
      n++;
      const queryExcel = excelQuery(item.medida, item.desc_excel);
      const queryCompact = ddgCompactQuery(item.medida, item.desc_excel);
      const ddg = await searchDuckDuckGo(page, queryExcel, queryCompact);
      const inf = inferFromHits(ddg, item);
      const erp_audit = erpDiverge(item);

      let confirm = {
        status: 'nao_encontrado',
        motivo: ddg.captcha ? ddg.motivo : 'ddg_sem_url_oficial',
        produto_url: '',
        imagens_count: 0,
        imagens: [],
      };

      for (const cand of inf.urls_oficiais.slice(0, 4)) {
        const tryConfirm = await confirmarSite(cand.url, cand, item);
        if (tryConfirm.status === 'confirmado_site') {
          confirm = tryConfirm;
          break;
        }
        if (!confirm.produto_url) confirm = { ...tryConfirm, motivo: tryConfirm.motivo };
      }
      if (confirm.status !== 'confirmado_site') {
        if (ddg.captcha) confirm.motivo = ddg.motivo;
        else if (!inf.fabricante_inferido) {
          confirm.motivo = ddg.hits.length ? 'ddg_sem_fabricante_claro' : ddg.motivo || 'ddg_sem_resultados';
        } else if (!inf.urls_oficiais.length) {
          confirm.motivo = 'ddg_sem_url_oficial_no_fabricante';
        }
      }

      report.push({
        codigo: item.codigo,
        lote: item.lote,
        medida: item.medida,
        desc_excel: item.desc_excel,
        desc_erp: item.desc_erp,
        erp_audit,
        ddg: {
          query_excel: queryExcel,
          query_compact: queryCompact,
          query_usada: ddg.query_usada || ddg.query,
          fonte: ddg.fonte,
          captcha: !!ddg.captcha,
          hits: (ddg.hits || []).slice(0, 10).map((h) => (typeof h === 'string' ? h : h.url)),
          hits_count: ddg.hits?.length || 0,
          fabricante_votes: inf.fabricante_votes,
        },
        fabricante_inferido: inf.fabricante_inferido,
        status: confirm.status,
        motivo: confirm.motivo || (confirm.status === 'confirmado_site' ? '' : 'nao_confirmado'),
        produto_url: confirm.produto_url || '',
        nome_no_site: confirm.nome_no_site || '',
        fabricante_grupo: confirm.fabricante_grupo || inf.fabricante_inferido || '',
        imagens_count: confirm.imagens_count ?? 0,
        imagens: (confirm.imagens || []).slice(0, 6).map((i) => i.url || i),
        ficha: confirm.ficha || {},
        pipeline: 'excel_ddg_oficial_v1',
      });

      console.log(
        `[${n}/${items.length}]`,
        item.codigo,
        confirm.status,
        inf.fabricante_inferido || '—',
        confirm.imagens_count ?? 0,
        ddg.captcha ? 'CAPTCHA' : '',
      );
      await sleepP(SLEEP_MS);
    }
  } finally {
    await browser.close();
  }

  const summary = {
    geradoEm: new Date().toISOString(),
    metodologia: 'excel_verbatim → duckduckgo_lite_playwright → site_oficial',
    buscador: 'lite.duckduckgo.com (playwright/chromium, headless=' + DDG_HEADLESS + ')',
    excel_arquivo: EXCEL,
    lista_entrada: LISTA,
    total: report.length,
    confirmados_site: report.filter((r) => r.status === 'confirmado_site').length,
    com_foto: report.filter((r) => r.status === 'confirmado_site' && r.imagens_count > 0).length,
    sem_match: report.filter((r) => r.status !== 'confirmado_site').length,
    erp_diverge_count: report.filter((r) => r.erp_audit?.diverge).length,
    ddg_captcha_count: report.filter((r) => r.ddg?.captcha).length,
    causa_raiz: {
      titulo: 'Cascata antiga usava ERP/CSV, não Excel verbatim',
      exemplos: report.filter((r) => r.erp_audit?.diverge).map((r) => ({ codigo: r.codigo, excel: r.desc_excel, erp: r.desc_erp })),
    },
    itens: report,
  };

  fs.mkdirSync(ART, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
  fs.writeFileSync(OUT_MD, mdReport(summary));
  console.log('Done', {
    confirmados: summary.confirmados_site,
    com_foto: summary.com_foto,
    sem_match: summary.sem_match,
    ddg_captcha: summary.ddg_captcha_count,
    out: OUT_JSON,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});