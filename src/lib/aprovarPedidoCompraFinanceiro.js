/**
 * Ações financeiras centralizadas do Pedido de Compra (aprovar, rejeitar, liberar edição).
 * Usado em AprovacoesFinanceiras e no painel da aba Financeiro do pedido.
 */

import { format } from 'date-fns';
import { registrarTransicao } from '@/components/compras/transicaoHelper';
import {
  calcValorTotalPedidoCompra,
  cancelarLancamentosNaoPagosPedidoCompra,
  evidenciaAprovacaoFinanceiraProcessada,
  filtrarLancamentosCompraPedido,
  listarLancamentosPedidoCompra,
  pedidoPrecisaSincronizarAprovacaoFinanceira,
  pedidoStatusIndicaAguardandoAprovacaoFinanceira,
} from '@/lib/pedidoCompraFinanceiro';
import { isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';

export function pedidoAguardandoAprovacaoFinanceira(pedido = {}, lancamentos = null) {
  if (!pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido)) return false;
  if (lancamentos && evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos)) return false;
  return true;
}

export function pedidoAprovadoFinanceiramente(pedido = {}) {
  const saf = pedido.status_aprovacao_financeira || '';
  if (saf === 'Aprovado Financeiramente' || saf === 'Aprovado') return true;
  return [
    'Aprovado',
    'Aguardando Recepção',
    'Aguardando Embarque',
    'Enviado',
    'Despachado',
    'Em Recepção',
    'Em Trânsito',
    'Recebido Parcialmente',
    'Recebido Parcial',
    'Pendência',
    'Concluído',
  ].includes(pedido.status || '');
}

/** Financeiro liberou compra/logística, mas embarque ainda sem despacho (card = Aprovado). */
export function pedidoLiberadoParaLogistica(pedido = {}) {
  if (pedidoAguardandoAprovacaoFinanceira(pedido)) return false;
  return pedidoAprovadoFinanceiramente(pedido);
}

function nomeAprovador(authData = {}) {
  return authData.intervenienteName || authData.userName || 'Usuário';
}

function statusPedidoAposAprovacaoFinanceira(statusAtual = '') {
  if (
    statusAtual === 'Aguardando Aprovação Financeira' ||
    statusAtual === 'Aguardando Liberação' ||
    statusAtual === 'Rascunho'
  ) {
    return 'Aguardando Recepção';
  }
  return statusAtual || 'Aguardando Recepção';
}

/**
 * Alinha `status_aprovacao_financeira` / `status` do pedido quando a aprovação já consta
 * nos lançamentos ou no histórico, mas o pedido ficou preso em "Aguardando Aprovação Financeira".
 * @returns {{ synced: boolean, statusNovo?: string }}
 */
export async function sincronizarPedidoCompraAprovacaoFinanceira({
  base44,
  pedido,
  lancamentos: lancamentosIn,
  notaHistorico = '',
} = {}) {
  if (!pedido?.id || !base44) return { synced: false };

  const lancamentos = lancamentosIn || await listarLancamentosPedidoCompra(base44, pedido.id);
  if (!pedidoPrecisaSincronizarAprovacaoFinanceira(pedido, lancamentos)) return { synced: false };

  const compraLancs = filtrarLancamentosCompraPedido(pedido.id, lancamentos);
  const lancRef = compraLancs.find(isLancamentoPago) || compraLancs[0];
  const contaId = pedido.conta_pagamento_id || lancRef?.conta_financeira_id || '';
  const contaNome = pedido.conta_pagamento_nome || lancRef?.conta_financeira_nome || '';
  const agora = new Date().toISOString();
  const dataAprovacao =
    pedido.data_aprovacao_financeira ||
    (lancRef?.data_pagamento ? `${lancRef.data_pagamento}T12:00:00.000Z` : agora);
  const nota =
    notaHistorico ||
    `\n[Aprovação financeira sincronizada — pedido constava pendente mas lançamentos já processados | ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`;
  const statusNovo = statusPedidoAposAprovacaoFinanceira(pedido.status || '');

  await base44.entities.PedidoCompra.update(pedido.id, {
    status: statusNovo,
    status_aprovacao_financeira: 'Aprovado Financeiramente',
    conta_pagamento_id: contaId,
    conta_pagamento_nome: contaNome,
    data_aprovacao_financeira: dataAprovacao,
    historico: (pedido.historico || '') + nota,
  });

  return { synced: true, statusNovo };
}

