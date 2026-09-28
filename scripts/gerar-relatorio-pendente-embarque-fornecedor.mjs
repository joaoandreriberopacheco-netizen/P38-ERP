#!/usr/bin/env node
/**
 * Relatório saldo pós-embarque (fornecedor) — dados **Supabase** (Postgres).
 * Não usa Base44.
 *
 * Uso:
 *   npm run compras:relatorio-pendente-fornecedor
 *   npm run compras:relatorio-pendente-fornecedor -- --fornecedor=tintão --pdf
 *
 * Requer Supabase: DATABASE_URL **ou** SUPABASE_SERVICE_ROLE_KEY + project ref (REST).
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets, P38_CANONICAL_PROJECT_REF } from './p38-secrets.mjs';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import { hydrateProdutoFromSupabaseRow } from '../src/lib/produtoSupabaseHydrate.js';
import {
  buildRelatorioPendenteEmbarqueFornecedor,
  renderRelatorioPendenteEmbarqueFornecedorHtml,
  RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT,
} from '../src/lib/relatorioPendenteEmbarqueFornecedor.js';

const OUT_DIR_DEFAULT = path.join(process.cwd(), 'docs', 'imports-local', 'pendente-embarque-fornecedor');

function resolveOutDir(fornecedorNorm = '') {
  if (String(fornecedorNorm || '').trim().toLowerCase().includes('tint')) {
    return path.join(process.cwd(), 'docs', 'exports', 'Tintao');
  }
  return OUT_DIR_DEFAULT;
}

function parseArgs(argv) {
  const desdeArg = argv.find((a) => a.startsWith('--desde='));
  const fornecedorArg = argv.find((a) => a.startsWith('--fornecedor='));
  return {
    dataMin: desdeArg?.slice('--desde='.length) || RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT,
    fornecedor: fornecedorArg?.slice('--fornecedor='.length) || '',
    json: argv.includes('--json'),
    htmlOnly: argv.includes('--html'),
    pdf: argv.includes('--pdf'),
    incluirAguardandoEmbarque: argv.includes('--incluir-aguardando-embarque'),
    somentePosEmbarque: argv.includes('--so-pos-embarque'),
  };
}

function resolveDataEmissaoRow(row = {}) {
  const raw = row.data_emissao
    ? String(row.data_emissao).slice(0, 10)
    : String(row?.dados?.data_emissao || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function filterPedidosRowsPorDataMin(rows = [], dataMin = '') {
  if (!dataMin) return rows;
  return rows.filter((row) => {
    const d = resolveDataEmissaoRow(row);
    return d && d >= dataMin;
  });
}

function requireDatabaseUrl() {
  loadDotEnvFiles();
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl?.trim()) return null;
  return dbUrl.trim();
}

async function createSupabaseAdminClient() {
  loadDotEnvFiles();
  const secrets = resolveP38Secrets('cloud-agent');
  const url =
    secrets.supabaseUrl
    || process.env.VITE_SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || (secrets.projectRef || P38_CANONICAL_PROJECT_REF
      ? `https://${secrets.projectRef || P38_CANONICAL_PROJECT_REF}.supabase.co`
      : '');
  const key = secrets.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[P38] Supabase em falta: SUPABASE_SERVICE_ROLE_KEY + URL (ou project ref).');
    console.error('Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchInChunks(sb, table, column, ids, select = '*') {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const rows = [];
  for (let i = 0; i < unique.length; i += 80) {
    const slice = unique.slice(i, i + 80);
    const { data, error } = await sb.from(table).select(select).in(column, slice);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
  }
  return rows;
}

function buildBundleFromRows(pedidosRows, pciRows, embRows, eiRows, produtoRows = []) {
  const produtosMap = {};
  for (const row of produtoRows) {
    produtosMap[row.id] = mapProdutoRow(row);
  }

  const itensPorPedido = new Map();
  for (const item of pciRows) {
    const pid = item.pedido_compra_id;
    if (!itensPorPedido.has(pid)) itensPorPedido.set(pid, []);
    itensPorPedido.get(pid).push(pedidoCompraItemToLegacyMirror(item));
  }

  const pedidos = pedidosRows.map((row) =>
    mapPedidoFromSqlRow(row, itensPorPedido.get(row.id) || []),
  );

  const embIds = embRows.map((r) => r.id);
  const linhasPorEmb = new Map();
  for (const eid of embIds) linhasPorEmb.set(eid, []);
  for (const ei of eiRows) {
    const eid = ei.embarque_id;
    if (!linhasPorEmb.has(eid)) linhasPorEmb.set(eid, []);
    linhasPorEmb.get(eid).push(ei);
  }

  const embarquesDb = embRows.map((row) => {
    const pedidoItens = itensPorPedido.get(row.pedido_compra_id) || [];
    const raw = linhasPorEmb.get(row.id) || [];
    const mirror = rebuildEmbarqueItensMirror(raw).map((linha) =>
      enrichEmbarqueMirrorFromPedidoItens(linha, pedidoItens),
    );
    return mapEmbarqueFromSqlRow(row, mirror);
  });

  if (!produtoRows.length) {
    const produtoIds = [
      ...new Set([
        ...pciRows.map((i) => i.produto_id).filter(Boolean),
        ...eiRows.map((i) => i.produto_id).filter(Boolean),
      ]),
    ];
    for (const id of produtoIds) {
      if (!produtosMap[id]) produtosMap[id] = { id, unidades: [] };
    }
  }

  return { pedidos, embarquesDb, produtosMap };
}

function mapPedidoFromSqlRow(row, itens = []) {
  const dados = row.dados || {};
  return {
    id: row.id,
    numero: row.numero || dados.numero,
    fornecedor_id: row.fornecedor_id || dados.fornecedor_id,
    fornecedor_nome: row.fornecedor_nome || dados.fornecedor_nome,
    data_emissao: row.data_emissao
      ? String(row.data_emissao).slice(0, 10)
      : dados.data_emissao,
    status: row.status || dados.status,
    status_recebimento_geral: row.status_recebimento_geral || dados.status_recebimento_geral,
    valor_total: row.valor_total ?? dados.valor_total,
    itens,
    created_date: row.created_at || dados.created_date,
  };
}

function mapEmbarqueFromSqlRow(row, linhasMirror = []) {
  const dados = row.dados || {};
  return {
    id: row.id,
    pedido_compra_id: row.pedido_compra_id,
    numero: row.numero || dados.numero,
    codigo_exibicao: row.codigo_exibicao || dados.codigo_exibicao,
    tipo: row.tipo || dados.tipo,
    status: row.status || dados.status,
    status_recebimento: row.status_recebimento || dados.status_recebimento,
    status_recebimento_embarque: row.status_recebimento_embarque || dados.status_recebimento_embarque,
    data_embarque: row.data_embarque || dados.data_embarque,
    eta: row.eta || dados.eta,
    transportadora_id: row.transportadora_id || dados.transportadora_id,
    transportadora_nome: row.transportadora_nome || dados.transportadora_nome,
    observacoes: row.observacoes || dados.observacoes,
    created_date: row.created_at || dados.created_date,
    _linhas: linhasMirror,
    _itens_fonte: 'sql',
  };
}

function mapProdutoRow(row) {
  return hydrateProdutoFromSupabaseRow(row);
}

async function fetchProdutosMap(client, produtoIds = []) {
  const ids = [...new Set(produtoIds.filter(Boolean))];
  const map = {};
  if (!ids.length) return map;

  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { rows } = await client.query(
      `select id, nome, unidade_principal, unidade_vitrine, unidades_alternativas, unidades,
              valor_compra, dados
       from public.produto where id = any($1::text[])`,
      [slice],
    );
    for (const row of rows) {
      map[row.id] = mapProdutoRow(row);
    }
  }
  return map;
}

/** Postgres directo (preferido local). */
async function fetchFromSupabasePg(dataMin) {
  const dbUrl = requireDatabaseUrl();
  if (!dbUrl) throw new Error('NO_DATABASE_URL');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows: pedidosRows } = await client.query(
      `select id, numero, fornecedor_id, fornecedor_nome, data_emissao, status,
              status_recebimento_geral, valor_total, dados, created_at
       from public.pedido_compra
       where coalesce(data_emissao,
         case when dados->>'data_emissao' ~ '^\\d{4}-\\d{2}-\\d{2}'
           then left(dados->>'data_emissao', 10)::date else null end
       ) >= $1::date
       and coalesce(status, dados->>'status', '') not in ('Rascunho', 'Cancelado')
       order by fornecedor_nome, data_emissao, numero`,
      [dataMin],
    );

    if (!pedidosRows.length) {
      return { pedidos: [], embarquesDb: [], produtosMap: {} };
    }

    const pedidoIds = pedidosRows.map((r) => r.id);
    const { rows: pciRows } = await client.query(
      `select * from public.pedido_compra_item
       where pedido_compra_id = any($1::text[])
       order by pedido_compra_id, ordem nulls last, created_at`,
      [pedidoIds],
    );

    const { rows: embRows } = await client.query(
      `select * from public.embarque where pedido_compra_id = any($1::text[]) order by created_at`,
      [pedidoIds],
    );
    const embIds = embRows.map((r) => r.id);
    const { rows: eiRows } = embIds.length
      ? await client.query(`select * from public.embarque_item where embarque_id = any($1::text[])`, [embIds])
      : { rows: [] };

    const produtoIds = [
      ...new Set([
        ...pciRows.map((i) => i.produto_id).filter(Boolean),
        ...eiRows.map((i) => i.produto_id).filter(Boolean),
      ]),
    ];
    const produtosMap = await fetchProdutosMap(client, produtoIds);
    const bundle = buildBundleFromRows(pedidosRows, pciRows, embRows, eiRows);
    bundle.produtosMap = { ...bundle.produtosMap, ...produtosMap };
    return bundle;
  } finally {
    await client.end();
  }
}

