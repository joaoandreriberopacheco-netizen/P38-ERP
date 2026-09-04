#!/usr/bin/env node
/**
 * Backfill PedidoCompraItem a partir do espelho legado PedidoCompra.itens[].
 *
 * Uso:
 *   npm run compras:migrar-pci-legacy              # dry-run
 *   npm run compras:migrar-pci-legacy -- --apply
 *   npm run compras:migrar-pci-legacy -- --apply --limit=20 --loops=10
 */

import { requireBase44Client } from './base44-env.mjs';

function parseArgs(argv) {
  const args = { apply: false, limit: 10, loops: 1, skip: 0, force: false };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a === '--force') args.force = true;
    else if (a.startsWith('--limit=')) args.limit = Math.min(Number(a.slice('--limit='.length)) || 10, 30);
    else if (a.startsWith('--loops=')) args.loops = Number(a.slice('--loops='.length)) || 1;
    else if (a.startsWith('--skip=')) args.skip = Number(a.slice('--skip='.length)) || 0;
  }
  return args;
}

const { apply, limit, loops, skip, force } = parseArgs(process.argv.slice(2));
const base44 = requireBase44Client();

let currentSkip = skip;
const totals = { itens_criados: 0, pedidos_processados: 0, pedidos_com_erro: 0 };

for (let loop = 0; loop < loops; loop++) {
  const body = {
    dry_run: !apply,
    limit,
    skip: currentSkip,
    force,
  };
  const resp = await base44.functions.invoke('migrarPedidoCompraItensLegacy', body);
  const data = resp?.data ?? resp;
  console.log(JSON.stringify({ loop: loop + 1, skip: currentSkip, ...data }, null, 2));

  const stats = data?.stats || {};
  totals.itens_criados += stats.itens_criados || 0;
  totals.pedidos_processados += stats.pedidos_processados || 0;
  totals.pedidos_com_erro += stats.pedidos_com_erro || 0;

  const processados = stats.pedidos_processados || 0;
  if (!processados) break;
  currentSkip += limit;
}

console.log('\nTotais:', totals);
if (!apply) {
  console.log('\nDry-run. Para gravar: npm run compras:migrar-pci-legacy -- --apply');
}
