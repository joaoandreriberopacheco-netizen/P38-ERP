/**
 * Código legível de despesa registrada no turno de caixa (LancamentoFinanceiro).
 * Usado no comprovante, acompanhamento do caixa e módulo de exclusão de documentos.
 */
export function codigoDespesaTurno(lancamento) {
  if (!lancamento?.id) return '';
  const compact = String(lancamento.id).replace(/-/g, '').toUpperCase();
  return `DSP-${compact.slice(0, 8)}`;
}

/** Termo de busca (número, descrição, ID completo ou código DSP). */
export function despesaTurnoCorrespondeTermo(lancamento, termoRaw) {
  const t = String(termoRaw || '').trim().toUpperCase();
  if (!t) return false;

  const codigo = codigoDespesaTurno(lancamento).toUpperCase();
  const id = String(lancamento.id || '').toUpperCase();
  const texto = [
    lancamento.numero,
    lancamento.descricao,
    lancamento.observacao,
    lancamento.observacoes,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  const codigoSemPrefixo = codigo.replace(/^DSP-/, '');
  const termoSemPrefixo = t.replace(/^DSP-/, '');

  return (
    texto.includes(t) ||
    id === t ||
    id.includes(t) ||
    codigo.includes(t) ||
    codigoSemPrefixo.startsWith(termoSemPrefixo)
  );
}
