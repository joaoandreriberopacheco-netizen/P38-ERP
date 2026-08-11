/**
 * Comportamento das LINHAS na hierarquia catálogo → categoria → linha → prod → SKU.
 */

/** Mix e portfolio: máx. 2 eixos no produto compra. Terceiro eixo = outro produto compra. */
export const MAX_EIXOS_PRODUTO_COMPRA = 2;

export const LINHA_COMPORTAMENTOS = {
  solo: {
    tipo: 'solo',
    nome: 'Força especial (solo)',
    niveis: 'Categoria → LINHA → SKU',
    pula: 'produto de compra',
    controle: 'SKU único ou lista curta — massa crítica por SKU',
    intersubstituibilidade: 'Baixa — cada SKU é posto distinto ou substituto explícito',
    ruptura_tipica: 'Estoque zero ou ponto futuro negativo',
    eixos_max: '0–2 na LINHA (opcional); sem esquadra',
    descricao: 'Sem esquadra intermediária. SKU é a unidade de luta (ex. cimento, pregos).',
    exemplo: 'CIMENTO → SKU CP II 50 kg',
  },
  mix: {
    tipo: 'mix',
    nome: 'Mix (grelha A × B)',
    niveis: 'Categoria → LINHA → produto compra → SKU',
    pula: '—',
    controle: 'Composição plena — células da grelha devem estar cobertas (gaúcho completo)',
    intersubstituibilidade: 'Por eixo — medidas/classes intersubstituíveis na missão',
    ruptura_tipica: 'Ponto futuro negativo ou perda de massa crítica no SKU',
    eixos_max: '2 eixos (A×B). Terceiro = novo produto compra',
    descricao: 'Produto compra = esquadra; SKU = célula. Reposição mantém a grelha inteira.',
    exemplo: 'SOLDÁVEL → JOELHO 90° → 25 mm / 32 mm',
  },
  portfolio: {
    tipo: 'portfolio',
    nome: 'Portfólio (variantes)',
    niveis: 'Categoria → LINHA → produto compra → SKU',
    pula: '—',
    controle: 'Nível de cobertura (ex. 80%) — não exige 100% das opções cheias',
    intersubstituibilidade: 'Opcional entre variantes — cliente escolhe do leque',
    ruptura_tipica: 'Perda de massa crítica (cerâmica: 3 caixas não “conta”)',
    eixos_max: '2 eixos. Terceiro = novo produto compra',
    descricao: 'Regras por produto compra: tamanho do time (ex. 11 SKUs) + mínimo saldável.',
    exemplo: 'CERÂMICA → formato 60×60 → cores/modelos (cobertura 80%)',
  },
};

/** Tipos de ruptura para análise (Ranger) — além do estoque zero. */
export const TIPOS_RUPTURA = {
  estoque_zero: 'Ruptura clássica — estoque ≤ 0',
  ponto_futuro_negativo: 'Ponto futuro < 0 — incêndio previsto (média 30d)',
  massa_critica: 'Perda de massa crítica — SKU existe mas não é relevante (ex. 3 caixas cerâmica)',
};

export function niveisParaTipo(tipo) {
  return LINHA_COMPORTAMENTOS[tipo]?.niveis || LINHA_COMPORTAMENTOS.mix.niveis;
}

export function pulaProdutoCompra(tipo) {
  return tipo === 'solo';
}
