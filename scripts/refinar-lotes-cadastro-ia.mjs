#!/usr/bin/env node
/**
 * Refina cadastro com regras IA (negócio P38), aplica no Supabase e gera antes/depois.
 *
 * Uso:
 *   npm run produto:cadastro:refinar-ia -- --lotes=1,2,3,4
 *   npm run produto:cadastro:refinar-ia -- --lotes=1,2,3,4 --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import {
  refinarHierarquiaProduto,
  formatHierarchyLine,
} from '../src/lib/refinarHierarquiaProduto.js';

loadDotEnvFiles();

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

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function parseArgs(argv) {
  const lotesRaw = argv.find((a) => a.startsWith('--lotes='))?.slice(8) || '1,2,3,4';
  const lotes = lotesRaw.split(',').map((n) => Number(n.trim())).filter((n) => n >= 1);
  const apply = argv.includes('--apply');
  const outDir = argv.find((a) => a.startsWith('--out-dir='))?.slice(10) || 'docs/tmp';
  return { lotes, apply, outDir };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allRows = [];

  for (const n of args.lotes) {
    const file = path.resolve(`docs/tmp/cadastro-hierarquia-lote-${String(n).padStart(2, '0')}.csv`);
    if (!fs.existsSync(file)) {
      console.error(`Ficheiro não encontrado: ${file}`);
      process.exit(1);
    }
    const parsed = parseCsv(fs.readFileSync(file, 'utf8'));
    for (const row of parsed) {
      allRows.push({ ...row, _lote: n });
    }
  }

  const refinados = allRows.map((row) => {
    const r = refinarHierarquiaProduto({
      nome: row.nome,
      marca: row.marca,
      h1_antes: row.h1_atual,
      h2_antes: row.h2_atual,
      h3_antes: row.h3_atual,
      h4_antes: row.h4_atual,
      h5_antes: row.h5_atual,
    });
    return {
      id: row.id,
      codigo_interno: row.codigo_interno,
      nome: row.nome,
      lote: row._lote,
      capital_reais: row.capital_reais,
      segmento: row.segmento,
      antes_line: formatHierarchyLine(r.antes.h1, r.antes.h2, r.antes.h3, r.antes.h4, r.antes.h5),
      depois_line: formatHierarchyLine(r.depois.h1, r.depois.h2, r.depois.h3, r.depois.h4, r.depois.h5),
      ...r,
    };
  });

  const mudaram = refinados.filter((r) => r.mudou);
  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const csvPath = path.join(outDir, 'cadastro-antes-depois-lotes-1-4.csv');
  const header = [
    'codigo', 'nome', 'lote', 'segmento', 'capital_reais',
    'antes_h1', 'antes_h2', 'antes_h3', 'antes_h4', 'antes_h5', 'antes_resumo',
    'depois_h1', 'depois_h2', 'depois_h3', 'depois_h4', 'depois_h5', 'depois_resumo',
    'mudou', 'motivo', 'id',
  ];
  const lines = [header.join(';')];
  for (const r of refinados) {
    lines.push([
      r.codigo_interno, r.nome, r.lote, r.segmento, r.capital_reais,
      r.antes.h1, r.antes.h2, r.antes.h3, r.antes.h4, r.antes.h5, r.antes_line,
      r.depois.h1, r.depois.h2, r.depois.h3, r.depois.h4, r.depois.h5, r.depois_line,
      r.mudou ? 'SIM' : 'NAO', r.motivo, r.id,
    ].map(csvEscape).join(';'));
  }
  fs.writeFileSync(csvPath, `\uFEFF${lines.join('\n')}`, 'utf8');

  const mdPath = path.join(outDir, 'cadastro-antes-depois-lotes-1-4.md');
  const md = [];
  md.push('# Cadastro produtos — antes e depois (lotes 1–4)');
  md.push('');
  md.push(`Gerado em: ${new Date().toISOString()}`);
  md.push(`Total: **${refinados.length}** produtos | Alterados: **${mudaram.length}**`);
  md.push('');
  md.push('## Resumo');
  md.push('');
  md.push('| Métrica | Valor |');
  md.push('|---------|-------|');
  md.push(`| Produtos processados | ${refinados.length} |`);
  md.push(`| Com mudança na hierarquia | ${mudaram.length} |`);
  md.push(`| Sem mudança | ${refinados.length - mudaram.length} |`);
  md.push(`| Capital no lote (R$) | ${refinados.reduce((s, r) => s + (Number(r.capital_reais) || 0), 0).toFixed(2)} |`);
  md.push('');
  md.push('## Lista completa (como estava → como ficou)');
  md.push('');
  md.push('| Código | Nome | Antes | Depois | Motivo |');
  md.push('|--------|------|-------|--------|--------|');
  for (const r of refinados) {
    const nome = String(r.nome || '').slice(0, 40).replace(/\|/g, '/');
    md.push(`| ${r.codigo_interno} | ${nome} | ${r.antes_line} | ${r.depois_line} | ${r.motivo} |`);
  }
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

  console.log(JSON.stringify({
    total: refinados.length,
    mudaram: mudaram.length,
    csv: csvPath,
    markdown: mdPath,
    apply: args.apply,
  }, null, 2));

  if (!args.apply) {
    console.log('\nDry-run. Use --apply para gravar no Supabase.');
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definido');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let ok = 0;
  for (const r of refinados) {
    const d = r.depois;
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
      [r.id, d.h1, d.h2, d.h3, d.h4, d.h5, d.nome],
    );
    ok += 1;
    if (ok % 50 === 0 || ok === refinados.length) {
      console.log(`[refinar-ia] ${ok}/${refinados.length}`);
    }
  }
  await pool.end();
  console.log(`\nAplicados no Supabase: ${ok} produto(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
