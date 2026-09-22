#!/usr/bin/env node
/**
 * Órfãos por fornecedor — view pedido_compra_orfaos_v (migration 100).
 * Saldos em base (M²) + saldo_orfa em unidade vitrine (CX).
 *
 * Uso: node scripts/orfaos-por-fornecedor.mjs
 */
import { resolveP38Secrets } from './p38-secrets.mjs';

const BASE = 'https://zhonvxkkqabfdyehyxpu.supabase.co';

async function sbFetch(path) {
  const key = resolveP38Secrets().serviceRoleKey;
  const r = await fetch(`${BASE}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const msg = await r.text();
    if (r.status === 404 || msg.includes('42P01')) {
      throw new Error('View pedido_compra_orfaos_v não encontrada. Corra: npm run supabase:deploy -- --migrations-only');
    }
    throw new Error(`${r.status} ${path}: ${msg}`);
  }
  return r.json();
}

async function main() {
  const rows = await sbFetch(
    '/rest/v1/pedido_compra_orfaos_v?select=fornecedor_nome,pedido_compra_numero,pedido_status,produto_nome,unidade_sigla,unidade_vitrine_sigla,quantidade_pedida_base,quantidade_desmembrada_base,quantidade_embarcada_base,quantidade_recebida_base,saldo_orfa_base,saldo_orfa&order=fornecedor_nome.asc,pedido_compra_numero.asc,produto_nome.asc',
  );

  const porFornecedor = new Map();
  for (const row of rows) {
    const forn = String(row.fornecedor_nome || 'Sem fornecedor').trim();
    if (!porFornecedor.has(forn)) porFornecedor.set(forn, new Map());
    const pedidos = porFornecedor.get(forn);
    const num = row.pedido_compra_numero;
    if (!pedidos.has(num)) {
      pedidos.set(num, { status: row.pedido_status, linhas: [] });
    }
    const saldoVitrine = Number(row.saldo_orfa);
    const unVitrine = row.unidade_vitrine_sigla || 'CX';
    pedidos.get(num).linhas.push({
      produto: (row.produto_nome || '').slice(0, 58),
      pedidaBase: Number(row.quantidade_pedida_base),
      desmembradaBase: Number(row.quantidade_desmembrada_base),
      recebidaBase: Number(row.quantidade_recebida_base),
      saldoBase: Number(row.saldo_orfa_base),
      saldoVitrine,
      unBase: row.unidade_sigla,
      unVitrine,
    });
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ linhas: rows.length, porFornecedor: Object.fromEntries(porFornecedor) }, null, 2));
    return;
  }

  console.log('=== Órfãos — unidade vitrine (view 100, trânsito excluído) ===\n');
  let totalPed = 0;
  let totalLin = 0;
  let totalCx = 0;

  for (const [forn, pedidos] of [...porFornecedor.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))) {
    console.log(`## ${forn}`);
    for (const [num, p] of [...pedidos.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR'))) {
      totalPed += 1;
      console.log(`\n  Pedido ${num} (${p.status})`);
      for (const l of p.linhas) {
        totalLin += 1;
        if (String(l.unVitrine).toUpperCase() === 'CX') totalCx += l.saldoVitrine;
        console.log(
          `    • saldo ${l.saldoVitrine} ${l.unVitrine}`
          + ` (${l.saldoBase} ${l.unBase} base)`
          + ` — pedido ${l.pedidaBase} ${l.unBase}, recebido ${l.recebidaBase} ${l.unBase}`
          + ` — ${l.produto}`,
        );
      }
    }
    console.log('');
  }

  console.log(
    `--- ${porFornecedor.size} fornecedor(es), ${totalPed} pedido(s), ${totalLin} linha(s), ~${Math.round(totalCx * 10) / 10} cx ---`,
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
