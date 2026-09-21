#!/usr/bin/env node
/**
 * Mescla ROLO DE LÃ 23 CM (anti-respingo + sintética) num único cadastro.
 *
 *   node scripts/merge-rolo-la-23cm.mjs           # dry-run
 *   node scripts/merge-rolo-la-23cm.mjs --apply   # core + Supabase
 *
 * Regra de preço: fica o produto com preco_venda_padrao (ou valor_compra) > 0;
 * empate → 043-5GC (anti-respingo).
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const SURVIVOR_DEFAULT = '043-5GC';
const LOSER_DEFAULT = 'FD0-O28';
const CORE_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');

function priceScore(row) {
  const venda = Number(row.preco_venda_padrao) || 0;
  const compra = Number(row.valor_compra) || 0;
  const custo = Number(row.preco_custo_calculado) || 0;
  return Math.max(venda, compra, custo);
}

function pickWinner(a, b) {
  const sa = priceScore(a);
  const sb = priceScore(b);
  if (sa > sb) return { winner: a, loser: b, reason: `preço ${sa} > ${sb}` };
  if (sb > sa) return { winner: b, loser: a, reason: `preço ${sb} > ${sa}` };
  if (a.codigo_interno === SURVIVOR_DEFAULT) {
    return { winner: a, loser: b, reason: 'empate — preferência 043-5GC' };
  }
  return { winner: b, loser: a, reason: 'empate — preferência FD0-O28' };
}

async function patchCoreExcel(winnerCodigo) {
  if (!fs.existsSync(CORE_PATH)) throw new Error(`Core em falta: ${CORE_PATH}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  if (!ws) throw new Error('Aba Catálogo não encontrada');

  let survivorUpdated = false;
  let loserArchived = false;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = String(row.getCell(1).value ?? '').trim().toUpperCase();
    if (codigo === winnerCodigo.toUpperCase()) {
      row.getCell(5).value = 'ROLO DE LÃ';
      row.getCell(6).value = '23 CM';
      row.getCell(7).value = '';
      row.getCell(8).value = 'ROLO DE LÃ 23 CM';
      survivorUpdated = true;
    }
    if (codigo === LOSER_DEFAULT) {
      row.getCell(3).value = 'CATALOGO_ESPACO';
      row.getCell(8).value = `→ mesclado em ${winnerCodigo}`;
      loserArchived = true;
    }
  });

  if (!survivorUpdated) throw new Error(`Survivor ${winnerCodigo} não encontrado no core`);
  if (!loserArchived) throw new Error(`Loser ${LOSER_DEFAULT} não encontrado no core`);

  if (APPLY) {
    await wb.xlsx.writeFile(CORE_PATH);
  }

  return { survivorUpdated, loserArchived };
}

async function mergeSupabase(winner, loser) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[merge] DATABASE_URL em falta — salta Supabase');
    return null;
  }

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (err) {
    console.warn(`[merge] Supabase indisponível (${err.message}) — só core Excel`);
    return null;
  }

  try {
    const bestPrice = Math.max(priceScore(winner), priceScore(loser));
    const bestCompra = Math.max(Number(winner.valor_compra) || 0, Number(loser.valor_compra) || 0);
    const bestCusto = Math.max(Number(winner.preco_custo_calculado) || 0, Number(loser.preco_custo_calculado) || 0);
    const estoque = (Number(winner.estoque_atual) || 0) + (Number(loser.estoque_atual) || 0);

    await client.query('BEGIN');

    await client.query(
      `UPDATE produto SET
        nome = $2,
        preco_venda_padrao = CASE WHEN $3 > 0 THEN $3 ELSE preco_venda_padrao END,
        valor_compra = CASE WHEN $4 > 0 THEN $4 ELSE valor_compra END,
        preco_custo_calculado = CASE WHEN $5 > 0 THEN $5 ELSE preco_custo_calculado END,
        estoque_atual = $6,
        ativo = true,
        updated_at = now()
      WHERE id = $1`,
      [winner.id, 'ROLO DE LÃ 23 CM', bestPrice, bestCompra, bestCusto, estoque],
    );

    await client.query(
      `UPDATE produto SET
        ativo = false,
        observacoes = COALESCE(observacoes, '') || $2,
        updated_at = now()
      WHERE id = $1`,
      [loser.id, `\n[${new Date().toISOString().slice(0, 10)}] Mesclado em ${winner.codigo_interno} (ROLO DE LÃ 23 CM).`],
    );

    if (APPLY) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    return { winner: winner.codigo_interno, loser: loser.codigo_interno, bestPrice, estoque };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const { rows } = process.env.DATABASE_URL
    ? await (async () => {
        const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
        try {
          await client.connect();
          const res = await client.query(
            `SELECT id, codigo_interno, nome, ativo,
              coalesce(preco_venda_padrao,0) as preco_venda_padrao,
              coalesce(valor_compra,0) as valor_compra,
              coalesce(preco_custo_calculado,0) as preco_custo_calculado,
              coalesce(estoque_atual,0) as estoque_atual
            FROM produto
            WHERE codigo_interno IN ($1, $2)`,
            [SURVIVOR_DEFAULT, LOSER_DEFAULT],
          );
          await client.end();
          return res;
        } catch {
          await client.end().catch(() => {});
          return { rows: [] };
        }
      })()
    : { rows: [] };

  let winnerCodigo = SURVIVOR_DEFAULT;
  let winner = rows.find((r) => r.codigo_interno === SURVIVOR_DEFAULT);
  let loser = rows.find((r) => r.codigo_interno === LOSER_DEFAULT);

  if (winner && loser) {
    const picked = pickWinner(winner, loser);
    winner = picked.winner;
    loser = picked.loser;
    winnerCodigo = winner.codigo_interno;
    console.log(`[merge] Vencedor: ${winner.codigo_interno} (${picked.reason})`);
    console.log(`[merge] Arquivar: ${loser.codigo_interno}`);
    console.log(`[merge] Preços — vencedor: ${priceScore(winner)} · perdedor: ${priceScore(loser)}`);
  } else {
    console.log(`[merge] Supabase indisponível ou SKUs em falta — core usa ${winnerCodigo} como canónico`);
  }

  const core = await patchCoreExcel(winnerCodigo);
  console.log('[merge] Core Excel:', core, APPLY ? '(gravado)' : '(dry-run)');

  if (winner && loser) {
    const db = await mergeSupabase(winner, loser);
    if (db) console.log('[merge] Supabase:', db, APPLY ? '(commit)' : '(rollback dry-run)');
  }

  if (!APPLY) {
    console.log('\nPara aplicar: node scripts/merge-rolo-la-23cm.mjs --apply');
    console.log('Depois: npm run export:catalogo-4x3 && npm run export:pdf-catalogo-4x3');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
