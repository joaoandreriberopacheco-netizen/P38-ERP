/**
 * Cadastro Produto v2 — produto compra + eixos (0–2), grade tipo Excel.
 * Grava em cadastro_v2_grade_sku; publicação no catálogo é acção explícita.
 *
 * **Produção:** desligado por defeito (activar só em homologação).
 */
import { p38PublicEnvBool } from '@/lib/p38PublicEnv';

export const CADASTRO_PRODUTO_V2_ENABLED = p38PublicEnvBool('VITE_CADASTRO_PRODUTO_V2_ENABLED', false);

/** Reutiliza piloto cerâmica do laboratório */
export {
  MODELO_PILOTO_LINHAS_ATIVAS as CADASTRO_V2_LINHAS_ATIVAS,
  MODELO_PILOTO_CODIGOS_ATIVOS as CADASTRO_V2_LINHA_CODIGOS,
} from '@/config/modeloCatalogoFlags';
