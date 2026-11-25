/**
 * Corrige U67-84J — despesa rateada / valor_itens / valor_total.
 * Uso: npx vite-node --config legacy/vite/vite.config.js scripts/fix-pedido-u67-84j-despesas.mjs [--apply]
 */
import { requireP38SupabaseAdmin } from './p38-supabase-admin.mjs';
import { pedidoCompraItemToLegacyMirror } from '@/lib/pedidoCompraItemContract.js';
import { normalizeDespesasRateadasForEdit } from '@/lib/pedidoCompraDespesasRateadas.js';
import {
  calcValorMercadoriaPedidoCompraBase,
  calcValorTotalPedidoCompra,
  valorFinanceiroLinhaPedido,
} from '@/lib/pedidoCompraFinanceiro.js';

const PEDIDO_ID = '8aaaf8f1-ecee-4fac-9821-56c49fd9fab4';
const MERC_TOTAL = 4259.7;
const DESPESA_TOTAL = 102;
const PESO_RATEIO = [2265.3, 2096.4];
const apply = process.argv.includes('--apply');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;

const supabase = requireP38SupabaseAdmin();

function snapshotHeader(p) {
  const d = p?.dados || {};
  return {
    numero: p.numero,
    valor_itens_dados: d.valor_itens,
    valor_total_dados: d.valor_total,
    valor_total_col: p.valor_total,
    despesas_rateadas: p.despesas_rateadas,
  };
}

function snapshotLine(row) {
  const d = row.dados || {};
  return {
    produto: row.produto_nome,
    custo_unitario_fator1: row.custo_unitario_fator1,
    qbase: row.quantidade_base,
    outros: d.outros_unitario_fator1 ?? row.outros_unitario_fator1,
    rateio: d.despesa_rateada_outros_fator1,
    incorpora: d.incorpora_despesa_rateada_no_custo ?? false,
    total: row.total,
    custo_total_f1: row.custo_total_unitario_fator1,
    valor_financeiro: null,
  };
}

const { data: pedido, error: e0 } = await supabase
  .from('pedido_compra')
  .select('*')
  .eq('id', PEDIDO_ID)
  .maybeSingle();
if (e0 || !pedido) throw new Error(e0?.message || 'pedido não encontrado');

const { data: sqlRows, error: e1 } = await supabase
  .from('pedido_compra_item')
  .select('*')
  .eq('pedido_compra_id', PEDIDO_ID)
  .order('ordem');
if (e1) throw e1;

const beforeHeader = snapshotHeader(pedido);
const beforeLines = sqlRows.map(snapshotLine);

console.log('=== BEFORE ===');
console.log('header', JSON.stringify(beforeHeader, null, 2));
beforeLines.forEach((l, i) => console.log(`line${i + 1}`, JSON.stringify(l, null, 2)));

const despesas = normalizeDespesasRateadasForEdit(
  pedido.despesas_rateadas ?? pedido.dados?.despesas_rateadas,
);

const share1 = round2((DESPESA_TOTAL * PESO_RATEIO[0]) / MERC_TOTAL);
const share2 = round2(DESPESA_TOTAL - share1);
const somaPeso = PESO_RATEIO[0] + PESO_RATEIO[1];

const rateados = sqlRows.map((row, idx) => {
  const leg = pedidoCompraItemToLegacyMirror(row);
  const d = row.dados || {};
  const share = idx === 0 ? share1 : share2;
  const qBase = Number(row.quantidade_base) || 0;
  const rateioF1 = qBase > 0 ? share / qBase : 0;
  const custoF1 = Number(row.custo_unitario_fator1) || 0;
  const custoTotalF1 = round6(custoF1 + rateioF1);
  const mercadoriaLinha = round2(MERC_TOTAL * (PESO_RATEIO[idx] / somaPeso));

  const totalLinha = Number(row.total) || round2(row.quantidade_comercial * (d.custo_unitario_comercial || 0));

  const item = {
    ...leg,
    ...d,
    pedido_compra_item_id: row.id,
    custo_unitario: custoF1,
    custo_unitario_fator1: custoF1,
    quantidade: row.quantidade_comercial,
    quantidade_base: qBase,
    fator_conversao: row.fator_aplicado,
    frete_unitario_fator1: d.frete_unitario_fator1 ?? 0,
    outros_unitario_fator1: round6(rateioF1),
    custo_outros_unitario: round6(rateioF1),
    despesa_rateada_outros_fator1: round6(rateioF1),
    outros_unitario_fator1_manual: 0,
    custo_total_unitario_fator1: custoTotalF1,
    incorpora_despesa_rateada_no_custo: false,
    total: totalLinha,
    valor_total_item: totalLinha,
    _mercadoria_referencia: mercadoriaLinha,
  };

  return {
    row,
    item,
    share,
    mercadoriaLinha,
    rateioF1: round6(rateioF1),
    valorFin: valorFinanceiroLinhaPedido(
      { ...item, total: mercadoriaLinha, valor_total_item: mercadoriaLinha },
      null,
    ),
    totalLinha,
  };
});

