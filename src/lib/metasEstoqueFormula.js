/** Texto canónico da regra automática de estoque mínimo / ideal (v4). */
export const METAS_ESTOQUE_FORMULA_MEDIA = 'vendas 60d ÷ 60';
export const METAS_ESTOQUE_FORMULA_MINIMO = `${METAS_ESTOQUE_FORMULA_MEDIA} × 0,5 × lead time`;
export const METAS_ESTOQUE_FORMULA_IDEAL = `${METAS_ESTOQUE_FORMULA_MEDIA} × lead time`;

export const METAS_ESTOQUE_FORMULA_RESUMO = [
  `Estoque mínimo = ${METAS_ESTOQUE_FORMULA_MINIMO}`,
  `Estoque ideal = ${METAS_ESTOQUE_FORMULA_IDEAL}`,
];
