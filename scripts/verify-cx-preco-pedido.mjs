/**
 * Verifica correção de preço CX (apresentação vs fator-1).
 * node --import ./scripts/vite-node-alias.mjs scripts/verify-cx-preco-pedido.mjs
 */
import {
  calcTotalItemCompraPedido,
  getCustoApresentacaoItem,
  getItemCompraExibicaoVitrine,
  normalizeItemToCanonicalFactorOne,
  repararLinhaCompraApresentacaoComProduto,
} from '../src/lib/productUnits.js';
import { calcValorItensPedidoCompraComCatalogo } from '../src/lib/pedidoCompraFinanceiro.js';

const produto = {
  id: 'estribo',
  nome: 'ESTRIBO 17 X 17 CM (CAIXA C/200)',
  unidade_principal: 'UN',
  valor_compra: 0.55,
  unidade_show_ativa: true,
  unidade_vitrine: 'CX',
  unidades_alternativas: [{ id: 'cx', unidade: 'CX', fator_conversao: 200, ativo: true }],
};

const linhaBug = {
  produto_id: 'estribo',
  quantidade: 20,
  fator_conversao: 200,
  quantidade_base: 4000,
  unidade_medida: 'CX',
  custo_unitario: 0.55,
  custo_unitario_apresentacao: 0.55,
  valor_desconto_item: 0,
};

const reparado = repararLinhaCompraApresentacaoComProduto(linhaBug, produto);
console.log('reparado snapshot', {
  apres: reparado.custo_unitario_apresentacao,
  f1: reparado.custo_unitario,
  totalGravado: reparado.total,
});
const canon = normalizeItemToCanonicalFactorOne(reparado, 'custo');
const exib = getItemCompraExibicaoVitrine(linhaBug, produto);
const total = calcTotalItemCompraPedido(reparado);

const somaPedidoLegado = calcValorItensPedidoCompraComCatalogo(
  { itens: [{ ...linhaBug, total: 11 }] },
  { estribo: produto },
);

const checks = [
  ['custo apres', getCustoApresentacaoItem(reparado), 110],
  ['total linha', total, 2200],
  ['exib preco', exib.preco_unitario, 110],
  ['exib total', exib.total, 2200],
  ['custo f1 canon', canon.custo_unitario, 0.55],
  ['apres canon', canon.custo_unitario_apresentacao, 110],
  ['soma pedido (total legado 11)', somaPedidoLegado, 2200],
];

let ok = true;
for (const [label, got, want] of checks) {
  const pass = Math.abs(Number(got) - want) < 0.02;
  console.log(`${pass ? 'OK' : 'FAIL'} ${label}: ${got} (esperado ~${want})`);
  if (!pass) ok = false;
}

process.exit(ok ? 0 : 1);
