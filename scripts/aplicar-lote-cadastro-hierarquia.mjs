#!/usr/bin/env node
/**
 * Aplica correções de hierarquia a partir de CSV revisado (colunas sugestao_h* ou h*_final).
 *
 * Por defeito grava no Supabase. Base44 só com --base44 (legado).
 *
 * Uso:
 *   npm run produto:cadastro:aplicar-lote -- --file=docs/tmp/cadastro-hierarquia-lote-01.csv
 *   npm run produto:cadastro:aplicar-lote -- --file=... --apply
 *   npm run produto:cadastro:aplicar-lote -- --file=... --apply --base44
 */
import fs from 'node:fs';
import pg from 'pg';
import { loadDotEnvFiles, requireBase44Client } from './base44-env.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const file = argv.find((a) => a.startsWith('--file='))?.slice(7);
  const apply = argv.includes('--apply');
  const base44 = argv.includes('--base44');
  if (!file) {
    console.error('Uso: --file=caminho.csv [--apply] [--base44]');
    process.exit(1);
  }
  return { file, apply, base44 };
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(';').map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let j = 0; j < lines[i].length; j += 1) {
      const ch = lines[i][j];
      if (ch === '"') {
        if (inQ && lines[i][j + 1] === '"') { cur += '"'; j += 1; }
        else inQ = !inQ;
      } else if (ch === ';' && !inQ) {
        cols.push(cur); cur = '';
      } else cur += ch;
    }
    cols.push(cur);
    const row = {};
    header.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function pick(row, keys) {
  for (const k of keys) {
    const v = String(row[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { file, apply } = args;
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));

  const updates = [];
  for (const row of rows) {
    const aplicar = upper(row.aplicar);
    if (aplicar === 'NAO' || aplicar === 'N' || aplicar === '0') continue;

    const id = pick(row, ['id']);
    if (!id) continue;

    const h1 = pick(row, ['h1_final', 'sugestao_h1']);
    const h2 = pick(row, ['h2_final', 'sugestao_h2']);
    if (!h1 || !h2) continue;

    updates.push({
      id,
      codigo: row.codigo_interno,
      nome: row.nome,
      h1,
      h2,
      h3: pick(row, ['h3_final', 'sugestao_h3']),
      h4: pick(row, ['h4_final', 'sugestao_h4']),
      h5: pick(row, ['h5_final', 'sugestao_h5']),
    });
  }

  console.log(JSON.stringify({
    file,
    apply,
    linhas_csv: rows.length,
    updates_preparados: updates.length,
    amostra: updates.slice(0, 5),
  }, null, 2));

  if (!apply) {
    console.log('\nDry-run. Reveja o CSV e use --apply para gravar no Supabase.');
    return;
  }

  let ok = 0;
  if (args.base44) {
    const base44Client = requireBase44Client();
    for (const u of updates) {
      const nome = [u.h1, u.h2, u.h3, u.h4, u.h5].filter(Boolean).join(' ').trim();
      await base44Client.entities.Produto.update(u.id, {
        campo_hierarquico_1: u.h1,
        campo_hierarquico_2: u.h2,
        campo_hierarquico_3: u.h3 || '',
        campo_hierarquico_4: u.h4 || '',
        campo_hierarquico_5: u.h5 || '',
        nome: nome || u.nome,
      });
      ok += 1;
      if (ok % 25 === 0 || ok === updates.length) {
        console.log(`[produto:cadastro:aplicar-lote] ${ok}/${updates.length}`);
      }
    }
  } else {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL não definido');
      process.exit(1);
    }
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    for (const u of updates) {
      const nome = [u.h1, u.h2, u.h3, u.h4, u.h5].filter(Boolean).join(' ').trim();
      await pool.query(
        `update public.produto set
           campo_hierarquico_1 = $2,
           campo_hierarquico_2 = $3,
           campo_hierarquico_3 = nullif($4, ''),
           campo_hierarquico_4 = nullif($5, ''),
           campo_hierarquico_5 = nullif($6, ''),
           nome = $7,
           updated_at = now()
         where id = $1`,
        [u.id, u.h1, u.h2, u.h3, u.h4, u.h5, nome || u.nome],
      );
      ok += 1;
      if (ok % 25 === 0 || ok === updates.length) {
        console.log(`[produto:cadastro:aplicar-lote] ${ok}/${updates.length}`);
      }
    }
    await pool.end();
  }

  console.log(`\nAplicados: ${ok} produto(s).`);
}

function upper(s) {
  return String(s || '').trim().toUpperCase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
