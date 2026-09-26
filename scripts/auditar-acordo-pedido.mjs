#!/usr/bin/env node
/**
 * Audita acordo órfão / folha de um pedido (Supabase).
 * Uso: npx vite-node scripts/auditar-acordo-pedido.mjs --numero=AAC-EB6
 */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { loadPedidoCompraCli } from './lib/load-pedido-compra-cli.mjs';
import { listarLancamentosPedidoCompra } from '../src/lib/pedidoCompraFinanceiro.js';
import { listarAcordosOrfaoComBaixaPendente, pedidoTemBaixaLogisticaAcordo, isLancamentoAcordoFinanceiroOrfao } from '../src/lib/acordoFinanceiroOrfaoLancamento.js';
import { calcularFolhaLogisticaLinha } from '../src/lib/aplicarAcordoFinanceiroOrfaos.js';

const numero = (process.argv.find((a) => a.startsWith('--numero=')) || '').slice(9).trim().toUpperCase();
if (!numero) {
  console.error('Use --numero=AAC-EB6');
  process.exit(1);
}

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const loaded = await loadPedidoCompraCli(p38, { numero });
if (!loaded) {
  console.error('Pedido não encontrado');
  process.exit(1);
}

const { pedido, embarques, itensOrfaos } = loaded;
const lancs = await listarLancamentosPedidoCompra(p38, pedido.id);
const acordos = (lancs || []).filter(isLancamentoAcordoFinanceiroOrfao);
const pendentes = listarAcordosOrfaoComBaixaPendente(pedido, lancs);

console.log(JSON.stringify({
  pedido: { id: pedido.id, numero: pedido.numero, status: pedido.status, valor_total: pedido.valor_total },
  itens_pedido: (pedido.itens || []).map((it) => ({
    produto_id: it.produto_id,
    nome: it.produto_nome,
    qtd: it.quantidade ?? it.quantidade_comercial,
    qtd_base: it.quantidade_base,
    total: it.total,
    folha: calcularFolhaLogisticaLinha(it, embarques),
  })),
  embarques: embarques.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    codigo: e.codigo_exibicao || e.numero,
    linhas: (e._linhas || []).map((l) => ({
      produto_id: l.produto_id,
      nome: l.produto_nome,
      emb: l.quantidade_embarcada_base ?? l.quantidade_embarcada,
      rec: l.quantidade_recebida_base ?? l.quantidade_recebida,
      acordo_id: l.acordo_financeiro_lancamento_id,
    })),
  })),
  orfaos_agora: itensOrfaos,
  acordos_financeiros: acordos.map((l) => ({
    id: l.id,
    valor: l.valor,
    descricao: l.descricao,
    baixa_no_historico: pedidoTemBaixaLogisticaAcordo(pedido.historico, l.id),
  })),
  acordos_baixa_pendente: pendentes.map((p) => p.lancamento.id),
  historico_trecho: String(pedido.historico || '').split('\n').filter((ln) => /ACORDO|órfã|ORFÃ/i.test(ln)).slice(-5),
}, null, 2));
