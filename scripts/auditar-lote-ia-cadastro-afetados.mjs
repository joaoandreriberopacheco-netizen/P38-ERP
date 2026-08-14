#!/usr/bin/env node
/**
 * Audita produtos afectados pelo lote IA cadastro (lotes 1-4).
 * Compara CSV antes/depois (da8b1bbb) com estado actual na base.
 */
import fs from 'node:fs';
import pg from 'pg';

const CSV_PATH = process.argv[2] || '/tmp/cadastro-antes-depois.csv';

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

function norm(s) {
  return String(s || '').trim().toUpperCase();
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

/** Nome esperado se o lote IA tiver colapsado só h1+h2 (padrão comum). */
function nomeColapsadoEsperado(row) {
  const h1 = String(row.depois_h1 || '').trim();
  const h2 = String(row.depois_h2 || '').trim();
  if (!h1) return '';
  if (h2) {
    // THINNER 5L vs THINNER + 900 ML — variantes de espaço
    return `${h1} ${h2}`.replace(/\s+/g, ' ').trim();
  }
  return h1;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV não encontrado:', CSV_PATH);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL em falta');
    process.exit(1);
  }

  const rows = readCsv(CSV_PATH);
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const codigos = rows.map((r) => r.codigo).filter(Boolean);
  const { rows: dbRows } = await client.query(
    `select id, codigo_interno, nome,
            campo_hierarquico_1 as h1,
            campo_hierarquico_2 as h2,
            campo_hierarquico_3 as h3,
            ativo
     from produto
     where upper(trim(codigo_interno)) = any($1::text[])`,
    [codigos.map((c) => c.toUpperCase())],
  );
  await client.end();

  const dbByCodigo = new Map(
    dbRows.map((r) => [norm(r.codigo_interno), r]),
  );

  const mudou = rows.filter((r) => norm(r.mudou) === 'SIM');
  const aindaColapsado = [];
  const restauradoOuOk = [];
  const naoEncontrado = [];
  const mudouMasNomeOk = [];

  for (const r of mudou) {
    const db = dbByCodigo.get(norm(r.codigo));
    if (!db) {
      naoEncontrado.push(r);
      continue;
    }
    const nomeAntes = String(r.nome || r['nome'] || '').trim();
    // coluna "nome" no CSV é o nome no momento do export; usar campo antes via linha - actually CSV has "nome" as current at export time which was AFTER change. Look at columns:
    // codigo;nome;lote;...;antes_h1;...;depois_h1;...;mudou
    // The "nome" column in CSV - from the thinner example: "I2H-1R0";"THINNER ANJO 2750 900ML" - wait that's the name BEFORE in the first nome column?
    // Looking at grep output: "I2H-1R0";"THINNER ANJO 2750 900ML";...;"THINNER ANJO 2750 900ML";"";...;"THINNER";"900ML"
    // So column "nome" = name at time of report, and antes_h1 empty means antes was full name in nome field before processing?
    // Actually antes_resumo = "THINNER ANJO 2750 900ML" and antes_h1 empty - the original name WAS in nome field
    // depois changed h1/h2

    const nomeOriginal = String(r.antes_resumo || '').trim() || String(r.nome || '').trim();
    const nomeAtualDb = String(db.nome || '').trim();
    const colapsado = nomeColapsadoEsperado(r);

    const isCollapsedNow =
      norm(nomeAtualDb) === norm(colapsado)
      || (norm(nomeOriginal) !== norm(nomeAtualDb) && norm(nomeAtualDb).length < norm(nomeOriginal).length * 0.85);

    if (norm(nomeAtualDb) === norm(nomeOriginal)) {
      restauradoOuOk.push({ ...r, db: db, nomeOriginal, nomeAtualDb, status: 'ok_ou_restaurado' });
    } else if (isCollapsedNow) {
      aindaColapsado.push({
        codigo: r.codigo,
        lote: r.lote,
        motivo: r.motivo,
        nomeOriginal,
        nomeAtualDb,
        colapsadoEsperado: colapsado,
        depois_resumo: r.depois_resumo,
        h1: db.h1,
        h2: db.h2,
        ativo: db.ativo,
      });
    } else {
      mudouMasNomeOk.push({
        codigo: r.codigo,
        nomeOriginal,
        nomeAtualDb,
        motivo: r.motivo,
        lote: r.lote,
      });
    }
  }

  // agrupar colapsados por motivo
  const porMotivo = new Map();
  for (const x of aindaColapsado) {
    const m = x.motivo || '(sem motivo)';
    if (!porMotivo.has(m)) porMotivo.set(m, []);
    porMotivo.get(m).push(x);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  AUDIT — Lote IA cadastro (lotes 1-4)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Total no CSV:        ${rows.length}`);
  console.log(`Alterados (mudou=SIM): ${mudou.length}`);
  console.log(`Ainda colapsados:    ${aindaColapsado.length}`);
  console.log(`Nome OK/restaurado:  ${restauradoOuOk.length}`);
  console.log(`Outro nome actual:   ${mudouMasNomeOk.length}`);
  console.log(`Não encontrados:     ${naoEncontrado.length}`);
  console.log('');

  if (aindaColapsado.length) {
    console.log('── AINDA COLAPSADOS (prioridade restauração) ──\n');
    for (const [motivo, lista] of [...porMotivo.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`### ${motivo} (${lista.length})`);
      for (const x of lista.sort((a, b) => a.codigo.localeCompare(b.codigo))) {
        console.log(`  ${x.codigo} | era: ${x.nomeOriginal}`);
        console.log(`           | hoje: ${x.nomeAtualDb}`);
      }
      console.log('');
    }
  }

  const outPath = '/workspace/docs/exports/P38-lote-IA-cadastro-afetados.csv';
  const hdr = 'codigo;lote;motivo;nome_original;nome_actual_db;status;ativo';
  const lines = [hdr];
  for (const x of aindaColapsado) {
    lines.push([x.codigo, x.lote, x.motivo, x.nomeOriginal, x.nomeAtualDb, 'colapsado', x.ativo].join(';'));
  }
  for (const x of restauradoOuOk) {
    lines.push([x.codigo, x.lote, x.motivo, x.nomeOriginal, x.nomeAtualDb, 'ok', x.db?.ativo].join(';'));
  }
  for (const x of mudouMasNomeOk) {
    lines.push([x.codigo, x.lote, x.motivo, x.nomeOriginal, x.nomeAtualDb, 'nome_diferente', ''].join(';'));
  }
  fs.mkdirSync('/workspace/docs/exports', { recursive: true });
  fs.writeFileSync(outPath, `\ufeff${lines.join('\n')}\n`);
  console.log(`Relatório CSV: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
