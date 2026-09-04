import { base44 } from '@/api/base44Client';
import { fetchReferenciasAnexosPedidoCompra } from '@/lib/anexosReferenciasIntegradas';
import { listarAnexos } from '@/functions/listarAnexos';

/**
 * Coleta anexos (pedido + lançamentos financeiros) para vários pedidos de compra.
 * @param {string[]} pedidoIds
 * @returns {Promise<Record<string, object[]>>}
 */
export async function fetchAnexosPorPedidos(pedidoIds = []) {
  const uniqueIds = [...new Set((pedidoIds || []).filter(Boolean))];
  const map = {};

  await Promise.all(
    uniqueIds.map(async (pedidoId) => {
      try {
        const referencias = await fetchReferenciasAnexosPedidoCompra(base44, pedidoId);
        if (!referencias.length) {
          map[pedidoId] = [];
          return;
        }
        const lotes = await Promise.all(
          referencias.map(async (r) => {
            const res = await listarAnexos({
              referencia_tipo: r.referencia_tipo,
              referencia_id: r.referencia_id,
            });
            const list = res.data?.anexos || [];
            return list.map((a) => ({
              ...a,
              origem_label: r.label,
            }));
          }),
        );
        const merged = lotes.flat();
        const byId = new Map();
        merged.forEach((a) => {
          if (a?.id && !byId.has(a.id)) byId.set(a.id, a);
        });
        map[pedidoId] = [...byId.values()];
      } catch {
        map[pedidoId] = [];
      }
    }),
  );

  return map;
}

/**
 * Extrai IDs únicos de pedidos a partir de lista plana ou estrutura agrupada.
 */
export function coletarPedidoIdsParaRelatorio(pedidos = [], grupos = []) {
  const ids = new Set();
  const walkPedido = (p) => {
    if (p?.id) ids.add(p.id);
  };
  (pedidos || []).forEach(walkPedido);
  const walkGrupo = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walkGrupo);
      return;
    }
    if (Array.isArray(node.pedidos)) node.pedidos.forEach(walkPedido);
    if (Array.isArray(node.grupos)) node.grupos.forEach(walkGrupo);
    if (Array.isArray(node.children)) node.children.forEach(walkGrupo);
  };
  walkGrupo(grupos);
  return [...ids];
}
