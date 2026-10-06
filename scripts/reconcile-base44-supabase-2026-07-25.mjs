#!/usr/bin/env node
/**
 * Reconciliação única Base44 ↔ Supabase (25/07/2026).
 *
 * Regras:
 * - Até PV-02705: Base44 (já alinhado)
 * - Apagar PV-02694 de teste no Supabase (id e0e56004…)
 * - Fechamento TC-00110 de ontem: prevalece Base44
 * - Apagar TC-00111 duplicado de teste no Supabase
 * - Renumerar vendas homolog Supabase PV-02706..2711 → PV-02719..2724
 * - Importar do Base44 PV-02706..2718 + MCX-99778..99783 + turnos
 *
 * Uso: npm run reconcile:base44-supabase-2026-07-25
 */

import { createClient } from '@base44/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { spawn } from 'node:child_process';

import { resolveEntityMapping } from '../src/integrations/p38/entityTableMap.js';
import { prepareWritePayload } from '../src/integrations/p38/supabaseEntityLayer.js';

const BAD_PV_ID = 'e0e56004-2ec7-4400-b725-afe4926dfdc4';
const DUP_TC111_ID = '16a501c0-e24f-4c39-b358-f30ca369f1e7';

/** Renumerar do maior para o menor para não colidir. */
const RENUMBER_MAP = [
  ['PV-02711', 'PV-02724'],
  ['PV-02710', 'PV-02723'],
  ['PV-02709', 'PV-02722'],
  ['PV-02708', 'PV-02721'],
  ['PV-02707', 'PV-02720'],
  ['PV-02706', 'PV-02719'],
];

const IMPORT_PEDIDOS = Array.from({ length: 13 }, (_, i) => `PV-${String(2706 + i).padStart(5, '0')}`);
const IMPORT_MCX = Array.from({ length: 6 }, (_, i) => `MCX-${String(99778 + i).padStart(5, '0')}`);

function loadDotEnvFiles() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const name of ['.env', '.env.local']) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    for (let line of text.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      if (/^export\s+/i.test(line)) line = line.replace(/^export\s+/i, '').trim();
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val.replace(/\\n/g, '\n');
    }
  }
}

loadDotEnvFiles();

function requireEnv() {
  const appId = process.env.VITE_BASE44_APP_ID;
  const serverUrl = process.env.VITE_BASE44_BACKEND_URL || 'https://base44.app';
  const apiKey = process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!appId || !apiKey || !databaseUrl) {
    console.error('[reconcile] Faltam VITE_BASE44_APP_ID, BASE44_API_KEY ou DATABASE_URL');
    process.exit(1);
  }
  return { appId, serverUrl, apiKey, databaseUrl };
}

function buildPgPoolConfig(connectionString) {
  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
  };
}

function serializeCell(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object' && !Buffer.isBuffer(val)) return val;
  return val;
}

async function loadTableColumns(client, table) {
  const r = await client.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table]
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function loadJsonbColumnMeta(client, table) {
  const r = await client.query(
    `select column_name, is_nullable, coalesce(column_default::text, '') as def, udt_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1 and udt_name in ('jsonb', 'json')`,
    [table]
  );
  const meta = new Map();
  for (const row of r.rows) {
    const def = String(row.def || '');
    meta.set(row.column_name, {
      notNull: row.is_nullable === 'NO',
      defaultIsArray: def.includes('[]'),
      udtName: row.udt_name === 'json' ? 'json' : 'jsonb',
    });
  }
  return meta;
}

async function upsertBatch(client, table, rows, allowedCols, jsonbMeta) {
  let skipped = 0;
  for (const row of rows) {
    const clean = { ...row };
    for (const k of Object.keys(clean)) {
      if (allowedCols && !allowedCols.has(k)) delete clean[k];
    }
    if (!clean.id) {
      skipped += 1;
      continue;
    }
    const keys = Object.keys(clean);
    const colList = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(', ');
    const placeholders = keys
      .map((k, i) => {
        const cast = jsonbMeta?.has(k) ? `::${jsonbMeta.get(k).udtName || 'jsonb'}` : '';
        return `$${i + 1}${cast}`;
      })
      .join(', ');
    const values = keys.map((k) => {
      const v = clean[k];
      if (jsonbMeta?.has(k) && v !== null && typeof v === 'object') return JSON.stringify(v);
      return serializeCell(v);
    });
    const updateSet = keys
      .filter((k) => k !== 'id')
      .map((k) => `"${k.replace(/"/g, '""')}" = EXCLUDED."${k.replace(/"/g, '""')}"`)
      .join(', ');
    const sql =
      `INSERT INTO public.${table.replace(/[^a-z0-9_]/gi, '')} (${colList}) VALUES (${placeholders}) ` +
      `ON CONFLICT (id) DO UPDATE SET ${updateSet || '"id" = EXCLUDED."id"'}`;
    await client.query(sql, values);
  }
  return skipped;
}

