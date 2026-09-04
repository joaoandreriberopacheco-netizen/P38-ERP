import {
  buildRecebidosPorPedidoProdutoFromEmbarques,
  hydratePedidosCompraItens,
  pedidoCompraAprovadoNaoConcluido,
} from '@/lib/sugestaoCompraEstoquePendente';
import { fetchEmbarquesPorPedidos, hydrateEmbarquesFromSql } from '@/lib/fetchEmbarqueItens';

/** Status logísticos em aberto — alinhado a `pedidoCompraAprovadoNaoConcluido`. */
export const PEDIDO_COMPRA_STATUS_QUERY_ESTOQUE = [
  'Aprovado',
  'Aguardando Recepção',
  'Aguardando Embarque',
  'Enviado',
  'Despachado',
  'Em Recepção',
  'Em Trânsito',
  'Recebido Parcialmente',
  'Recebido Parcial',
  'Pendência',
  'Aguardando',
];

const PEDIDOS_RECENTES_LIMIT = 1200;
const EMBARQUES_LIMIT = 2000;

function dedupePedidosPorId(pedidos = []) {
  const porId = new Map();
  (pedidos || []).forEach((pedido) => {
    if (pedido?.id) porId.set(pedido.id, pedido);
  });
  return [...porId.values()];
}

async function fetchPedidosByIds(base44, ids = []) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];

  const rows = await Promise.all(
    unique.map((id) =>
      base44.entities.PedidoCompra.filter({ id }).catch(() => []),
    ),
  );

  return rows.flat().filter((pedido) => pedido?.id);
}

function dedupeEmbarquesPorId(embarques = []) {
  const porId = new Map();
  (embarques || []).forEach((embarque) => {
    if (embarque?.id) porId.set(embarque.id, embarque);
  });
  return [...porId.values()];
}

export async function fetchEmbarquesForPedidoIds(base44, pedidoIds = []) {
  return fetchEmbarquesPorPedidos(base44, pedidoIds);
}

/**
 * Carrega pedidos de compra relevantes para pendente de estoque (catálogo / sugestão).
 * Fonte: Supabase via `p38.legacyClient` (parâmetro mantém nome legado `base44`).
 * Inclui pedidos referenciados por embarques em trânsito mesmo fora do top N recentes.
 */
export async function fetchPedidosCompraParaSugestaoEstoque(base44) {
  const [porStatus, recentes, embarques] = await Promise.all([
    base44.entities.PedidoCompra.filter({
      status: PEDIDO_COMPRA_STATUS_QUERY_ESTOQUE,
    }).catch(() => []),
    base44.entities.PedidoCompra.list('-created_date', PEDIDOS_RECENTES_LIMIT).catch(() => []),
    base44.entities.Embarque.list('-created_date', EMBARQUES_LIMIT).catch(() => []),
  ]);

  const pedidosPorId = new Map();
  [...porStatus, ...recentes].forEach((pedido) => {
    if (pedido?.id) pedidosPorId.set(pedido.id, pedido);
  });

  const pedidoIdsEmbarques = [
    ...new Set(
      (embarques || []).map((embarque) => embarque?.pedido_compra_id).filter(Boolean),
    ),
  ];
  const missingPedidoIds = pedidoIdsEmbarques.filter((id) => !pedidosPorId.has(id));
  const pedidosExtras = await fetchPedidosByIds(base44, missingPedidoIds);
  pedidosExtras.forEach((pedido) => {
    if (pedido?.id) pedidosPorId.set(pedido.id, pedido);
  });

  let pedidosTodos = [...pedidosPorId.values()];
  pedidosTodos = await hydratePedidosCompraItens(base44, pedidosTodos);

  const pedidosAbertos = pedidosTodos.filter(pedidoCompraAprovadoNaoConcluido);
  const embarquesExtras = await fetchEmbarquesForPedidoIds(
    base44,
    pedidosAbertos.map((pedido) => pedido.id),
  );
  const embarquesBrutos = dedupeEmbarquesPorId([...(embarques || []), ...embarquesExtras]);
  const embarquesTodos = await hydrateEmbarquesFromSql(base44, embarquesBrutos);
  const recebidosPorPedidoProduto = buildRecebidosPorPedidoProdutoFromEmbarques(embarquesTodos, pedidosTodos);

  return {
    pedidosTodos,
    pedidosAbertos,
    embarques: embarquesTodos,
    recebidosPorPedidoProduto,
  };
}

/** Extrai número base do pedido a partir de código de embarque (ex. E62-67G → E62). */
export function parsePedidoNumeroBase(codigo = '') {
  const raw = String(codigo || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(.+?)-[A-Z0-9]+$/i);
  return (match?.[1] || raw).trim();
}
