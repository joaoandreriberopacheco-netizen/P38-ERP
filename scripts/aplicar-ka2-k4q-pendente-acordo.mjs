#!/usr/bin/env node
/**
 * Pedido KA2-K4Q: renomeia split (Necessidade → Pendente) e completa baixa logística
 * do acordo órfão já lançado (sem novo financeiro).
 *
 * Stack: Supabase — VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Cursor / GitHub Actions / Cloud Agent).
 *
 * Uso:
 *   npx vite-node scripts/aplicar-ka2-k4q-pendente-acordo.mjs           # dry-run
 *   npx vite-node scripts/aplicar-ka2-k4q-pendente-acordo.mjs --apply
 */

import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { loadPedidoCompraCli } from './lib/load-pedido-compra-cli.mjs';
import { EMBARQUE_TIPO_SALDO_PENDENTE } from '../src/lib/embarqueTipoSaldoPendente.js';
import {
  completarBaixaLogisticaAcordoExistente,
  resolverAcordoOrfaoLegadoParaCompletar,
} from '../src/lib/completarAcordoFinanceiroOrfaoLegado.js';
import { listarLancamentosPedidoCompra } from '../src/lib/pedidoCompraFinanceiro.js';
import { listarAcordosOrfaoComBaixaPendente } from '../src/lib/acordoFinanceiroOrfaoLancamento.js';

const NUMERO = 'KA2-K4Q';
const LANCAMENTO_PADRAO = 'fea676a0-2112-436c-ad76-c2e45c27d88b';

const apply = process.argv.includes('--apply');

async function main() {
  const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
  const loaded = await loadPedidoCompraCli(p38, { numero: NUMERO });
  if (!loaded) {
    console.error(`Pedido ${NUMERO} não encontrado no Supabase.`);
    process.exit(1);
  }

  const { pedido, embarques: embList, itensOrfaos } = loaded;

  const renomear = embList.filter((e) => e.tipo === 'Necessidade');
  console.log(`Pedido ${pedido.numero} (${pedido.id})`);
  console.log(`Embarques com tipo legado Necessidade: ${renomear.length}`);
  for (const emb of renomear) {
    console.log(`  → ${emb.codigo_exibicao || emb.id}: Necessidade → ${EMBARQUE_TIPO_SALDO_PENDENTE}`);
    if (apply) {
      await p38.entities.Embarque.update(emb.id, { tipo: EMBARQUE_TIPO_SALDO_PENDENTE });
      emb.tipo = EMBARQUE_TIPO_SALDO_PENDENTE;
    }
  }

  console.log('Órfãos antes da baixa:', itensOrfaos);

  const lancRows = await listarLancamentosPedidoCompra(p38, pedido.id);
  let lanc = (lancRows || []).find((l) => l.id === LANCAMENTO_PADRAO);
  if (!lanc) {
    const pendentes = listarAcordosOrfaoComBaixaPendente(pedido, lancRows);
    lanc = pendentes[0]?.lancamento
      || (await resolverAcordoOrfaoLegadoParaCompletar(p38, pedido));
  }
  if (!lanc?.id) {
    console.error('Nenhum acordo órfão com baixa pendente encontrado neste pedido.');
    process.exit(1);
  }
  const lancamentoId = lanc.id;

  console.log(`Lançamento acordo: ${lanc.id} — valor ${lanc.valor ?? lanc.valor_liquido ?? '?'}`);
  if (!apply) {
    console.log('\nDry-run. Use --apply para gravar renomeação + baixa logística no Supabase.');
    return;
  }

  const resultado = await completarBaixaLogisticaAcordoExistente(p38, {
    pedido,
    embarques: embList,
    itensOrfaos,
    lancamentoId: lanc.id,
    produtosMap: {},
  });
  console.log('Baixa logística:', JSON.stringify(resultado, null, 2));
  process.exit(resultado.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
