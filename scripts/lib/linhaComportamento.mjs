/**
 * Comportamento das LINHAS na hierarquia catálogo → categoria → linha → prod → SKU.
 */

export const LINHA_COMPORTAMENTOS = {
  solo: {
    tipo: 'solo',
    nome: 'Força especial (solo)',
    niveis: 'Categoria → LINHA → SKU',
    pula: 'produto de compra',
    descricao: 'Sem esquadra intermediária. SKU é a unidade de luta (ex. cimento, pregos).',
    eixos: 'Opcional na LINHA; valores no SKU / descrição.',
    exemplo: 'CIMENTO → SKU CP II 50 kg',
  },
  mix: {
    tipo: 'mix',
    nome: 'Mix (grelha A × B)',
    niveis: 'Categoria → LINHA → produto compra → SKU',
    pula: '—',
    descricao: 'Produto compra define a esquadra; SKU ocupa célula da grelha.',
    eixos: 'Definir rótulo eixo A e B no produto compra (ex. A=medida, B=—).',
    exemplo: 'SOLDÁVEL → JOELHO 90° → 25 mm / 32 mm',
  },
  portfolio: {
    tipo: 'portfolio',
    nome: 'Portfólio (variantes)',
    niveis: 'Categoria → LINHA → produto compra → SKU',
    pula: '—',
    descricao: 'Família de variantes (cor, modelo, formato).',
    eixos: 'Ex. A=apresentação/volume, B=cor ou modelo.',
    exemplo: 'TINTA → linha marca → cor / volume',
  },
};

export function niveisParaTipo(tipo) {
  return LINHA_COMPORTAMENTOS[tipo]?.niveis || LINHA_COMPORTAMENTOS.mix.niveis;
}

export function pulaProdutoCompra(tipo) {
  return tipo === 'solo';
}
