#!/usr/bin/env node
/**
 * Pedido KA2-K4Q: renomeia split B (Necessidade → Pendente) e completa baixa logística
 * do acordo órfão já lançado (sem novo financeiro).
 *
 * Uso:
 *   npx vite-node scripts/aplicar-ka2-k4q-pendente-acordo.mjs           # dry-run
 *   npx vite-node scripts/aplicar-ka2-k4q-pendente-acordo.mjs --apply
 *
 * Requer VITE_BASE44_APP_ID + BASE44_ACCESS_TOKEN (ou BASE44_API_KEY).
 */

import { requireFlareClient } from './flare-sdk.mjs';
import { EMBARQUE_TIPO_SALDO_PENDENTE } from '../src/lib/embarqueTipoSaldoPendente.js';
import { completarBaixaLogisticaAcordoExistente, resolverAcordoOrfaoLegadoParaCompletar } from '../src/lib/completarAcordoFinanceiroOrfaoLegado.js';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import { rebuildEmbarqueItensMirror } from '../src/lib/embarqueItemContract.js';
import { calcularItensOrfaosAguardandoDespacho, calcularTotalDespachadoBasePorProduto, embarqueTemDespachoInformado } from '../src/lib/embarqueLogisticaHelpers.js';

const NUMERO = 'KA2-K4Q';
const LANCAMENTO_PADRAO = 'fea676a0-2112-436c-ad76-c2e45c27d88b';

const apply = process.argv.includes('--apply');

async function main() {
  const base44 = requireFlareClient();
  const norm = NUMERO.trim().toUpperCase();
  let pedido = (await base44.entities.PedidoCompra.filter({ numero: norm }))?.[0];
  if (!pedido) {
    const recent = await base44.entities.PedidoCompra.list('-created_date', 5000);
    pedido = (recent || []).find((p) => String(p?.numero || '').toUpperCase() === norm);
  }
  if (!pedido) {
    console.error(`Pedido ${NUMERO} não encontrado.`);
    process.exit(1);
  }

  const embarques = await base44.entities.Embarque.filter({ pedido_compra_id: pedido.id }, 'created_date', 200);
  const embList = Array.isArray(embarques) ? embarques : [];
  for (const emb of embList) {
    const linhas = await base44.entities.EmbarqueItem.filter({ embarque_id: emb.id });
    emb._linhas = rebuildEmbarqueItensMirror(linhas || []);
  }

  const renomear = embList.filter((e) => e.tipo === 'Necessidade');
  console.log(`Pedido ${pedido.numero} (${pedido.id})`);
  console.log(`Embarques saldo pendente legado (Necessidade): ${renomear.length}`);
  for (const emb of renomear) {
    console.log(`  → ${emb.codigo_exibicao || emb.id}: tipo Necessidade → ${EMBARQUE_TIPO_SALDO_PENDENTE}`);
    if (apply) {
      await base44.entities.Embarque.update(emb.id, { tipo: EMBARQUE_TIPO_SALDO_PENDENTE });
      emb.tipo = EMBARQUE_TIPO_SALDO_PENDENTE;
    }
  }

  if (!pedido.itens?.length) {
    const pci = await base44.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
    pedido.itens = (pci || []).map(pedidoCompraItemToLegacyMirror);
  }

  const embarquesComDespacho = embList.filter(embarqueTemDespachoInformado);
  const totalEmb = calcularTotalDespachadoBasePorProduto(
    embarquesComDespacho.filter((e) => (e._linhas || []).some((l) => (Number(l?.quantidade_embarcada) || 0) > 0)),
  );
  const itensOrfaos = calcularItensOrfaosAguardandoDespacho(pedido, embList, totalEmb, {});
  console.log('Órfãos antes da baixa:', itensOrfaos);

  const lancamentos = await base44.entities.LancamentoFinanceiro.filter({ pedido_compra_id: pedido.id });
  const ctx = resolverAcordoOrfaoLegadoParaCompletar({
    pedido,
    embarques: embList,
    lancamentos: lancamentos || [],
    lancamentoIdPreferido: LANCAMENTO_PADRAO,
    itensOrfaos,
  });

  if (!ctx?.lancamento) {
    console.error('Nenhum acordo órfão legado encontrado para completar.', ctx?.motivo || '');
    process.exit(1);
  }

  console.log(`Lançamento acordo: ${ctx.lancamento.id} — R$ ${ctx.lancamento.valor}`);
  if (!apply) {
    console.log('\nDry-run. Use --apply para gravar renomeação + baixa logística.');
    return;
  }

  const resultado = await completarBaixaLogisticaAcordoExistente({
    base44,
    pedido,
    embarques: embList,
    lancamento: ctx.lancamento,
    itensOrfaos: ctx.itensOrfaos,
    produtosMap: {},
  });
  console.log('Baixa logística:', JSON.stringify(resultado, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
