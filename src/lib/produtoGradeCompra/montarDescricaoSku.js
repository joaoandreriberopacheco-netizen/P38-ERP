/**
 * Monta descrição do SKU a partir de produto_compra + eixos (substitui hierarquia livre).
 */
export function montarDescricaoSku({
  produtoCompraNome = '',
  eixoANome = '',
  eixoBNome = '',
  marca = '',
} = {}) {
  return [produtoCompraNome, eixoANome, eixoBNome, marca]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function montarDescricaoSkuFromProduto(produto = {}, produtoCompra = null, eixoA = null, eixoB = null) {
  const pcNome = produtoCompra?.nome
    || produto?.produto_compra_nome
    || '';
  const a = eixoA?.nome || produto?.eixo_a_texto || '';
  const b = eixoB?.nome || produto?.eixo_b_texto || '';
  return montarDescricaoSku({
    produtoCompraNome: pcNome,
    eixoANome: a,
    eixoBNome: b,
    marca: produto?.marca,
  });
}
