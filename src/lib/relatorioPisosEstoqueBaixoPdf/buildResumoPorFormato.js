export function extractFormatoPiso(nome) {
  const m = String(nome || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!m) return 'Outros';
  return `${m[1]}x${m[2]}`.toLowerCase();
}

export function sortFormatoPisoKeys(a, b) {
  const pa = String(a).match(/(\d+)x(\d+)/i);
  const pb = String(b).match(/(\d+)x(\d+)/i);
  if (pa && pb) {
    const areaA = Number(pa[1]) * Number(pa[2]);
    const areaB = Number(pb[1]) * Number(pb[2]);
    if (areaA !== areaB) return areaA - areaB;
  }
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
}

/**
 * Agrega linhas do relatório por formato (ex. 60x60).
 * quant = soma de CX em estoque; médias ponderadas por CX; total = Σ (CX × promo/CX).
 */
export function buildResumoPorFormatoPisos(rows = []) {
  const grupos = new Map();
  for (const row of rows) {
    const formato = extractFormatoPiso(row.nome);
    if (!grupos.has(formato)) grupos.set(formato, []);
    grupos.get(formato).push(row);
  }

  const linhas = [];
  for (const formato of [...grupos.keys()].sort(sortFormatoPisoKeys)) {
    const items = grupos.get(formato);
    const quant = items.reduce((s, r) => s + (Number(r.cx) || 0), 0);
    let wCusto = 0;
    let wPromo = 0;
    let wCart = 0;
    let totalPromo = 0;
    for (const r of items) {
      const cx = Number(r.cx) || 0;
      wCusto += cx * (Number(r.custo_calc_x_cx) || 0);
      wPromo += cx * (Number(r.preco_sim_40_cx) || 0);
      wCart += cx * (Number(r.preco_venda_cx) || 0);
      totalPromo += cx * (Number(r.preco_sim_40_cx) || 0);
    }
    const custo_medio = quant > 0 ? wCusto / quant : 0;
    const valor_promocao = quant > 0 ? wPromo / quant : 0;
    const valor_cartao = quant > 0 ? wCart / quant : 0;
    linhas.push({
      formato,
      quant: Math.round(quant * 100) / 100,
      custo_medio: Math.round(custo_medio * 100) / 100,
      valor_promocao: Math.round(valor_promocao * 100) / 100,
      valor_cartao: Math.round(valor_cartao * 100) / 100,
      total: Math.round(totalPromo * 100) / 100,
    });
  }

  const totais = linhas.reduce(
    (acc, r) => ({
      quant: acc.quant + (Number(r.quant) || 0),
      total: acc.total + (Number(r.total) || 0),
    }),
    { quant: 0, total: 0 },
  );
  totais.quant = Math.round(totais.quant * 100) / 100;
  totais.total = Math.round(totais.total * 100) / 100;

  return { linhas, totais };
}
