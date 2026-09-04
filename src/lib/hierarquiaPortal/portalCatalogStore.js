/**
 * Runtime cache do catálogo portal (tabela auxiliar portal_catalog).
 * Fallback: manifest JSON em portalExcelManifest.js
 */
let catalogRows = [];
let catalogSkuMap = new Map();
let catalogLinhas = [];
let catalogSource = 'none'; // 'supabase' | 'manifest' | 'none'

function mapRowToExcelShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo_interno: row.codigo_interno,
    produto_id: row.produto_id,
    categoria: row.categoria_nome,
    linha_codigo: row.linha_codigo,
    linha_nome: row.linha_nome,
    linha_tipo: row.linha_tipo,
    linha_ordem: row.linha_ordem,
    produto_compra: row.produto_compra_nome,
    produto_compra_codigo: row.produto_compra_codigo,
    ex_a: row.eixo_a_texto,
    ex_b: row.eixo_b_texto,
    novo_sku: row.novo_sku,
    reserva_portal: row.reserva_portal === true,
    fonte: row.fonte,
  };
}

function rebuildIndex(rows) {
  catalogRows = rows || [];
  catalogSkuMap = new Map();
  const linhasMap = new Map();
  for (const row of catalogRows) {
    const cod = String(row.codigo_interno || '').trim().toUpperCase();
    if (!cod) continue;
    catalogSkuMap.set(cod, mapRowToExcelShape(row));
    if (!linhasMap.has(row.linha_codigo)) {
      linhasMap.set(row.linha_codigo, {
        codigo: row.linha_codigo,
        nome: row.linha_nome,
        tipo: row.linha_tipo || 'portfolio',
        ordem: row.linha_ordem ?? 10,
      });
    }
  }
  catalogLinhas = [...linhasMap.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

export function setPortalCatalogCache(rows, source = 'supabase') {
  rebuildIndex(rows);
  catalogSource = source;
}

export function clearPortalCatalogCache() {
  rebuildIndex([]);
  catalogSource = 'none';
}

export function isPortalCatalogLoaded() {
  return catalogSkuMap.size > 0;
}

export function getPortalCatalogSource() {
  return catalogSource;
}

export function getPortalCatalogSkuSync(codigoInterno) {
  const cod = String(codigoInterno || '').trim().toUpperCase();
  return catalogSkuMap.get(cod) || null;
}

export function getPortalCatalogLinhasSync() {
  return catalogLinhas;
}

export function getPortalCatalogSkuCountSync() {
  return catalogSkuMap.size;
}

export function isProdutoInPortalCatalogSync(produtoOrCodigo) {
  const cod =
    typeof produtoOrCodigo === 'string'
      ? produtoOrCodigo
      : (produtoOrCodigo?.codigo_interno || '');
  return catalogSkuMap.has(String(cod).trim().toUpperCase());
}

export function isProdutoReservaPortalSync(produtoOrCodigo) {
  const sku = getPortalCatalogSkuSync(
    typeof produtoOrCodigo === 'string' ? produtoOrCodigo : produtoOrCodigo?.codigo_interno,
  );
  return sku?.reserva_portal === true;
}

export function filterProdutosPortalCatalog(produtos = []) {
  if (!catalogSkuMap.size) return produtos;
  return (produtos || []).filter((p) => isProdutoInPortalCatalogSync(p));
}

export function listPortalCatalogReservadosSync() {
  return catalogRows.filter((r) => r.reserva_portal === true).map(mapRowToExcelShape);
}

/** Atualiza reserva no cache local após write Supabase. */
export function patchPortalCatalogReservaLocal(codigosInternos = [], reserva = true) {
  const set = new Set(codigosInternos.map((c) => String(c).trim().toUpperCase()));
  catalogRows = catalogRows.map((row) => {
    const cod = String(row.codigo_interno || '').trim().toUpperCase();
    if (!set.has(cod)) return row;
    return { ...row, reserva_portal: reserva };
  });
  rebuildIndex(catalogRows);
}
