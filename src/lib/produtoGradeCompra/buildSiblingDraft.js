import { montarDescricaoSku } from './montarDescricaoSku';

function stripIdentity(produto = {}) {
  const {
    id: _id,
    created_date: _cd,
    updated_date: _ud,
    created_by: _cb,
    ...rest
  } = produto;
  return rest;
}

/**
 * Rascunho de produto novo herdado de um irmão na mesma grelha.
 * Mantém linha, produto_compra, custos, unidades; zera identidade e estoque.
 */
export function buildSiblingDraft(irmao = {}, {
  linha = null,
  produtoCompra = null,
  eixoA = null,
  eixoB = null,
  eixoATexto = '',
  eixoBTexto = '',
  limparEixoA = false,
  limparEixoB = false,
} = {}) {
  const base = stripIdentity(irmao);

  const eixoAId = limparEixoA ? '' : (eixoA?.id || base.eixo_a_valor_id || '');
  const eixoBId = limparEixoB ? '' : (eixoB?.id || base.eixo_b_valor_id || '');
  const eixoATxt = limparEixoA ? '' : (eixoA?.nome || eixoATexto || base.eixo_a_texto || '');
  const eixoBTxt = limparEixoB ? '' : (eixoB?.nome || eixoBTexto || base.eixo_b_texto || '');

  const pcNome = produtoCompra?.nome || base.produto_compra_nome || '';
  const nome = montarDescricaoSku({
    produtoCompraNome: pcNome,
    eixoANome: eixoATxt,
    eixoBNome: eixoBTxt,
    marca: base.marca,
  });

  return {
    ...base,
    linha_compra_id: linha?.id || base.linha_compra_id || '',
    produto_compra_id: produtoCompra?.id || base.produto_compra_id || '',
    eixo_a_valor_id: eixoAId,
    eixo_b_valor_id: eixoBId,
    eixo_a_texto: eixoATxt,
    eixo_b_texto: eixoBTxt,
    codigo_interno: '',
    codigo_barras: '',
    estoque_atual: 0,
    produto_compra_avulso: false,
    nome: nome ? nome.toUpperCase() : '',
  };
}

/** Escolhe o melhor irmão para herdar (mesma linha / produto_compra; prefere mesma linha de eixo A). */
export function pickSiblingForCell(produtos = [], {
  linhaId,
  produtoCompraId,
  eixoA = null,
} = {}) {
  const pool = produtos.filter((p) => {
    if (linhaId && p.linha_compra_id !== linhaId) return false;
    if (produtoCompraId && p.produto_compra_id !== produtoCompraId) return false;
    return true;
  });
  if (!pool.length) return null;

  if (eixoA?.id) {
    const sameA = pool.find((p) => p.eixo_a_valor_id === eixoA.id);
    if (sameA) return sameA;
  }
  if (eixoA?.nome) {
    const norm = String(eixoA.nome).trim().toUpperCase();
    const sameA = pool.find((p) => String(p.eixo_a_texto || '').trim().toUpperCase() === norm);
    if (sameA) return sameA;
  }

  return pool[0];
}
