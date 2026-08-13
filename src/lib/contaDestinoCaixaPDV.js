import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  calcularSaldoContaFinanceira,
  contaUsaRegraCaixaPDV,
  getDataMovimentoCaixa,
  idsMovimentosComLancamentoFinanceiro,
} from '@/lib/saldoContaFinanceira';

/**
 * Conta financeira que recebe recolhimentos e o dinheiro do fechamento do caixa PDV.
 * Definida em Configurações → Financeiro → Contas (flag is_caixa_geral).
 */
export function resolveContaDestinoCaixaPDV(contas = []) {
  return contas.find((c) => c.is_caixa_geral === true && c.ativo !== false) ?? null;
}

function dataHojeIso() {
  return new Date().toISOString().slice(0, 10);
}

async function carregarContaFinanceira(base44, contaId) {
  if (!contaId) return null;
  const rows = await base44.entities.ContasFinanceiras.filter({ id: contaId });
  return rows?.[0] ?? null;
}

/** Par Despesa/Receita no fluxo de caixa (espelha transferência manual). */
async function registrarLancamentosTransferenciaCaixaPDV(
  base44,
  { contaOrigem, contaDestino, valor, descricao, movimentoId, dataPagamento },
) {
  const amount = roundToTwoDecimals(valor);
  if (!contaOrigem?.id || !contaDestino?.id || amount <= 0) return;

  const dataRef = dataPagamento || dataHojeIso();
  const ref = movimentoId
    ? { referencia_tipo: 'MovimentosCaixa', referencia_id: movimentoId }
    : {};
  const base = {
    valor: amount,
    data_vencimento: dataRef,
    data_pagamento: dataRef,
    status: 'Pago',
    status_conciliacao: 'N/A',
    categoria: 'Transferência entre Contas',
    ...ref,
  };

  await base44.entities.LancamentoFinanceiro.create({
    tipo: 'Despesa',
    descricao,
    conta_financeira_id: contaOrigem.id,
    conta_financeira_nome: contaOrigem.nome,
    observacoes: descricao,
    ...base,
  });

  await base44.entities.LancamentoFinanceiro.create({
    tipo: 'Receita',
    descricao: `Entrada de ${contaOrigem.nome}: ${descricao}`,
    conta_financeira_id: contaDestino.id,
    conta_financeira_nome: contaDestino.nome,
    observacoes: descricao,
    ...base,
  });
}

/** Saldo na gaveta = mesmo cálculo do extrato (lançamentos + movimentos). */
export async function resolverSaldoGavetaCaixaPDV(
  base44,
  contaCaixaPDV,
  lancamentos,
  movimentos,
) {
  if (!contaCaixaPDV?.id) {
    return { conta: null, saldoGaveta: 0, lancamentos: [], movimentos: [] };
  }
  const [contaFresh, lancs, movs] = await Promise.all([
    carregarContaFinanceira(base44, contaCaixaPDV.id),
    lancamentos ? Promise.resolve(lancamentos) : base44.entities.LancamentoFinanceiro.list(),
    movimentos ? Promise.resolve(movimentos) : base44.entities.MovimentosCaixa.list(),
  ]);
  const conta = contaFresh ?? contaCaixaPDV;
  const saldoGaveta = calcularSaldoContaFinanceira(conta, lancs, movs);
  return { conta, saldoGaveta, lancamentos: lancs, movimentos: movs };
}

/**
 * Turno fechado com PDV ainda gravada com saldo > 0: só zera o campo gravado.
 * Não cria lançamentos — recolhimentos/fechamento já transferem via movimentos reais.
 */
export async function reconciliarSaldoCaixaPDVSemTurnoAberto(base44, conta, contas, lancamentos, movimentos) {
  void contas;
  void lancamentos;
  void movimentos;
  if (!contaUsaRegraCaixaPDV(conta)) return false;

  const turnosAbertos = await base44.entities.TurnoCaixa.filter({
    conta_caixa_pdv_id: conta.id,
    status: 'Aberto',
  });
  if (turnosAbertos.length > 0) return false;

  const contaFresh = await carregarContaFinanceira(base44, conta.id);
  const gravado = Number(contaFresh?.saldo_atual ?? conta.saldo_atual ?? 0);
  if (gravado <= 0.009) return false;

  await base44.entities.ContasFinanceiras.update(conta.id, { saldo_atual: 0 });
  return true;
}

