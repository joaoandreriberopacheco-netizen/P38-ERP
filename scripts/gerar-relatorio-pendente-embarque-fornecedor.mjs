#!/usr/bin/env node
/**
 * Relatório por embarque — pendências para fornecedor (% sobre pedido).
 * Alinhado à UI: materializePedidosCompraView + buildConsultaItensEmbarque (modo pendente).
 *
 * Uso:
 *   npm run compras:relatorio-pendente-fornecedor
 *   npm run compras:relatorio-pendente-fornecedor -- --fornecedor=tintão
 *   npm run compras:relatorio-pendente-fornecedor -- --desde=2026-07-20 --json
 *
 * Requer Base44 (VITE_BASE44_APP_ID + BASE44_ACCESS_TOKEN) ou DATABASE_URL (fallback SQL).
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { requireBase44Client, loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';
import { hydrateEmbarquesFromSql, fetchEmbarquesPorPedidos } from '../src/lib/fetchEmbarqueItens.js';
import { hydratePedidosCompraItensFromSql } from '../src/lib/fetchPedidoCompraItens.js';
import { carregarProdutosMap } from '../src/lib/embarqueVitrineHelpers.js';
import { getEmbarqueItensLinhas } from '../src/lib/fetchEmbarqueItens.js';
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

function mapEmbarqueFromSqlRow(row, linhas = []) {
  const dados = row.dados || {};
  return {
    id: row.id,
    pedido_compra_id: row.pedido_compra_id,
    numero: row.numero || dados.numero,
    tipo: row.tipo || dados.tipo,
    status: row.status || dados.status,
    status_recebimento: row.status_recebimento || dados.status_recebimento,
    data_embarque: row.data_embarque || dados.data_embarque,
    eta: row.eta || dados.eta,
    transportadora_nome: row.transportadora_nome || dados.transportadora_nome,
    observacoes: row.observacoes || dados.observacoes,
    created_date: row.created_at || dados.created_date,
    _linhas: linhas,
  };
}

async function fetchViaPostgres(dataMin) {
  loadDotEnvFiles();
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) return null;

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
    if (!pedidosRows.length) return { pedidos: [], embarquesDb: [] };

    const pedidoIds = pedidosRows.map((r) => r.id);
    const { rows: pciRows } = await client.query(
      `select * from public.pedido_compra_item
       where pedido_compra_id = any($1::uuid[])
       order by pedido_compra_id, ordem nulls last, created_at`,
      [pedidoIds],
    );
    const itensPorPedido = new Map();
    for (const item of pciRows) {
      const pid = item.pedido_compra_id;
      if (!itensPorPedido.has(pid)) itensPorPedido.set(pid, []);
      const d = item.dados || {};
      itensPorPedido.get(pid).push({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome || d.produto_nome,
        quantidade: item.quantidade_comercial ?? d.quantidade,
        quantidade_base: item.quantidade_base ?? d.quantidade_base,
        fator_conversao: item.fator_aplicado ?? d.fator_conversao ?? 1,
        unidade_medida: item.unidade_comercial ?? d.unidade_medida,
        custo_unitario: item.custo_unitario_fator1 ?? d.custo_unitario,
        custo_final_unitario: d.custo_final_unitario,
        total: item.total ?? d.total,
      });
    }

    const pedidos = pedidosRows.map((row) =>
      mapPedidoFromSqlRow(row, itensPorPedido.get(row.id) || []),
    );

    const { rows: embRows } = await client.query(
      `select * from public.embarque where pedido_compra_id = any($1::uuid[]) order by created_at`,
      [pedidoIds],
    );
    const embIds = embRows.map((r) => r.id);
    const { rows: eiRows } = embIds.length
      ? await client.query(`select * from public.embarque_item where embarque_id = any($1::uuid[])`, [embIds])
      : { rows: [] };

    const linhasPorEmb = new Map();
    for (const ei of eiRows) {
      const eid = ei.embarque_id;
      if (!linhasPorEmb.has(eid)) linhasPorEmb.set(eid, []);
      const d = ei.dados || {};
      linhasPorEmb.get(eid).push({
        produto_id: ei.produto_id,
        produto_nome: ei.produto_nome || d.produto_nome,
        quantidade_embarcada_comercial: ei.quantidade_embarcada_comercial,
        quantidade_recebida_comercial: ei.quantidade_recebida_comercial,
        quantidade_pedida_comercial: ei.quantidade_pedida_comercial,
        quantidade_embarcada_base: d.quantidade_embarcada_base,
        quantidade_recebida_base: d.quantidade_recebida_base,
        quantidade_pedida_base: d.quantidade_pedida_base,
        fator_conversao: d.fator_aplicado ?? d.fator_conversao,
        unidade_medida: ei.unidade_comercial ?? d.unidade_medida,
        dados: d,
      });
    }

    const embarquesDb = embRows.map((row) =>
      mapEmbarqueFromSqlRow(row, linhasPorEmb.get(row.id) || []),
    );

    return { pedidos, embarquesDb };
  } finally {
    await client.end();
  }
}

async function fetchViaBase44(dataMin) {
  const base44 = requireBase44Client();
  const pedidosRaw = await base44.entities.PedidoCompra.filter(
    { data_emissao: { $gte: dataMin } },
    '-data_emissao',
    800,
  ).catch(() => []);

  const pedidosFiltrados = (pedidosRaw || []).filter((p) => {
    const st = String(p?.status || '').trim();
    return st && st !== 'Rascunho' && st !== 'Cancelado';
  });

  const pedidos = await hydratePedidosCompraItensFromSql(base44, pedidosFiltrados);
  const pedidoIds = pedidos.map((p) => p.id).filter(Boolean);
  const embarquesHeaders = pedidoIds.length
    ? await fetchEmbarquesPorPedidos(base44, pedidoIds)
    : [];
  const embarquesDb = await hydrateEmbarquesFromSql(base44, embarquesHeaders);

  return { pedidos, embarquesDb };
}

async function main() {
  const { dataMin, fornecedor, json, htmlOnly, pdf, incluirAguardandoEmbarque } = parseArgs(process.argv.slice(2));

  let bundle = await fetchViaPostgres(dataMin);
  let fonte = 'postgres';
  if (!bundle) {
    bundle = await fetchViaBase44(dataMin);
    fonte = 'base44';
  }

  const { pedidos, embarquesDb } = bundle;
  let produtosMap = {};
  if (fonte === 'base44') {
    const produtoIds = [
      ...new Set([
        ...pedidos.flatMap((p) => (p.itens || []).map((i) => i.produto_id).filter(Boolean)),
        ...embarquesDb.flatMap((e) => getEmbarqueItensLinhas(e).map((i) => i.produto_id).filter(Boolean)),
      ]),
    ];
    if (produtoIds.length) {
      produtosMap = await carregarProdutosMap(produtoIds.map((id) => ({ produto_id: id })));
    }
  }

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

  fs.writeFileSync(jsonPath, `${JSON.stringify({ ...relatorio, fonte }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    htmlPath,
    renderRelatorioPendenteEmbarqueFornecedorHtml(relatorio),
    'utf8',
  );

  console.log(`Fonte: ${fonte}`);
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
      console.log(`\n${g.fornecedor}: ${g.embarques.length} embarque(s) · ${g.valor_pendente.toFixed(2)}`);
      for (const e of g.embarques.slice(0, 5)) {
        console.log(
          `  ${e.embarque_codigo} (${e.pedido_numero}) ${e.pct_valor_sobre_pedido}% · ${e.motivo}`,
        );
      }
      if (g.embarques.length > 5) console.log(`  … +${g.embarques.length - 5} embarque(s)`);
    }
    if (relatorio.fornecedores.length > 8) {
      console.log(`\n… +${relatorio.fornecedores.length - 8} fornecedor(es) — ver HTML/JSON`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
