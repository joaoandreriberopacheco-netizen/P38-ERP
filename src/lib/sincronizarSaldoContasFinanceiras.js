import { roundToTwoDecimals } from '@/lib/financialUtils';
import { DATA_CORTE_HISTORICO_PADRAO } from '@/lib/filtroDataFinanceiro';
import {
  calcularSaldosAposDataCorte,
  calcularSaldosTodasContas,
} from '@/lib/saldoContaFinanceira';

/**
 * Persiste `saldo_atual` alinhado à regra do Fluxo/Caixas.
 * Com data de corte: grava saldo pós-corte (saldo_inicial + movimentos desde o corte).
 */
export async function sincronizarSaldosContasFinanceiras(
  base44,
  {
    contas = [],
    lancamentos = [],
    movimentos = [],
    contaIds = [],
    dataCorte = DATA_CORTE_HISTORICO_PADRAO,
    usarCorteHistorico = true,
  } = {},
) {
  const ids = [...new Set((contaIds || []).filter(Boolean))];
  if (!ids.length || !contas.length) return;

  const contasAlvo = contas.filter((c) => ids.includes(c.id));
  const saldos = usarCorteHistorico && dataCorte
    ? calcularSaldosAposDataCorte(contasAlvo, lancamentos, movimentos, dataCorte)
    : calcularSaldosTodasContas(contasAlvo, lancamentos, movimentos);

  await Promise.all(
    ids.map((id) => {
      const saldo = saldos[id];
      if (saldo == null) return Promise.resolve();
      return base44.entities.ContasFinanceiras.update(id, {
        saldo_atual: roundToTwoDecimals(saldo),
      });
    }),
  );
}

/** Recarrega dados e persiste saldos — mesma regra do Fluxo e Caixas. */
export async function sincronizarSaldosAposAlteracao(base44, contaIds = [], options = {}) {
  const ids = [...new Set((contaIds || []).filter(Boolean))];
  if (!ids.length) return;

  const [contas, lancamentos, movimentos] = await Promise.all([
    base44.entities.ContasFinanceiras.list(),
    base44.entities.LancamentoFinanceiro.list(),
    base44.entities.MovimentosCaixa.list(),
  ]);

  await sincronizarSaldosContasFinanceiras(base44, {
    contas,
    lancamentos,
    movimentos,
    contaIds: ids,
    ...options,
  });
}
