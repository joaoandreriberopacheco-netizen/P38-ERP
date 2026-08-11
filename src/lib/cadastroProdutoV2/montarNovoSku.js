import { montarNomeModeloSku } from '@/lib/modeloCatalogo/montarNomeSku';

/** Coluna «novo_sku» — produto_compra + eixos preenchidos (+ marca). */
export function montarNovoSku({ linha, produtoCompra, eixoA, eixoB, marca, solo }) {
  return montarNomeModeloSku({
    linhaNome: linha?.nome,
    produtoCompraNome: solo ? '' : (produtoCompra?.nome || ''),
    eixoA: String(eixoA || '').trim(),
    eixoB: String(eixoB || '').trim(),
    marca: String(marca || '').trim(),
    solo: Boolean(solo),
  });
}

export function emptyGradeRow() {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    eixo_a: '',
    eixo_b: '',
    codigo_interno: '',
    marca: '',
    valor_compra: '',
    preco_venda: '',
    estoque: '',
    estoque_minimo: '',
    id: null,
  };
}
