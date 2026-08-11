import { mapTipoLinhaUi } from '@/lib/modeloCatalogo/montarNomeSku';

/**
 * SMART SUPPLY simulado — agrupa por produto_compra (ou linha solo).
 * P.FUT* = estoque_simulado - estoque_minimo_simulado (simplificado).
 */
export function buildModeloSupplyLines({ linhas, produtosCompra, skus }) {
  const linhaById = new Map((linhas || []).map((l) => [l.id, l]));
  const pcById = new Map((produtosCompra || []).map((p) => [p.id, p]));
  const groups = new Map();

  for (const sku of skus || []) {
    const linha = linhaById.get(sku.linha_id);
    if (!linha) continue;
    const tipo = mapTipoLinhaUi(linha.tipo);
    const key = sku.produto_compra_id || `solo:${sku.linha_id}`;
    if (!groups.has(key)) {
      const pc = sku.produto_compra_id ? pcById.get(sku.produto_compra_id) : null;
      groups.set(key, {
        linha_id: linha.id,
        linha_codigo: linha.codigo,
        linha_nome: linha.nome,
        linha_tipo: tipo,
        categoria: linha.categoria_nome,
        produto_compra_id: pc?.id || null,
        produto_compra_nome: pc?.nome || linha.nome,
        meta_vagas: pc?.meta_vagas ?? null,
        massa_critica: pc?.massa_critica ?? null,
        skus: [],
      });
    }
    groups.get(key).skus.push(sku);
  }

  return [...groups.values()].map((g) => {
    const estoqueTotal = g.skus.reduce((n, s) => n + (Number(s.estoque_simulado) || 0), 0);
    const minimoTotal = g.skus.reduce((n, s) => n + (Number(s.estoque_minimo_simulado) || 0), 0);
    const zerados = g.skus.filter((s) => (Number(s.estoque_simulado) || 0) <= 0).length;
    const pfut = Math.round(estoqueTotal - minimoTotal);
    const alerta = zerados > 0 || pfut < 0;
    return {
      ...g,
      sku_count: g.skus.length,
      estoque_total: estoqueTotal,
      pfut_simulado: pfut,
      zerados,
      alerta,
    };
  }).sort((a, b) => a.produto_compra_nome.localeCompare(b.produto_compra_nome));
}
