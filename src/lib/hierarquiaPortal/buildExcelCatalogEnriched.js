import { enrichProdutoPortal } from '@/lib/hierarquiaPortal/buildPortalModel';
import { listPortalCatalogExcelSkusSync } from '@/lib/hierarquiaPortal/portalCatalogStore';
import { resolvePortalProdutoCodigo } from '@/lib/hierarquiaPortal/portalExcelManifest';

function stubProdutoFromExcel(excel) {
  const cod = String(excel.codigo_interno || '').trim().toUpperCase();
  return {
    id: `excel:${cod}`,
    codigo_interno: cod,
    nome: excel.novo_sku || cod,
    categoria_nome: excel.categoria || '',
    estoque_minimo: 0,
    _excelOnly: true,
  };
}

/**
 * Índice codigo_interno → produto (produção) para enriquecer estoque/nome real quando existir.
 */
export function indexProdutosByCodigo(produtos = []) {
  const map = new Map();
  for (const p of produtos || []) {
    const cod = resolvePortalProdutoCodigo(p);
    if (cod) map.set(cod, p);
  }
  return map;
}

/**
 * Monta linhas enriquecidas a partir do catálogo Excel/portal_catalog (todos os SKUs do manifest),
 * opcionalmente sobrepondo dados de produtos activos do ERP.
 */
export function buildEnrichedFromPortalCatalog(produtosIndex = new Map(), catalogStockContext = null) {
  const excelSkus = listPortalCatalogExcelSkusSync();
  const rows = [];

  for (const excel of excelSkus) {
    const cod = String(excel.codigo_interno || '').trim().toUpperCase();
    if (!cod) continue;
    const produto = produtosIndex.get(cod) || stubProdutoFromExcel(excel);
    const enriched = enrichProdutoPortal(produto, catalogStockContext);
    rows.push({
      ...enriched,
      excel_row: excel,
      cadastrado_erp: !produto._excelOnly,
    });
  }

  return rows.sort((a, b) => {
    if (a.linha_ordem !== b.linha_ordem) return a.linha_ordem - b.linha_ordem;
    const pcA = a.produto_compra_nome || '';
    const pcB = b.produto_compra_nome || '';
    if (pcA !== pcB) return pcA.localeCompare(pcB, 'pt-BR');
    return (a.novo_sku || a.produto?.nome || '').localeCompare(b.novo_sku || b.produto?.nome || '', 'pt-BR');
  });
}
