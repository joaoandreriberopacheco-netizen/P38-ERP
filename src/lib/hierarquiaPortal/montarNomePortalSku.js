import { montarNomeProposto } from '@/lib/hierarquiaPortal/planLinhaCompra';

function pick(...vals) {
  for (const v of vals) {
    const s = String(v || '').trim();
    if (s) return s;
  }
  return '';
}

/** Nome completo estilo “novo SKU” (PC + eixos + marca). */
export function montarNomePortalSku(row) {
  const composed = montarNomeProposto({
    produtoCompraNome: row.solo ? pick(row.linha_nome) : pick(row.produto_compra_nome),
    eixoA: pick(row.eixo_a, row.eixo_a_rotulo),
    eixoB: pick(row.eixo_b, row.eixo_b_rotulo),
    marca: pick(row.produto?.marca),
  });
  return composed || pick(row.produto?.nome);
}

/** Rótulo do SKU dentro de uma esquadra — só o que varia (eixos), sem repetir PC. */
export function montarVariantePortalSku(row) {
  const ea = pick(row.eixo_a, row.eixo_a_rotulo);
  const eb = pick(row.eixo_b, row.eixo_b_rotulo);
  if (ea && eb) return `${ea} × ${eb}`;
  if (ea || eb) return ea || eb;
  return pick(row.produto?.codigo_interno, row.produto?.nome);
}

/** Subtítulo do SKU — código interno, nunca repetir eixo já visível no rótulo. */
export function montarSubtituloPortalSku(row) {
  return pick(row.produto?.codigo_interno);
}
