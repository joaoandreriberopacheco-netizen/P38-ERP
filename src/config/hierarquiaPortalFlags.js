/**
 * Portal de preview da hierarquia (Categoria → LINHA → Produto compra → SKU).
 *
 * Papéis (visão alvo pós-corte):
 * - Catálogo /Produtos → cadastro (nome, hierarquia, unidades, preço)
 * - Portal SMART SUPPLY → giro, ponto futuro, saldável, ponte cotação fornecedor
 * - Sugestões de Compra → execução da cotação/reposição (legado hoje; converge para supply)
 */
import {
  MODELO_PILOTO_LINHAS_ATIVAS,
  MODELO_PILOTO_PREFIXO_PC,
} from '@/config/modeloCatalogoFlags';

export const HIERARQUIA_PORTAL_ENABLED = true;

/** Só SKUs presentes no Excel mestre (docs/P38-catalogo-skus-completo.xlsx). */
export const HIERARQUIA_PORTAL_FILTRAR_EXCEL = true;

/** Mesmas LINHAS activas que o catálogo Modelo (piloto cerâmica). */
export const HIERARQUIA_PORTAL_PILOTO_LINHAS = MODELO_PILOTO_LINHAS_ATIVAS;

export const HIERARQUIA_PORTAL_PILOTO_PREFIXO_PC = MODELO_PILOTO_PREFIXO_PC;
