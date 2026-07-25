#!/usr/bin/env node
/**
 * Benchmark catálogo (Produtos): Base44 vs Supabase P38.
 * Mede tempo de API (dados) e, se Playwright disponível, abertura + rolagem na UI.
 *
 * Uso: npm run benchmark:catalogo
 */
import pg from 'pg';
import { performance } from 'node:perf_hooks';
import { loadDotEnvFiles, tryBase44Client } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();

const RUNS = 3;
const BASE44_APP_URL = process.env.P38_BASE44_APP_URL || 'https://p38.base44.app';
const VERCEL_APP_URL = process.env.P38_VERCEL_APP_URL || 'https://p-38erp.vercel.app';

function ms(start, end) {
  return Math.round(end - start);
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    med: sorted[Math.floor(sorted.length / 2)],
    max: sorted.at(-1),
    avg: Math.round(sum / sorted.length),
  };
}

async function timedRuns(label, fn, runs = RUNS) {
  const samples = [];
  let lastCount = 0;
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    const result = await fn();
    const t1 = performance.now();
    samples.push(ms(t0, t1));
    lastCount = result?.count ?? result ?? lastCount;
  }
  return { label, ...stats(samples), count: lastCount, unit: 'ms' };
}

async function fetchBase44Produtos(client) {
  const pageSize = 500;
  const all = [];
  let skip = 0;
  for (let page = 0; page < 40; page += 1) {
    const batch = await client.entities.Produto.list('-created_date', pageSize, skip);
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    skip += pageSize;
  }
  return { count: all.length, rows: all };
}

