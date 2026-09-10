/**
 * Normalização compartilhada — job KPI margem e Relatório de Margem (entity layer).
 */

function isEmptyPromotedColumnValue(value) {
  return value === null || value === undefined || value === '';
}

/** Espelha `decorateRow` em supabaseEntityLayer (promove `dados` quando coluna vazia). */
export function decorateMargemEntityRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  if ('created_at' in out && out.created_at != null) out.created_date = out.created_at;
  if ('updated_at' in out && out.updated_at != null) out.updated_date = out.updated_at;

  if ('dados' in out && out.dados && typeof out.dados === 'object') {
    const dados = out.dados;
    delete out.dados;
    for (const [k, v] of Object.entries(dados)) {
      if (!(k in out) || isEmptyPromotedColumnValue(out[k])) {
        out[k] = v;
      }
    }
  }

  if ('extras' in out && out.extras && typeof out.extras === 'object') {
    const extras = out.extras;
    delete out.extras;
    for (const [k, v] of Object.entries(extras)) {
      if (!(k in out) || isEmptyPromotedColumnValue(out[k])) {
        out[k] = v;
      }
    }
  }

  return out;
}

/** Mesma normalização de linha que fetchPedidosVenda90d. */
export function normalizeMargemPedidoVendaItem(it) {
  return {
    ...it,
    produto_id: it?.produto_id ?? it?.produtoId,
    produtoId: it?.produto_id ?? it?.produtoId,
    quantidade_base: it?.quantidade_base,
    quantidade: it?.quantidade ?? it?.quantidade_comercial,
    fator_conversao: it?.fator_conversao ?? it?.fator_aplicado ?? 1,
    preco_final_unitario_fator1: it?.preco_final_unitario_fator1,
    preco_unitario_fator1: it?.preco_unitario_fator1 ?? it?.preco_unitario_praticado,
    preco_unitario_praticado: it?.preco_unitario_praticado ?? it?.preco_unitario_fator1,
    preco_unitario_comercial: it?.preco_unitario_comercial,
    total: it?.total,
    unidade_medida: it?.unidade_sigla ?? it?.unidade_medida,
  };
}

/** PedidoVenda após flatten — alinhado ao entity layer. */
export function decorateMargemPedidoVendaRow(p) {
  const flat = decorateMargemEntityRow(p);
  const totalCol = flat.total != null ? Number(flat.total) : NaN;
  const totalLegado = flat.valor_total != null ? Number(flat.valor_total) : NaN;
  if (Number.isFinite(totalCol) && totalCol > 0) {
    flat.valor_total = totalCol;
    flat.total = totalCol;
  } else if (Number.isFinite(totalLegado) && totalLegado > 0) {
    flat.valor_total = totalLegado;
    if (flat.total == null) flat.total = totalLegado;
  } else if (flat.total != null && flat.valor_total == null) {
    flat.valor_total = flat.total;
  }

  flat.status = flat.status || p?.dados?.status;
  flat.tipo = flat.tipo || p?.dados?.tipo;
  flat.created_date = flat.created_date ?? flat.created_at ?? p?.created_at;
  return flat;
}
