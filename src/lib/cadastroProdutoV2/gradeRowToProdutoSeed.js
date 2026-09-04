import { montarNovoSku } from '@/lib/cadastroProdutoV2/montarNovoSku';
import { mapTipoLinhaUi } from '@/lib/modeloCatalogo/montarNomeSku';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Converte linha da grade v2 em rascunho de Produto (catálogo produção).
 * Preenche h1–h3 alinhados ao piloto cerâmica / portfolio.
 */
export function gradeRowToProdutoSeed({ row, linha, produtoCompra, eixos, solo, produtoExistente = null }) {
  const codigo = String(row.codigo_interno || produtoExistente?.codigo_interno || '').trim();
  const nomeProducao = String(produtoExistente?.nome || row._nome_producao || '').trim();

  let nome = montarNovoSku({
    linha,
    produtoCompra,
    eixoA: eixos?.useA ? row.eixo_a : '',
    eixoB: eixos?.useB ? row.eixo_b : '',
    marca: row.marca || produtoExistente?.marca,
    solo,
  });

  // Sem código: não substituir nome distintivo (Anjo, Luksonva, etc.) pela fórmula genérica.
  if (!codigo && nomeProducao) {
    nome = nomeProducao;
  }

  const tipoLinha = mapTipoLinhaUi(linha?.tipo);
  let h1 = '';
  let h2 = '';
  let h3 = '';

  if (solo) {
    h1 = linha?.nome || '';
    h2 = eixos?.useA ? String(row.eixo_a || '').trim() : '';
    h3 = eixos?.useB ? String(row.eixo_b || '').trim() : '';
  } else if (tipoLinha === 'portfolio') {
    h1 = produtoCompra?.nome || '';
    h2 = eixos?.useA ? String(row.eixo_a || '').trim() : '';
    h3 = eixos?.useB ? String(row.eixo_b || '').trim() : '';
  } else {
    h1 = produtoCompra?.nome || linha?.nome || '';
    h2 = eixos?.useA ? String(row.eixo_a || '').trim() : '';
    h3 = eixos?.useB ? String(row.eixo_b || '').trim() : '';
  }

  return {
    nome,
    codigo_interno: codigo.toUpperCase(),
    marca: String(row.marca || '').trim(),
    categoria_nome: linha?.categoria_nome || produtoCompra?.categoria_nome || '',
    campo_hierarquico_1: h1,
    campo_hierarquico_2: h2,
    campo_hierarquico_3: h3,
    campo_hierarquico_4: '',
    campo_hierarquico_5: '',
    valor_compra: num(row.valor_compra),
    preco_custo_calculado: num(row.valor_compra),
    preco_venda_padrao: num(row.preco_venda),
    estoque_atual: num(row.estoque),
    estoque_minimo: num(row.estoque_minimo),
    ativo: true,
    tipo: 'Produto',
  };
}

/** Actualiza linha da grade após gravar no catálogo produção. */
export function linkGradeRowFromProduto(row, produto, { linha, produtoCompra, eixos, solo } = {}) {
  if (!produto?.id) return row;
  return {
    ...row,
    produto_producao_id: produto.id,
    codigo_interno: produto.codigo_interno || row.codigo_interno,
    marca: produto.marca ?? row.marca,
    valor_compra: produto.valor_compra ?? produto.preco_custo_calculado ?? row.valor_compra,
    preco_venda: produto.preco_venda_padrao ?? row.preco_venda,
    estoque: produto.estoque_atual ?? row.estoque,
    estoque_minimo: produto.estoque_minimo ?? row.estoque_minimo,
    eixo_a: eixos?.useA ? (row.eixo_a || produto.campo_hierarquico_2 || '') : row.eixo_a,
    eixo_b: eixos?.useB ? (row.eixo_b || produto.campo_hierarquico_3 || '') : row.eixo_b,
    from_producao: true,
    _novo_sku: montarNovoSku({
      linha,
      produtoCompra,
      eixoA: eixos?.useA ? row.eixo_a : '',
      eixoB: eixos?.useB ? row.eixo_b : '',
      marca: produto.marca || row.marca,
      solo,
    }),
  };
}
