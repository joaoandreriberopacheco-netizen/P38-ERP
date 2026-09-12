import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

type EntityRecord = Record<string, unknown>;

function isLancamentoPago(l: EntityRecord) {
  return l?.status === 'Pago' || !!l?.data_pagamento;
}

async function listarRelacionados(svc: ReturnType<typeof createClientFromRequest>['asServiceRole'], pedidoId: string) {
  const [lancamentos, movEst, agendas, ordens, protocolos, devolucoes] = await Promise.all([
    svc.entities.LancamentoFinanceiro.filter({ referencia_id: pedidoId }),
    svc.entities.MovimentacaoEstoque.filter({ referencia_id: pedidoId }),
    svc.entities.AgendaLogistica.filter({ pedido_venda_id: pedidoId }),
    svc.entities.OrdemSeparacao.filter({ pedido_venda_id: pedidoId }),
    svc.entities.ProtocoloEntrega.filter({ pedido_venda_id: pedidoId }),
    svc.entities.DevolucaoTroca.filter({ pedido_origem_id: pedidoId }),
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

async function cancelarLancamentoComEstorno(
  svc: ReturnType<typeof createClientFromRequest>['asServiceRole'],
  lanc: EntityRecord,
  nota: string,
) {
  if (lanc.status === 'Cancelado') return;

  if (isLancamentoPago(lanc) && lanc.conta_financeira_id) {
    try {
      const conta = await svc.entities.ContasFinanceiras.get(String(lanc.conta_financeira_id));
      if (conta) {
        const valor = Number(lanc.valor || 0);
        const delta = lanc.tipo === 'Receita' ? -valor : valor;
        await svc.entities.ContasFinanceiras.update(String(conta.id), {
          saldo_atual: (Number(conta.saldo_atual) || 0) + delta,
        });
      }
    } catch (_) {
      /* não bloqueia cancelamento se conta não existir */
    }
  }

  await svc.entities.LancamentoFinanceiro.update(String(lanc.id), {
    status: 'Cancelado',
    observacoes: `${String(lanc.observacoes || '')}${nota}`.trim(),
  });
}

async function estornarEstoqueVenda(
  svc: ReturnType<typeof createClientFromRequest>['asServiceRole'],
  pedido: EntityRecord,
  movEst: EntityRecord[],
  nota: string,
  userName: string,
) {
  const estornosExistentes = movEst.filter(
    (m) => m.tipo === 'Entrada' && String(m.motivo || '') === 'Cancelamento',
  );
  const produtosEstornados = new Set(
    estornosExistentes.map((m) => String(m.produto_id || '')),
  );

  const saidas = movEst.filter(
    (m) =>
      m.tipo === 'Saída' &&
      String(m.motivo || '') === 'Venda' &&
      !produtosEstornados.has(String(m.produto_id || '')),
  );

  for (const mov of saidas) {
    const produtoId = String(mov.produto_id || '');
    if (!produtoId) continue;
    const quantidade = Number(mov.quantidade) || 0;
    if (quantidade <= 0) continue;

    await svc.entities.MovimentacaoEstoque.create({
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
      observacoes: `Estorno por cancelamento de venda${nota ? `: ${nota}` : ''}`.trim(),
      usuario_responsavel: userName,
    });

    try {
      const produto = await svc.entities.Produto.get(produtoId);
      if (produto) {
        await svc.entities.Produto.update(produtoId, {
          estoque_atual: (Number(produto.estoque_atual) || 0) + quantidade,
        });
      }
    } catch (_) {
      /* movimento já registra o estorno */
    }
  }
}

async function estornarValeTroca(
  svc: ReturnType<typeof createClientFromRequest>['asServiceRole'],
  pedido: EntityRecord,
) {
  const pagamentos = Array.isArray(pedido.pagamentos) ? pedido.pagamentos : [];
  const pagVale = pagamentos.find(
    (p: EntityRecord) => p?.forma_pagamento === 'Vale Troca' && p?.vale_id,
  ) as EntityRecord | undefined;
  if (!pagVale?.vale_id) return;

  try {
    const vale = await svc.entities.ValeCompra.get(String(pagVale.vale_id));
    if (!vale) return;
    const valorUsado = Number(pagVale.valor) || 0;
    const novoSaldo = (Number(vale.valor_disponivel) || 0) + valorUsado;
    const valorOriginal = Number(vale.valor_original) || novoSaldo;
    let status = 'Ativo';
    if (novoSaldo <= 0.01) status = 'Utilizado';
    else if (novoSaldo < valorOriginal - 0.01) status = 'Utilizado Parcialmente';

    await svc.entities.ValeCompra.update(String(vale.id), {
      valor_disponivel: Math.min(novoSaldo, valorOriginal),
      status,
    });
  } catch (_) {
    /* não bloqueia cancelamento */
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { pedidoId, motivo } = await req.json();
    if (!pedidoId) {
      return Response.json({ error: 'pedidoId obrigatório.' }, { status: 400 });
    }
    const motivoLimpo = String(motivo || '').trim();
    if (!motivoLimpo) {
      return Response.json({ error: 'Informe o motivo do cancelamento.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    let pedido: EntityRecord;
    try {
      pedido = await svc.entities.PedidoVenda.get(pedidoId);
    } catch (_) {
      return Response.json({ error: 'Pedido de venda não encontrado.' }, { status: 404 });
    }

    const status = String(pedido.status || '');
    if (status === 'Cancelado') {
      return Response.json({ error: 'Este pedido já está cancelado.' }, { status: 409 });
    }
    if (status === 'Orçamento' || String(pedido.tipo || '') === 'Orçamento') {
      return Response.json({ error: 'Orçamentos devem ser excluídos ou convertidos, não cancelados por este fluxo.' }, { status: 400 });
    }

    const { lancamentos, movEst, agendas, ordens, protocolos, devolucoes } = await listarRelacionados(svc, pedidoId);
    const temDevolucao = devolucoes.some((d) => String(d.status || '') === 'Processada');
    if (temDevolucao) {
      return Response.json({
        error: 'Pedido possui devolução/troca processada. Estorne ou ajuste a devolução antes de cancelar a venda.',
      }, { status: 409 });
    }

    const userName = user.full_name || user.email || 'Operador';
    const nota = `\n[Cancelado: ${motivoLimpo} | ${userName} | ${new Date().toLocaleString('pt-BR')}]`;

    const lancamentosCancelados = new Set<string>();
    for (const lanc of lancamentos) {
      if (lancamentosCancelados.has(String(lanc.id))) continue;
      const grupoId = lanc.grupo_lancamento_id;
      const alvos = grupoId
        ? lancamentos.filter((l) => l.grupo_lancamento_id === grupoId)
        : [lanc];
      for (const alvo of alvos) {
        if (lancamentosCancelados.has(String(alvo.id))) continue;
        await cancelarLancamentoComEstorno(svc, alvo, nota);
        lancamentosCancelados.add(String(alvo.id));
      }
    }

    await estornarEstoqueVenda(svc, pedido, movEst, motivoLimpo, userName);
    await estornarValeTroca(svc, pedido);

    await Promise.all([
      ...agendas.map((a) =>
        a.status !== 'Cancelado'
          ? svc.entities.AgendaLogistica.update(String(a.id), { status: 'Cancelado' })
          : Promise.resolve()
      ),
      ...ordens.map((o) =>
        o.status !== 'Cancelado'
          ? svc.entities.OrdemSeparacao.update(String(o.id), { status: 'Cancelado' })
          : Promise.resolve()
      ),
      ...protocolos.map((p) =>
        p.status !== 'Cancelado'
          ? svc.entities.ProtocoloEntrega.update(String(p.id), { status: 'Cancelado' })
          : Promise.resolve()
      ),
    ]);

    await svc.entities.PedidoVenda.update(pedidoId, {
      status: 'Cancelado',
      observacoes: `${String(pedido.observacoes || '')}${nota}`.trim(),
    });

    return Response.json({
      sucesso: true,
      pedido_id: pedidoId,
      numero: pedido.numero,
      status: 'Cancelado',
      lancamentos_cancelados: lancamentosCancelados.size,
      movimentos_estornados: movEst.filter((m) => m.tipo === 'Saída' && m.motivo === 'Venda').length,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
