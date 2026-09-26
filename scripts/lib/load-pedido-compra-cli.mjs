import { pedidoCompraItemToLegacyMirror } from '../../src/lib/pedidoCompraItemContract.js';
import { rebuildEmbarqueItensMirror } from '../../src/lib/embarqueItemContract.js';
import {
  calcularItensOrfaosAguardandoDespacho,
  calcularTotalDespachadoBasePorProduto,
  embarqueTemDespachoInformado,
} from '../../src/lib/embarqueLogisticaHelpers.js';

/**
 * Carrega pedido + embarques + órfãos via camada de entidades Supabase.
 * @param {{ entities: object }} client — `asP38LegacyClient(requireP38SupabaseScriptClient())`
 */
export async function loadPedidoCompraCli(client, { numero, pedidoId }) {
  const { entities } = client;
  let pedido = null;

  if (pedidoId) {
    const rows = await entities.PedidoCompra.filter({ id: pedidoId });
    pedido = rows?.[0];
  } else if (numero) {
    const norm = numero.trim().toUpperCase();
    const rows = await entities.PedidoCompra.filter({ numero: norm });
    pedido = rows?.[0];
    if (!pedido) {
      const recent = await entities.PedidoCompra.list('-created_date', 5000);
      pedido = (recent || []).find((p) => String(p?.numero || '').toUpperCase() === norm);
    }
  }
  if (!pedido) return null;

  const embarques = await entities.Embarque.filter({ pedido_compra_id: pedido.id }, 'created_date', 200);
  const embList = Array.isArray(embarques) ? embarques : [];
  for (const emb of embList) {
    try {
      const linhas = await entities.EmbarqueItem.filter({ embarque_id: emb.id });
      emb._linhas = rebuildEmbarqueItensMirror(linhas || []);
    } catch {
      emb._linhas = emb.itens_embarcados || emb.itens || [];
    }
  }

  if (!pedido.itens?.length) {
    try {
      const pci = await entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
      pedido.itens = (pci || []).map(pedidoCompraItemToLegacyMirror);
    } catch {
      /* legado JSON no pedido */
    }
  }

  const embarquesComDespacho = embList.filter(embarqueTemDespachoInformado);
  const totalEmb = calcularTotalDespachadoBasePorProduto(
    embarquesComDespacho.filter((e) => (e._linhas || []).some((l) => (Number(l?.quantidade_embarcada) || 0) > 0)),
  );
  const itensOrfaos = calcularItensOrfaosAguardandoDespacho(pedido, embList, totalEmb, {});

  return { pedido, embarques: embList, itensOrfaos };
}