/** @deprecated Use sincronizarPedidoCompraAprovacaoFinanceira */
export async function sincronizarPedidoCompraSePagamentoCompleto(args = {}) {
  return sincronizarPedidoCompraAprovacaoFinanceira(args);
}

/** Sincroniza pedidos vinculados quando lançamentos indicam aprovação financeira já realizada. */
export async function sincronizarPedidosCompraPorLancamentos(base44, lancamentos = []) {
  const pedidoIds = new Set();
  for (const l of lancamentos) {
    if (l?.referencia_tipo === 'PedidoCompra' && l.referencia_id) pedidoIds.add(l.referencia_id);
    if (l?.pedido_compra_vinculado_id) pedidoIds.add(l.pedido_compra_vinculado_id);
  }

  const syncedIds = [];
  for (const pedidoId of pedidoIds) {
    const rows = await base44.entities.PedidoCompra.filter({ id: pedidoId });
    const pedido = rows?.[0];
    if (!pedido) continue;
    const lancs = await listarLancamentosPedidoCompra(base44, pedidoId);
    const { synced } = await sincronizarPedidoCompraAprovacaoFinanceira({
      base44,
      pedido,
      lancamentos: lancs,
    });
    if (synced) syncedIds.push(pedidoId);
  }
  return syncedIds;
}

/**
 * Aprova o pedido: libera logística (Aguardando Recepção), CMV nos lançamentos, transição auditada.
 */
export async function aprovarPedidoCompraFinanceiro({
  base44,
  pedido,
  contaId,
  contaNome = '',
  authData = {},
}) {
  if (!pedido?.id || !contaId) {
    throw new Error('Pedido ou conta de pagamento não informados.');
  }

  const lancamentosExistentes = await listarLancamentosPedidoCompra(base44, pedido.id);
  if (evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentosExistentes)) {
    const aprovador = nomeAprovador(authData);
    const notaSync = `\n[Aprovação financeira já constava nos lançamentos — status do pedido alinhado: ${aprovador} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`;
    const contaNomeSync = contaNome || lancamentosExistentes.find(isLancamentoPago)?.conta_financeira_nome || '';
    const { statusNovo } = await sincronizarPedidoCompraAprovacaoFinanceira({
      base44,
      pedido: {
        ...pedido,
        conta_pagamento_id: pedido.conta_pagamento_id || contaId,
        conta_pagamento_nome: pedido.conta_pagamento_nome || contaNomeSync,
      },
      lancamentos: lancamentosExistentes,
      notaHistorico: notaSync,
    });
    return { statusNovo, aprovacaoJaRealizada: true };
  }

  const agora = new Date().toISOString();
  const aprovador = nomeAprovador(authData);
  const notaAprovacao = `\n[Aprovado: ${aprovador} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`;
  const statusAnterior = pedido.status || 'Aguardando Liberação';
  const historicoAtualizado = (pedido.historico || '') + notaAprovacao;

  await base44.entities.PedidoCompra.update(pedido.id, {
    status: 'Aguardando Recepção',
    status_aprovacao_financeira: 'Aprovado Financeiramente',
    conta_pagamento_id: contaId,
    conta_pagamento_nome: contaNome,
    data_aprovacao_financeira: agora,
    historico: historicoAtualizado,
  });

  await registrarTransicao({
    pedidoId: pedido.id,
    pedidoNumero: pedido.numero,
    statusAnterior,
    statusNovo: 'Aguardando Recepção',
    responsavel: {
      id: authData.intervenienteId || authData.userId,
      nome: aprovador,
      email: authData.intervenienteEmail || '',
    },
    tipoAutenticacao: 'Interveniente',
    codigoOperacao: authData.codigoOperacao || authData.operationCode || '',
    observacao: `Aprovação financeira. Conta: ${contaNome || contaId}`,
    historicoAtual: historicoAtualizado,
  });

  const lancamentos = lancamentosExistentes;
  const valor = calcValorTotalPedidoCompra(pedido);

  if (lancamentos.length === 0) {
    await base44.entities.LancamentoFinanceiro.create({
      tipo: 'Despesa',
      descricao: `Compra - ${pedido.fornecedor_nome || pedido.numero}`,
      terceiro_id: pedido.fornecedor_id,
      terceiro_nome: pedido.fornecedor_nome,
      valor,
      valor_liquido: valor,
      data_vencimento: pedido.data_prevista_entrega || format(new Date(), 'yyyy-MM-dd'),
      status: 'Em Aberto',
      status_conciliacao: 'N/A',
      conta_financeira_id: contaId,
      conta_financeira_nome: contaNome,
      referencia_id: pedido.id,
      referencia_tipo: 'PedidoCompra',
      referencia_numero: pedido.numero,
      observacoes: notaAprovacao.trim(),
      is_custo_mercadoria: true,
      pedido_compra_vinculado_id: pedido.id,
      pedido_compra_vinculado_numero: pedido.numero,
      forma_pagamento_tipo: pedido.forma_pagamento_compra || undefined,
      forma_pagamento_compra: pedido.forma_pagamento_compra || undefined,
    });
  } else {
    for (const l of lancamentos) {
      if (isLancamentoPago(l)) continue;
      await base44.entities.LancamentoFinanceiro.update(l.id, {
        tipo: 'Despesa',
        status: 'Em Aberto',
        conta_financeira_id: contaId,
        conta_financeira_nome: contaNome,
        is_custo_mercadoria: true,
        pedido_compra_vinculado_id: pedido.id,
        pedido_compra_vinculado_numero: pedido.numero,
        observacoes: (l.observacoes || '') + notaAprovacao,
        forma_pagamento_tipo: l.forma_pagamento_tipo || pedido.forma_pagamento_compra || undefined,
        forma_pagamento_compra: l.forma_pagamento_compra || pedido.forma_pagamento_compra || undefined,
      });
    }
  }

  return { statusNovo: 'Aguardando Recepção' };
}

