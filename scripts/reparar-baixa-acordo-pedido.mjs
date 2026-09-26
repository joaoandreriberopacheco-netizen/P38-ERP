#!/usr/bin/env node
/**
 * Repara baixa logística incompleta de acordo órfão (histórico já existe).
 * Uso:
 *   npx vite-node scripts/reparar-baixa-acordo-pedido.mjs --numero=AAC-EB6 --lancamento-id=<uuid>
 *   npx vite-node scripts/reparar-baixa-acordo-pedido.mjs --numero=AAC-EB6 --lancamento-id=<uuid> --apply
 */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { loadPedidoCompraCli } from './lib/load-pedido-compra-cli.mjs';
import {
  pedidoTemBaixaLogisticaAcordo,
  isLancamentoAcordoFinanceiroOrfao,
} from '../src/lib/acordoFinanceiroOrfaoLancamento.js';

/** Lê quantidades acordadas na linha de histórico (evita baixar órfão a mais). */
export function parseQtdBaixaAcordoHistorico(historico = '', lancamentoId = '') {
  const line = String(historico || '')
    .split('\n')
    .find((ln) => ln.includes('[ACORDO FINANCEIRO ÓRFÃOS') && ln.includes(`lançamento=${lancamentoId}`));
  if (!line) return [];
  const marker = `lançamento=${lancamentoId} | `;
  const start = line.indexOf(marker);
  if (start < 0) return [];
  const rest = line.slice(start + marker.length);
  const end = rest.lastIndexOf(' | ');
  const blob = (end > 0 ? rest.slice(0, end) : rest).trim();
  const out = [];
  for (const chunk of blob.split(';').map((s) => s.trim()).filter(Boolean)) {
    const m = chunk.match(/^(.+?):\s*[-−](\d+(?:\.\d+)?)\s*base/i);
    if (m) out.push({ produto_nome: m[1].trim(), qtd_baixa_base: Number(m[2]) });
  }
  return out;
}
import { aplicarBaixaLogisticaAcordoFinanceiroOrfaos } from '../src/lib/aplicarAcordoFinanceiroOrfaos.js';
import { listarLancamentosPedidoCompra } from '../src/lib/pedidoCompraFinanceiro.js';
import { invokeRecalcularConclusaoPedidoCompra } from '../src/lib/p38StockRecalc.js';

function parseArgs(argv) {
  const args = { numero: '', pedidoId: '', lancamentoId: '', apply: false };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--numero=')) args.numero = a.slice(9).trim();
    else if (a.startsWith('--pedido-id=')) args.pedidoId = a.slice(12).trim();
    else if (a.startsWith('--lancamento-id=')) args.lancamentoId = a.slice(16).trim();
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if ((!args.numero && !args.pedidoId) || !args.lancamentoId) {
  console.error('Use --numero= ou --pedido-id= e --lancamento-id=<uuid>');
  process.exit(1);
}

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const loaded = await loadPedidoCompraCli(p38, args);
if (!loaded) {
  console.error('Pedido não encontrado');
  process.exit(1);
}

const { pedido, embarques, itensOrfaos } = loaded;
const lancamentos = await listarLancamentosPedidoCompra(p38, pedido.id);
const lanc = lancamentos.find((l) => l.id === args.lancamentoId);
if (!lanc || !isLancamentoAcordoFinanceiroOrfao(lanc)) {
  console.error('Lançamento não é acordo órfão deste pedido');
  process.exit(1);
}
if (!pedidoTemBaixaLogisticaAcordo(pedido.historico, args.lancamentoId)) {
  console.error('Histórico não indica baixa para este lançamento — use completar-acordo-orfao-legado.mjs');
  process.exit(1);
}

const doHistorico = parseQtdBaixaAcordoHistorico(pedido.historico, args.lancamentoId);
const itensPedido = pedido.itens || [];
const itensBaixa = doHistorico.length
  ? doHistorico.map((h) => {
      const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
      const item = itensPedido.find((it) => norm(it.produto_nome) === norm(h.produto_nome));
      if (!item) return null;
      return {
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        qtd_baixa_base: h.qtd_baixa_base,
      };
    }).filter(Boolean)
  : (itensOrfaos || []).map((o) => ({
      ...o,
      qtd_baixa_base: o.qtd_pendente,
    }));

const preview = {
  ok: true,
  dryRun: !args.apply,
  pedido: pedido.numero,
  lancamentoId: args.lancamentoId,
  itensBaixa: itensBaixa.map((i) => ({
    produto_id: i.produto_id,
    nome: i.produto_nome,
    qtd_baixa_base: i.qtd_baixa_base,
  })),
};

if (!args.apply) {
  console.log(JSON.stringify(preview, null, 2));
  console.log('\nAdicione --apply para executar (sem duplicar linha principal de acordo no histórico).');
  process.exit(0);
}

if (!itensBaixa.length) {
  console.log(JSON.stringify({ ok: false, error: 'Nenhum órfão pendente para reparar.' }, null, 2));
  process.exit(1);
}

const baixa = await aplicarBaixaLogisticaAcordoFinanceiroOrfaos(p38, {
  pedido,
  embarques,
  itensOrfaos: itensBaixa,
  lancamentoId: args.lancamentoId,
  produtosMap: {},
  appendHistorico: false,
  historicoSufixoExtra: 'REPARO baixa logística incompleta',
});

if (baixa.ok) {
  await invokeRecalcularConclusaoPedidoCompra(p38, pedido.id);
}

console.log(JSON.stringify({ ...preview, dryRun: false, resultado: baixa }, null, 2));
process.exit(baixa.ok ? 0 : 1);
