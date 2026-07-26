import { montarDescricaoSku } from './montarDescricaoSku';

/**
 * Monta patch de grelha + nome para um produto (formulário ou massa).
 */
export function buildGradePatch({
  produto = {},
  linha = null,
  produtoCompra = null,
  eixoA = null,
  eixoB = null,
  eixoATexto = '',
  eixoBTexto = '',
  noMixAtivo,
  celulaObrigatoria,
  manterEixosExistentes = false,
  atualizarNome = true,
} = {}) {
  const patch = {};

  if (linha?.id) patch.linha_compra_id = linha.id;
  if (produtoCompra?.id) patch.produto_compra_id = produtoCompra.id;

  const resolveEixoA = () => {
    if (manterEixosExistentes && (produto.eixo_a_valor_id || produto.eixo_a_texto)) {
      return {
        id: produto.eixo_a_valor_id || '',
        nome: produto.eixo_a_texto || '',
      };
    }
    return {
      id: eixoA?.id || '',
      nome: eixoA?.nome || eixoATexto || '',
    };
  };

  const resolveEixoB = () => {
    if (manterEixosExistentes && (produto.eixo_b_valor_id || produto.eixo_b_texto)) {
      return {
        id: produto.eixo_b_valor_id || '',
        nome: produto.eixo_b_texto || '',
      };
    }
    return {
      id: eixoB?.id || '',
      nome: eixoB?.nome || eixoBTexto || '',
    };
  };

  const a = resolveEixoA();
  const b = resolveEixoB();

  if (!manterEixosExistentes || !(produto.eixo_a_valor_id || produto.eixo_a_texto)) {
    patch.eixo_a_valor_id = a.id || '';
    patch.eixo_a_texto = a.nome || '';
  }
  if (!manterEixosExistentes || !(produto.eixo_b_valor_id || produto.eixo_b_texto)) {
    patch.eixo_b_valor_id = b.id || '';
    patch.eixo_b_texto = b.nome || '';
  }

  if (noMixAtivo !== undefined) patch.no_mix_ativo = noMixAtivo === true;
  if (celulaObrigatoria !== undefined) patch.celula_obrigatoria = celulaObrigatoria === true;

  if (atualizarNome) {
    const pcNome = produtoCompra?.nome || linha?.nome || '';
    const nome = montarDescricaoSku({
      produtoCompraNome: pcNome,
      eixoANome: a.nome,
      eixoBNome: b.nome,
      marca: produto.marca,
    });
    if (nome) patch.nome = nome.toUpperCase();
  }

  return patch;
}
