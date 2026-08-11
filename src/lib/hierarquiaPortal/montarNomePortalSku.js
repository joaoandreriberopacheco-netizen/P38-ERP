import { montarNomeProposto } from '@/lib/hierarquiaPortal/planLinhaCompra';

function pick(...vals) {
  for (const v of vals) {
    const s = String(v || '').trim();
    if (s) return s;
  }
  return '';
}

/**
 * Nome canónico estilo coluna «novo_sku» do Excel:
 * produto_compra + ex_a + ex_b (+ marca se houver).
 * Ex.: CERAM BOLD ANTI 50x50 MEDINA
 */
export function montarNomePortalSku(row) {
  const fromExcel = pick(row.novo_sku);
  if (fromExcel) return fromExcel;

  const composed = montarNomeProposto({
    produtoCompraNome: row.solo ? pick(row.linha_nome) : pick(row.produto_compra_nome),
    eixoA: pick(row.eixo_a, row.eixo_a_rotulo),
    eixoB: pick(row.eixo_b, row.eixo_b_rotulo),
    marca: pick(row.produto?.marca),
  });
  return composed || pick(row.produto?.nome);
}

/** Subtítulo do SKU — código interno. */
export function montarSubtituloPortalSku(row) {
  return pick(row.produto?.codigo_interno);
}