export async function rejeitarPedidoCompraFinanceiro({ base44, pedido, motivo, authData = {} }) {
  if (!pedido?.id || !motivo?.trim()) {
    throw new Error('Informe o motivo da rejeição.');
  }

  const motivoLimpo = motivo.trim();
  const nota = `\n[Rejeitado Financeiramente: ${motivoLimpo} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`;

  await base44.entities.PedidoCompra.update(pedido.id, {
    status: 'Cancelado',
    status_aprovacao_financeira: 'Rejeitado Financeiramente',
    motivo_rejeicao_financeira: motivoLimpo,
    data_rejeicao_financeira: new Date().toISOString(),
    historico: (pedido.historico || '') + nota,
  });

  const lancamentos = await listarLancamentosPedidoCompra(base44, pedido.id);
  await Promise.all(
    lancamentos
      .filter((l) => l.status === 'Em Aberto' || l.status === 'Vencido')
      .map((l) =>
        base44.entities.LancamentoFinanceiro.update(l.id, {
          status: 'Cancelado',
          observacoes: `${l.observacoes || ''}${nota}`.trim(),
        })
      )
  );

  return { statusNovo: 'Cancelado' };
}

export async function liberarEdicaoPedidoCompraFinanceiro({ base44, pedido, authData = {} }) {
  if (!pedido?.id) throw new Error('Pedido não encontrado.');

  const nota = `| Liberar edição | Ref: ${authData.operationCode || authData.codigoOperacao || ''} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  await cancelarLancamentosNaoPagosPedidoCompra(base44, pedido.id, nota);

  await base44.entities.PedidoCompra.update(pedido.id, {
    status: 'Rascunho',
    status_aprovacao_financeira: 'Pendente',
    historico:
      (pedido.historico || '') +
      `\n[Liberado para Edição: ${nomeAprovador(authData)} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`,
  });

  return { statusNovo: 'Rascunho' };
}
