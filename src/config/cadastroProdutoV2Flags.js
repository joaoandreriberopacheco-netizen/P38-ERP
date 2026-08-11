/**
 * Cadastro Produto v2 — produto compra + eixos (0–2), grade tipo Excel.
 * Grava em modelo_* e opcionalmente publica em produção (Produto).
 */
export const CADASTRO_PRODUTO_V2_ENABLED = true;

/** Reutiliza piloto cerâmica do laboratório */
export {
  MODELO_PILOTO_LINHAS_ATIVAS as CADASTRO_V2_LINHAS_ATIVAS,
  MODELO_PILOTO_CODIGOS_ATIVOS as CADASTRO_V2_LINHA_CODIGOS,
} from '@/config/modeloCatalogoFlags';
