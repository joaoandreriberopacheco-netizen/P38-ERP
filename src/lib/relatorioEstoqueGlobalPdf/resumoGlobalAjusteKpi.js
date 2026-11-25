/**
 * Ajuste manual no KPI da página 1 do Resumo global (estoque físico).
 * Altere ou zere quando o desconto temporário deixar de valer.
 */
export const RESUMO_GLOBAL_DESCONTO_KPI_FISICO_RS = 18100;

export function resolveKpiFisicoResumoGlobal(totalIntegral = 0) {
  const integral = Math.max(0, Number(totalIntegral) || 0);
  const desconto = Math.max(0, Number(RESUMO_GLOBAL_DESCONTO_KPI_FISICO_RS) || 0);
  const descontoAplicado = Math.min(desconto, integral);
  const exibido = Math.max(0, integral - descontoAplicado);
  return { integral, descontoAplicado, exibido, ativo: descontoAplicado > 0 };
}