const pedidoPos = {
  ...pedido,
  valor_itens: MERC_TOTAL,
  despesas_rateadas: despesas,
  itens: rateados.map((r) => r.item),
};

const valorTotalAlvo = round2(MERC_TOTAL + DESPESA_TOTAL);

console.log('\n=== PLANNED ===');
console.log({
  valor_itens: MERC_TOTAL,
  valor_total: valorTotalAlvo,
  calcMercadoria: calcValorMercadoriaPedidoCompraBase(pedidoPos, {}),
  calcFinanceiroTotal: calcValorTotalPedidoCompra(
    { ...pedidoPos, valor_itens: MERC_TOTAL, valor_frete: 0, valor_desconto: 0 },
    {},
  ),
  shares: { line1: share1, line2: share2 },
});
rateados.forEach((r, i) => {
  console.log(`line${i + 1}`, {
    mercadoria_linha: r.mercadoriaLinha,
    share_rateio: r.share,
    outros_f1: r.rateioF1,
    valor_financeiro: r.valorFin,
    total_linha: r.totalLinha,
    custo_f1: r.row.custo_unitario_fator1,
  });
});

if (!apply) {
  console.log('\nDry-run — use --apply para gravar.');
  process.exit(0);
}

const dPatch = pedido.dados && typeof pedido.dados === 'object' ? { ...pedido.dados } : {};
dPatch.valor_itens = MERC_TOTAL;
dPatch.valor_total = valorTotalAlvo;
dPatch.valor_frete = dPatch.valor_frete ?? null;
dPatch.valor_desconto = dPatch.valor_desconto ?? null;

const { error: ep } = await supabase
  .from('pedido_compra')
  .update({
    valor_total: valorTotalAlvo,
    dados: dPatch,
    despesas_rateadas: despesas,
    updated_at: new Date().toISOString(),
  })
  .eq('id', PEDIDO_ID);
if (ep) throw ep;

for (const r of rateados) {
  const d = { ...(r.row.dados || {}) };
  d.outros_unitario_fator1 = r.rateioF1;
  d.despesa_rateada_outros_fator1 = r.rateioF1;
  d.outros_unitario_fator1_manual = 0;
  delete d.incorpora_despesa_rateada_no_custo;

  const { error: ei } = await supabase
    .from('pedido_compra_item')
    .update({
      custo_total_unitario_fator1: round6(
        Number(r.row.custo_unitario_fator1) + r.rateioF1,
      ),
      total: r.totalLinha,
      dados: d,
      updated_at: new Date().toISOString(),
    })
    .eq('id', r.row.id);
  if (ei) throw ei;
}

const { data: pedidoAfter } = await supabase.from('pedido_compra').select('*').eq('id', PEDIDO_ID).single();
const { data: linesAfter } = await supabase
  .from('pedido_compra_item')
  .select('*')
  .eq('pedido_compra_id', PEDIDO_ID)
  .order('ordem');

const afterLines = linesAfter.map((row) => {
  const s = snapshotLine(row);
  const leg = pedidoCompraItemToLegacyMirror(row);
  s.valor_financeiro = valorFinanceiroLinhaPedido({ ...leg, ...(row.dados || {}) }, null);
  return s;
});

console.log('\n=== AFTER ===');
console.log('header', JSON.stringify(snapshotHeader(pedidoAfter), null, 2));
afterLines.forEach((l, i) => console.log(`line${i + 1}`, JSON.stringify(l, null, 2)));

console.log('\nBEFORE/AFTER summary');
console.log(
  JSON.stringify(
    {
      header: { before: beforeHeader, after: snapshotHeader(pedidoAfter) },
      lines: beforeLines.map((b, i) => ({ before: b, after: afterLines[i] })),
    },
    null,
    2,
  ),
);
console.log('\nGravado com sucesso.');