/**
 * Labels canónicos de orçamento em `pedido_venda` (manifesto Base44 / Gestão de vendas).
 * Colunas alvo: `tipo` e `status` (texto exato `Orçamento`).
 */
/** Valor gravado nas colunas `tipo` e `status` para orçamento aberto. */
export const PEDIDO_VENDA_TIPO_ORCAMENTO = 'Orçamento';
export const PEDIDO_VENDA_STATUS_ORCAMENTO = 'Orçamento';

/** Legado sem cedilha — só leitura/filtro até backfill. */
export const PEDIDO_VENDA_ORCAMENTO_LEGACY_ASCII = 'Orcamento';

const ORCAMENTO_LABEL_KEYS = new Set(['orçamento', 'orcamento']);

function labelKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** `true` se o texto (qualquer coluna) é variante de orçamento. */
export function isOrcamentoPedidoVendaLabel(value) {
  return ORCAMENTO_LABEL_KEYS.has(labelKey(value));
}

/**
 * Normaliza para o valor canónico da coluna quando o conteúdo é orçamento;
 * caso contrário devolve o texto trimado (ex.: PDV, Pedido).
 */
export function normalizePedidoVendaOrcamentoColumn(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (isOrcamentoPedidoVendaLabel(trimmed)) return PEDIDO_VENDA_TIPO_ORCAMENTO;
  return trimmed;
}

/** Resolve `tipo` / `status` efetivos (coluna + `dados`) já canónicos para orçamento. */
export function resolvePedidoVendaTipoStatus(source = {}) {
  const dados = source?.dados && typeof source.dados === 'object' ? source.dados : {};
  return {
    tipo: normalizePedidoVendaOrcamentoColumn(source.tipo ?? dados.tipo ?? ''),
    status: normalizePedidoVendaOrcamentoColumn(source.status ?? dados.status ?? ''),
  };
}

/** Filtro PostgREST para listar orçamentos (colunas + espelho em `dados`). */
export function orcamentoPedidoVendaSqlOrFilter() {
  const canon = PEDIDO_VENDA_TIPO_ORCAMENTO;
  const legacy = PEDIDO_VENDA_ORCAMENTO_LEGACY_ASCII;
  return [
    `tipo.eq.${canon}`,
    `status.eq.${canon}`,
    `dados->>tipo.eq.${canon}`,
    `dados->>status.eq.${canon}`,
    `tipo.eq.${legacy}`,
    `status.eq.${legacy}`,
    `dados->>tipo.eq.${legacy}`,
    `dados->>status.eq.${legacy}`,
    'dados->>origem.eq.orcamento_rapido',
  ].join(',');
}
