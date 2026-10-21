/**
 * Parcela ao cliente com juros compostos (Price) — alinhado ao SimuladorCartaoSheet (PDV).
 */
export function calcularParcelaComJurosCliente(valorTotal, taxaMensalPercent, parcelas) {
  const pv = Number(valorTotal) || 0;
  const n = Math.max(1, Number(parcelas) || 1);
  if (n <= 1) return pv;
  const i = Number(taxaMensalPercent) / 100;
  if (!Number.isFinite(i) || i === 0) return pv / n;
  return pv * i / (1 - Math.pow(1 + i, -n));
}
