#!/usr/bin/env node
/**
 * Incorpora desconto de linha no custo unitário (valor líquido) dos pedidos em Rascunho.
 *
 * Uso:
 *   npm run compras:normalizar-rascunho-desconto          # pré-visualização (dry-run)
 *   npm run compras:normalizar-rascunho-desconto -- --apply
 *
 * Alternativa via Edge Function Base44 (após deploy):
 *   base44.functions.invoke('normalizarPedidosCompraPendentes', {
 *     apenas_rascunho: true,
 *     incorporar_desconto_liquido: true,
 *     dry_run: false,
 *   })
 */

import { requireBase44Client } from './base44-env.mjs';
import { normalizarPedidosCompraRascunhoDesconto } from '../src/lib/normalizarPedidosCompraRascunhoDesconto.js';

function parseArgs(argv) {
  const args = { apply: false, limit: 500 };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length)) || 500;
  }
  return args;
}

const { apply, limit } = parseArgs(process.argv.slice(2));
const base44 = requireBase44Client();

const result = await normalizarPedidosCompraRascunhoDesconto(base44, {
  dryRun: !apply,
  limit,
});

console.log(JSON.stringify(result, null, 2));

if (!apply) {
  console.log('\nPré-visualização apenas. Para gravar: npm run compras:normalizar-rascunho-desconto -- --apply');
}

process.exit(0);
