#!/usr/bin/env node
/**
 * Auditoria Tintão: view pedido_compra_saldo_a_embarcar_v vs lista manual 22/09/2026.
 *
 * Pré-requisito: migration 094 aplicada no Supabase (view existe).
 * Uso: node scripts/tintao-saldo-view-auditoria.mjs
 *
 * Lista manual (controlo operacional):
 *   EXC-FQZ 1 cx, HHW-5NP 9, KQL-J94 4, SQF-7ZH 17, AB6-PPQ 10, 7MW-ZZQ 1 Roble
 *   Total ~42 cx. PW8-WLV deve estar zerado.
 */
import { resolveP38Secrets } from './p38-secrets.mjs';

const BASE = 'https://zhonvxkkqabfdyehyxpu.supabase.co';

/** Prefixos de código de card esperados com falta (22/09). PW8 excluído de propósito. */
const ESPERADO_PREFIXOS = [
  { prefix: 'EXC-FQZ', minFalta: 0.5, label: 'EXC-FQZ ~1 cx' },
  { prefix: 'HHW-5NP', minFalta: 8, label: 'HHW-5NP ~9 cx' },
  { prefix: 'KQL-J94', minFalta: 3, label: 'KQL-J94 ~4 cx' },
  { prefix: 'SQF-7ZH', minFalta: 16, label: 'SQF-7ZH ~17 cx' },
  { prefix: 'AB6-PPQ', minFalta: 9, label: 'AB6-PPQ ~10 cx Travertino' },
  { prefix: '7MW-ZZQ', minFalta: 0.5, label: '7MW-ZZQ ~1 cx Roble' },
];

const EXCLUIR_ZERADO = ['PW8-WLV'];

const TOTAL_ESPERADO_MIN = 38;
const TOTAL_ESPERADO_MAX = 46;

async function sbFetch(path) {
  const key = resolveP38Secrets().serviceRoleKey;
  const r = await fetch(`${BASE}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`${r.status} ${path}: ${await r.text()}`);
  return r.json();
}

function normCodigo(numero) {
  return String(numero || '').toUpperCase().replace(/\s/g, '');
}

async function main() {
  console.log('=== Auditoria Tintão — view pedido_compra_saldo_a_embarcar_v ===\n');

  let rows;
  try {
    rows = await sbFetch(
      '/rest/v1/pedido_compra_saldo_a_embarcar_v?fornecedor_nome=ilike.*tint*&falta_operacional=gt.0.009&select=pedido_compra_numero,produto_nome,unidade_sigla,falta_operacional,saldo_pos_recepcao,diagnostico,quantidade_em_transito&order=pedido_compra_numero.asc',
    );
  } catch (e) {
    if (String(e.message).includes('404') || String(e.message).includes('42P01')) {
      console.error('View não encontrada. Aplique migration 094 no Supabase primeiro.');
      process.exit(2);
    }
    throw e;
  }

  const porPedido = {};
  let somaFalta = 0;

  for (const row of rows) {
    const cod = normCodigo(row.pedido_compra_numero);
    if (!porPedido[cod]) porPedido[cod] = { linhas: [], soma: 0 };
    porPedido[cod].linhas.push(row);
    porPedido[cod].soma += Number(row.falta_operacional) || 0;
    somaFalta += Number(row.falta_operacional) || 0;
  }

  console.log(`Linhas com falta_operacional > 0: ${rows.length}`);
  console.log(`Soma falta_operacional (unidades comerciais): ${somaFalta.toFixed(2)}\n`);

  console.log('--- Por pedido ---');
  Object.entries(porPedido)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([cod, info]) => {
      console.log(`  ${cod}: soma=${info.soma.toFixed(2)} (${info.linhas.length} linha(s))`);
      info.linhas.forEach((l) => {
        console.log(`    - ${l.produto_nome?.slice(0, 50)} | falta=${l.falta_operacional} ${l.unidade_sigla} | ${l.diagnostico}`);
      });
    });

  console.log('\n--- Verificações ---');
  let ok = 0;
  let fail = 0;

  for (const exp of ESPERADO_PREFIXOS) {
    const match = Object.entries(porPedido).find(([cod]) => cod.startsWith(normCodigo(exp.prefix)));
    if (!match) {
      console.log(`  FAIL  ${exp.label}: pedido não encontrado com falta`);
      fail += 1;
      continue;
    }
    const [, info] = match;
    if (info.soma >= exp.minFalta) {
      console.log(`  OK    ${exp.label}: soma=${info.soma.toFixed(2)}`);
      ok += 1;
    } else {
      console.log(`  FAIL  ${exp.label}: soma=${info.soma.toFixed(2)} (esperado >= ${exp.minFalta})`);
      fail += 1;
    }
  }

  for (const ex of EXCLUIR_ZERADO) {
    const match = Object.entries(porPedido).find(([cod]) => cod.startsWith(normCodigo(ex)));
    if (match) {
      console.log(`  FAIL  ${ex} deveria estar zerado; soma=${match[1].soma.toFixed(2)}`);
      fail += 1;
    } else {
      console.log(`  OK    ${ex} sem falta (zerado ou ausente)`);
      ok += 1;
    }
  }

  if (somaFalta >= TOTAL_ESPERADO_MIN && somaFalta <= TOTAL_ESPERADO_MAX) {
    console.log(`  OK    Total ${somaFalta.toFixed(2)} dentro da faixa ${TOTAL_ESPERADO_MIN}–${TOTAL_ESPERADO_MAX}`);
    ok += 1;
  } else {
    console.log(`  FAIL  Total ${somaFalta.toFixed(2)} fora da faixa ${TOTAL_ESPERADO_MIN}–${TOTAL_ESPERADO_MAX}`);
    fail += 1;
  }

  console.log(`\nResultado: ${ok} OK, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
