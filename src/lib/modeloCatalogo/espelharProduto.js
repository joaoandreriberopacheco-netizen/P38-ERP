import { planLinhaCompraAnalise } from '@/lib/hierarquiaPortal/planLinhaCompra';
import { inferirLinhaCodigo, findLinhaMeta } from '@/lib/hierarquiaPortal/inferirLinha';
import { montarNomeModeloSku, slugCodigo } from '@/lib/modeloCatalogo/montarNomeSku';

/**
 * Converte produto de PRODUÇÃO (read-only) em rascunho modelo_sku + hints LINHA/PC.
 * Não escreve em produto.
 */
export function espelharProdutoProducao(produto, { linhas = [], produtosCompra = [] } = {}) {
  const plan = planLinhaCompraAnalise(produto);
  const linhaCod = inferirLinhaCodigo(produto);
  const linhaMeta = findLinhaMeta(linhaCod);

  let linha = linhas.find((l) => l.codigo === linhaCod || l.nome === linhaMeta.nome);
  const pcNome = plan.produto_compra_nome || produto.campo_hierarquico_1 || '';
  let produtoCompra = linha
    ? produtosCompra.find((p) => p.linha_id === linha.id && (p.nome === pcNome || p.codigo === slugCodigo(pcNome)))
    : null;

  const solo = linhaMeta.tipo === 'solo';

  const draft = {
    linha_id: linha?.id || '',
    produto_compra_id: solo ? null : (produtoCompra?.id || ''),
    eixo_a_texto: plan.eixo_a || produto.campo_hierarquico_2 || '',
    eixo_b_texto: plan.eixo_b || produto.campo_hierarquico_3 || '',
    marca: produto.marca || '',
    estoque_simulado: Number(produto.estoque_atual) || 0,
    estoque_minimo_simulado: Number(produto.estoque_minimo) || 0,
    espelho_produto_id: produto.id,
    espelho_codigo_interno: produto.codigo_interno || '',
    codigo_interno: '',
    ativo: true,
  };

  draft.nome = montarNomeModeloSku({
    produtoCompraNome: solo ? '' : pcNome,
    eixoA: draft.eixo_a_texto,
    eixoB: draft.eixo_b_texto,
    marca: draft.marca,
    linhaNome: linha?.nome || linhaMeta.nome,
    solo,
  }) || produto.nome;

  return {
    draft,
    hints: {
      linha_codigo_sugerido: linhaCod,
      linha_nome_sugerido: linhaMeta.nome,
      linha_tipo_sugerido: linhaMeta.tipo,
      produto_compra_nome_sugerido: pcNome,
      linha_existente: !!linha,
      produto_compra_existente: !!produtoCompra,
      confianca: plan.confianca,
    },
    produto_producao: produto,
  };
}

export function applyModeloSkuSimilar(baseSku, { clearEixos = false } = {}) {
  if (!baseSku) return null;
  return {
    linha_id: baseSku.linha_id,
    produto_compra_id: baseSku.produto_compra_id,
    eixo_a_texto: clearEixos ? '' : (baseSku.eixo_a_texto || ''),
    eixo_b_texto: clearEixos ? '' : (baseSku.eixo_b_texto || ''),
    marca: baseSku.marca || '',
    estoque_simulado: 0,
    estoque_minimo_simulado: baseSku.estoque_minimo_simulado || 0,
    espelho_produto_id: null,
    espelho_codigo_interno: '',
    codigo_interno: '',
    nome: baseSku.nome,
    ativo: true,
  };
}