export async function creditarContaDestinoCaixaPDV(base44, contaDestino, valor) {
  const amount = roundToTwoDecimals(valor);
  if (!contaDestino?.id || amount <= 0) return;
  const contaFresh = await carregarContaFinanceira(base44, contaDestino.id);
  const base = contaFresh ?? contaDestino;
  await base44.entities.ContasFinanceiras.update(contaDestino.id, {
    saldo_atual: roundToTwoDecimals((base.saldo_atual || 0) + amount),
  });
}

/** Recolhimento durante o turno: debita PDV, credita destino e registra no fluxo de caixa. */
export async function transferirRecolhimentoCaixaPDV({
  base44,
  contaOrigem,
  contaDestino,
  valor,
  descricao,
  movimentoId,
}) {
  const amount = roundToTwoDecimals(valor);
  if (!contaOrigem?.id || !contaDestino?.id || amount <= 0) return;

  const origemFresh = (await carregarContaFinanceira(base44, contaOrigem.id)) ?? contaOrigem;
  await base44.entities.ContasFinanceiras.update(contaOrigem.id, {
    saldo_atual: roundToTwoDecimals(Math.max(0, (origemFresh.saldo_atual || 0) - amount)),
  });
  await creditarContaDestinoCaixaPDV(base44, contaDestino, amount);
  await registrarLancamentosTransferenciaCaixaPDV(base44, {
    contaOrigem: origemFresh,
    contaDestino,
    valor: amount,
    descricao,
    movimentoId,
  });
}

/**
 * Fechamento: transfere o dinheiro restante na gaveta para Caixa Geral e zera a conta PDV.
 * `valorTransferir` — saldo na gaveta do turno (caixaData.saldoAtual); se omitido, usa cálculo financeiro.
 */
export async function transferirDinheiroFechamentoCaixaPDV({
  base44,
  contaCaixaPDV,
  contaDestino,
  descricao,
  movimentoId,
  lancamentos,
  movimentos,
  valorTransferir,
}) {
  if (!contaCaixaPDV?.id) return { saldoRestante: 0, valorTransferido: 0 };

  const { conta: origemFresh, saldoGaveta } = await resolverSaldoGavetaCaixaPDV(
    base44,
    contaCaixaPDV,
    lancamentos,
    movimentos,
  );
  const saldoRestante = valorTransferir != null
    ? roundToTwoDecimals(Math.max(0, valorTransferir))
    : roundToTwoDecimals(Math.max(0, saldoGaveta));

  if (saldoRestante > 0.009) {
    if (!contaDestino?.id) {
      throw new Error(
        'Conta destino do caixa PDV não configurada. Vá em Configurações → Financeiro → Contas.'
      );
    }
    await creditarContaDestinoCaixaPDV(base44, contaDestino, saldoRestante);
    await registrarLancamentosTransferenciaCaixaPDV(base44, {
      contaOrigem: origemFresh,
      contaDestino,
      valor: saldoRestante,
      descricao,
      movimentoId,
    });
  }

  await base44.entities.ContasFinanceiras.update(contaCaixaPDV.id, { saldo_atual: 0 });

  return { saldoRestante, valorTransferido: saldoRestante };
}

/**
 * Sangrias/recolhimentos antigos sem par Despesa/Receita no fluxo: cria lançamentos
 * retroativos (só registo contábil; não altera saldo_atual gravado).
 */
export async function backfillLancamentosMovimentosCaixaPDV(base44, contas = []) {
  const contaDestino = resolveContaDestinoCaixaPDV(contas);
  if (!contaDestino) return false;

  const [movimentos, lancamentos] = await Promise.all([
    base44.entities.MovimentosCaixa.list(),
    base44.entities.LancamentoFinanceiro.list(),
  ]);
  const idsComLanc = idsMovimentosComLancamentoFinanceiro(lancamentos);
  const pdvById = Object.fromEntries(
    contas.filter((c) => contaUsaRegraCaixaPDV(c)).map((c) => [c.id, c]),
  );

  let criou = false;
  for (const mov of movimentos) {
    const contaOrigem = pdvById[mov.conta_id];
    if (!contaOrigem) continue;
    if (mov.tipo !== 'Sangria' && mov.tipo !== 'Recolhimento de Caixa') continue;
    if (idsComLanc.has(String(mov.id))) continue;

    const dataPagamento = getDataMovimentoCaixa(mov)?.slice(0, 10) || dataHojeIso();
    await registrarLancamentosTransferenciaCaixaPDV(base44, {
      contaOrigem,
      contaDestino,
      valor: mov.valor,
      descricao: mov.observacao || `${mov.tipo} — ${contaOrigem.nome}`,
      movimentoId: mov.id,
      dataPagamento,
    });
    criou = true;
  }
  return criou;
}
