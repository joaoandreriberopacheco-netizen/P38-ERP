import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';

async function listarRelacionadosPedidoVenda(base44Client, pedidoId) {
  const [lancamentos, movEst, agendas, ordens, protocolos, devolucoes] = await Promise.all([
    base44Client.entities.LancamentoFinanceiro.filter({ referencia_id: pedidoId }),
    base44Client.entities.MovimentacaoEstoque.filter({ referencia_id: pedidoId }),
    base44Client.entities.AgendaLogistica.filter({ pedido_venda_id: pedidoId }),
    base44Client.entities.OrdemSeparacao.filter({ pedido_venda_id: pedidoId }),
    base44Client.entities.ProtocoloEntrega.filter({ pedido_venda_id: pedidoId }),
    base44Client.entities.DevolucaoTroca.filter({ pedido_origem_id: pedidoId }),
  ]);

  return {
    lancamentos: Array.isArray(lancamentos) ? lancamentos : [],
    movEst: Array.isArray(movEst) ? movEst : [],
    agendas: Array.isArray(agendas) ? agendas : [],
    ordens: Array.isArray(ordens) ? ordens : [],
    protocolos: Array.isArray(protocolos) ? protocolos : [],
    devolucoes: Array.isArray(devolucoes) ? devolucoes : [],
  };
}

async function cancelarLancamentoComEstorno(base44Client, lanc, nota) {
  if (lanc.status === 'Cancelado') return;

  if (isLancamentoPago(lanc) && lanc.conta_financeira_id) {
    try {
      const conta = await base44Client.entities.ContasFinanceiras.get(lanc.conta_financeira_id);
      if (conta) {
        const valor = Number(lanc.valor || 0);
        const delta = lanc.tipo === 'Receita' ? -valor : valor;
        await base44Client.entities.ContasFinanceiras.update(conta.id, {
          saldo_atual: (Number(conta.saldo_atual) || 0) + delta,
        });
      }
    } catch (_) {
      /* não bloqueia cancelamento se conta não existir */
    }
  }

  await base44Client.entities.LancamentoFinanceiro.update(lanc.id, {
    status: 'Cancelado',
    observacoes: `${lanc.observacoes || ''}${nota}`.trim(),
  });
}

async function estornarEstoqueVenda(base44Client, pedido, movEst, motivo, userName) {
  const estornosExistentes = movEst.filter(
    (m) => m.tipo === 'Entrada' && String(m.motivo || '') === 'Cancelamento',
  );
  const produtosEstornados = new Set(estornosExistentes.map((m) => String(m.produto_id || '')));

  const saidas = movEst.filter(
    (m) =>
      m.tipo === 'Saída' &&
      String(m.motivo || '') === 'Venda' &&
      !produtosEstornados.has(String(m.produto_id || '')),
  );

  for (const mov of saidas) {
    const produtoId = mov.produto_id;
    if (!produtoId) continue;
    const quantidade = Number(mov.quantidade) || 0;
    if (quantidade <= 0) continue;

    await base44Client.entities.MovimentacaoEstoque.create({
      produto_id: produtoId,
      produto_nome: mov.produto_nome,
      tipo: 'Entrada',
      motivo: 'Cancelamento',
      quantidade,
      custo_unitario: mov.custo_unitario || 0,
      referencia_tipo: 'PedidoVenda',
      referencia_id: pedido.id,
      referencia_numero: pedido.numero,
      ...(pedido.cliente_nome
        ? {
            cliente_nome: pedido.cliente_nome,
            referencia_cliente_nome: pedido.cliente_nome,
            terceiro_nome: pedido.cliente_nome,
          }
        : {}),
      observacoes: `Estorno por cancelamento de venda: ${motivo}`.trim(),
      usuario_responsavel: userName,
    });

    try {
      const produto = await base44Client.entities.Produto.get(produtoId);
      if (produto) {
        await base44Client.entities.Produto.update(produtoId, {
          estoque_atual: (Number(produto.estoque_atual) || 0) + quantidade,
        });
      }
    } catch (_) {
      /* movimento já registra o estorno */
    }
  }

  return saidas.length;
}