/** REST API (Cloud Agent quando pooler IPv6 falha). */
async function fetchFromSupabaseRest(dataMin) {
  const sb = await createSupabaseAdminClient();
  const { data: pedidosRaw, error } = await sb
    .from('pedido_compra')
    .select('*')
    .gte('data_emissao', dataMin)
    .order('fornecedor_nome', { ascending: true })
    .order('data_emissao', { ascending: true })
    .limit(3000);
  if (error) throw new Error(`pedido_compra: ${error.message}`);

  const pedidosRows = filterPedidosRowsPorDataMin(
    (pedidosRaw || []).filter((p) => {
      const st = String(p?.status || p?.dados?.status || '').trim();
      return st && st !== 'Rascunho' && st !== 'Cancelado';
    }),
    dataMin,
  );

  if (!pedidosRows.length) {
    return { pedidos: [], embarquesDb: [], produtosMap: {} };
  }

  const pedidoIds = pedidosRows.map((r) => r.id);
  const pciRows = await fetchInChunks(sb, 'pedido_compra_item', 'pedido_compra_id', pedidoIds);
  const embRows = await fetchInChunks(sb, 'embarque', 'pedido_compra_id', pedidoIds);
  const embIds = embRows.map((r) => r.id);
  const eiRows = embIds.length
    ? await fetchInChunks(sb, 'embarque_item', 'embarque_id', embIds)
    : [];
  const produtoIds = [
    ...new Set([
      ...pciRows.map((i) => i.produto_id).filter(Boolean),
      ...eiRows.map((i) => i.produto_id).filter(Boolean),
    ]),
  ];
  const produtoRows = produtoIds.length
    ? await fetchInChunks(sb, 'produto', 'id', produtoIds, '*')
    : [];

  return buildBundleFromRows(pedidosRows, pciRows, embRows, eiRows, produtoRows);
}

