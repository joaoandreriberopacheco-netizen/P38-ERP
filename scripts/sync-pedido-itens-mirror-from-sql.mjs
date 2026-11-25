#!/usr/bin/env node
/** Alinha `pedido.itens` (JSON) com PedidoCompraItem (SQL). */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import { roundToTwoDecimals } from '../src/lib/financialUtils.js';

const numero = (process.argv.find((a) => a.startsWith('--numero=')) || '').slice(9).trim().toUpperCase();
const apply = process.argv.includes('--apply');
if (!numero) {
  console.error('Use --numero=EXC-FQZ [--apply]');
  process.exit(1);
}

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const pedido = (await p38.entities.PedidoCompra.filter({ numero }))?.[0];
if (!pedido) process.exit(1);

const pci = await p38.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
if (!pci?.length) {
  console.log('Sem linhas SQL — nada a sincronizar.');
  process.exit(0);
}

const itens = pci.map(pedidoCompraItemToLegacyMirror);
const valor_total = roundToTwoDecimals(itens.reduce((s, it) => s + (Number(it.total) || 0), 0));

console.log(JSON.stringify({ numero, valor_total, itens: itens.map((i) => ({ nome: i.produto_nome, base: i.quantidade_base })) }, null, 2));

if (apply) {
  await p38.entities.PedidoCompra.update(pedido.id, { itens, valor_total });
  console.log('Mirror JSON atualizado.');
}