async function estornarValeTroca(base44Client, pedido) {
  const pagamentos = Array.isArray(pedido.pagamentos) ? pedido.pagamentos : [];
  const pagVale = pagamentos.find(
    (p) => p?.forma_pagamento === 'Vale Troca' && p?.vale_id,
  );
  if (!pagVale?.vale_id) return;

  try {
    const vale = await base44Client.entities.ValeCompra.get(pagVale.vale_id);
    if (!vale) return;
    const valorUsado = Number(pagVale.valor) || 0;
    const novoSaldo = (Number(vale.valor_disponivel) || 0) + valorUsado;
    const valorOriginal = Number(vale.valor_original) || novoSaldo;
    let status = 'Ativo';
    if (novoSaldo <= 0.01) status = 'Utilizado';
    else if (novoSaldo < valorOriginal - 0.01) status = 'Utilizado Parcialmente';

    await base44Client.entities.ValeCompra.update(vale.id, {
      valor_disponivel: Math.min(novoSaldo, valorOriginal),
      status,
    });
  } catch (_) {
    /* não bloqueia cancelamento */
  }
}

/**
 * Cancela um pedido de venda mantendo o registro histórico.
 * Executa via entidades (mesmo padrão de Exclusão de Documentos) — não depende de Edge Function.
 */
export async function cancelarPedidoVenda({ pedidoId, motivo, pedido: pedidoInput, base44Client = base44 }) {
  if (!pedidoId && !pedidoInput?.id) throw new Error('Pedido não informado.');
  const id = pedidoId || pedidoInput.id;
  const motivoLimpo = String(motivo || '').trim();
  if (!motivoLimpo) throw new Error('Informe o motivo do cancelamento.');

  let pedido = pedidoInput;
  if (!pedido?.id || pedido.id !== id) {
    try {
      pedido = await base44Client.entities.PedidoVenda.get(id);
    } catch (_) {
      throw new Error('Pedido de venda não encontrado.');
    }
  }

  const status = String(pedido.status || '');
  if (status === 'Cancelado') {
    throw new Error('Este pedido já está cancelado.');
  }
  if (status === 'Orçamento' || String(pedido.tipo || '') === 'Orçamento') {
    throw new Error('Orçamentos devem ser excluídos ou convertidos, não cancelados por este fluxo.');
  }

  const { lancamentos, movEst, agendas, ordens, protocolos, devolucoes } =
    await listarRelacionadosPedidoVenda(base44Client, id);

  const temDevolucao = devolucoes.some((d) => String(d.status || '') === 'Processada');
  if (temDevolucao) {
    throw new Error(
      'Pedido possui devolução/troca processada. Estorne ou ajuste a devolução antes de cancelar a venda.',
    );
  }

  const user = await base44Client.auth.me().catch(() => null);
  const userName = user?.full_name || user?.email || 'Operador';
  const nota = `\n[Cancelado: ${motivoLimpo} | ${userName} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`;

  const lancamentosCancelados = new Set();
  for (const lanc of lancamentos) {
    if (lancamentosCancelados.has(lanc.id)) continue;
    const grupoId = lanc.grupo_lancamento_id;
    const alvos = grupoId ? lancamentos.filter((l) => l.grupo_lancamento_id === grupoId) : [lanc];
    for (const alvo of alvos) {
      if (lancamentosCancelados.has(alvo.id)) continue;
      await cancelarLancamentoComEstorno(base44Client, alvo, nota);
      lancamentosCancelados.add(alvo.id);
    }
  }

  const movimentosEstornados = await estornarEstoqueVenda(
    base44Client,
    pedido,
    movEst,
    motivoLimpo,
    userName,
  );
  await estornarValeTroca(base44Client, pedido);

  await Promise.all([
    ...agendas.map((a) =>
      a.status !== 'Cancelado'
        ? base44Client.entities.AgendaLogistica.update(a.id, { status: 'Cancelado' })
        : Promise.resolve(),
    ),
    ...ordens.map((o) =>
      o.status !== 'Cancelado'
        ? base44Client.entities.OrdemSeparacao.update(o.id, { status: 'Cancelado' })
        : Promise.resolve(),
    ),
    ...protocolos.map((p) =>
      p.status !== 'Cancelado'
        ? base44Client.entities.ProtocoloEntrega.update(p.id, { status: 'Cancelado' })
        : Promise.resolve(),
    ),
  ]);

  await base44Client.entities.PedidoVenda.update(id, {
    status: 'Cancelado',
    observacoes: `${pedido.observacoes || ''}${nota}`.trim(),
  });

  return {
    sucesso: true,
    pedido_id: id,
    numero: pedido.numero,
    status: 'Cancelado',
    lancamentos_cancelados: lancamentosCancelados.size,
    movimentos_estornados: movimentosEstornados,
  };
}

/** Pedidos que podem ser cancelados pela gestão de vendas. */
export function pedidoPodeSerCancelado(pedido) {
  if (!pedido?.id) return false;
  const status = String(pedido.status || '').trim();
  if (status === 'Cancelado') return false;
  if (status === 'Orçamento') return false;
  if (String(pedido.tipo || '').trim() === 'Orçamento') return false;
  return true;
}
