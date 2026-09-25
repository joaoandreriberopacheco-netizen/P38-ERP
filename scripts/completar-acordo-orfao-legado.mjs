#!/usr/bin/env node
/**
 * Completa baixa logística de acordo órfão já lançado (sem novo financeiro).
 *
 * Uso:
 *   npx vite-node scripts/completar-acordo-orfao-legado.mjs --numero=KA2-K4Q
 *   npx vite-node scripts/completar-acordo-orfao-legado.mjs --numero=KA2-K4Q --lancamento-id=<uuid>
 *   npx vite-node scripts/completar-acordo-orfao-legado.mjs --numero=KA2-K4Q --apply
 */

import { requireFlareClient } from './flare-sdk.mjs';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import { rebuildEmbarqueItensMirror } from '../src/lib/embarqueItemContract.js';
import { calcularItensOrfaosAguardandoDespacho, calcularTotalDespachadoBasePorProduto, embarqueTemDespachoInformado } from '../src/lib/embarqueLogisticaHelpers.js';
import { completarBaixaLogisticaAcordoExistente, resolverAcordoOrfaoLegadoParaCompletar } from '../src/lib/completarAcordoFinanceiroOrfaoLegado.js';

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

async function loadPedido(base44, { numero, pedidoId }) {
  let pedido = null;
  if (pedidoId) {
    const rows = await base44.entities.PedidoCompra.filter({ id: pedidoId });
    pedido = rows?.[0];
  } else if (numero) {
    const norm = numero.trim().toUpperCase();
    const rows = await base44.entities.PedidoCompra.filter({ numero: norm });
    pedido = rows?.[0];
    if (!pedido) {
      const recent = await base44.entities.PedidoCompra.list('-created_date', 5000);
      pedido = (recent || []).find((p) => String(p?.numero || '').toUpperCase() === norm);
    }
  }
  if (!pedido) return null;

  const embarques = await base44.entities.Embarque.filter({ pedido_compra_id: pedido.id }, 'created_date', 200);
  const embList = Array.isArray(embarques) ? embarques : [];
  for (const emb of embList) {
    try {
      const linhas = await base44.entities.EmbarqueItem.filter({ embarque_id: emb.id });
      emb._linhas = rebuildEmbarqueItensMirror(linhas || []);
    } catch {
      emb._linhas = emb.itens_embarcados || emb.itens || [];
    }
  }

  if (!pedido.itens?.length) {
    try {
      const pci = await base44.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
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

const args = parseArgs(process.argv.slice(2));
if (!args.numero && !args.pedidoId) {
  console.error('Use --numero=KA2-K4Q ou --pedido-id=<uuid>');
  process.exit(1);
}

const base44 = requireFlareClient();
const loaded = await loadPedido(base44, args);
if (!loaded) {
  console.error('Pedido não encontrado');
  process.exit(1);
}

const { pedido, embarques, itensOrfaos } = loaded;
const lancamentoId = args.lancamentoId
  || (await resolverAcordoOrfaoLegadoParaCompletar(base44, pedido))?.id;

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

const result = await completarBaixaLogisticaAcordoExistente(base44, {
  pedido,
  embarques,
  itensOrfaos,
  lancamentoId,
  produtosMap: {},
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