async function fetchFromSupabase(dataMin) {
  try {
    const bundle = await fetchFromSupabasePg(dataMin);
    return { ...bundle, fonte: 'supabase-postgres' };
  } catch (err) {
    const retryRest =
      err?.message === 'NO_DATABASE_URL'
      || err?.code === 'ENETUNREACH'
      || err?.code === 'ECONNREFUSED'
      || err?.code === 'ETIMEDOUT';
    if (!retryRest) throw err;
    console.warn('[P38] Postgres directo indisponível — a usar Supabase REST (service role).');
    const bundle = await fetchFromSupabaseRest(dataMin);
    return { ...bundle, fonte: 'supabase-rest' };
  }
}

async function main() {
  const {
    dataMin,
    fornecedor,
    json,
    htmlOnly,
    pdf,
    incluirAguardandoEmbarque,
    somentePosEmbarque,
  } = parseArgs(process.argv.slice(2));

  const { pedidos, embarquesDb, produtosMap, fonte } = await fetchFromSupabase(dataMin);

  const fornecedorNorm = String(fornecedor || '').trim();
  const isTintExport = fornecedorNorm.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes('tint');
  let somenteSaldoAvaria = true;
  if (incluirAguardandoEmbarque) somenteSaldoAvaria = false;
  else if (somentePosEmbarque) somenteSaldoAvaria = true;
  else if (isTintExport) somenteSaldoAvaria = false;

  const relatorio = buildRelatorioPendenteEmbarqueFornecedor(pedidos, embarquesDb, produtosMap, {
    dataEmissaoMin: dataMin,
    fornecedorNorm: fornecedor,
    somenteSaldoAvaria,
  });

  const outDir = resolveOutDir(fornecedor);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = fornecedor ? `-${fornecedor.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : '';
  const jsonPath = path.join(outDir, `pendente-embarque${suffix}-${stamp}.json`);
  const htmlPath = path.join(outDir, `pendente-embarque${suffix}-${stamp}.html`);

  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify({ ...relatorio, fonte }, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    htmlPath,
    renderRelatorioPendenteEmbarqueFornecedorHtml(relatorio),
    'utf8',
  );

  console.log(`Fonte: ${fonte}`);
  console.log(`Corte de emissão: >= ${dataMin}`);
  console.log(`Pedidos carregados (BD no período): ${pedidos.length}`);
  if (fornecedorNorm) {
    const fn = fornecedorNorm.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const noFiltro = pedidos.filter((p) => {
      const n = String(p.fornecedor_nome || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
      return fn.includes('tint') ? n.includes('tint') : n.includes(fn);
    }).length;
    console.log(`Fornecedor «${fornecedorNorm}»: ${noFiltro} pedido(s) no período`);
  }
  console.log(`Pedidos no relatório: ${relatorio.totalPedidos} · escopo: ${somenteSaldoAvaria ? 'só pós-recepção' : 'todos os pendentes'}`);
  console.log(`Embarques com pendência: ${relatorio.totalEmbarques}`);
  console.log(
    `Total a repor: ${relatorio.totalValorPendente?.toFixed(2)} · `
    + `${relatorio.totalCxPendente} cx avaria / ${relatorio.totalCxPedido} cx pedidas `
    + `(${relatorio.pct_cx_avaria_geral}%)`,
  );
  console.log(`JSON: ${jsonPath}`);
  console.log(`HTML: ${htmlPath}`);

  if (pdf) {
    const { chromium } = await import('playwright');
    const pdfPath = path.join(outDir, `pendente-embarque${suffix}-${stamp}.pdf`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(fs.readFileSync(htmlPath, 'utf8'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
    });
    await browser.close();
    console.log(`PDF: ${pdfPath}`);
    const artifactsDir = '/opt/cursor/artifacts';
    fs.mkdirSync(artifactsDir, { recursive: true });
    const artifactPdf = path.join(artifactsDir, `pendente-embarque-fornecedor${suffix || ''}-${stamp}.pdf`);
    fs.copyFileSync(pdfPath, artifactPdf);
    console.log(`Artifact: ${artifactPdf}`);
  }

  if (json) {
    console.log(JSON.stringify(relatorio, null, 2));
  } else if (!htmlOnly) {
    for (const g of relatorio.fornecedores.slice(0, 8)) {
      console.log(`\n${g.fornecedor}: ${g.pedidos.length} pedido(s) · ${g.valor_pendente.toFixed(2)}`);
      for (const p of g.pedidos.slice(0, 4)) {
        console.log(
          `  ${p.pedido_numero}: ${pctShort(p.pct_valor_pendente_sobre_pedido)} pendente · ${p.linhas.length} linha(s)`,
        );
      }
      if (g.pedidos.length > 4) console.log(`  … +${g.pedidos.length - 4} pedido(s)`);
    }
    if (relatorio.fornecedores.length > 8) {
      console.log(`\n… +${relatorio.fornecedores.length - 8} fornecedor(es) — ver HTML/JSON`);
    }
  }
}

function pctShort(n) {
  return `${Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
