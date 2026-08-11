#!/usr/bin/env node
/**
 * Seed piloto cerâmica no laboratório modelo_* (a partir do Excel mestre).
 * Não altera produto de produção — opcionalmente liga espelho por codigo_interno.
 *
 * npm run modelo:seed-ceramica              # dry-run
 * npm run modelo:seed-ceramica -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const EXCEL = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');
const apply = process.argv.includes('--apply');
const CATEGORIA = 'E - PISOS E REVESTIMENTOS';

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function slug(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'ITEM';
}

function inferLinhaFromPc(pc) {
  const u = pc.toUpperCase();
  if (u.includes('RETIF')) return { codigo: 'CERAMICA_RETIF', nome: 'CERÂMICA RETIF', tipo: 'portfolio', ordem: 20 };
  if (u.includes('BOLD') || u.includes('CERAM')) return { codigo: 'CERAMICA_BOLD', nome: 'CERÂMICA BOLD', tipo: 'linha_mix', ordem: 10 };
  return { codigo: 'CERAMICA_OUTROS', nome: 'CERÂMICA OUTROS', tipo: 'linha_mix', ordem: 30 };
}

async function loadExcelRows() {
  if (!fs.existsSync(EXCEL)) throw new Error(`Excel não encontrado: ${EXCEL}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL);
  const ws = wb.getWorksheet('Catálogo SKUs');
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cat = cellStr(row.getCell(1));
    const cod = cellStr(row.getCell(2));
    const pc = cellStr(row.getCell(4));
    const exA = cellStr(row.getCell(5));
    const exB = cellStr(row.getCell(6));
    const desc = cellStr(row.getCell(13));
    const est = cellStr(row.getCell(14));
    if (!cat.includes('PISOS') && !cat.includes('REVEST')) return;
    if (!pc || exB.toUpperCase() === 'ZUMBI') return;
    rows.push({ cat, cod, pc, exA, exB, desc, est: Number(est) || 0 });
  });
  return rows;
}

async function main() {
  const rows = await loadExcelRows();
  const linhasMap = new Map();
  const pcMap = new Map();

  for (const r of rows) {
    const linha = inferLinhaFromPc(r.pc);
    linhasMap.set(linha.codigo, linha);
    pcMap.set(`${linha.codigo}::${r.pc}`, { linhaCodigo: linha.codigo, nome: r.pc });
  }

  console.log('[seed-ceramica]', {
    skus: rows.length,
    linhas: linhasMap.size,
    produtos_compra: pcMap.size,
    apply,
  });

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run modelo:seed-ceramica -- --apply');
    return;
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const linhaIds = new Map();
  for (const linha of linhasMap.values()) {
    const { rows: ex } = await client.query(
      `select id from modelo_linha where codigo = $1`,
      [linha.codigo],
    );
    if (ex[0]?.id) {
      linhaIds.set(linha.codigo, ex[0].id);
      continue;
    }
    const ins = await client.query(
      `insert into modelo_linha (codigo, nome, categoria_nome, tipo, eixo_a_rotulo, eixo_b_rotulo, ordem, ativo)
       values ($1,$2,$3,$4,'Formato','Cor / Modelo',$5,true) returning id`,
      [linha.codigo, linha.nome, CATEGORIA, linha.tipo, linha.ordem],
    );
    linhaIds.set(linha.codigo, ins.rows[0].id);
  }

  const pcIds = new Map();
  for (const [key, pc] of pcMap.entries()) {
    const linhaId = linhaIds.get(pc.linhaCodigo);
    const { rows: ex } = await client.query(
      `select id from modelo_produto_compra where linha_id = $1 and codigo = $2`,
      [linhaId, slug(pc.nome)],
    );
    if (ex[0]?.id) {
      pcIds.set(key, ex[0].id);
      continue;
    }
    const isPortfolio = linhasMap.get(pc.linhaCodigo)?.tipo === 'portfolio';
    const ins = await client.query(
      `insert into modelo_produto_compra (linha_id, codigo, nome, meta_vagas, massa_critica, eixo_a_rotulo, eixo_b_rotulo, ativo)
       values ($1,$2,$3,$4,$5,'Formato','Cor / Modelo',true) returning id`,
      [linhaId, slug(pc.nome), pc.nome, isPortfolio ? 24 : null, isPortfolio ? 3 : null],
    );
    pcIds.set(key, ins.rows[0].id);
  }

  const prodByCod = new Map();
  const { rows: prods } = await client.query(
    `select id, codigo_interno from produto where codigo_interno is not null and ativo = true`,
  );
  for (const p of prods) prodByCod.set(p.codigo_interno, p.id);

  let inserted = 0;
  let skipped = 0;

  for (const r of rows) {
    const linha = inferLinhaFromPc(r.pc);
    const linhaId = linhaIds.get(linha.codigo);
    const pcId = pcIds.get(`${linha.codigo}::${r.pc}`);
    const nome = [r.pc, r.exA, r.exB].filter(Boolean).join(' ').trim() || r.desc;
    const espelhoId = r.cod ? prodByCod.get(r.cod) || null : null;

    const { rows: dup } = await client.query(
      `select id from modelo_sku where linha_id = $1 and produto_compra_id = $2
       and coalesce(eixo_a_texto,'') = $3 and coalesce(eixo_b_texto,'') = $4 limit 1`,
      [linhaId, pcId, r.exA, r.exB],
    );
    if (dup[0]?.id) {
      skipped += 1;
      continue;
    }

    await client.query(
      `insert into modelo_sku (
        linha_id, produto_compra_id, eixo_a_texto, eixo_b_texto, nome, codigo_interno,
        estoque_simulado, espelho_produto_id, espelho_codigo_interno, ativo
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
      [linhaId, pcId, r.exA, r.exB, nome, r.cod ? `M-${r.cod}` : null, r.est, espelhoId, r.cod || null],
    );
    inserted += 1;
  }

  console.log('[seed-ceramica] Concluído:', { inserted, skipped, linhas: linhaIds.size, pc: pcIds.size });
  await client.end();
}

main().catch((e) => {
  console.error('[seed-ceramica] ERRO:', e.message);
  process.exit(1);
});
