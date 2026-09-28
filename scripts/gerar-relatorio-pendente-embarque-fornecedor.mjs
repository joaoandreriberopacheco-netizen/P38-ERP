#!/usr/bin/env node
/**
 * Relatório saldo pós-embarque (fornecedor) — dados **Supabase** (Postgres).
 * Não usa Base44.
 *
 * Uso:
 *   npm run compras:relatorio-pendente-fornecedor
 *   npm run compras:relatorio-pendente-fornecedor -- --fornecedor=tintão --pdf
 *
 * Requer DATABASE_URL (Cursor Cloud / GitHub Actions — ver docs/migration/P38_SECRETS_CANONICOS.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import {
  rebuildEmbarqueItensMirror,
  enrichEmbarqueMirrorFromPedidoItens,
} from '../src/lib/embarqueItemContract.js';
import {
  buildRelatorioPendenteEmbarqueFornecedor,
  renderRelatorioPendenteEmbarqueFornecedorHtml,
  RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT,
} from '../src/lib/relatorioPendenteEmbarqueFornecedor.js';

const OUT_DIR = path.join(process.cwd(), 'docs', 'imports-local', 'pendente-embarque-fornecedor');

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
  };
}

function requireDatabaseUrl() {
  loadDotEnvFiles();
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl?.trim()) {
    console.error('[P38] DATABASE_URL em falta — relatório lê pedidos/embarques directo do Supabase Postgres.');
    console.error('Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
    console.error('(Base44 não faz parte deste fluxo.)');
    process.exit(1);
  }
  return dbUrl.trim();
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
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  let unidades = row.unidades ?? dados.unidades;
  if (typeof unidades === 'string') {
    try {
      unidades = JSON.parse(unidades);
    } catch {
      unidades = [];
    }
  }
  return {
    id: row.id,
    nome: row.nome || dados.nome,
    unidades: Array.isArray(unidades) ? unidades : [],
    ...dados,
  };
}

async function fetchProdutosMap(client, produtoIds = []) {
  const ids = [...new Set(produtoIds.filter(Boolean))];
  const map = {};
  if (!ids.length) return map;

  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { rows } = await client.query(
      `select id, nome, unidades, dados from public.produto where id = any($1::text[])`,
      [slice],
    );
    for (const row of rows) {
      map[row.id] = mapProdutoRow(row);
    }
  }
  return map;
}

/** Carga completa a partir do Postgres Supabase (text ids). */
async function fetchFromSupabase(dataMin) {
  const dbUrl = requireDatabaseUrl();
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

    const itensPorPedido = new Map();
    for (const item of pciRows) {
      const pid = item.pedido_compra_id;
      if (!itensPorPedido.has(pid)) itensPorPedido.set(pid, []);
      itensPorPedido.get(pid).push(pedidoCompraItemToLegacyMirror(item));
    }

    const pedidos = pedidosRows.map((row) =>
      mapPedidoFromSqlRow(row, itensPorPedido.get(row.id) || []),
    );

    const { rows: embRows } = await client.query(
      `select * from public.embarque where pedido_compra_id = any($1::text[]) order by created_at`,
      [pedidoIds],
    );
    const embIds = embRows.map((r) => r.id);
    const { rows: eiRows } = embIds.length
      ? await client.query(`select * from public.embarque_item where embarque_id = any($1::text[])`, [embIds])
      : { rows: [] };

    const pciByPedido = itensPorPedido;
    const linhasPorEmb = new Map();
    for (const eid of embIds) linhasPorEmb.set(eid, []);
    for (const ei of eiRows) {
      const eid = ei.embarque_id;
      if (!linhasPorEmb.has(eid)) linhasPorEmb.set(eid, []);
      linhasPorEmb.get(eid).push(ei);
    }

    const embarquesDb = embRows.map((row) => {
      const pedidoItens = pciByPedido.get(row.pedido_compra_id) || [];
      const raw = linhasPorEmb.get(row.id) || [];
      const mirror = rebuildEmbarqueItensMirror(raw).map((linha) =>
        enrichEmbarqueMirrorFromPedidoItens(linha, pedidoItens),
      );
      return mapEmbarqueFromSqlRow(row, mirror);
    });

    const produtoIds = [
      ...new Set([
        ...pciRows.map((i) => i.produto_id).filter(Boolean),
        ...eiRows.map((i) => i.produto_id).filter(Boolean),
      ]),
    ];
    const produtosMap = await fetchProdutosMap(client, produtoIds);

    return { pedidos, embarquesDb, produtosMap };
  } finally {
    await client.end();
  }
}

async function main() {
  const { dataMin, fornecedor, json, htmlOnly, pdf, incluirAguardandoEmbarque } = parseArgs(
    process.argv.slice(2),
  );

  const { pedidos, embarquesDb, produtosMap } = await fetchFromSupabase(dataMin);

  const relatorio = buildRelatorioPendenteEmbarqueFornecedor(pedidos, embarquesDb, produtosMap, {
    dataEmissaoMin: dataMin,
    fornecedorNorm: fornecedor,
    somenteSaldoAvaria: !incluirAguardandoEmbarque,
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = fornecedor ? `-${fornecedor.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : '';
  const jsonPath = path.join(OUT_DIR, `pendente-embarque${suffix}-${stamp}.json`);
  const htmlPath = path.join(OUT_DIR, `pendente-embarque${suffix}-${stamp}.html`);

  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify({ ...relatorio, fonte: 'supabase' }, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    htmlPath,
    renderRelatorioPendenteEmbarqueFornecedorHtml(relatorio),
    'utf8',
  );

  console.log('Fonte: supabase (DATABASE_URL)');
  console.log(`Pedidos carregados: ${pedidos.length}`);
  console.log(`Pedidos com saldo: ${relatorio.totalPedidos}`);
  console.log(`Embarques com pendência: ${relatorio.totalEmbarques}`);
  console.log(`Total a repor: ${relatorio.totalValorPendente?.toFixed(2)} (${relatorio.totalCxPendente} un.)`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`HTML: ${htmlPath}`);

  if (pdf) {
    const { chromium } = await import('playwright');
    const pdfPath = path.join(OUT_DIR, `pendente-embarque${suffix}-${stamp}.pdf`);
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
