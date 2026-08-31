/**
 * Adapta SKU do manifest Excel (pathway) para o formato que TreeGrid / MobileHierarquica
 * de Produtos já entendem — só Novo Ecosistema; não persiste h1–h5 no cadastro.
 */

import { montarNomePortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';

function trim(s) {
  return String(s ?? '').trim();
}

/** "A — Edificações" → "Edificações" */
function formatBlocoLabel(bloco) {
  const b = trim(bloco);
  const m = b.match(/^[A-C]\s*—\s*(.+)$/i);
  return m ? trim(m[1]) : b || '(sem bloco)';
}

/** "ALVENARIA" → "Alvenaria" */
function formatCoreLabel(core) {
  const c = trim(core);
  if (!c) return '';
  return c
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (ch) => ch.toUpperCase());
}

function normCodigo(c) {
  return trim(c).toUpperCase();
}

/**
 * Camadas pathway → pseudo h1–h4 para TreeGrid (só visualização).
 *
 * Modelo de negócio (João André):
 *   Edificações → Alvenaria (core) → LINHA → Produto compra → SKU
 *
 * Excel guarda mais detalhe (sub_bloco, grupo, pathway N/C/R); aqui colapsamos
 * para os 5 níveis legíveis no catálogo. SKUs solo ficam sob LINHA (h4 vazio).
 */
export function pathwayFieldsForTreeGrid(estudoRow) {
  const h1 = formatBlocoLabel(estudoRow.bloco);

  const h2 = formatCoreLabel(estudoRow.core) || '(sem núcleo)';

  const h3 = trim(estudoRow.linha_display || estudoRow.linha_nome) || '(sem LINHA)';

  let h4 = '';
  if (!estudoRow.solo) {
    h4 = trim(estudoRow.produto_compra_nome || estudoRow.produto_compra);
  }

  return { h1, h2, h3, h4 };
}

/**
 * @param {object} estudoRow — linha enriquecida do manifest
 * @param {object|null} produto — cadastro live (opcional), chave codigo_interno
 */
export function mapEstudoToProdutoCatalogRow(estudoRow, produto = null) {
  const { h1, h2, h3, h4 } = pathwayFieldsForTreeGrid(estudoRow);
  const codigo = normCodigo(estudoRow.codigo_interno);
  const nome =
    trim(estudoRow.novo_sku) ||
    trim(produto?.nome) ||
    montarNomePortalSku({ ...estudoRow, produto });

  const estoqueExcel = estudoRow.estoque_encontrado ? Number(estudoRow.estoque) || 0 : null;
  const siglaExcel = trim(estudoRow.estoque_sigla) || trim(produto?.unidade_principal) || 'UN';

  const base = produto
    ? { ...produto }
    : {
        id: codigo,
        codigo_interno: codigo,
        ativo: true,
        categoria_nome: trim(estudoRow.bloco) || '(Excel estudo)',
        unidade_principal: siglaExcel,
      };

  return {
    ...base,
    id: base.id || codigo,
    codigo_interno: codigo,
    nome,
    estoque_atual: estoqueExcel != null ? estoqueExcel : Number(base.estoque_atual) || 0,
    estoque_minimo:
      Number(estudoRow.estoque_minimo) ||
      Number(base.estoque_minimo) ||
      0,
    campo_hierarquico_1: h1,
    campo_hierarquico_2: h2,
    campo_hierarquico_3: h3,
    campo_hierarquico_4: h4,
    campo_hierarquico_5: '',
    /** Metadados pathway — cadastro estrutural Novo Ecosistema */
    _estudo: {
      bloco: estudoRow.bloco,
      sub_bloco: estudoRow.sub_bloco,
      grupo: estudoRow.grupo,
      core: estudoRow.core,
      linha_codigo: estudoRow.linha_codigo,
      linha_nome: estudoRow.linha_nome,
      linha_tipo: estudoRow.linha_tipo,
      produto_compra_nome: estudoRow.produto_compra_nome,
      eixo_a: estudoRow.eixo_a,
      eixo_b: estudoRow.eixo_b,
      novo_sku: estudoRow.novo_sku,
      fonte_excel: true,
    },
  };
}

/** Index cadastro por codigo_interno. */
export function indexProdutosPorCodigo(produtos = []) {
  const map = new Map();
  for (const p of produtos) {
    const cod = normCodigo(p?.codigo_interno);
    if (cod && !map.has(cod)) map.set(cod, p);
  }
  return map;
}

export function mapEstudoRowsToCatalogProdutos(enrichedRows = [], produtoByCodigo = null) {
  const byCodigo = produtoByCodigo || new Map();
  return enrichedRows.map((row) =>
    mapEstudoToProdutoCatalogRow(row, byCodigo.get(normCodigo(row.codigo_interno)) || null),
  );
}
