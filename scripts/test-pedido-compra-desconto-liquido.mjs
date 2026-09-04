/**
 * Valida: desconto no pedido de compra grava valor líquido (não bruto + desconto).
 * node scripts/test-pedido-compra-desconto-liquido.mjs
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function normalizePedidoCompraItemCustoLiquidoParaPersist(item = {}) {
  const frete = Number(item.frete_unitario_fator1 ?? item.custo_frete_unitario) || 0;
  const outros = Number(item.outros_unitario_fator1 ?? item.custo_outros_unitario) || 0;
  const custoBruto = Number(item.custo_unitario_fator1 ?? item.custo_unitario) || 0;
  const desconto = Number(
    item.desconto_unitario_fator1 ?? item.valor_desconto_item ?? item.desconto_unitario,
  ) || 0;
  const custoLiquidoF1 = round2(custoBruto - desconto);
  const fator = Number(item.fator_aplicado ?? item.fator_conversao) || 1;
  const custoTotalUnit = round2(custoLiquidoF1 + frete + outros);
  const qb = Number(item.quantidade_base);
  const qty = Number(item.quantidade ?? item.quantidade_comercial) || 0;
  const qBase = Number.isFinite(qb) && qb > 0 ? qb : qty * fator;
  const totalExplicito = Number(item.total ?? item.valor_total_item ?? item.subtotal) || 0;
  const total = totalExplicito > 0 ? round2(totalExplicito) : round2(qBase * custoTotalUnit);

  return {
    ...item,
    custo_unitario_fator1: custoLiquidoF1,
    desconto_unitario_fator1: 0,
    custo_total_unitario_fator1: custoTotalUnit,
    total,
  };
}

const bruto = 100;
const descontoPct = 15;
const descontoValor = round2((bruto * descontoPct) / 100);
const liquidoEsperado = round2(bruto - descontoValor);

const item = normalizePedidoCompraItemCustoLiquidoParaPersist({
  quantidade: 1,
  quantidade_base: 1,
  fator_conversao: 1,
  custo_unitario_fator1: bruto,
  desconto_unitario_fator1: descontoValor,
});

const checks = [
  ['custo líquido 85', item.custo_unitario_fator1 === liquidoEsperado],
  ['desconto zerado na persistência', item.desconto_unitario_fator1 === 0],
  ['total 85', item.total === liquidoEsperado],
  ['não soma desconto ao bruto', item.total !== round2(bruto + descontoValor)],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) {
    console.error('FAIL', label, item);
    failed += 1;
  } else {
    console.log('OK', label);
  }
}

process.exit(failed > 0 ? 1 : 0);
