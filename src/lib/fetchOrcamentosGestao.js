import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import { isValidGestaoDateKey } from '@/lib/fetchPedidosVendaGestao';
import {
  PEDIDO_VENDA_STATUS_ORCAMENTO,
  PEDIDO_VENDA_TIPO_ORCAMENTO,
} from '@/lib/pedidoVendaOrcamentoLabels';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';

/** Formato esperado pela Gestão de Vendas (aba Orçamentos). */
export function mapOrcamentoRowToGestaoPedido(row = {}) {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  const total = Number(row.total ?? dados.valor_total ?? 0);
  const created = row.created_at || dados.created_date || row.updated_at;
  return {
    id: row.id,
    numero: row.numero || '',
    cliente_nome: row.cliente_nome || dados.cliente_nome || '',
    observacoes: row.observacoes || dados.observacoes || '',
    subtotal: Number(row.subtotal ?? dados.subtotal ?? 0),
    valor_desconto: Number(row.valor_desconto ?? dados.valor_desconto ?? 0),
    valor_total: total,
    total,
    tabela_preco_id: row.tabela_preco_id || dados.tabela_preco_id || '',
    vendedor_id: row.vendedor_id || '',
    vendedor_nome: row.vendedor_nome || '',
    tipo: PEDIDO_VENDA_TIPO_ORCAMENTO,
    status: PEDIDO_VENDA_STATUS_ORCAMENTO,
    created_at: created,
    created_date: created,
  };
}

/** Cabeçalhos de orçamentos (`orcamento`) no período — Gestão de Vendas. */
export async function fetchOrcamentosGestaoHeaders({ dataInicio, dataFim } = {}) {
  if (!isValidGestaoDateKey(dataInicio) || !isValidGestaoDateKey(dataFim)) {
    return [];
  }
  if (!isSupabaseBrowserConfigured()) {
    return [];
  }
  const client = getSupabaseBrowserClient();
  if (!client) return [];

  const { data, error } = await client
    .from('orcamento')
    .select('*')
    .neq('status', 'Cancelado')
    .gte('created_at', inicioDiaSistemaISO(dataInicio))
    .lte('created_at', fimDiaSistemaISO(dataFim))
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data || []).map(mapOrcamentoRowToGestaoPedido);
}
