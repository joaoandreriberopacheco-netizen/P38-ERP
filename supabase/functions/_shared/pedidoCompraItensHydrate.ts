/**
 * Fonte canónica de linhas: pedido_compra_item (PedidoCompraItem).
 * Espelho JSON em pedido_compra.itens é legado — não usar em relatórios/Edge.
 */

type P38Client = {
  asServiceRole: {
    entities: {
      PedidoCompraItem: { filter: (q: object) => Promise<any[]> };
    };
  };
};

export function pedidoCompraItemRowToLegacyMirror(linha: Record<string, unknown> = {}) {
  const qty = Number(linha.quantidade_comercial) || 0;
  const qtyBase = Number(linha.quantidade_base) || 0;
  const fator = Number(linha.fator_aplicado) || 1;
  return {
    produto_id: linha.produto_id,
    produto_nome: linha.produto_nome,
    produto_unidade_id: linha.produto_unidade_id,
    pedido_compra_item_id: linha.id,
    quantidade: qty,
    quantidade_comercial: qty,
    quantidade_base: qtyBase,
    unidade_medida: linha.unidade_sigla || 'UN',
    fator_conversao: fator,
    fator_aplicado: fator,
    custo_unitario: Number(linha.custo_unitario_fator1) || 0,
    custo_unitario_fator1: Number(linha.custo_unitario_fator1) || 0,
    custo_frete_unitario: Number(linha.frete_unitario_fator1) || 0,
    custo_outros_unitario: Number(linha.outros_unitario_fator1) || 0,
    total: Number(linha.total) || 0,
    valor_total_item: Number(linha.total) || 0,
    subtotal: Number(linha.total) || 0,
    status_recebimento: linha.status_recebimento || 'Pendente',
    observacoes: typeof linha.observacoes === 'string' ? linha.observacoes : '',
  };
}

export async function fetchPedidoCompraItensByPedidoIds(
  base44: P38Client,
  pedidoIds: string[],
): Promise<Map<string, Record<string, unknown>[]>> {
  const unique = [...new Set((pedidoIds || []).filter(Boolean))];
  const byPedido = new Map<string, Record<string, unknown>[]>();
  if (!unique.length) return byPedido;

  const allRows: Record<string, unknown>[] = [];
  const chunk = 40;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    for (const pedidoId of slice) {
      const rows = await base44.asServiceRole.entities.PedidoCompraItem.filter({
        pedido_compra_id: pedidoId,
      });
      if (Array.isArray(rows)) allRows.push(...rows);
    }
  }

  for (const row of allRows) {
    const pid = String(row?.pedido_compra_id || '');
    if (!pid) continue;
    if (!byPedido.has(pid)) byPedido.set(pid, []);
    byPedido.get(pid)!.push(row);
  }
  for (const rows of byPedido.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }
  return byPedido;
}

/** Anexa `itens` hidratados do SQL; fallback para `pedido.itens` só se não houver linhas SQL. */
export async function hydratePedidosCompraItensFromSqlEdge(
  base44: P38Client,
  pedidos: Record<string, unknown>[] = [],
): Promise<Record<string, unknown>[]> {
  if (!pedidos.length) return pedidos;
  const byPedido = await fetchPedidoCompraItensByPedidoIds(
    base44,
    pedidos.map((p) => String(p?.id || '')).filter(Boolean),
  );

  return pedidos.map((pedido) => {
    const pid = String(pedido?.id || '');
    const sqlRows = byPedido.get(pid) || [];
    if (sqlRows.length > 0) {
      return {
        ...pedido,
        itens: sqlRows.map(pedidoCompraItemRowToLegacyMirror),
        _itens_fonte: 'sql',
      };
    }
    const legado = Array.isArray(pedido?.itens) ? pedido.itens : [];
    return {
      ...pedido,
      itens: legado,
      _itens_fonte: legado.length ? 'json-legado' : 'vazio',
    };
  });
}