async function upsertEntityRows(client, entityName, rawRows) {
  const mapping = resolveEntityMapping(entityName);
  if (!mapping?.table) throw new Error(`Sem mapping para ${entityName}`);
  const table = mapping.table;
  const allowedCols = await loadTableColumns(client, table);
  const jsonbMeta = await loadJsonbColumnMeta(client, table);
  const prepared = rawRows.map((r) => {
    const p = prepareWritePayload(r, entityName, mapping);
    const out = {};
    for (const [k, v] of Object.entries(p)) {
      if (allowedCols.has(k)) out[k] = v;
    }
    if (allowedCols.has('id') && p.id) out.id = p.id;
    return out;
  });
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL session_replication_role = 'replica'");
    const skipped = await upsertBatch(client, table, prepared, allowedCols, jsonbMeta);
    await client.query("SET LOCAL session_replication_role = 'origin'");
    await client.query('COMMIT');
    return { table, count: prepared.length, skipped };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

async function deletePedidoDependents(client, pedidoId) {
  const tables = [
    ['pedido_venda_item', 'pedido_venda_id'],
    ['lancamento_financeiro', 'referencia_id'],
    ['movimentacao_estoque', 'referencia_id'],
    ['pagamento_cartao_detalhe', 'pedido_venda_id'],
  ];
  for (const [table, col] of tables) {
    const exists = await client.query(
      `select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`,
      [table, col]
    );
    if (!exists.rows.length) continue;
    const r = await client.query(`DELETE FROM public.${table} WHERE ${col} = $1`, [pedidoId]);
    console.log(`[reconcile] DELETE ${table} where ${col}=${pedidoId.slice(0, 8)}… → ${r.rowCount}`);
  }
  const r = await client.query(`DELETE FROM public.pedido_venda WHERE id = $1`, [pedidoId]);
  console.log(`[reconcile] DELETE pedido_venda ${pedidoId.slice(0, 8)}… → ${r.rowCount}`);
}

async function renumberPedido(client, oldNum, newNum) {
  const pv = (
    await client.query(`SELECT id FROM public.pedido_venda WHERE numero = $1`, [oldNum])
  ).rows[0];
  if (!pv) {
    console.warn(`[reconcile] Renumerar: ${oldNum} não encontrado — ignorado`);
    return;
  }
  await client.query(`UPDATE public.pedido_venda SET numero = $1, updated_at = now() WHERE id = $2`, [
    newNum,
    pv.id,
  ]);
  await client.query(
    `UPDATE public.lancamento_financeiro SET referencia_numero = $1, updated_at = now() WHERE referencia_id = $2`,
    [newNum, pv.id]
  );
  await client.query(
    `UPDATE public.movimentacao_estoque SET referencia_numero = $1, updated_at = now() WHERE referencia_id = $2`,
    [newNum, pv.id]
  );
  await client.query(
    `UPDATE public.pedido_venda_item SET pedido_venda_numero = $1, updated_at = now() WHERE pedido_venda_id = $2`,
    [newNum, pv.id]
  );
  console.log(`[reconcile] Renumerado ${oldNum} → ${newNum} (id ${pv.id.slice(0, 8)}…)`);
}

async function fetchByNumero(base44, entityName, numero) {
  const api = base44.entities?.[entityName];
  if (!api?.filter) return [];
  const rows = await api.filter({ numero });
  return Array.isArray(rows) ? rows : [];
}

async function fetchRelatedByReferencia(base44, entityName, pedidoId) {
  const api = base44.entities?.[entityName];
  if (!api?.filter) return [];
  const rows = await api.filter({ referencia_id: pedidoId });
  return Array.isArray(rows) ? rows : [];
}

async function fetchPedidoVendaItems(base44, pedidoId) {
  const api = base44.entities?.PedidoVendaItem;
  if (!api?.filter) return [];
  const rows = await api.filter({ pedido_venda_id: pedidoId });
  return Array.isArray(rows) ? rows : [];
}

function runMigrateImport() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npm',
      [
        'run',
        'migrate:base44-to-supabase',
        '--',
        '--only=PedidoVenda,PedidoVendaItem,LancamentoFinanceiro,MovimentacaoEstoque,MovimentosCaixa,TurnoCaixa',
        '--limit=120',
      ],
      { stdio: 'inherit', shell: true, cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') }
    );
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`migrate exit ${code}`))));
  });
}

