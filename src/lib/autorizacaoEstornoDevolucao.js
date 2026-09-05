import { base44 } from '@/api/base44Client';
import { findTurnoAbertoParaCaixa } from '@/lib/turnoCaixaAberto';

function pedidoTurnoCaixaId(pedido) {
  return String(pedido?.turno_caixa_id ?? pedido?.dados?.turno_caixa_id ?? '').trim();
}

function turnoEstaAberto(turno) {
  return turno?.status === 'Aberto' && !turno?.data_fechamento;
}

/**
 * Resolve o turno de caixa que deve processar o reembolso em dinheiro.
 * Prioridade: turno original da venda (se aberto) → turno aberto do mesmo caixa PDV.
 */
export async function resolverTurnoDestinoEstornoDevolucao(pedido) {
  const turnoOrigemId = pedidoTurnoCaixaId(pedido);

  if (turnoOrigemId) {
    const turnoOrigem = await base44.entities.TurnoCaixa.get(turnoOrigemId);
    if (turnoEstaAberto(turnoOrigem)) {
      return turnoOrigem;
    }

    const contaCaixaId = String(turnoOrigem?.conta_caixa_pdv_id ?? '').trim();
    if (contaCaixaId) {
      const turnoAberto = await findTurnoAbertoParaCaixa(contaCaixaId);
      if (turnoAberto) return turnoAberto;
    }
  }

  const turnosAbertos = await base44.entities.TurnoCaixa.filter({ status: 'Aberto' });
  const lista = Array.isArray(turnosAbertos)
    ? turnosAbertos.filter(Boolean)
    : turnosAbertos?.id
      ? [turnosAbertos]
      : [];

  if (lista.length === 0) {
    throw new Error(
      'Nenhum turno de caixa aberto para receber o estorno. Abra um turno antes de registrar devolução em dinheiro.'
    );
  }

  return lista.sort(
    (a, b) => new Date(a.data_abertura || 0).getTime() - new Date(b.data_abertura || 0).getTime()
  )[0];
}

async function proximoNumeroAutorizacaoEstorno() {
  const todosEstornos = await base44.entities.AutorizacaoEstorno.list();
  const lista = Array.isArray(todosEstornos) ? todosEstornos : [];
  const nextEstorno =
    (lista.length > 0
      ? Math.max(...lista.map((a) => parseInt(a.numero?.split('-')[1] || 0, 10) || 0))
      : 0) + 1;
  return `AE-${String(nextEstorno).padStart(5, '0')}`;
}

/**
 * Cria uma única AutorizacaoEstorno para devolução em dinheiro (idempotente por devolução).
 */
export async function criarAutorizacaoEstornoDevolucao({
  pedido,
  numeroDev,
  totalDevolvido,
  tipo,
  motivo,
  user,
}) {
  const existentes = await base44.entities.AutorizacaoEstorno.filter({
    devolucao_numero: numeroDev,
    status: 'Pendente',
  });
  const pendentes = Array.isArray(existentes)
    ? existentes.filter(Boolean)
    : existentes?.id
      ? [existentes]
      : [];

  if (pendentes.length > 0) {
    return pendentes[0];
  }

  const duplicataPedido = await base44.entities.AutorizacaoEstorno.filter({
    pedido_origem_numero: pedido.numero,
    status: 'Pendente',
    forma_reembolso: 'Dinheiro',
  });
  const pendentesPedido = (Array.isArray(duplicataPedido) ? duplicataPedido : duplicataPedido?.id ? [duplicataPedido] : [])
    .filter((a) => Math.abs(Number(a.valor_autorizado || 0) - Number(totalDevolvido || 0)) < 0.01);

  if (pendentesPedido.length > 0) {
    return pendentesPedido[0];
  }

  const turnoDestino = await resolverTurnoDestinoEstornoDevolucao(pedido);
  const numeroEstorno = await proximoNumeroAutorizacaoEstorno();

  return base44.entities.AutorizacaoEstorno.create({
    numero: numeroEstorno,
    devolucao_id: numeroDev,
    devolucao_numero: numeroDev,
    pedido_origem_numero: pedido.numero,
    cliente_nome: pedido.cliente_nome,
    valor_autorizado: totalDevolvido,
    forma_reembolso: 'Dinheiro',
    motivo: `${tipo}${motivo ? ` - ${motivo}` : ''}`,
    turno_caixa_destino_id: turnoDestino.id,
    turno_caixa_destino_numero: turnoDestino.numero,
    gerente_aprovador_id: user?.id,
    gerente_aprovador_nome: user?.full_name,
    status: 'Pendente',
  });
}

/**
 * Cancela autorizações pendentes duplicadas da mesma devolução (mantém a processada).
 */
export async function cancelarAutorizacoesEstornoDuplicadas(devolucaoNumero, manterId = null) {
  const todas = await base44.entities.AutorizacaoEstorno.filter({
    devolucao_numero: devolucaoNumero,
    status: 'Pendente',
  });
  const pendentes = Array.isArray(todas) ? todas.filter(Boolean) : todas?.id ? [todas] : [];

  for (const auth of pendentes) {
    if (manterId && auth.id === manterId) continue;
    await base44.entities.AutorizacaoEstorno.update(auth.id, { status: 'Cancelado' });
  }
}
