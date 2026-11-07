/** Data do corte de abertura (mesma referência do Fluxo e scripts de migração). */
export const DATA_CORTE_FINANCEIRO_ABERTURA = '2026-11-06';

/** Saldos de abertura em 06/11/2026 — documentação canónica. */
export const SALDOS_ABERTURA_CORTE_2026_11_06 = Object.freeze({
  caixaGeral: 0,
  caixaPdv: 0,
  bancoDoBrasil: 0,
  pagBank: 0,
  caixaPoupancaPP: 5997,
  caixaPj: 8.55,
});

export function normNomeContaCorte(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Abertura 06/11/2026 — nomes na BD podem variar; combina flags + nome. */
export function classificarContaCorteFinanceiro(conta) {
  if (!conta) return null;
  const nome = normNomeContaCorte(conta.nome);
  const tipo = normNomeContaCorte(conta.tipo || '');
  const isGeral = conta.is_caixa_geral === true;
  const isPdv = conta.is_caixa_pdv === true;

  if (isGeral || (nome.includes('geral') && nome.includes('caixa'))) {
    return { alvo: SALDOS_ABERTURA_CORTE_2026_11_06.caixaGeral, ocultar: false };
  }
  if (isPdv || nome.includes('gaveta') || (nome.includes('pdv') && nome.includes('caixa')) || nome === 'caixa pdv') {
    return { alvo: SALDOS_ABERTURA_CORTE_2026_11_06.caixaPdv, ocultar: false };
  }
  if (nome.includes('brasil') || (nome.includes('banco') && nome.includes('brasil'))) {
    return { alvo: SALDOS_ABERTURA_CORTE_2026_11_06.bancoDoBrasil, ocultar: false };
  }
  if (nome.includes('pagbank') || (nome.includes('pag') && nome.includes('bank'))) {
    return { alvo: SALDOS_ABERTURA_CORTE_2026_11_06.pagBank, ocultar: false };
  }
  if (
    tipo.includes('poup')
    || nome.includes('poupanca')
    || (nome.includes('poup') && nome.includes('caixa'))
    || (nome.includes('caixa') && /\bpp\b/.test(nome))
  ) {
    return { alvo: SALDOS_ABERTURA_CORTE_2026_11_06.caixaPoupancaPP, ocultar: true };
  }
  if (nome.includes('pj') && nome.includes('caixa')) {
    return { alvo: SALDOS_ABERTURA_CORTE_2026_11_06.caixaPj, ocultar: true };
  }
  return null;
}

/**
 * Saldo inicial usado em calcularSaldoContaAposDataCorte.
 * No corte 06/11/2026 usa abertura acordada; noutras datas, saldo_inicial da conta.
 */
export function saldoInicialParaCalculoCorte(conta, dataCorte) {
  const gravado = Number(conta?.saldo_inicial || 0);
  if (!conta || !dataCorte) return gravado;
  if (dataCorte !== DATA_CORTE_FINANCEIRO_ABERTURA) return gravado;
  const hit = classificarContaCorteFinanceiro(conta);
  if (hit && Number.isFinite(hit.alvo)) return hit.alvo;
  return gravado;
}