async function fetchSupabaseProdutosPg(databaseUrl) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select id, nome, ativo, tipo, estoque_atual, dados from public.produto where coalesce(ativo, true) = true and coalesce(tipo, '') <> 'Serviço' order by created_at desc nulls last`
    );
    return { count: rows.length, rows };
  } finally {
    await client.end();
  }
}

async function fetchSupabaseProdutosRest(url, anonKey) {
  const base = url.replace(/\/$/, '');
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  for (let page = 0; page < 50; page += 1) {
    const endpoint =
      `${base}/rest/v1/produto?select=id,nome,ativo,tipo,estoque_atual` +
      `&ativo=eq.true&tipo=neq.Serviço&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) throw new Error(`REST produto ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return { count: all.length, rows: all };
}

async function measureChunkLoad(baseUrl, label) {
  const htmlRes = await fetch(`${baseUrl}/`);
  const html = await htmlRes.text();
  const jsMatch = html.match(/\/assets\/[^"']*Produtos-[^"']+\.js/);
  const indexMatch = html.match(/\/assets\/index-[^"']+\.js/);
  const produtosChunk = jsMatch?.[0];
  const indexChunk = indexMatch?.[0];

  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    if (produtosChunk) {
      await fetch(`${baseUrl}${produtosChunk}`, { cache: 'no-store' });
    } else if (indexChunk) {
      await fetch(`${baseUrl}${indexChunk}`, { cache: 'no-store' });
    }
    samples.push(ms(t0, performance.now()));
  }

  return {
    label: `${label} — download chunk catálogo`,
    ...stats(samples),
    chunk: produtosChunk || indexChunk || '(não encontrado)',
    unit: 'ms',
  };
}

async function measureUiWithPlaywright() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return null;
  }

  const results = [];
  const scenarios = [
    { name: 'Base44 (p38.base44.app)', url: BASE44_APP_URL },
    { name: 'Nova estrutura (Vercel)', url: VERCEL_APP_URL },
  ];

  for (const scenario of scenarios) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      // Abertura: até DOM da rota Produtos (pode redirecionar para login)
      const openSamples = [];
      let landedOn = '';
      for (let i = 0; i < RUNS; i += 1) {
        const t0 = performance.now();
        await page.goto(`${scenario.url}/Produtos`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(500);
        const t1 = performance.now();
        openSamples.push(ms(t0, t1));
        landedOn = page.url();
      }

      // Rolagem: simula utilizador a percorrer o catálogo
      const scrollSamples = [];
      for (let i = 0; i < RUNS; i += 1) {
        await page.goto(`${scenario.url}/Produtos`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const t0 = performance.now();
        for (let step = 0; step < 12; step += 1) {
          await page.mouse.wheel(0, 900);
          await page.waitForTimeout(80);
        }
        const t1 = performance.now();
        scrollSamples.push(ms(t0, t1));
      }

      results.push({
        scenario: scenario.name,
        url: scenario.url,
        landedOn,
        open: stats(openSamples),
        scroll12Steps: stats(scrollSamples),
        note:
          landedOn.includes('/login') || landedOn.includes('auth')
            ? 'Medição inclui redirect para login (sem sessão autenticada)'
            : 'Página Produtos carregada',
      });
    } finally {
      await browser.close();
    }
  }

  return results;
}

function printRow(r) {
  console.log(`  ${r.label}`);
  if (r.count != null) console.log(`    registos: ${r.count}`);
  console.log(`    min ${r.min}ms · mediana ${r.med}ms · média ${r.avg}ms · max ${r.max}ms`);
  if (r.chunk) console.log(`    asset: ${r.chunk}`);
}

async function main() {
  const secrets = resolveP38Secrets();
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Benchmark catálogo — Base44 vs Supabase (P38)');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Corridas por teste: ${RUNS}`);
  console.log('');

  const apiResults = [];

  const b44 = tryBase44Client();
  if (b44) {
    const r = await timedRuns('Base44 API — listar produtos', () => fetchBase44Produtos(b44));
    apiResults.push(r);
  } else {
    console.log('  ⚠ Base44 API — credenciais em falta (VITE_BASE44_APP_ID + BASE44_ACCESS_TOKEN)');
    console.log('');
  }

  if (secrets.databaseUrl) {
    try {
      const r = await timedRuns('Supabase SQL — listar produtos', () =>
        fetchSupabaseProdutosPg(secrets.databaseUrl)
      );
      apiResults.push(r);
    } catch (e) {
      console.log(`  ✗ Supabase SQL falhou: ${e.message}`);
      console.log('');
    }
  }

  if (secrets.viteSupabaseUrl && secrets.viteSupabaseAnonKey) {
    try {
      const r = await timedRuns('Supabase REST (como o browser) — listar produtos', () =>
        fetchSupabaseProdutosRest(secrets.viteSupabaseUrl, secrets.viteSupabaseAnonKey)
      );
      apiResults.push(r);
    } catch (e) {
      console.log(`  ✗ Supabase REST falhou: ${e.message}`);
      console.log('');
    }
  }

  console.log('── Camada de dados (API) ──');
  console.log('');
  if (!apiResults.length) {
    console.log('  Sem resultados — configure secrets e/ou p38-chaves.txt');
  } else {
    for (const r of apiResults) printRow(r);

    if (apiResults.length >= 2) {
      const base = apiResults.find((r) => r.label.startsWith('Base44'));
      const supa =
        apiResults.find((r) => r.label.includes('REST')) ||
        apiResults.find((r) => r.label.includes('SQL'));
      if (base && supa) {
        const diff = base.med - supa.med;
        const faster = diff > 0 ? 'Supabase' : 'Base44';
        console.log('');
        console.log(
          `  → Mediana dados: ${faster} ~${Math.abs(diff)}ms mais rápido (${base.med}ms vs ${supa.med}ms)`
        );
      }
    }
  }

  console.log('');
  console.log('── Assets (chunk JavaScript do catálogo) ──');
  console.log('');
  try {
    const b44Chunk = await measureChunkLoad(BASE44_APP_URL, 'Base44');
    const vercelChunk = await measureChunkLoad(VERCEL_APP_URL, 'Vercel');
    printRow(b44Chunk);
    console.log('');
    printRow(vercelChunk);
    const diff = b44Chunk.med - vercelChunk.med;
    if (diff !== 0) {
      const faster = diff > 0 ? 'Vercel' : 'Base44';
      console.log('');
      console.log(`  → Mediana download chunk: ${faster} ~${Math.abs(diff)}ms mais rápido`);
    }
  } catch (e) {
    console.log(`  ✗ Assets: ${e.message}`);
  }

  console.log('');
  console.log('── UI simulada (Playwright: abrir /Produtos + rolar) ──');
  console.log('');
  const ui = await measureUiWithPlaywright();
  if (!ui) {
    console.log('  (Playwright não instalado — só API/assets. Para UI: npx playwright install chromium)');
  } else {
    for (const u of ui) {
      console.log(`  ${u.scenario}`);
      console.log(`    URL final: ${u.landedOn}`);
      console.log(`    Abertura: min ${u.open.min}ms · mediana ${u.open.med}ms · max ${u.open.max}ms`);
      console.log(
        `    Rolagem (12 passos): min ${u.scroll12Steps.min}ms · mediana ${u.scroll12Steps.med}ms · max ${u.scroll12Steps.max}ms`
      );
      console.log(`    Nota: ${u.note}`);
      console.log('');
    }
    if (ui.length === 2) {
      const diffOpen = ui[0].open.med - ui[1].open.med;
      const diffScroll = ui[0].scroll12Steps.med - ui[1].scroll12Steps.med;
      console.log(
        `  → Abertura: ${diffOpen > 0 ? 'Vercel' : 'Base44'} ~${Math.abs(diffOpen)}ms vs outro (mediana)`
      );
      console.log(
        `  → Rolagem: ${diffScroll > 0 ? 'Vercel' : 'Base44'} ~${Math.abs(diffScroll)}ms vs outro (mediana)`
      );
    }
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Nota: sem login, a UI mede até redirect/login + shell.');
  console.log('  A camada API reflecte melhor o carregamento do catálogo autenticado.');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');
}

main().catch((err) => {
  console.error('[benchmark:catalogo]', err);
  process.exit(1);
});