async function validate(client) {
  const checks = [];

  const bad2694 = await client.query(
    `SELECT count(*)::int n FROM pedido_venda WHERE id = $1`,
    [BAD_PV_ID]
  );
  checks.push({ name: 'PV-02694 teste apagado', ok: bad2694.rows[0].n === 0 });

  const dupTc = await client.query(`SELECT count(*)::int n FROM turno_caixa WHERE id = $1`, [DUP_TC111_ID]);
  checks.push({ name: 'TC-00111 duplicado apagado', ok: dupTc.rows[0].n === 0 });

  for (const num of IMPORT_PEDIDOS) {
    const r = await client.query(`SELECT id, total FROM pedido_venda WHERE numero = $1`, [num]);
    checks.push({ name: `${num} presente`, ok: r.rows.length === 1 });
  }

  for (const [oldNum, newNum] of RENUMBER_MAP) {
    const homologIds = {
      'PV-02706': 'b801bb22',
      'PV-02707': 'ffbfb235',
      'PV-02708': '197ec122',
      'PV-02709': '8a136fbe',
      'PV-02710': '5690d685',
      'PV-02711': '783aab22',
    };
    const newR = await client.query(`SELECT id FROM pedido_venda WHERE numero = $1`, [newNum]);
    const expectedPrefix = homologIds[oldNum];
    checks.push({
      name: `Homolog ${oldNum}→${newNum}`,
      ok: newR.rows.length === 1 && String(newR.rows[0].id).startsWith(expectedPrefix),
    });
  }

  const tc110 = await client.query(
    `SELECT data_fechamento, total_sangrias FROM turno_caixa WHERE numero = 'TC-00110'`
  );
  const fech = tc110.rows[0]?.data_fechamento;
  const fechIso = fech instanceof Date ? fech.toISOString() : String(fech ?? '');
  const sangrias = Number(tc110.rows[0]?.total_sangrias);
  checks.push({
    name: 'TC-00110 fechamento Base44 (24/07)',
    ok: fechIso.startsWith('2026-07-24') && sangrias >= 2800,
  });

  const tc111 = await client.query(
    `SELECT id, status, data_abertura FROM turno_caixa WHERE numero = 'TC-00111'`
  );
  checks.push({
    name: 'TC-00111 único (Base44)',
    ok: tc111.rows.length === 1 && tc111.rows[0].id.startsWith('6a64b90e'),
  });

  for (const num of IMPORT_MCX) {
    const r = await client.query(`SELECT count(*)::int n FROM movimentos_caixa WHERE numero = $1`, [num]);
    checks.push({ name: `${num} presente`, ok: r.rows[0].n >= 1 });
  }

  const maxPv = await client.query(
    `SELECT numero FROM pedido_venda WHERE numero ~ '^PV-[0-9]+$' ORDER BY substring(numero from 4)::int DESC LIMIT 1`
  );
  checks.push({ name: 'Último PV', ok: maxPv.rows[0]?.numero === 'PV-02724', detail: maxPv.rows[0]?.numero });

  return checks;
}

async function main() {
  const { appId, serverUrl, apiKey, databaseUrl } = requireEnv();
  const base44 = createClient({
    appId,
    serverUrl,
    headers: { api_key: apiKey },
  });

  const pool = new pg.Pool(buildPgPoolConfig(databaseUrl));
  const client = await pool.connect();

  try {
    console.log('[reconcile] === PASSO 1: apagar PV-02694 de teste ===');
    await deletePedidoDependents(client, BAD_PV_ID);

    console.log('\n[reconcile] === PASSO 2: renumerar vendas homolog Supabase ===');
    for (const [oldNum, newNum] of RENUMBER_MAP) {
      await renumberPedido(client, oldNum, newNum);
    }

    console.log('\n[reconcile] === PASSO 3: apagar TC-00111 duplicado ===');
    const delTc = await client.query(`DELETE FROM public.turno_caixa WHERE id = $1`, [DUP_TC111_ID]);
    console.log(`[reconcile] DELETE turno_caixa duplicado → ${delTc.rowCount}`);

    console.log('\n[reconcile] === PASSO 4: importar Base44 (pedidos, itens, lançamentos, estoque, caixa, turnos) ===');
    await client.release();
    await pool.end();
    await runMigrateImport();

    const pool2 = new pg.Pool(buildPgPoolConfig(databaseUrl));
    const client2 = await pool2.connect();

    console.log('\n[reconcile] === PASSO 5: validação ===');
    const checks = await validate(client2);
    let allOk = true;
    for (const c of checks) {
      const mark = c.ok ? '✓' : '✗';
      console.log(`  ${mark} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
      if (!c.ok) allOk = false;
    }

    await client2.release();
    await pool2.end();

    if (!allOk) {
      console.error('\n[reconcile] Validação falhou — rever logs acima.');
      process.exit(1);
    }
    console.log('\n[reconcile] Concluído com sucesso.');
  } catch (e) {
    console.error('[reconcile] Erro:', e?.message || e);
    process.exit(1);
  }
}

main();
