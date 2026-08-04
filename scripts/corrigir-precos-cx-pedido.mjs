#!/usr/bin/env node
/**
 * Corrige preços CX inflados por arredondamento na importação.
 *
 * Uso:
 *   node scripts/corrigir-precos-cx-pedido.mjs --numero=NXJ-53K
 *   node scripts/corrigir-precos-cx-pedido.mjs --numero=NXJ-53K --apply
 */

import pg from 'pg';
import {
  corrigirPrecosCxPedidoSupabase,
  PRECOS_DOCUMENTO_NXJ_53K,
} from '../src/lib/oneOffCorrigirPrecosCxPedido.js';

function parseArgs(argv) {
  const args = { numero: '', pedidoId: '', apply: false, nxj53k: false };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a === '--nxj-53k') args.nxj53k = true;
    else if (a.startsWith('--numero=')) args.numero = a.slice('--numero='.length).trim();
    else if (a.startsWith('--pedido-id=')) args.pedidoId = a.slice('--pedido-id='.length).trim();
  }
  if (args.nxj53k) args.numero = 'NXJ-53K';
  return args;
}

const { numero, pedidoId, apply, nxj53k } = parseArgs(process.argv.slice(2));
if (!numero && !pedidoId) {
  console.error('Uso: node scripts/corrigir-precos-cx-pedido.mjs --numero=NXJ-53K [--apply]');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL em falta.');
  process.exit(1);
}

const overrides =
  nxj53k || String(numero || '').toUpperCase().replace(/\s/g, '') === 'NXJ-53K'
    ? PRECOS_DOCUMENTO_NXJ_53K
    : {};

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const result = await corrigirPrecosCxPedidoSupabase(client, {
    numero,
    pedidoId,
    apply,
    overrides,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} finally {
  await client.end();
}
