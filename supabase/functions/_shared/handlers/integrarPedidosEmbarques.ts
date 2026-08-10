// Percentuais de logística a partir de PedidoCompraItem + EmbarqueItem (SQL). Sem espelho JSON.
import type { createP38Client } from '../p38Client.ts';

function toNumber(value: unknown) {
  return Number(value) || 0;
}

function calcularPercentuaisFromSql(
  pedidoItens: Record<string, unknown>[] = [],
  embarqueItens: Record<string, unknown>[] = [],
) {
  const porProdutoEmb: Record<string, number> = {};
  const porProdutoRec: Record<string, number> = {};

  for (const row of embarqueItens) {
    const pid = String(row?.produto_id || '');
    if (!pid) continue;
    porProdutoEmb[pid] = (porProdutoEmb[pid] || 0) + toNumber(row.quantidade_embarcada_base ?? row.quantidade_embarcada_comercial);
    porProdutoRec[pid] = (porProdutoRec[pid] || 0) + toNumber(row.quantidade_recebida_base ?? row.quantidade_recebida_comercial);
  }

  let totalPedido = 0;
  let totalDespachado = 0;
  let totalConcluido = 0;

  if (pedidoItens.length) {
    for (const item of pedidoItens) {
      const pid = String(item?.produto_id || '');
      const pedida = toNumber(item.quantidade_base ?? item.quantidade_comercial ?? item.quantidade);
      totalPedido += pedida;
      totalDespachado += Math.min(pedida, porProdutoEmb[pid] || 0);
      totalConcluido += Math.min(pedida, porProdutoRec[pid] || 0);
    }
  } else {
    totalPedido = embarqueItens.reduce(
      (acc, row) => acc + toNumber(row.quantidade_pedida_base ?? row.quantidade_pedida_comercial),
      0,
    );
    totalDespachado = embarqueItens.reduce(
      (acc, row) => acc + toNumber(row.quantidade_embarcada_base ?? row.quantidade_embarcada_comercial),
      0,
    );
    totalConcluido = embarqueItens.reduce(
      (acc, row) => acc + toNumber(row.quantidade_recebida_base ?? row.quantidade_recebida_comercial),
      0,
    );
  }

  if (!totalPedido) {
    return { percentual_valor_embarcado: 0, percentual_despachado: 0, percentual_concluido: 0, percentual_pendente: 100 };
  }

  const percentualDespachado = Number(((totalDespachado / totalPedido) * 100).toFixed(2));
  const percentualConcluido = Number(((totalConcluido / totalPedido) * 100).toFixed(2));
  const percentualPendente = Number(Math.max(0, 100 - percentualDespachado).toFixed(2));

  return {
    percentual_valor_embarcado: percentualDespachado,
    percentual_despachado: percentualDespachado,
    percentual_concluido: percentualConcluido,
    percentual_pendente: percentualPendente,
  };
}

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { numeros = [] } = await req.json();
    if (!Array.isArray(numeros) || !numeros.length) {
      return Response.json({ error: 'numeros é obrigatório' }, { status: 400 });
    }

    const pedidos = await base44.asServiceRole.entities.PedidoCompra.list();
    const alvo = pedidos.filter((pedido) => numeros.includes(pedido.numero));
    const updated = [];

    for (const pedido of alvo) {
      const [pciRows, embRows, embItens] = await Promise.all([
        base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id }),
        base44.asServiceRole.entities.Embarque.filter({ pedido_compra_id: pedido.id }),
        base44.asServiceRole.entities.EmbarqueItem.filter({ pedido_compra_id: pedido.id }),
      ]);

      const percentuais = calcularPercentuaisFromSql(pciRows || [], embItens || []);
      const temNecessidade = (embRows || []).some((e: Record<string, unknown>) => e?.tipo === 'Necessidade');

      await base44.asServiceRole.entities.PedidoCompra.update(pedido.id, {
        status_embarque: temNecessidade
          ? 'Parcial'
          : (percentuais.percentual_despachado >= 100 ? 'Total' : 'Nenhum'),
        ...percentuais,
        historico: `${pedido.historico || ''}\n[INTEGRAÇÃO EMBARQUES SQL | embarques=${(embRows || []).length} | linhas=${(embItens || []).length}]`,
      });

      updated.push({ numero: pedido.numero, pedidoId: pedido.id, linhas_sql: (embItens || []).length });
    }

    return Response.json({ success: true, updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
