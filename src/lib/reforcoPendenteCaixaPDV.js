import { roundToTwoDecimals } from '@/lib/financialUtils';
import { gerarNumeroSequencial } from '@/lib/gerarNumeroSequencial';
import {
  buildMapaContrapartesTransferencia,
  contaUsaRegraCaixaPDV,
  isTransferenciaEntreContas,
} from '@/lib/saldoContaFinanceira';
import { findTurnoAbertoParaCaixa } from '@/lib/turnoCaixaAberto';
import { appendTurnoArrayId } from '@/lib/caixaTurnoData';
import { sincronizarSaldosAposAlteracao } from '@/lib/sincronizarSaldoContasFinanceiras';

export const STATUS_REFORCO_PENDENTE = 'Pendente';
export const STATUS_REFORCO_ATIVO = 'Ativo';

export function isReforcoPendente(movimento) {
  return movimento?.tipo === 'Reforço' && movimento?.status_registro === STATUS_REFORCO_PENDENTE;
}

/** Status do reforço PDV vinculado a transferência financeira (para tag no extrato/fluxo). */
export function statusReforcoTransferenciaPdv(movimento) {
  if (!movimento || movimento.tipo !== 'Reforço' || !movimento.lancamento_financeiro_id) return null;
  if (isReforcoPendente(movimento)) return 'aguardando_caixa';
  if (movimento.status_registro === 'Ativo' || movimento.status_registro === 'Editado') return 'aceito_caixa';
  return null;
}

export function mapReforcosTransferenciaPorLancamentoId(movimentos = []) {
  const map = new Map();
  movimentos.forEach((m) => {
    if (m?.tipo === 'Reforço' && m?.lancamento_financeiro_id) {
      map.set(String(m.lancamento_financeiro_id), m);
    }
  });
  return map;
}

/** Reforço pendente vinculado a transferência não aparece como linha separada no extrato. */
export function isMovimentoReforcoTransferenciaPdv(movimento) {
  return movimento?.tipo === 'Reforço' && !!movimento?.lancamento_financeiro_id;
}

export function movimentoReforcoContaSaldo(movimento) {
  if (!movimento || movimento?.tipo !== 'Reforço') return 0;
  if (movimento.status_registro === 'Cancelado') return 0;
  if (isReforcoPendente(movimento)) return 0;
  return Number(movimento.valor || 0);
}

/**
 * Transferência financeira com destino Caixa PDV: cria reforço aguardando confirmação do operador.
 */
export async function criarReforcoPendenteTransferenciaCaixaPDV(
  base44,
  {
    contaDestino,
    contaOrigem,
    valor,
    lancamentoReceitaId,
    usuarioId,
    usuarioNome,
    observacaoExtra = '',
  },
) {
  if (!contaUsaRegraCaixaPDV(contaDestino)) return null;

  const amount = roundToTwoDecimals(valor);
  if (!contaDestino?.id || amount <= 0) return null;

  const turnoAberto = await findTurnoAbertoParaCaixa(contaDestino.id);
  const numero = await gerarNumeroSequencial('MCX');
  const origemNome = contaOrigem?.nome || 'conta de origem';
  const observacao = [
    `Transferência de ${origemNome}`,
    observacaoExtra?.trim(),
    'Aguardando confirmação no caixa PDV',
  ]
    .filter(Boolean)
    .join(' — ');

  const movimento = await base44.entities.MovimentosCaixa.create({
    numero,
    tipo: 'Reforço',
    valor: amount,
    observacao,
    conta_id: contaDestino.id,
    turno_caixa_id: turnoAberto?.id || null,
    usuario_responsavel_id: usuarioId || 'sistema',
    usuario_responsavel_nome: usuarioNome || 'Financeiro',
    status_registro: STATUS_REFORCO_PENDENTE,
    lancamento_financeiro_id: lancamentoReceitaId || null,
  });

  return movimento;
}

