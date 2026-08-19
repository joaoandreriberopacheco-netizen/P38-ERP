#!/usr/bin/env node
/**
 * Monitor de uso Supabase P38 — proxy local para egress (PostgREST) e Storage.
 *
 * O dashboard Supabase mostra GB de egress; esta ferramenta mede o que podemos
 * ver via API + Postgres: pedidos REST, tamanho das tabelas e ficheiros Storage.
 *
 * Uso:
 *   npm run monitor:supabase-usage
 *   npm run monitor:supabase-usage -- --json
 *
 * Histórico local (não commitado): monitoring/supabase-usage-history.jsonl
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';
import { P38_CANONICAL_PROJECT_REF } from './p38-secrets.mjs';

const ROOT = process.cwd();
const HISTORY_PATH = path.join(ROOT, 'monitoring', 'supabase-usage-history.jsonl');
const FREE_EGRESS_GB = 5;

const HEAVY_TABLES = [
  'lancamento_financeiro',
  'movimentacao_estoque',
  'pedido_venda',
  'rascunho_pedido_venda',
  'produto',
  'pedido_venda_item',
  'terceiro',
  'movimentos_caixa',
];

function fmtMb(bytes) {
  return `${(Number(bytes) / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtGb(bytes) {
  return `${(Number(bytes) / (1024 * 1024 * 1024)).toFixed(3)} GB`;
}

async function fetchAnalytics(projectRef, accessToken, endpoint) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/${endpoint}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const body = await res.json();
  return { ok: true, body };
}

function summarizeApiCounts(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return { buckets: 0, rest: 0, storage: 0, auth: 0, from: null, to: null };
  }
  const totals = { rest: 0, storage: 0, auth: 0, realtime: 0 };
  for (const row of result) {
    totals.rest += row.total_rest_requests || 0;
    totals.storage += row.total_storage_requests || 0;
    totals.auth += row.total_auth_requests || 0;
    totals.realtime += row.total_realtime_requests || 0;
  }
  return {
    buckets: result.length,
    ...totals,
    from: result[0]?.timestamp,
    to: result[result.length - 1]?.timestamp,
  };
}

async function collectDbMetrics(databaseUrl) {
  const client = new pg.Client({
    connectionString: databaseUrl.trim(),
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  try {
    const tableSizes = await client.query(`
      select relname as table_name,
        pg_total_relation_size(quote_ident(relname)::regclass)::bigint as bytes,
        n_live_tup::bigint as live_rows
      from pg_stat_user_tables
      where schemaname = 'public'
        and relname = any($1::text[])
      order by bytes desc
    `, [HEAVY_TABLES]);

    const storage = await client.query(`
      select bucket_id,
        count(*)::int as files,
        coalesce(sum((metadata->>'size')::bigint), 0)::bigint as bytes
      from storage.objects
      group by bucket_id
      order by bytes desc
    `);

    const produtoImagem = await client.query(`
      select count(*)::int as total,
        count(*) filter (where url like '%supabase%')::int as supabase_urls,
        count(*) filter (where fonte = 'formigres')::int as formigres_urls
      from public.produto_imagem
      where ativo = true
    `);

    const totalHeavyBytes = tableSizes.rows.reduce((sum, r) => sum + Number(r.bytes), 0);
    const totalStorageBytes = storage.rows.reduce((sum, r) => sum + Number(r.bytes), 0);

    return {
      tables: tableSizes.rows.map((r) => ({
        table: r.table_name,
        bytes: Number(r.bytes),
        live_rows: Number(r.live_rows),
      })),
      storage_buckets: storage.rows.map((r) => ({
        bucket: r.bucket_id,
        files: r.files,
        bytes: Number(r.bytes),
      })),
      produto_imagem: produtoImagem.rows[0],
      totals: {
        heavy_tables_bytes: totalHeavyBytes,
        storage_bytes: totalStorageBytes,
        full_list_pull_estimate_bytes: totalHeavyBytes,
      },
    };
  } finally {
    await client.end();
  }
}

function loadPreviousSnapshot() {
  if (!fs.existsSync(HISTORY_PATH)) return null;
  try {
    const lines = fs.readFileSync(HISTORY_PATH, 'utf8').trim().split('\n').filter(Boolean);
    if (!lines.length) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function appendSnapshot(snapshot) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.appendFileSync(HISTORY_PATH, `${JSON.stringify(snapshot)}\n`, 'utf8');
}

function printReport(snapshot, previous, asJson) {
  if (asJson) {
    console.log(JSON.stringify({ current: snapshot, previous }, null, 2));
    return;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  P38 — Monitor Supabase (egress / PostgREST)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Projecto: ${snapshot.project_ref} (${snapshot.project_name || 'P38'})`);
  console.log(`  Quota Free egress (org): ${FREE_EGRESS_GB} GB / ciclo`);
  console.log(`  Snapshot: ${snapshot.at}`);
  console.log('');

  console.log('── API (proxy actividade PostgREST) ──');
  if (snapshot.analytics.rest_requests_total != null) {
    console.log(`  Pedidos REST (total projecto): ${snapshot.analytics.rest_requests_total.toLocaleString('pt-BR')}`);
  }
  const counts = snapshot.analytics.api_counts_window;
  if (counts?.buckets > 0) {
    console.log(
      `  Janela recente (${counts.from} → ${counts.to}): REST ${counts.rest}, Storage ${counts.storage}, Auth ${counts.auth}`
    );
  } else {
    console.log('  Janela api-counts: sem dados recentes na API');
  }
  console.log('  Nota: GB de egress só no dashboard → Usage → Egress (PostgREST vs Storage)');
  console.log('');

  console.log('── Tabelas pesadas (se list() sem limite = JSON grande) ──');
  for (const t of snapshot.db.tables) {
    console.log(`  ${t.table}: ${t.live_rows.toLocaleString('pt-BR')} linhas · ${fmtMb(t.bytes)}`);
  }
  console.log(
    `  Estimativa “puxar tudo” nas tabelas acima: ${fmtMb(snapshot.db.totals.heavy_tables_bytes)} (${fmtGb(snapshot.db.totals.heavy_tables_bytes)})`
  );
  console.log('');

  console.log('── Storage (egress ao baixar ficheiros) ──');
  if (snapshot.db.storage_buckets.length === 0) {
    console.log('  Sem ficheiros em storage.objects');
  } else {
    for (const b of snapshot.db.storage_buckets) {
      console.log(`  ${b.bucket}: ${b.files} ficheiros · ${fmtMb(b.bytes)}`);
    }
    console.log(`  Total Storage: ${fmtMb(snapshot.db.totals.storage_bytes)}`);
  }
  console.log('');

  console.log('── Imagens produto ──');
  const pi = snapshot.db.produto_imagem;
  console.log(
    `  produto_imagem: ${pi.total} URLs (${pi.formigres_urls} Formigres externo, ${pi.supabase_urls} Supabase)`
  );
  console.log('  Fotos Formigres no browser → egress Formigres, não PostgREST');
  console.log('');

  if (previous) {
    const days = (new Date(snapshot.at) - new Date(previous.at)) / (1000 * 60 * 60 * 24);
    const restDelta = snapshot.analytics.rest_requests_total - (previous.analytics?.rest_requests_total || 0);
    const heavyDelta = snapshot.db.totals.heavy_tables_bytes - (previous.db?.totals?.heavy_tables_bytes || 0);
    console.log('── Delta vs snapshot anterior ──');
    console.log(`  Período: ${days.toFixed(1)} dias`);
    if (restDelta >= 0) console.log(`  Pedidos REST: +${restDelta.toLocaleString('pt-BR')}`);
    console.log(`  Tabelas pesadas (tamanho BD): ${heavyDelta >= 0 ? '+' : ''}${fmtMb(heavyDelta)}`);
    console.log('');
  }

  console.log('── Checklist manual (dashboard) ──');
  console.log('  1. Usage → Egress → ver % PostgREST vs Storage');
  console.log('  2. Billing → MB/GB restantes no ciclo');
  console.log('  3. Repetir: npm run monitor:supabase-usage');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

async function main() {
  const asJson = process.argv.includes('--json');
  const { databaseUrl, accessToken, projectRef } = resolveSupabaseDeployEnv();

  if (!databaseUrl) {
    console.error('[monitor] DATABASE_URL em falta');
    process.exit(1);
  }
  if (!accessToken) {
    console.error('[monitor] SUPABASE_ACCESS_TOKEN em falta');
    process.exit(1);
  }

  const ref = projectRef || P38_CANONICAL_PROJECT_REF;
  let projectName = 'P38';
  try {
    const pr = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (pr.ok) {
      const p = await pr.json();
      projectName = p.name || projectName;
    }
  } catch {
    /* ignore */
  }

  const apiCounts = await fetchAnalytics(ref, accessToken, 'usage.api-counts');
  const apiRequests = await fetchAnalytics(ref, accessToken, 'usage.api-requests-count');

  const countsBody = apiCounts.ok ? apiCounts.body?.result : null;
  const requestsBody = apiRequests.ok ? apiRequests.body?.result : null;

  const db = await collectDbMetrics(databaseUrl);

  const snapshot = {
    at: new Date().toISOString(),
    project_ref: ref,
    project_name: projectName,
    analytics: {
      rest_requests_total: requestsBody?.[0]?.count ?? null,
      api_counts_window: summarizeApiCounts(countsBody),
    },
    db,
  };

  const previous = loadPreviousSnapshot();
  appendSnapshot(snapshot);
  printReport(snapshot, previous, asJson);
}

main().catch((err) => {
  console.error('[monitor]', err.message || err);
  process.exit(1);
});
