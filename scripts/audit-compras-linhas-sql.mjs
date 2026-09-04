#!/usr/bin/env node
/**
 * Auditoria de cobertura SQL: PedidoCompraItem + EmbarqueItem vs espelhos legados.
 *
 * Uso:
 *   npm run compras:audit-linhas-sql
 *   npm run compras:audit-linhas-sql -- --limit=500
 */

import { requireBase44Client } from './base44-env.mjs';

const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

function parseArgs(argv) {
  const args = { limit: 300 };
  for (const a of argv) {
    if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length)) || 300;
  }
  return args;
}

async function safeFilter(base44, entity, where, limit) {
  try {
    const rows = await base44.entities[entity].filter(where, null, limit);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

async function main() {
  const { limit } = parseArgs(process.argv.slice(2));
  const base44 = requireBase44Client();

  console.log('\n== Auditoria linhas SQL (compras + embarques) ==\n');

  const pciProbe = await safeFilter(base44, 'PedidoCompraItem', {}, 1);
  if (pciProbe?.error) {
    console.error('PedidoCompraItem indisponível:', pciProbe.error);
    process.exit(2);
  }

  const eiProbe = await safeFilter(base44, 'EmbarqueItem', {}, 1);
  if (eiProbe?.error) {
    console.error('EmbarqueItem indisponível:', eiProbe.error);
    process.exit(2);
  }

  const [pciSample, eiSample, pedidos, embarques] = await Promise.all([
    safeFilter(base44, 'PedidoCompraItem', {}, 2000),
    safeFilter(base44, 'EmbarqueItem', {}, 2000),
    safeFilter(base44, 'PedidoCompra', {}, limit),
    safeFilter(base44, 'Embarque', {}, limit),
  ]);

  const pciPorPedido = new Set((pciSample || []).map((r) => r.pedido_compra_id).filter(Boolean));
  const eiPorEmbarque = new Set((eiSample || []).map((r) => r.embarque_id).filter(Boolean));

  let pedidosComItensLegado = 0;
  let linhasLegadoPedido = 0;
  let pedidosSemSql = 0;

  for (const p of pedidos || []) {
    const itens = Array.isArray(p.itens) ? p.itens : [];
    if (itens.length) {
      pedidosComItensLegado++;
      linhasLegadoPedido += itens.length;
    }
    if (itens.length > 0 && !pciPorPedido.has(p.id)) {
      pedidosSemSql++;
    }
  }

  let embarquesComItensLegado = 0;
  let linhasLegadoEmbarque = 0;
  let embarquesSemSql = 0;

  for (const e of embarques || []) {
    const itens =
      (Array.isArray(e.itens_embarcados) && e.itens_embarcados.length > 0
        ? e.itens_embarcados
        : Array.isArray(e.itens)
          ? e.itens
          : []);
    if (itens.length) {
      embarquesComItensLegado++;
      linhasLegadoEmbarque += itens.length;
    }
    if (itens.length > 0 && !eiPorEmbarque.has(e.id)) {
      embarquesSemSql++;
    }
  }

  console.log('PedidoCompraItem (amostra até 2000 linhas):');
  console.log(`  Linhas SQL: ${fmt(pciSample.length)}`);
  console.log(`  Pedidos distintos com SQL: ${fmt(pciPorPedido.size)}`);
  console.log(`  Pedidos amostrados: ${fmt(pedidos.length)}`);
  console.log(`  Com itens no espelho legado: ${fmt(pedidosComItensLegado)} (${fmt(linhasLegadoPedido)} linhas)`);
  console.log(`  Com espelho mas SEM SQL: ${fmt(pedidosSemSql)}`);

  console.log('\nEmbarqueItem (amostra até 2000 linhas):');
  console.log(`  Linhas SQL: ${fmt(eiSample.length)}`);
  console.log(`  Embarques distintos com SQL: ${fmt(eiPorEmbarque.size)}`);
  console.log(`  Embarques amostrados: ${fmt(embarques.length)}`);
  console.log(`  Com itens no espelho legado: ${fmt(embarquesComItensLegado)} (${fmt(linhasLegadoEmbarque)} linhas)`);
  console.log(`  Com espelho mas SEM SQL: ${fmt(embarquesSemSql)}`);

  console.log('\n== Ações sugeridas ==');
  if (pedidosSemSql > 0) {
    console.log(`• Migrar pedidos: npm run compras:migrar-pci-legacy -- --apply`);
  }
  if (embarquesSemSql > 0) {
    console.log(`• Migrar embarques (após pedidos): npm run compras:migrar-embarque-legacy -- --apply`);
  }
  if (pedidosSemSql === 0 && embarquesSemSql === 0) {
    console.log('Cobertura OK na amostra — pode avançar leitura SQL nas telas.');
  }

  process.exit(pedidosSemSql > 0 || embarquesSemSql > 0 ? 3 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
