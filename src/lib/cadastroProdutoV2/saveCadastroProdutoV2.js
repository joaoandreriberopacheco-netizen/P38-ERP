import { fetchCadastroV2Grade, upsertCadastroV2GradeBatch } from '@/lib/cadastroProdutoV2/fetchCadastroV2';
import {
  cadastroV2ToGradeRow,
  hydrateGradeFromProducao,
  mergeHydratedWithSaved,
  syncGradeFromProducao,
} from '@/lib/cadastroProdutoV2/hydrateGradeFromProducao';
import { montarNovoSku } from '@/lib/cadastroProdutoV2/montarNovoSku';
import { resolveEixosCadastro } from '@/lib/cadastroProdutoV2/resolveEixosCadastro';
import { mapTipoLinhaUi } from '@/lib/modeloCatalogo/montarNomeSku';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowToCadastroV2Payload({ row, linha, produtoCompra, eixos, solo }) {
  const novoSku = montarNovoSku({
    linha,
    produtoCompra,
    eixoA: eixos.useA ? row.eixo_a : '',
    eixoB: eixos.useB ? row.eixo_b : '',
    marca: row.marca,
    solo,
  });

  return {
    id: row.cadastro_v2_id || row.id || null,
    linha_id: linha.id,
    produto_compra_id: solo ? null : produtoCompra?.id || null,
    linha_codigo: linha.codigo,
    produto_compra_codigo: solo ? null : produtoCompra?.codigo || null,
    produto_producao_id: row.produto_producao_id || null,
    eixo_a_texto: eixos.useA ? String(row.eixo_a || '').trim() : '',
    eixo_b_texto: eixos.useB ? String(row.eixo_b || '').trim() : '',
    novo_sku: novoSku || produtoCompra?.nome || linha.nome,
    codigo_interno: String(row.codigo_interno || '').trim() || null,
    marca: String(row.marca || '').trim() || null,
    valor_compra: num(row.valor_compra),
    preco_venda: num(row.preco_venda),
    estoque_atual: num(row.estoque),
    estoque_minimo: num(row.estoque_minimo),
    hydrated_at: row.from_producao ? new Date().toISOString() : null,
    ativo: true,
  };
}

/**
 * Carrega grade: prioriza cadastro_v2; se vazio, hidrata SKUs reais.
 */
export async function loadGradeForContext({ produtos, linha, produtoCompra, solo }) {
  const saved = await fetchCadastroV2Grade({
    linhaId: linha.id,
    produtoCompraId: produtoCompra?.id,
    solo,
  });

  const hydrated = hydrateGradeFromProducao(produtos, { linha, produtoCompra, solo });

  if (saved.length) {
    const savedRows = saved.map(cadastroV2ToGradeRow);
    return mergeHydratedWithSaved(hydrated, savedRows);
  }

  return hydrated;
}

/** Actualiza só preço/estoque a partir dos SKUs reais. */
export function refreshGradeFromProducao(gradeRows, produtos, context) {
  return syncGradeFromProducao(gradeRows, produtos, context);
}

/**
 * Grava grade na entidade cadastro_v2_grade_sku (nunca em produto/produção).
 */
export async function saveGradeCadastroV2({ rows, linha, produtoCompra }) {
  const eixos = resolveEixosCadastro(produtoCompra, linha);
  const solo = eixos.solo;

  const valid = rows.filter((r) => {
    if (eixos.count === 0) return true;
    const hasA = !eixos.useA || String(r.eixo_a || '').trim();
    const hasB = !eixos.useB || String(r.eixo_b || '').trim();
    return hasA && hasB;
  });

  if (!valid.length) throw new Error('Nenhuma linha válida na grade');

  const payloads = valid.map((row) => rowToCadastroV2Payload({
    row,
    linha,
    produtoCompra: solo ? null : produtoCompra,
    eixos,
    solo,
  }));

  return upsertCadastroV2GradeBatch(payloads, {
    linhaId: linha.id,
    produtoCompraId: produtoCompra?.id,
    solo,
  });
}

export function linhaTipoLabel(linha) {
  const t = mapTipoLinhaUi(linha?.tipo);
  if (t === 'solo') return 'Solo';
  if (t === 'portfolio') return 'Portfolio';
  return 'Mix';
}

export { cadastroV2ToGradeRow };
