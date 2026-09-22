#!/usr/bin/env node
/**
 * Órfãos por fornecedor — view pedido_compra_orfaos_v (migration 095).
 * Conta simples: pedido − embarcado, só pedidos com algum embarque > 0.
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

function cxFromNome(nome, qtd, un) {
  if (String(un || '').toUpperCase() === 'CX') return Math.round(qtd * 10) / 10;
  const m = String(nome || '').match(/([\d,\.]+)\s*m[²2]\s*\/\s*cx/i)
    || String(nome || '').match(/\(([\d,\.]+)\s*m[²2]/i);
  const m2cx = m ? parseFloat(m[1].replace(',', '.')) : null;
  return m2cx && qtd ? Math.round((qtd / m2cx) * 10) / 10 : null;
}

async function main() {
  const rows = await sbFetch(
    '/rest/v1/pedido_compra_orfaos_v?select=fornecedor_nome,pedido_compra_numero,pedido_status,produto_nome,unidade_sigla,quantidade_pedida,quantidade_embarcada,saldo_orfa&order=fornecedor_nome.asc,pedido_compra_numero.asc,produto_nome.asc',
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
    const saldo = Number(row.saldo_orfa);
    pedidos.get(num).linhas.push({
      produto: (row.produto_nome || '').slice(0, 58),
      pedida: Number(row.quantidade_pedida),
      embarcada: Number(row.quantidade_embarcada),
      saldo,
      un: row.unidade_sigla,
      cx: cxFromNome(row.produto_nome, saldo, row.unidade_sigla),
    });
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ linhas: rows.length, porFornecedor: Object.fromEntries(porFornecedor) }, null, 2));
    return;
  }

  console.log('=== Órfãos — pedido − embarcado (view 095) ===\n');
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
        if (l.cx) totalCx += l.cx;
        console.log(
          `    • saldo ${l.saldo} ${l.un}${l.cx != null ? ` (~${l.cx} cx)` : ''}`
          + ` (pedido ${l.pedida} − embarcado ${l.embarcada}) — ${l.produto}`,
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
