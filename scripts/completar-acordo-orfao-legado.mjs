#!/usr/bin/env node
/**
 * Completa baixa logística de acordo órfão já lançado (sem novo financeiro).
 * Stack: Supabase (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Base44 não é usado.
 *
 * Uso:
 *   npx vite-node scripts/completar-acordo-orfao-legado.mjs --numero=KA2-K4Q
 *   npx vite-node scripts/completar-acordo-orfao-legado.mjs --numero=KA2-K4Q --lancamento-id=<uuid>
 *   npx vite-node scripts/completar-acordo-orfao-legado.mjs --numero=KA2-K4Q --apply
 */

import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { loadPedidoCompraCli } from './lib/load-pedido-compra-cli.mjs';
import {
  completarBaixaLogisticaAcordoExistente,
  resolverAcordoOrfaoLegadoParaCompletar,
} from '../src/lib/completarAcordoFinanceiroOrfaoLegado.js';

function parseArgs(argv) {
  const args = { numero: '', pedidoId: '', lancamentoId: '', apply: false };
  for (const a of argv) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--numero=')) args.numero = a.slice(9).trim();
    else if (a.startsWith('--pedido-id=')) args.pedidoId = a.slice(12).trim();
    else if (a.startsWith('--lancamento-id=')) args.lancamentoId = a.slice(16).trim();
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.numero && !args.pedidoId) {
  console.error('Use --numero=KA2-K4Q ou --pedido-id=<uuid>');
  process.exit(1);
}

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const loaded = await loadPedidoCompraCli(p38, args);
if (!loaded) {
  console.error('Pedido não encontrado');
  process.exit(1);
}

const { pedido, embarques, itensOrfaos } = loaded;
const lancamentoId = args.lancamentoId
  || (await resolverAcordoOrfaoLegadoParaCompletar(p38, pedido))?.id;

if (!lancamentoId) {
  console.log(JSON.stringify({ ok: false, error: 'Nenhum acordo órfão com baixa pendente.' }, null, 2));
  process.exit(1);
}

const preview = {
  ok: true,
  dryRun: !args.apply,
  pedido: pedido.numero,
  lancamentoId,
  itensOrfaos,
};

if (!args.apply) {
  console.log(JSON.stringify({ ...preview, hint: 'Adicione --apply para executar' }, null, 2));
  process.exit(0);
}

const result = await completarBaixaLogisticaAcordoExistente(p38, {
  pedido,
  embarques,
  itensOrfaos,
  lancamentoId,
  produtosMap: {},
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
