#!/usr/bin/env node
/**
 * Restaura os 295 SKUs afectados pelo lote IA cadastro (lotes 1-4).
 * Repõe nome + h1–h5 conforme CSV antes/depois (commit da8b1bbb).
 *
 * Uso:
 *   git show da8b1bbb:docs/tmp/cadastro-antes-depois-lotes-1-4.csv > /tmp/cadastro-antes-depois.csv
 *   DATABASE_URL=... node scripts/restaurar-lote-ia-cadastro-once.mjs /tmp/cadastro-antes-depois.csv
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import pg from 'pg';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ';' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function readCsv(path) {
  const raw = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row;
  });
}

function resolveCsvPath(argPath) {
  if (argPath && fs.existsSync(argPath)) return argPath;
  const fallback = '/tmp/cadastro-antes-depois.csv';
  if (fs.existsSync(fallback)) return fallback;
  try {
    const content = execSync(
      'git show da8b1bbb:docs/tmp/cadastro-antes-depois-lotes-1-4.csv',
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    );
    fs.writeFileSync(fallback, content);
    return fallback;
  } catch {
    throw new Error('CSV não encontrado — passe o caminho ou garanta git show da8b1bbb');
  }
}

function pickNomeOriginal(row) {
  return String(row.antes_resumo || row.nome || row.antes_h1 || '').trim();
}

async function main() {
  const csvPath = resolveCsvPath(process.argv[2]);
  const rows = readCsv(csvPath).filter((r) => String(r.mudou || '').toUpperCase() === 'SIM');
  if (!rows.length) {
    console.error('Nenhuma linha mudou=SIM no CSV');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL em falta');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let ok = 0;
  let skip = 0;
  const falhas = [];

  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const codigo = String(row.codigo || '').trim();
      const nome = pickNomeOriginal(row);
      if (!codigo || !nome) {
        skip += 1;
        falhas.push({ codigo, erro: 'codigo ou nome original vazio' });
        continue;
      }

      const h1 = String(row.antes_h1 ?? '').trim() || null;
      const h2 = String(row.antes_h2 ?? '').trim() || null;
      const h3 = String(row.antes_h3 ?? '').trim() || null;
      const h4 = String(row.antes_h4 ?? '').trim() || null;
      const h5 = String(row.antes_h5 ?? '').trim() || null;

      const { rowCount } = await client.query(
        `update produto
         set nome = $1,
             campo_hierarquico_1 = $2,
             campo_hierarquico_2 = $3,
             campo_hierarquico_3 = $4,
             campo_hierarquico_4 = $5,
             campo_hierarquico_5 = $6,
             updated_at = now()
         where upper(trim(codigo_interno)) = upper(trim($7))`,
        [nome, h1, h2, h3, h4, h5, codigo],
      );

      if (rowCount === 1) {
        ok += 1;
      } else {
        falhas.push({ codigo, erro: `update ${rowCount} linha(s)` });
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }

  console.log(`[restaurar-lote-ia] CSV: ${csvPath}`);
  console.log(`[restaurar-lote-ia] Restaurados: ${ok}/${rows.length} (skip ${skip})`);
  if (falhas.length) {
    console.warn('Falhas:', falhas.slice(0, 20));
    if (falhas.length > 20) console.warn(`... +${falhas.length - 20} mais`);
  }
  if (ok !== rows.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
