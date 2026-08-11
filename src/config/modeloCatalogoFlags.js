/**
 * Catálogo Modelo — laboratório paralelo (LINHA → produto compra → SKU).
 * Grava só em modelo_*; pode ler produto de produção (espelho).
 * Não altera cadastro, pedidos nem Sugestões de Compra reais.
 */
export const MODELO_CATALOGO_ENABLED = true;

/** Piloto actual — só cerâmica no universo de teste */
export const MODELO_PILOTO_LINHAS_ATIVAS = [
  { codigo: 'CERAMICA_BOLD', nome: 'CERÂMICA BOLD' },
  { codigo: 'CERAMICA_RETIF', nome: 'CERÂMICA RETIF' },
];

/** Próxima onda (mix) — ainda não activar no laboratório */
export const MODELO_PILOTO_LINHAS_PLANEADAS = [
  { codigo: 'ESGOTO', nome: 'CONEXÕES ESGOTO', tipo: 'linha_mix' },
  { codigo: 'SOLDAVEL', nome: 'CONEXÕES SOLDÁVEL', tipo: 'linha_mix' },
];

export const MODELO_PILOTO_CODIGOS_ATIVOS = MODELO_PILOTO_LINHAS_ATIVAS.map((l) => l.codigo);

/** Prefixo produto_compra permitido no piloto cerâmica */
export const MODELO_PILOTO_PREFIXO_PC = 'CERAM';