export async function listarReforcosPendentesCaixaPDV(base44, contaCaixaId) {
  if (!contaCaixaId) return [];
  const rows = await base44.entities.MovimentosCaixa.filter({
    conta_id: contaCaixaId,
    tipo: 'Reforço',
    status_registro: STATUS_REFORCO_PENDENTE,
  });
  return (rows || []).filter((m) => isReforcoPendente(m));
}

/**
 * Transferências já lançadas para o PDV sem reforço pendente: cria retroativamente.
 */
export async function backfillReforcosPendentesTransferenciasCaixaPDV(base44, contas = []) {
  const pdvContas = contas.filter((c) => contaUsaRegraCaixaPDV(c));
  if (!pdvContas.length) return false;

  const [lancamentos, movimentos] = await Promise.all([
    base44.entities.LancamentoFinanceiro.list(),
    base44.entities.MovimentosCaixa.list(),
  ]);

  const receitasJaVinculadas = new Set(
    movimentos
      .filter((m) => m.lancamento_financeiro_id)
      .map((m) => String(m.lancamento_financeiro_id)),
  );
  const movimentoIds = new Set(movimentos.map((m) => String(m.id)));
  const mapaContrapartes = buildMapaContrapartesTransferencia(lancamentos);
  const pdvIds = new Set(pdvContas.map((c) => c.id));

  let criou = false;
  for (const receita of lancamentos) {
    if (receita.tipo !== 'Receita') continue;
    if (!pdvIds.has(receita.conta_financeira_id)) continue;
    if (!isTransferenciaEntreContas(receita)) continue;
    if (receita.status !== 'Pago' && !receita.data_pagamento) continue;
    if (receitasJaVinculadas.has(String(receita.id))) continue;
    if (
      receita.referencia_tipo === 'MovimentosCaixa' &&
      receita.referencia_id &&
      movimentoIds.has(String(receita.referencia_id))
    ) {
      continue;
    }

    const contaDestino = pdvContas.find((c) => c.id === receita.conta_financeira_id);
    const origemId = mapaContrapartes.get(receita.id);
    const contaOrigem = contas.find((c) => c.id === origemId) || { nome: receita.descricao?.replace(/^Transferência de\s+/i, '') };

    await criarReforcoPendenteTransferenciaCaixaPDV(base44, {
      contaDestino,
      contaOrigem,
      valor: receita.valor,
      lancamentoReceitaId: receita.id,
      usuarioId: 'sistema',
      usuarioNome: 'Retroativo',
      observacaoExtra: receita.observacoes || '',
    });
    criou = true;
  }

  return criou;
}

/**
 * Garante reforços pendentes para transferências sem par no caixa (ex.: lançamento de hoje).
 */
export async function ensureReforcosPendentesCaixaPDV(base44, contaCaixaId) {
  if (!contaCaixaId) return;
  const contas = await base44.entities.ContasFinanceiras.list();
  const conta = contas.find((c) => c.id === contaCaixaId);
  if (!contaUsaRegraCaixaPDV(conta)) return;
  await backfillReforcosPendentesTransferenciasCaixaPDV(base44, contas);
}

/**
 * Operador do PDV confirma que o dinheiro físico chegou à gaveta.
 */
export async function confirmarReforcoPendenteCaixaPDV(
  base44,
  { movimento, turnoAtivo, currentUser },
) {
  if (!movimento?.id || !isReforcoPendente(movimento)) {
    throw new Error('Reforço pendente não encontrado.');
  }
  if (!turnoAtivo?.id) {
    throw new Error('Abra o turno do caixa antes de confirmar o reforço.');
  }
  if (!currentUser?.id) {
    throw new Error('Usuário do caixa não identificado.');
  }

  const atualizado = await base44.entities.MovimentosCaixa.update(movimento.id, {
    status_registro: STATUS_REFORCO_ATIVO,
    turno_caixa_id: turnoAtivo.id,
    usuario_responsavel_id: currentUser.id,
    usuario_responsavel_nome: currentUser.full_name || currentUser.email || 'Operador',
  });

  await appendTurnoArrayId(base44, turnoAtivo.id, 'movimentos_ids', movimento.id);
  await sincronizarSaldosAposAlteracao(base44, [movimento.conta_id]);

  return atualizado;
}
