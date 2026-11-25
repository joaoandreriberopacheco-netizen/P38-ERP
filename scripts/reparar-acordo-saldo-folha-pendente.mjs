#!/usr/bin/env node
/**
 * Completa baixa logística quando o acordo financeiro já existe mas a folha
 * ainda mostra pendente (ex.: conversão CX→M² errada na 1ª baixa).
 *
 * Usa o saldo pendente ATUAL na folha para cada produto citado no histórico
 * do lançamento — sem criar novo LancamentoFinanceiro.
 *
 * Uso:
 *   npx vite-node scripts/reparar-acordo-saldo-folha-pendente.mjs --numero=EXC-FQZ
 *   npx vite-node scripts/reparar-acordo-saldo-folha-pendente.mjs --numero=HHW-5NP --apply
 */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { loadPedidoCompraCli } from './lib/load-pedido-compra-cli.mjs';
import {
  isLancamentoAcordoFinanceiroOrfao,
  pedidoTemBaixaLogisticaAcordo,
  parseQtdBaixaAcordoHistorico,
} from '../src/lib/acordoFinanceiroOrfaoLancamento.js';
import { listarLancamentosPedidoCompra } from '../src/lib/pedidoCompraFinanceiro.js';
import { aplicarBaixaLogisticaAcordoFinanceiroOrfaos } from '../src/lib/aplicarAcordoFinanceiroOrfaos.js';
import { invokeRecalcularConclusaoPedidoCompra } from '../src/lib/p38StockRecalc.js';
import { roundToTwoDecimals } from '../src/lib/financialUtils.js';

function parseArgs(argv) {
  const args = { numero: '', lancamentoId: '', apply: false };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--numero=')) args.numero = a.slice(9).trim().toUpperCase();
    else if (a.startsWith('--lancamento-id=')) args.lancamentoId = a.slice(16).trim();
  }
  return args;
}

function normNome(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function matchProdutoPorNome(itensPedido, nomeHistorico) {
  const n = normNome(nomeHistorico);
  return (itensPedido || []).find((it) => normNome(it.produto_nome) === n)
    || (itensPedido || []).find((it) => normNome(it.produto_nome).includes(n.slice(0, 20)));
}

const args = parseArgs(process.argv.slice(2));
if (!args.numero) {
  console.error('Use --numero=EXC-FQZ [--lancamento-id=uuid] [--apply]');
  process.exit(1);
}

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const loaded = await loadPedidoCompraCli(p38, { numero: args.numero });
if (!loaded) {
  console.error('Pedido não encontrado');
  process.exit(1);
}

const { pedido, embarques, itensOrfaos } = loaded;
const lancamentos = (await listarLancamentosPedidoCompra(p38, pedido.id)).filter(
  isLancamentoAcordoFinanceiroOrfao,
);

let lanc = args.lancamentoId
  ? lancamentos.find((l) => l.id === args.lancamentoId)
  : lancamentos.sort(
    (a, b) => new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0),
  )[0];

if (!lanc) {
  console.error('Nenhum lançamento de acordo órfão neste pedido');
  process.exit(1);
}

if (!pedidoTemBaixaLogisticaAcordo(pedido.historico, lanc.id)) {
  console.error('Acordo sem linha de baixa no histórico — use completar-acordo-orfao-legado.mjs');
  process.exit(1);
}

const jaBaixado = parseQtdBaixaAcordoHistorico(pedido.historico, lanc.id);
const orfaoPorPid = new Map((itensOrfaos || []).map((o) => [String(o.produto_id), o]));

const itensBaixa = [];
for (const h of jaBaixado) {
  const item = matchProdutoPorNome(pedido.itens, h.produto_nome);
  if (!item) continue;
  const orfao = orfaoPorPid.get(String(item.produto_id));
  const pendenteAtual = roundToTwoDecimals(Number(orfao?.qtd_pendente) || 0);
  if (pendenteAtual <= 0.009) continue;
  itensBaixa.push({
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    qtd_baixa_base: pendenteAtual,
    meta: {
      baixa_historico_anterior: h.qtd_baixa_base,
      pendente_folha_agora: pendenteAtual,
    },
  });
}

const prodIds = [...new Set((pedido.itens || []).map((i) => i.produto_id).filter(Boolean))];
const prods = await p38.entities.Produto.filter({ id: { $in: prodIds } }).catch(() => []);
const produtosMap = Object.fromEntries((prods || []).map((p) => [p.id, p]));

const preview = {
  dryRun: !args.apply,
  pedido: pedido.numero,
  lancamentoId: lanc.id,
  valor_acordo: lanc.valor,
  itensBaixa,
};

if (!args.apply) {
  console.log(JSON.stringify(preview, null, 2));
  console.log('\nAdicione --apply para baixar o pendente restante na folha (sem novo financeiro).');
  process.exit(itensBaixa.length ? 0 : 0);
}

if (!itensBaixa.length) {
  console.log(JSON.stringify({ ok: true, message: 'Nada pendente na folha para os itens do acordo.' }, null, 2));
  process.exit(0);
}

const baixa = await aplicarBaixaLogisticaAcordoFinanceiroOrfaos(p38, {
  pedido,
  embarques,
  itensOrfaos: itensBaixa,
  lancamentoId: lanc.id,
  produtosMap,
  appendHistorico: false,
  historicoSufixoExtra: 'REPARO folha — saldo pendente após acordo (sem novo lançamento)',
});

if (baixa.ok) {
  await invokeRecalcularConclusaoPedidoCompra(p38, pedido.id);
  const after = await loadPedidoCompraCli(p38, { numero: args.numero });
  preview.orfaos_depois = (after?.itensOrfaos || []).map((o) => ({
    nome: o.produto_nome,
    qtd_pendente: o.qtd_pendente,
  }));
}

console.log(JSON.stringify({ ...preview, dryRun: false, resultado: baixa }, null, 2));
process.exit(baixa.ok ? 0 : 1);
