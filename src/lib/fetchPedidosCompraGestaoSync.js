import {
  listarLancamentosPedidoCompra,
  pedidoPrecisaSincronizarAprovacaoFinanceira,
  pedidoStatusIndicaAguardandoAprovacaoFinanceira,
} from '@/lib/pedidoCompraFinanceiro';
import { sincronizarPedidoCompraAprovacaoFinanceira } from '@/lib/aprovarPedidoCompraFinanceiro';

/**
 * Sincroniza aprovação financeira pendente em background (não bloqueia LCP).
 * @returns {Promise<object[]>} pedidos atualizados
 */
export async function sincronizarPedidosCompraAprovacaoPendente(base44, pedidos = []) {
  const lista = Array.isArray(pedidos) ? [...pedidos] : [];
  const candidatos = lista.filter((pedido) => pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido));
  if (!candidatos.length) return lista;

  const byId = new Map(lista.map((p) => [p.id, { ...p }]));

  for (const pedido of candidatos) {
    try {
      const lancs = await listarLancamentosPedidoCompra(base44, pedido.id);
      if (!pedidoPrecisaSincronizarAprovacaoFinanceira(pedido, lancs)) continue;
      await sincronizarPedidoCompraAprovacaoFinanceira({ base44, pedido, lancamentos: lancs });
      const [atualizado] = await base44.entities.PedidoCompra.filter({ id: pedido.id });
      if (atualizado && byId.has(pedido.id)) {
        const row = byId.get(pedido.id);
        row.status = atualizado.status;
        row.status_aprovacao_financeira = atualizado.status_aprovacao_financeira;
        row.data_aprovacao_financeira = atualizado.data_aprovacao_financeira;
      }
    } catch {
      /* exibição segue com estado anterior */
    }
  }

  return [...byId.values()];
}
