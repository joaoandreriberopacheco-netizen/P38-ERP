#!/usr/bin/env node
/**
 * Migra Embarque.itens[] → EmbarqueItem via SDK (sem Edge Function).
 *
 *   npm run compras:migrar-embarque-local          # dry-run
 *   npm run compras:migrar-embarque-local -- --apply
 */

import { requireBase44Client } from './base44-env.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
const asNumber = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function parseArgs(argv) {
  return { apply: argv.includes('--apply'), limit: 80 };
}

function legacyItens(embarque) {
  if (Array.isArray(embarque?.itens_embarcados) && embarque.itens_embarcados.length > 0) {
    return embarque.itens_embarcados;
  }
  return Array.isArray(embarque?.itens) ? embarque.itens : [];
}

function buildEmbarqueItem(embarque, produto, leg, pciId, ordem) {
  const fator = asNumber(leg?.fator_conversao, 1) || 1;
  const qP = asNumber(leg?.quantidade_pedida ?? leg?.quantidade, 0);
  const qE = asNumber(leg?.quantidade_embarcada, 0);
  const qR = asNumber(leg?.quantidade_recebida, 0);
  return {
    embarque_id: embarque.id,
    embarque_numero: embarque.numero || '',
    pedido_compra_id: embarque.pedido_compra_id || '',
    pedido_compra_item_id: pciId || leg?.pedido_compra_item_id || '',
    produto_id: produto.id,
    produto_nome: produto.nome || leg?.produto_nome || '',
    produto_unidade_id: leg?.produto_unidade_id || '',
    unidade_sigla: String(leg?.unidade_medida || 'UN').toUpperCase(),
    fator_aplicado: fator,
    quantidade_pedida_comercial: round6(qP),
    quantidade_pedida_base: round6(qP * fator),
    quantidade_embarcada_comercial: round6(qE),
    quantidade_embarcada_base: round6(qE * fator),
    quantidade_recebida_comercial: round6(qR),
    quantidade_recebida_base: round6(qR * fator),
    divergencia_tipo: leg?.divergencia_tipo || 'Nenhuma',
    produto_id_recebido_diferente: leg?.produto_id_recebido_diferente || '',
    produto_nome_recebido_diferente: leg?.produto_nome_recebido_diferente || '',
    acordo_financeiro_lancamento_id: leg?.acordo_financeiro_lancamento_id || '',
    ordem,
    observacoes: typeof leg?.observacoes === 'string' ? leg.observacoes : '',
  };
}

async function main() {
  const { apply, limit } = parseArgs(process.argv.slice(2));
  const base44 = requireBase44Client();

  const [embarques, eiSample] = await Promise.all([
    base44.entities.Embarque.filter({}, null, limit),
    base44.entities.EmbarqueItem.filter({}, null, 2000),
  ]);

  const comSql = new Set((eiSample || []).map((r) => r.embarque_id).filter(Boolean));
  const candidatos = (embarques || []).filter((e) => legacyItens(e).length > 0 && !comSql.has(e.id));

  console.log(`Embarques pendentes: ${candidatos.length} (dry_run=${!apply})`);

  const produtoCache = new Map();
  const pciCache = new Map();

  const fetchProduto = async (id) => {
    if (!id) return null;
    if (produtoCache.has(id)) return produtoCache.get(id);
    const rows = await base44.entities.Produto.filter({ id }, null, 1);
    const p = rows?.[0] || null;
    produtoCache.set(id, p);
    return p;
  };

  const fetchPci = async (pedidoId) => {
    if (!pedidoId) return [];
    if (pciCache.has(pedidoId)) return pciCache.get(pedidoId);
    const rows = await base44.entities.PedidoCompraItem.filter({ pedido_compra_id: pedidoId });
    const arr = Array.isArray(rows) ? rows : [];
    pciCache.set(pedidoId, arr);
    return arr;
  };

  let criados = 0;
  for (const embarque of candidatos) {
    const itensLeg = legacyItens(embarque);
    const pci = embarque.pedido_compra_id ? await fetchPci(embarque.pedido_compra_id) : [];

    for (let i = 0; i < itensLeg.length; i++) {
      const leg = itensLeg[i];
      const produto = await fetchProduto(String(leg?.produto_id || ''));
      if (!produto) {
        console.warn(`  [skip] ${embarque.numero || embarque.id}: produto ${leg?.produto_id}`);
        continue;
      }

      const pedidoItem =
        pci.find((p) => p.id === leg?.pedido_compra_item_id)
        || pci.find((p) => p.produto_id === produto.id)
        || null;

      const item = buildEmbarqueItem(embarque, produto, leg, pedidoItem?.id, i);
      if (asNumber(item.quantidade_embarcada_comercial) <= 0 && asNumber(item.quantidade_pedida_comercial) <= 0) {
        continue;
      }

      if (apply) {
        await base44.entities.EmbarqueItem.create(item);
        await sleep(100);
      }
      criados++;
      console.log(`  ${apply ? '✓' : '~'} ${embarque.numero || embarque.id} · ${item.produto_nome}`);
    }
  }

  console.log(`\nLinhas ${apply ? 'criadas' : 'simuladas'}: ${criados}`);
  if (!apply) console.log('Para gravar: npm run compras:migrar-embarque-local -- --apply');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
