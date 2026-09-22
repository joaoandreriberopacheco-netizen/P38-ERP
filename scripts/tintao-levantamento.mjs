#!/usr/bin/env node
/**
 * Levantamento Tintão — fornecedor → pedido → linhas com falta (CX).
 * Usa pedido_compra_saldo_a_embarcar_v (migration 101): falta em base M²
 * convertida para vitrine. Inclui Verona, Naturale, etc. Trânsito excluído.
 *
 * Uso:
 *   node scripts/tintao-levantamento.mjs
 *   node scripts/tintao-levantamento.mjs --json
 */
import { resolveP38Secrets } from './p38-secrets.mjs';

const BASE = 'https://zhonvxkkqabfdyehyxpu.supabase.co';

async function sbFetch(path) {
  const key = resolveP38Secrets().serviceRoleKey;
  const r = await fetch(`${BASE}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`${r.status} ${path}: ${await r.text()}`);
  return r.json();
}

async function main() {
  const rows = await sbFetch(
    '/rest/v1/pedido_compra_saldo_a_embarcar_v'
    + '?or=(fornecedor_nome.ilike.*TINTAO%20TELEVENDAS*,fornecedor_nome.ilike.*TINTAO%20NOVA%20CIDADE*)'
    + '&or=(falta_operacional.gt.0.009,saldo_pos_recepcao.gt.0.009)'
    + '&select=fornecedor_nome,pedido_compra_numero,pedido_status,produto_nome,'
    + 'falta_operacional,falta_operacional_vitrine,unidade_vitrine_sigla,fator_vitrine,'
    + 'quantidade_pedida_base,quantidade_recebida_real,quantidade_em_transito,saldo_pos_recepcao'
    + '&order=fornecedor_nome.asc,pedido_compra_numero.asc,produto_nome.asc',
  );

  function vitrineFromBase(base, fator, un) {
    const b = Number(base) || 0;
    const f = Number(fator) || 1;
    if (b <= 0.009) return 0;
    if (f <= 0.009) return b;
    const raw = b / f;
    if (String(un).toUpperCase() === 'CX' && Math.abs(raw - Math.round(raw)) <= 0.02) {
      return Math.round(raw);
    }
    return Math.round(raw * 100) / 100;
  }

  const porFornecedor = new Map();
  for (const row of rows) {
    const forn = String(row.fornecedor_nome || 'Sem fornecedor').trim();
    if (!porFornecedor.has(forn)) porFornecedor.set(forn, new Map());
    const pedidos = porFornecedor.get(forn);
    const num = row.pedido_compra_numero;
    if (!pedidos.has(num)) {
      pedidos.set(num, { status: row.pedido_status, linhas: [], cx: 0 });
    }
    const un = row.unidade_vitrine_sigla || 'UN';
    const faltaBase = Number(row.falta_operacional) || 0;
    const posBase = Number(row.saldo_pos_recepcao) || 0;
    const faltaVitrine = Number(row.falta_operacional_vitrine) || vitrineFromBase(faltaBase, row.fator_vitrine, un);
    const posVitrine = vitrineFromBase(posBase, row.fator_vitrine, un);
    const totalBase = faltaBase + posBase;
    const totalVitrine = faltaVitrine + posVitrine;
    pedidos.get(num).linhas.push({
      produto: (row.produto_nome || '').slice(0, 58),
      faltaBase,
      faltaVitrine,
      posBase,
      posVitrine,
      totalBase,
      totalVitrine,
      un,
      pedidaBase: Number(row.quantidade_pedida_base),
      recebidaBase: Number(row.quantidade_recebida_real),
      transitoBase: Number(row.quantidade_em_transito),
    });
    if (un === 'CX') pedidos.get(num).cx += totalVitrine;
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ linhas: rows.length, porFornecedor: Object.fromEntries(porFornecedor) }, null, 2));
    return;
  }

  console.log('=== Tintão — falta operacional (fornecedor → pedido) ===');
  console.log('Regra: (pedido − recebido − trânsito) + pós-recepção (Necessidade BD), em CX\n');

  let totalPed = 0;
  let totalLin = 0;
  let totalCx = 0;

  for (const [forn, pedidos] of [...porFornecedor.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))) {
    let fornCx = 0;
    console.log(`## ${forn}`);
    for (const [num, p] of [...pedidos.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR'))) {
      totalPed += 1;
      fornCx += p.cx;
      console.log(`\n  Pedido ${num} (${p.status}) — ~${Math.round(p.cx * 10) / 10} CX`);
      for (const l of p.linhas) {
        totalLin += 1;
        if (l.un === 'CX') totalCx += l.totalVitrine;
        const partes = [];
        if (l.faltaVitrine > 0.009) partes.push(`falta ${l.faltaVitrine}`);
        if (l.posVitrine > 0.009) partes.push(`pós-recepção ${l.posVitrine}`);
        console.log(
          `    • ${l.totalVitrine} ${l.un}`
          + ` (${partes.join(' + ') || l.totalBase + ' base'})`
          + ` — pedido ${l.pedidaBase}, recebido ${l.recebidaBase}`
          + (l.transitoBase > 0.009 ? `, trânsito ${l.transitoBase}` : '')
          + ` — ${l.produto}`,
        );
      }
    }
    console.log(`  Subtotal fornecedor: ~${Math.round(fornCx * 10) / 10} CX\n`);
  }

  console.log(
    `--- ${porFornecedor.size} fornecedor(es), ${totalPed} pedido(s), ${totalLin} linha(s), ~${Math.round(totalCx * 10) / 10} CX ---`,
  );
  console.log('\nNota: lista de «órfãos» (só gap pós-recepção) → node scripts/orfaos-por-fornecedor.mjs');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
