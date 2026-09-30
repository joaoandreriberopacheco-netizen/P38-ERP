#!/usr/bin/env node
/**
 * Pedidos antigos: cria/atualiza PedidoCompraItem a partir do JSON do cabeçalho
 * quando ainda não há linhas SQL (ou lista vazia).
 *
 *   npx vite-node scripts/backfill-pedido-compra-item-legado-lote.mjs
 *   npx vite-node scripts/backfill-pedido-compra-item-legado-lote.mjs --apply
 *   npx vite-node scripts/backfill-pedido-compra-item-legado-lote.mjs --limit=200 --apply
 */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import {
  legacyItensPedidoCompraToCanonicalPayload,
  readLegacyItensPedidoCompra,
  syncPedidoCompraItensAfterLogisticaMutation,
} from '../src/lib/fetchPedidoCompraItens.js';

const apply = process.argv.includes('--apply');
const limitArg = (process.argv.find((a) => a.startsWith('--limit=')) || '').slice(8);
const limit = Math.min(5000, Math.max(1, Number(limitArg) || 500));

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const { entities } = p38;

const pedidos = await entities.PedidoCompra.list('-created_date', limit);
const candidatos = [];

for (const pedido of pedidos || []) {
  if (!pedido?.id) continue;
  const legado = readLegacyItensPedidoCompra(pedido);
  if (!legado.length) continue;

  let linhasSql = [];
  try {
    linhasSql = await entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
  } catch {
    linhasSql = [];
  }

  if ((linhasSql || []).length > 0) continue;

  const payload = legacyItensPedidoCompraToCanonicalPayload(legado);
  if (!payload.length) continue;

  candidatos.push({
    numero: pedido.numero,
    id: pedido.id,
    linhas_json: legado.length,
    linhas_canonicas: payload.length,
  });
}

console.log(JSON.stringify({
  scanned: (pedidos || []).length,
  candidatos_sem_sql: candidatos.length,
  apply,
  sample: candidatos.slice(0, 15),
}, null, 2));

if (!apply) {
  console.log('\nAdicione --apply para gravar PedidoCompraItem a partir do JSON (só pedidos sem linhas SQL).');
  process.exit(0);
}

let ok = 0;
let fail = 0;
for (const c of candidatos) {
  const pedido = (pedidos || []).find((p) => p.id === c.id);
  const legado = readLegacyItensPedidoCompra(pedido);
  try {
    await syncPedidoCompraItensAfterLogisticaMutation(p38, c.id, legado);
    ok += 1;
  } catch (err) {
    fail += 1;
    console.error(`Falha ${c.numero}:`, err?.message || err);
  }
}

console.log(JSON.stringify({ ok, fail }, null, 2));
