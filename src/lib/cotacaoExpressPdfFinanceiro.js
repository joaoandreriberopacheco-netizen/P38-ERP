function roundFinanceiroCotacao(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function financeiroCotacaoNear(a, b, base = Math.abs(b)) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= Math.max(Math.abs(base) * 0.02, 0.5);
}

/**
 * Normaliza totais extraídos de PDF de cotação.
 * Garante que total_final reflita o valor a pagar após TODOS os descontos
 * (comercial, SUFRAMA/ICMS, etc.) e que desconto_global = subtotal - total_final.
 */
export function normalizarFinanceiroCotacaoPdf(financeiro = {}) {
  const subtotal = roundFinanceiroCotacao(financeiro.subtotal);
  let totalFinal = roundFinanceiroCotacao(financeiro.total_final);
  let descontoGlobal = roundFinanceiroCotacao(financeiro.desconto_global);
  const descontoComercial = roundFinanceiroCotacao(financeiro.desconto_comercial);
  const descontoSuframa = roundFinanceiroCotacao(
    financeiro.desconto_suframa ?? financeiro.desconto_icms_suframa,
  );

  const liquidoComercial = subtotal > 0 && descontoComercial > 0
    ? roundFinanceiroCotacao(subtotal - descontoComercial)
    : 0;
  const totalNfEsperado = liquidoComercial > 0 && descontoSuframa > 0
    ? roundFinanceiroCotacao(liquidoComercial - descontoSuframa)
    : 0;

  // Reconstruir total a partir de componentes (mais confiável que total_final/desconto_global da IA)
  if (totalNfEsperado > 0) {
    if (
      totalFinal <= 0
      || financeiroCotacaoNear(totalFinal, liquidoComercial)
      || financeiroCotacaoNear(totalFinal, subtotal)
      || totalFinal < totalNfEsperado * 0.85
    ) {
      totalFinal = totalNfEsperado;
    } else if (!financeiroCotacaoNear(totalFinal, totalNfEsperado) && totalFinal > totalNfEsperado) {
      if (financeiroCotacaoNear(totalFinal, liquidoComercial)) {
        totalFinal = totalNfEsperado;
      }
    }
  } else if (liquidoComercial > 0 && (totalFinal <= 0 || financeiroCotacaoNear(totalFinal, subtotal))) {
    totalFinal = liquidoComercial;
  } else if (subtotal > 0 && descontoSuframa > 0 && totalFinal > 0 && liquidoComercial <= 0) {
    const totalComSuframa = roundFinanceiroCotacao(totalFinal - descontoSuframa);
    if (
      totalComSuframa > 0
      && totalComSuframa < totalFinal
      && financeiroCotacaoNear(totalFinal, subtotal - descontoGlobal + descontoSuframa, subtotal)
    ) {
      totalFinal = totalComSuframa;
    }
  }

  // Reparo: total absurdamente baixo (ex.: dupla subtração de SUFRAMA ou desconto_global inflado)
  if (subtotal > 0 && totalFinal > 0 && totalFinal < subtotal * 0.35 && totalNfEsperado > totalFinal) {
    totalFinal = totalNfEsperado;
  }

  // Sempre derivar desconto_global do par subtotal/total_final — nunca o inverso
  if (subtotal > 0 && totalFinal > 0 && totalFinal < subtotal) {
    descontoGlobal = roundFinanceiroCotacao(subtotal - totalFinal);
  } else if (subtotal > 0 && totalFinal <= 0 && descontoGlobal > 0 && descontoGlobal < subtotal) {
    totalFinal = roundFinanceiroCotacao(subtotal - descontoGlobal);
    descontoGlobal = roundFinanceiroCotacao(subtotal - totalFinal);
  }

  return {
    subtotal,
    desconto_global: descontoGlobal,
    total_final: totalFinal,
    ...(descontoComercial > 0 ? { desconto_comercial: descontoComercial } : {}),
    ...(descontoSuframa > 0 ? { desconto_suframa: descontoSuframa } : {}),
  };
}

/** Ratio para ratear desconto nos preços unitários (0..1). */
export function calcularRatioDescontoCotacaoPdf(subtotalItens, financeiro = {}) {
  const fin = normalizarFinanceiroCotacaoPdf(financeiro);
  const itemSum = roundFinanceiroCotacao(subtotalItens);
  const totalFinal = fin.total_final;
  const docSubtotal = fin.subtotal;

  if (totalFinal <= 0) return 1;

  const tolerance = (base) => Math.max(Math.abs(base) * 0.025, 0.5);

  // Preços brutos alinhados ao subtotal do documento
  if (docSubtotal > 0 && Math.abs(itemSum - docSubtotal) <= tolerance(docSubtotal)) {
    if (totalFinal < docSubtotal) return totalFinal / docSubtotal;
    return 1;
  }

  // Preços já com desconto comercial (total líquido intermediário)
  if (docSubtotal > 0 && fin.desconto_comercial > 0) {
    const liquidoComercial = roundFinanceiroCotacao(docSubtotal - fin.desconto_comercial);
    if (Math.abs(itemSum - liquidoComercial) <= tolerance(liquidoComercial)) {
      if (totalFinal < liquidoComercial) return totalFinal / liquidoComercial;
      return 1;
    }
  }

  // Fallback: soma dos itens selecionados
  if (itemSum > 0 && totalFinal < itemSum) {
    return totalFinal / itemSum;
  }

  // Último recurso: ratio do documento quando linhas divergem levemente
  if (docSubtotal > 0 && totalFinal < docSubtotal) {
    return totalFinal / docSubtotal;
  }

  return 1;
}

/** Aplica desconto global nos preços unitários extraídos do PDF. */
export function aplicarDescontoUnitarioCotacaoPdf(itens, financeiro = {}) {
  const fin = normalizarFinanceiroCotacaoPdf(financeiro);
  const rows = (itens || []).map((item) => ({
    ...item,
    quantidade: Number(item.quantidade_pdf) || 0,
    precoBruto: Number(item.preco_unitario_pdf) || 0,
  }));
  const subtotalItens = rows.reduce((sum, row) => sum + row.quantidade * row.precoBruto, 0);
  const ratio = calcularRatioDescontoCotacaoPdf(subtotalItens, fin);

  return rows.map((row) => ({
    ...row,
    preco_unitario_liquido: roundFinanceiroCotacao(row.precoBruto * ratio),
    ratio_desconto: ratio,
  }));
}
