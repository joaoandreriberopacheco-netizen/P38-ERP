#!/usr/bin/env node
/**
 * Alinha PedidoCompraItem (SQL) com `PedidoCompra.itens` já gravado no cabeçalho.
 * Útil após acordo órfão antigo (só atualizava JSON e a UI lia SQL desatualizado).
 *
 *   npx vite-node scripts/sincronizar-pedido-compra-item-de-json.mjs --numero=R64-JEC
 *   npx vite-node scripts/sincronizar-pedido-compra-item-de-json.mjs --numero=R64-JEC --apply
 */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import {
  legacyItensPedidoCompraToCanonicalPayload,
  syncPedidoCompraItensAfterLogisticaMutation,
} from '../src/lib/fetchPedidoCompraItens.js';
import {
  calcularItensOrfaosAguardandoDespacho,
  calcularTotalDespachadoBasePorProduto,
} from '../src/lib/embarqueLogisticaHelpers.js';
import { refreshPedidoCompraComLogistica } from '../src/lib/fetchPedidoCompraItens.js';
import { filterEmbarquesVisiveisParaPedido } from '../src/components/compras/embarqueFilters.js';

const apply = process.argv.includes('--apply');
const numero = (process.argv.find((a) => a.startsWith('--numero=')) || '').slice(9).trim().toUpperCase();
if (!numero) {
  console.error('Use --numero=R64-JEC');
  process.exit(1);
}

const scriptClient = requireP38SupabaseScriptClient();
const p38 = asP38LegacyClient(scriptClient);
const [pedidoRow] = await p38.entities.PedidoCompra.filter({ numero });
if (!pedidoRow) {
  console.error('Pedido não encontrado');
  process.exit(1);
}

const jsonItens = pedidoRow.itens || [];
const items = legacyItensPedidoCompraToCanonicalPayload(jsonItens);

const antes = await refreshPedidoCompraComLogistica(p38, pedidoRow.id, {
  filterEmbarques: filterEmbarquesVisiveisParaPedido,
});
const orfaosAntes = calcularItensOrfaosAguardandoDespacho(
  antes,
  antes?._embarques || [],
  calcularTotalDespachadoBasePorProduto(antes?._embarques || []),
  {},
);

console.log(JSON.stringify({
  pedido: pedidoRow.numero,
  linhas_json: jsonItens.length,
  linhas_canonicas_replace: items.length,
  orfaos_ui_sql_antes: orfaosAntes.map((o) => ({
    nome: o.produto_nome,
    qtd_pendente: o.qtd_pendente,
  })),
  apply,
}, null, 2));

if (!apply) {
  console.log('\nAdicione --apply para sincronizar PedidoCompraItem.');
  process.exit(0);
}

const syncRes = await syncPedidoCompraItensAfterLogisticaMutation(p38, pedidoRow.id, jsonItens);
console.log('sync:', syncRes);

const depois = await refreshPedidoCompraComLogistica(p38, pedidoRow.id, {
  filterEmbarques: filterEmbarquesVisiveisParaPedido,
});
const orfaosDepois = calcularItensOrfaosAguardandoDespacho(
  depois,
  depois?._embarques || [],
  calcularTotalDespachadoBasePorProduto(depois?._embarques || []),
  {},
);

console.log(JSON.stringify({
  ok: true,
  orfaos_ui_sql_depois: orfaosDepois.length,
  valor_total: depois?.valor_total,
}, null, 2));
