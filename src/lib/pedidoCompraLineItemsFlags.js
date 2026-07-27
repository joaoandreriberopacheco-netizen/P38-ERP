/**
 * Flags de transição SQL-only para linhas de pedido/embarque de compra.
 *
 * VITE_P38_SQL_FIRST_LINE_ITEMS=true — grava cabeçalho sem `itens[]` e confia no sync SQL.
 * VITE_P38_SKIP_JSON_LINE_ITEM_WRITES=true — alias mais restrito (mesmo efeito no cliente).
 */

function envTruthy(key) {
  const v = String(import.meta.env[key] || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function isSqlFirstLineItemsEnabled() {
  return envTruthy('VITE_P38_SQL_FIRST_LINE_ITEMS') || envTruthy('VITE_P38_SKIP_JSON_LINE_ITEM_WRITES');
}

/** Remove `itens` do payload de PedidoCompra quando a flag SQL-first está ligada. */
export function stripItensFromPedidoPayload(payload = {}) {
  if (!isSqlFirstLineItemsEnabled()) return payload;
  const { itens: _itens, ...rest } = payload;
  return rest;
}

/** Remove `itens` / `itens_embarcados` do payload de Embarque quando SQL-first. */
export function stripItensFromEmbarquePayload(payload = {}) {
  if (!isSqlFirstLineItemsEnabled()) return payload;
  const { itens: _i, itens_embarcados: _ie, ...rest } = payload;
  return rest;
}
