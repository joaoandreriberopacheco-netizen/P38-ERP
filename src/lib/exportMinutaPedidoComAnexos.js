import { fetchAnexosPorPedidos } from '@/lib/fetchAnexosPorPedidos';
import { exportPedidoAnexosComMinutaPdf } from '@/lib/exportPedidoAnexosComMinutaPdf';

function sanitizeFileName(numero) {
  return String(numero || 'pedido')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]+/g, '_');
}

/**
 * Minuta individual: capa da consulta do pedido + anexos vinculados (pedido e lançamentos).
 */
export async function exportMinutaPedidoComAnexos({ pedidoId, pedidoNumero = '' }) {
  if (!pedidoId) {
    throw new Error('Pedido não informado para gerar a minuta.');
  }

  const anexosPorPedido = await fetchAnexosPorPedidos([pedidoId]);
  const anexos = anexosPorPedido[pedidoId] || [];
  const numero = pedidoNumero || pedidoId;
  const fileName = `minuta-${sanitizeFileName(numero)}.pdf`;

  return exportPedidoAnexosComMinutaPdf({
    pedidoId,
    pedidoNumero: numero,
    anexos,
    fileName,
  });
}
