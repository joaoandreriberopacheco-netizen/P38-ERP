#!/usr/bin/env node
/**
 * Gera PDF de 2 páginas — estoque físico + em trânsito (reunião).
 * Lógica partilhada com o relatório "Resumo global" no catálogo P38.
 *
 * Uso: node scripts/gerar-resumo-estoque-fisico-pdf.mjs [--out=/caminho/arquivo.pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { resolveP38Secrets } from './p38-secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseOutArg(argv) {
  const hit = argv.find((a) => a.startsWith('--out='));
  if (!hit) {
    return path.join('/opt/cursor/artifacts', `estoque-fisico-reuniao-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return hit.slice('--out='.length);
}


async function fetchSupabaseTable(table, filter = '') {
  const { supabaseAnonKey: key } = resolveP38Secrets();
  const base = 'https://zhonvxkkqabfdyehyxpu.supabase.co';
  let offset = 0;
  const all = [];
  while (true) {
    const q = `${base}/rest/v1/${table}?select=*${filter}&limit=1000&offset=${offset}`;
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`Supabase ${table}: ${JSON.stringify(rows).slice(0, 200)}`);
    all.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function groupRowsByField(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row[field] || '');
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function pciToLegacy(row) {
  return {
    id: row.id,
    produto_id: row.produto_id,
    produto_nome: row.produto_nome,
    quantidade: row.quantidade_comercial,
    quantidade_comercial: row.quantidade_comercial,
    quantidade_base: row.quantidade_base,
    fator_conversao: row.fator_aplicado,
    fator_aplicado: row.fator_aplicado,
    unidade_medida: row.unidade_sigla,
  };
}

function embarqueEmTransito(embarque = {}) {
  const statusReceb = String(embarque.status_recebimento || '').trim().toLowerCase();
  const statusEmb = String(embarque.status || '').trim().toLowerCase();
  if (statusReceb.includes('recebido ok') || statusReceb.includes('diverg') || statusEmb.includes('conclu')) {
    return false;
  }
  return true;
}

async function fetchCompraContextNode(pendenteLib, embarqueLib, embarqueContract) {
  const { rebuildEmbarqueItensMirror } = embarqueContract;
  const { getEmbarqueItensLinhas } = embarqueLib;
  const {
    buildRecebidosPorPedidoProdutoFromEmbarques,
    pedidoCompraAprovadoNaoConcluido,
    buildPendenteAprovadoFinanceiroPorProduto,
    resolveQuantidadeBaseItemEmbarque,
  } = pendenteLib;

  const [pedidos, pciRows, embarques, embarqueItems] = await Promise.all([
    fetchSupabaseTable('pedido_compra'),
    fetchSupabaseTable('pedido_compra_item'),
    fetchSupabaseTable('embarque'),
    fetchSupabaseTable('embarque_item'),
  ]);

  const pciByPedido = groupRowsByField(pciRows, 'pedido_compra_id');
  const embItemsByEmb = groupRowsByField(embarqueItems, 'embarque_id');

  const pedidosHydrated = pedidos.map((pedido) => ({
    ...pedido,
    itens: (pciByPedido.get(String(pedido.id)) || []).map(pciToLegacy),
  }));

  const embarquesHydrated = embarques.map((embarque) => ({
    ...embarque,
    _linhas: rebuildEmbarqueItensMirror(embItemsByEmb.get(String(embarque.id)) || []),
  }));

  const pedidosMap = new Map(pedidosHydrated.map((pedido) => [String(pedido.id), pedido]));
  const pedidosAbertos = pedidosHydrated.filter(pedidoCompraAprovadoNaoConcluido);
  const recebidosPorPedidoProduto = buildRecebidosPorPedidoProdutoFromEmbarques(embarquesHydrated, pedidosHydrated);

  const embarquesTransito = embarquesHydrated.filter((embarque) => {
    const pedido = pedidosMap.get(String(embarque.pedido_compra_id));
    if (!pedido) return false;
    if (!pedidoCompraAprovadoNaoConcluido(pedido)) return false;
    return embarqueEmTransito(embarque);
  });

  return {
    getEmbarqueItensLinhas,
    resolveQuantidadeBaseItemEmbarque,
    pedidosMap,
    pedidosAbertos,
    embarquesHydrated,
    embarquesTransito,
    recebidosPorPedidoProduto,
    buildPendenteAprovadoFinanceiroPorProduto,
  };
}

async function main() {
  const outPath = parseOutArg(process.argv.slice(2));
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const pdfLib = await server.ssrLoadModule('/src/lib/relatorioEstoqueGlobalPdf/generateRelatorioEstoqueGlobalPdf.js');
    const stock = await server.ssrLoadModule('/src/lib/catalogStockTotals.js');
    const unitsLib = await server.ssrLoadModule('/src/lib/productUnits.js');
    const abcdLib = await server.ssrLoadModule('/src/lib/catalogAbcdEnrichment.js');
    const pendenteLib = await server.ssrLoadModule('/src/lib/sugestaoCompraEstoquePendente.js');
    const embarqueLib = await server.ssrLoadModule('/src/lib/fetchEmbarqueItens.js');
    const embarqueContract = await server.ssrLoadModule('/src/lib/embarqueItemContract.js');

    const produtos = await fetchSupabaseTable('produto', '&ativo=eq.true');
    const compraContext = await fetchCompraContextNode(pendenteLib, embarqueLib, embarqueContract);
    const resposta = await pdfLib.generateRelatorioEstoqueGlobalPdf({ produtos, compraContext });

    const fisicoData = pdfLib.buildResumoData(produtos, {
      resolveProdutoCustoUnitarioBase: stock.resolveProdutoCustoUnitarioBase,
      formatEstoqueApresentacao: unitsLib.formatEstoqueApresentacao,
      resolveProdutoAbcdClasse: abcdLib.resolveProdutoAbcdClasse,
    });
    const transitoData = pdfLib.buildResumoTransitoData(produtos, compraContext, {
      resolveProdutoCustoUnitarioBase: stock.resolveProdutoCustoUnitarioBase,
      resolveProdutoAbcdClasse: abcdLib.resolveProdutoAbcdClasse,
      sumCatalogTransitStockValue: stock.sumCatalogTransitStockValue,
      formatQuantidadeCatalogoApresentacao: unitsLib.formatQuantidadeCatalogoApresentacao,
    });

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(resposta.data));

    const repoRoot = path.join(__dirname, '..');
    for (const target of [
      path.join(repoRoot, 'estoque-fisico-reuniao.pdf'),
      path.join(repoRoot, 'public', 'estoque-fisico-reuniao.pdf'),
    ]) {
      fs.copyFileSync(outPath, target);
    }

    console.log(JSON.stringify({
      ok: true,
      out: outPath,
      build: pdfLib.PDF_BUILD,
      fisico: { total: fisicoData.total, skusCom: fisicoData.skusCom, familias: fisicoData.grupos.length },
      transito: {
        total: transitoData.totalTransito,
        pedidosAbertos: transitoData.pedidosAbertos,
        embarques: transitoData.embarquesTransito,
        volumes: transitoData.volumesTotal,
        familiasMaiores: transitoData.porFamiliaMaiores.length,
      },
      geradoEm: fisicoData.geradoEm,
    }, null, 2));
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
