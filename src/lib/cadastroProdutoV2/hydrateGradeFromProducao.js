import { enrichProdutoPortal } from '@/lib/hierarquiaPortal/buildPortalModel';
import { montarNomePortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';
import { montarNovoSku } from '@/lib/cadastroProdutoV2/montarNovoSku';
import { resolveEixosCadastro } from '@/lib/cadastroProdutoV2/resolveEixosCadastro';

function norm(s) {
  return String(s || '').trim().toUpperCase();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function matchesContext(row, { linha, produtoCompra, solo }) {
  if (!linha || row.linha_codigo !== linha.codigo) return false;
  if (solo) return row.solo;
  if (!produtoCompra) return false;
  return (
    row.produto_compra_codigo === produtoCompra.codigo
    || norm(row.produto_compra_nome) === norm(produtoCompra.nome)
  );
}

/** SKU real (produto) → linha da grade editável. */
export function produtoEnriquecidoToGradeRow(row, { linha, produtoCompra, eixos, solo }) {
  const p = row.produto;
  const novoSku = montarNomePortalSku(row) || montarNovoSku({
    linha,
    produtoCompra,
    eixoA: eixos.useA ? row.eixo_a : '',
    eixoB: eixos.useB ? row.eixo_b : '',
    marca: p.marca,
    solo,
  });

  return {
    key: p.id,
    id: null,
    cadastro_v2_id: null,
    produto_producao_id: p.id,
    eixo_a: eixos.useA ? (row.eixo_a || row.eixo_a_rotulo || '') : '',
    eixo_b: eixos.useB ? (row.eixo_b || row.eixo_b_rotulo || '') : '',
    codigo_interno: p.codigo_interno || '',
    marca: p.marca || '',
    valor_compra: num(p.valor_compra ?? p.preco_custo_calculado),
    preco_venda: num(p.preco_venda_padrao),
    estoque: num(p.estoque_atual),
    estoque_minimo: num(p.estoque_minimo),
    from_producao: true,
    _novo_sku: novoSku,
  };
}

/**
 * Hidrata grade a partir de SKUs reais (catálogo produção).
 */
export function hydrateGradeFromProducao(produtos, { linha, produtoCompra, solo }) {
  const eixos = resolveEixosCadastro(produtoCompra, linha);
  const enriched = (produtos || []).map(enrichProdutoPortal);
  return enriched
    .filter((row) => matchesContext(row, { linha, produtoCompra, solo }))
    .map((row) => produtoEnriquecidoToGradeRow(row, { linha, produtoCompra, eixos, solo }))
    .sort((a, b) => String(a._novo_sku).localeCompare(String(b._novo_sku), 'pt-BR'));
}

/** Mescla preço/estoque da produção nas linhas já editadas (por produto_producao_id ou código). */
export function syncGradeFromProducao(gradeRows, produtos, context) {
  const hydrated = hydrateGradeFromProducao(produtos, context);
  const byProdId = new Map(hydrated.map((r) => [r.produto_producao_id, r]));
  const byCodigo = new Map(hydrated.filter((r) => r.codigo_interno).map((r) => [norm(r.codigo_interno), r]));

  return gradeRows.map((row) => {
    const src = (row.produto_producao_id && byProdId.get(row.produto_producao_id))
      || (row.codigo_interno && byCodigo.get(norm(row.codigo_interno)));
    if (!src) return row;
    return {
      ...row,
      produto_producao_id: src.produto_producao_id,
      valor_compra: src.valor_compra,
      preco_venda: src.preco_venda,
      estoque: src.estoque,
      estoque_minimo: src.estoque_minimo,
      from_producao: true,
    };
  });
}

/** Junta hidratação (SKUs reais) com linhas novas ainda não publicadas. */
export function mergeHydratedWithSaved(hydrated, saved) {
  if (!saved?.length) return hydrated;
  const byKey = new Map();
  for (const row of hydrated) {
    const k = `${row.eixo_a}::${row.eixo_b}::${norm(row.codigo_interno)}`;
    byKey.set(k, row);
  }
  for (const s of saved) {
    const k = `${s.eixo_a}::${s.eixo_b}::${norm(s.codigo_interno)}`;
    byKey.set(k, s);
  }
  return [...byKey.values()];
}

export function cadastroV2ToGradeRow(rec) {
  return {
    key: rec.id,
    id: rec.id,
    cadastro_v2_id: rec.id,
    produto_producao_id: rec.produto_producao_id || null,
    eixo_a: rec.eixo_a_texto || '',
    eixo_b: rec.eixo_b_texto || '',
    codigo_interno: rec.codigo_interno || '',
    marca: rec.marca || '',
    valor_compra: rec.valor_compra ?? '',
    preco_venda: rec.preco_venda ?? '',
    estoque: rec.estoque_atual ?? '',
    estoque_minimo: rec.estoque_minimo ?? '',
    from_producao: Boolean(rec.produto_producao_id),
  };
}
