/**
 * Portal de hierarquia cerâmica (piloto).
 * Catálogo auxiliar em `portal_catalog` — não altera `public.produto`.
 */
import { p38PublicEnvBool } from '@/lib/p38PublicEnv';
import {
  MODELO_PILOTO_LINHAS_ATIVAS,
  MODELO_PILOTO_PREFIXO_PC,
} from '@/config/modeloCatalogoFlags';

/** @deprecated Mantido só para compatibilidade de env; o portal já não depende deste flag. */
export const HIERARQUIA_PORTAL_ENABLED = p38PublicEnvBool('VITE_HIERARQUIA_PORTAL_ENABLED', false);

/** Só SKUs presentes no Excel mestre (docs/P38-catalogo-skus-completo.xlsx). */
export const HIERARQUIA_PORTAL_FILTRAR_EXCEL = true;

/** Mesmas LINHAS activas que o catálogo Modelo + FORRO PVC piloto Smart Supply. */
export const HIERARQUIA_PORTAL_PILOTO_LINHAS = [
  ...MODELO_PILOTO_LINHAS_ATIVAS,
  { codigo: 'FORRO_PVC', nome: 'FORRO PVC' },
];

export const HIERARQUIA_PORTAL_PILOTO_PREFIXO_PC = MODELO_PILOTO_PREFIXO_PC;
