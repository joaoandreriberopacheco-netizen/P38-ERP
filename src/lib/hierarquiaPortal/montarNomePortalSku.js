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

/** Label compacto — só eixos (produto compra já está no cabeçalho da esquadra). */
export function montarEixosPortalSku(row) {
  const a = pick(row.eixo_a, row.eixo_a_rotulo);
  const b = pick(row.eixo_b, row.eixo_b_rotulo);
  const parts = [a, b].filter(Boolean);
  if (parts.length) return parts.join(' · ');

  const full = montarNomePortalSku(row);
  const pc = row.solo ? pick(row.linha_nome) : pick(row.produto_compra_nome);
  if (pc) {
    const normFull = full.toUpperCase();
    const normPc = pc.toUpperCase();
    if (normFull.startsWith(normPc)) {
      const rest = full.slice(pc.length).trim();
      if (rest) return rest;
    }
  }
  return full;
}

/** Ordenação alfabética de SKUs portal por label de eixos. */
export function comparePortalSkuEixos(a, b) {
  return montarEixosPortalSku(a).localeCompare(montarEixosPortalSku(b), 'pt-BR', { sensitivity: 'base' });
}

/** Subtítulo do SKU — código interno. */
export function montarSubtituloPortalSku(row) {
  return pick(row.produto?.codigo_interno);
}
