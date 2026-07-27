#!/usr/bin/env node
/**
 * Audita drift entre espelhos JSON (pedido_compra.itens / embarque.itens)
 * e tabelas canónicas (pedido_compra_item / embarque_item).
 *
 * Uso:
 *   node scripts/auditar-espelhos-canonicos.mjs
 *   node scripts/auditar-espelhos-canonicos.mjs --limit=50
 *   node scripts/auditar-espelhos-canonicos.mjs --repair=dry
 *   node scripts/auditar-espelhos-canonicos.mjs --repair=apply
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const limitRaw = argv.find((a) => a.startsWith('--limit='))?.slice(8);
  const repair = argv.find((a) => a.startsWith('--repair='))?.slice(9) || '';
  return {
    limit: limitRaw ? Math.max(1, Number(limitRaw) || 100) : 200,
    repair: repair === 'apply' ? 'apply' : repair === 'dry' ? 'dry' : null,
  };
}

function jsonItemCount(row) {
  const raw = row?.itens ?? row?.dados?.itens;
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function auditPedidos(pool, limit) {
  const { rows } = await pool.query(
    `select pc.id, pc.numero,
            coalesce(jsonb_array_length(pc.itens), 0) as json_count,
            coalesce(jsonb_array_length(pc.dados->'itens'), 0) as json_dados_count,
            (select count(*)::int from public.pedido_compra_item pci where pci.pedido_compra_id = pc.id) as sql_count,
            coalesce((
              select sum(coalesce(pci.total, 0))
              from public.pedido_compra_item pci
              where pci.pedido_compra_id = pc.id
            ), 0) as sql_total,
            coalesce((
              select sum(coalesce(nullif(elem->>'total', '')::numeric, 0))
              from jsonb_array_elements(coalesce(pc.itens, pc.dados->'itens', '[]'::jsonb)) elem
            ), 0) as json_total
     from public.pedido_compra pc
     order by pc.updated_at desc nulls last
     limit $1`,
    [limit],
  );

  const drift = [];
  for (const row of rows) {
    const jsonCount = Math.max(Number(row.json_count) || 0, Number(row.json_dados_count) || 0);
    const sqlCount = Number(row.sql_count) || 0;
    const countDrift = jsonCount !== sqlCount;
    const totalDrift = Math.abs(round2(row.json_total) - round2(row.sql_total)) > 0.02;
    if (countDrift || totalDrift || (jsonCount > 0 && sqlCount === 0) || (sqlCount > 0 && jsonCount === 0)) {
      drift.push({
        tipo: 'pedido_compra',
        id: row.id,
        numero: row.numero,
        json_count: jsonCount,
        sql_count: sqlCount,
        json_total: round2(row.json_total),
        sql_total: round2(row.sql_total),
        countDrift,
        totalDrift,
      });
    }
  }
  return { scanned: rows.length, drift };
}

async function auditEmbarques(pool, limit) {
  const { rows } = await pool.query(
    `select e.id, e.numero, e.pedido_compra_id,
            coalesce(jsonb_array_length(e.itens), 0) as json_count,
            coalesce(jsonb_array_length(e.dados->'itens'), 0) as json_dados_count,
            (select count(*)::int from public.embarque_item ei where ei.embarque_id = e.id) as sql_count
     from public.embarque e
     order by e.updated_at desc nulls last
     limit $1`,
    [limit],
  );

  const drift = [];
  for (const row of rows) {
    const jsonCount = Math.max(Number(row.json_count) || 0, Number(row.json_dados_count) || 0);
    const sqlCount = Number(row.sql_count) || 0;
    if (jsonCount !== sqlCount || (jsonCount > 0 && sqlCount === 0) || (sqlCount > 0 && jsonCount === 0)) {
      drift.push({
        tipo: 'embarque',
        id: row.id,
        numero: row.numero,
        pedido_compra_id: row.pedido_compra_id,
        json_count: jsonCount,
        sql_count: sqlCount,
      });
    }
  }
  return { scanned: rows.length, drift };
}

async function repairPedidosFromSql(pool, pedidoIds, mode) {
  if (!pedidoIds.length) return { repaired: 0 };
  const fn = mode === 'apply' ? 'public.reparar_espelho_pedido_compra_itens' : null;
  if (!fn) {
    console.log('[dry-run] Repararia espelho JSON de', pedidoIds.length, 'pedido(s):', pedidoIds.slice(0, 10).join(', '));
    return { repaired: pedidoIds.length, dryRun: true };
  }
  let repaired = 0;
  for (const id of pedidoIds) {
    const { rows } = await pool.query(`select public.reparar_espelho_pedido_compra_itens($1) as ok`, [id]);
    if (rows?.[0]?.ok) repaired += 1;
  }
  return { repaired };
}

async function main() {
  const { limit, repair } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definido. Ver docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const pedidos = await auditPedidos(pool, limit);
    const embarques = await auditEmbarques(pool, limit);

    console.log('=== Auditoria espelhos canónicos ===');
    console.log(`Pedidos analisados: ${pedidos.scanned} | com drift: ${pedidos.drift.length}`);
    console.log(`Embarques analisados: ${embarques.scanned} | com drift: ${embarques.drift.length}`);

    const sample = [...pedidos.drift.slice(0, 15), ...embarques.drift.slice(0, 10)];
    if (sample.length) {
      console.log('\nAmostra de drift:');
      for (const row of sample) {
        if (row.tipo === 'pedido_compra') {
          console.log(
            `  PC ${row.numero || row.id}: JSON=${row.json_count} SQL=${row.sql_count} ` +
              `totais JSON=${row.json_total} SQL=${row.sql_total}`,
          );
        } else {
          console.log(
            `  EMB ${row.numero || row.id}: JSON=${row.json_count} SQL=${row.sql_count} (pedido ${row.pedido_compra_id})`,
          );
        }
      }
    } else {
      console.log('\nNenhum drift detectado na amostra.');
    }

    if (repair) {
      const pedidoIds = pedidos.drift
        .filter((d) => d.sql_count > 0 && (d.json_count === 0 || d.totalDrift))
        .map((d) => d.id);
      const result = await repairPedidosFromSql(pool, pedidoIds, repair);
      console.log(`\nRepair (${repair}):`, result);
    }

    const exitCode = pedidos.drift.length + embarques.drift.length > 0 ? 2 : 0;
    process.exit(exitCode);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
