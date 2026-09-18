#!/usr/bin/env node
/**
 * Marca pedido/embarque como recepcionado (Recebido OK) de forma retroativa.
 *
 * Uso:
 *   npm run recepcionar:pedido -- --numero=DT8-8B8
 *   npm run recepcionar:pedido -- --codigo=DT8-8B8-B --apply
 *   npm run recepcionar:pedido -- --numero=DT8-8B8 --apply --sem-stock
 */

import { requireFlareClient } from './flare-sdk.mjs';
import { recepcionarPedidoArbitrario } from '../src/lib/oneOffRecepcionarPedidoArbitrario.js';

function parseArgs(argv) {
  const args = {
    numero: '',
    codigo: '',
    pedidoId: '',
    apply: false,
    criarStock: true,
  };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a === '--sem-stock') args.criarStock = false;
    else if (a.startsWith('--numero=')) args.numero = a.slice('--numero='.length).trim();
    else if (a.startsWith('--codigo=')) args.codigo = a.slice('--codigo='.length).trim();
    else if (a.startsWith('--pedido-id=')) args.pedidoId = a.slice('--pedido-id='.length).trim();
  }
  return args;
}

const { numero, codigo, pedidoId, apply, criarStock } = parseArgs(process.argv.slice(2));
if (!numero && !codigo && !pedidoId) {
  console.error('Indique --numero=DT8-8B8, --codigo=DT8-8B8-B ou --pedido-id=<uuid>');
  process.exit(1);
}

const base44 = requireFlareClient();
const result = await recepcionarPedidoArbitrario(base44, {
  numero,
  codigoEmbarque: codigo,
  pedidoId,
  apply,
  criarStock,
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
