/**
 * Regras de negócio — piloto cerâmica (produto_compra prefixo CERAM).
 * Laboratório modelo_*; não altera produção.
 */
export const CERAM_MASSA_CRITICA_CX = 16;
export const CERAM_META_VAGAS = 12;
export const CERAM_MIN_LINHAS_SALDAVEL = 9;

/** Estoque (cx simulado) atinge massa crítica */
export function atingeMassaCriticaCeramica(estoqueSimulado, massaCritica = CERAM_MASSA_CRITICA_CX) {
  return (Number(estoqueSimulado) || 0) >= Number(massaCritica);
}

/** Avalia produto compra cerâmica: posições, linhas com massa, saldável */
export function avaliarProdutoCompraCeramica(skus, {
  massaCritica = CERAM_MASSA_CRITICA_CX,
  metaVagas = CERAM_META_VAGAS,
  minLinhasSaldavel = CERAM_MIN_LINHAS_SALDAVEL,
} = {}) {
  const lista = skus || [];
  const linhasComMassa = lista.filter((s) => atingeMassaCriticaCeramica(s.estoque_simulado, massaCritica));
  const posicoesOcupadas = lista.length;
  const saldavel = linhasComMassa.length >= minLinhasSaldavel;
  return {
    posicoes_ocupadas: posicoesOcupadas,
    meta_vagas: metaVagas,
    linhas_com_massa_critica: linhasComMassa.length,
    min_linhas_saldavel: minLinhasSaldavel,
    massa_critica: massaCritica,
    saldavel,
    vagas_restantes: Math.max(0, metaVagas - posicoesOcupadas),
  };
}
