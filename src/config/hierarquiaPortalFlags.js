/**
 * Portal de preview da hierarquia (Categoria → LINHA → Produto compra → SKU).
 *
 * **Produção:** desligado por defeito.
 * **Homologação:** `VITE_HIERARQUIA_PORTAL_ENABLED=true` (ou `NEXT_PUBLIC_*` no Next).
 */
import { p38PublicEnvBool } from '@/lib/p38PublicEnv';
import {
  MODELO_PILOTO_LINHAS_ATIVAS,
  MODELO_PILOTO_PREFIXO_PC,
} from '@/config/modeloCatalogoFlags';

export const HIERARQUIA_PORTAL_ENABLED = p38PublicEnvBool('VITE_HIERARQUIA_PORTAL_ENABLED', false);

/** Só SKUs presentes no Excel mestre (docs/P38-catalogo-skus-completo.xlsx). */
export const HIERARQUIA_PORTAL_FILTRAR_EXCEL = true;

/** Mesmas LINHAS activas que o catálogo Modelo (piloto cerâmica). */
export const HIERARQUIA_PORTAL_PILOTO_LINHAS = MODELO_PILOTO_LINHAS_ATIVAS;

export const HIERARQUIA_PORTAL_PILOTO_PREFIXO_PC = MODELO_PILOTO_PREFIXO_PC;
