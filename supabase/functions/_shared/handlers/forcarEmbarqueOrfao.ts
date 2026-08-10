// Cria embarque tipo Necessidade com linhas EmbarqueItem (SQL). Sem espelho JSON.
import type { createP38Client } from '../p38Client.ts';

function toNumber(value: unknown) {
  return Number(value) || 0;
}

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { numero } = await req.json();
    if (!numero) {
      return Response.json({ error: 'numero é obrigatório' }, { status: 400 });
    }

    const pedidos = await base44.asServiceRole.entities.PedidoCompra.list();
    const pedido = pedidos.find((item) => item.numero === numero);
    if (!pedido) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const [embRows, embItens, pciRows] = await Promise.all([
      base44.asServiceRole.entities.Embarque.filter({ pedido_compra_id: pedido.id }),
      base44.asServiceRole.entities.EmbarqueItem.filter({ pedido_compra_id: pedido.id }),
      base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id }),
    ]);

    const recebidosPorProduto: Record<string, number> = {};
    for (const row of embItens || []) {
      const pid = String(row?.produto_id || '');
      if (!pid) continue;
      recebidosPorProduto[pid] = (recebidosPorProduto[pid] || 0)
        + toNumber(row.quantidade_recebida_base ?? row.quantidade_recebida_comercial);
    }

    const itensOrfaos: Record<string, unknown>[] = [];
    for (const pci of pciRows || []) {
      const pid = String(pci?.produto_id || '');
      if (!pid) continue;
      const pedida = toNumber(pci.quantidade_base ?? pci.quantidade_comercial);
      const recebida = recebidosPorProduto[pid] || 0;
      const saldo = Math.max(0, pedida - recebida);
      if (saldo <= 0) continue;
      itensOrfaos.push({
        produto_id: pci.produto_id,
        produto_nome: pci.produto_nome,
        pedido_compra_item_id: pci.id,
        produto_unidade_id: pci.produto_unidade_id,
        unidade_sigla: pci.unidade_sigla,
        quantidade_pedida_comercial: saldo,
        quantidade_embarcada_comercial: saldo,
        quantidade_recebida_comercial: 0,
      });
    }

    if (!itensOrfaos.length) {
      return Response.json({ success: true, created: false, reason: 'sem saldo órfão' });
    }

    const existente = (embRows || []).find((emb) => emb?.tipo === 'Necessidade');
    let embarqueId = existente?.id as string | undefined;

    if (!embarqueId) {
      const outros = (embRows || []).filter((emb) => emb?.tipo !== 'Necessidade');
      const letra = String.fromCharCode(65 + outros.length);
      const criado = await base44.asServiceRole.entities.Embarque.create({
        pedido_compra_id: pedido.id,
        pedido_compra_numero: pedido.numero,
        fornecedor_id: pedido.fornecedor_id,
        fornecedor_nome: pedido.fornecedor_nome,
        numero: String(outros.length + 1).padStart(2, '0'),
        codigo_exibicao: `${pedido.numero}-${letra}`,
        tipo: 'Necessidade',
        status: 'Pendente',
        status_recebimento: 'Pendente',
        observacoes: 'Embarque órfão forçado automaticamente para saldo pendente.',
      });
      embarqueId = criado?.id;
    }

    if (!embarqueId) {
      return Response.json({ error: 'Falha ao criar embarque de necessidade' }, { status: 500 });
    }

    const existentesLinhas = await base44.asServiceRole.entities.EmbarqueItem.filter({ embarque_id: embarqueId });
    for (const linha of existentesLinhas || []) {
      await base44.asServiceRole.entities.EmbarqueItem.delete(linha.id);
    }

    let ordem = 0;
    for (const item of itensOrfaos) {
      await base44.asServiceRole.entities.EmbarqueItem.create({
        embarque_id: embarqueId,
        pedido_compra_id: pedido.id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        pedido_compra_item_id: item.pedido_compra_item_id,
        produto_unidade_id: item.produto_unidade_id,
        unidade_sigla: item.unidade_sigla,
        quantidade_pedida_comercial: item.quantidade_pedida_comercial,
        quantidade_pedida_base: item.quantidade_pedida_comercial,
        quantidade_embarcada_comercial: item.quantidade_embarcada_comercial,
        quantidade_embarcada_base: item.quantidade_embarcada_comercial,
        quantidade_recebida_comercial: 0,
        quantidade_recebida_base: 0,
        divergencia_tipo: 'Nenhuma',
        ordem: ordem++,
      });
    }

    await base44.asServiceRole.entities.PedidoCompra.update(pedido.id, {
      status_embarque: 'Parcial',
      historico: `${pedido.historico || ''}\n[EMBARQUE ÓRFÃO FORÇADO SQL | embarque=${embarqueId} | itens=${itensOrfaos.length}]`,
    });

    return Response.json({ success: true, created: true, pedidoId: pedido.id, embarqueId, numero });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
