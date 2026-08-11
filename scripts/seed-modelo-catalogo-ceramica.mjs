#!/usr/bin/env node
/**
 * Seed piloto cerâmica no laboratório modelo_* (Excel docs/P38-catalogo-skus-completo.xlsx).
 * Apenas prefixo CERAM; exclui ex_b=ZUMBI.
 *
 * Regras por produto compra:
 * - meta_vagas = 12 posições
 * - massa_critica = 16 cx (abaixo disso perde conversão)
 * - saldável se >= 9 linhas com estoque >= massa_critica
 *
 * npm run modelo:seed-ceramica              # dry-run
 * npm run modelo:seed-ceramica -- --apply
 * Piloto: apenas CERAMICA_BOLD e CERAMICA_RETIF (prefixo produto_compra CERAM).
 * Próximo: ESGOTO + SOLDAVEL (mix) — ver MODELO_PILOTO_LINHAS_PLANEADAS.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const EXCEL_CANDIDATES = [
  path.join(process.cwd(), 'docs', 'P38-catalogo-skus-completo.xlsx'),
  path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx'),
];

const PILOTO_LINHA_CODIGOS = ['CERAMICA_BOLD', 'CERAMICA_RETIF'];
const META_VAGAS = 12;
const MASSA_CRITICA = 16;
const MIN_LINHAS_SALDAVEL = 9;

const apply = process.argv.includes('--apply');
const reset = process.argv.includes('--reset');
const CATEGORIA = 'E - PISOS E REVESTIMENTOS';

function resolveExcel() {
  for (const p of EXCEL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Excel não encontrado. Procurado: ${EXCEL_CANDIDATES.join(', ')}`);
}

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
  if (u.includes('RETIF')) {
    return { codigo: 'CERAMICA_RETIF', nome: 'CERÂMICA RETIF', tipo: 'portfolio', ordem: 20 };
  }
  return { codigo: 'CERAMICA_BOLD', nome: 'CERÂMICA BOLD', tipo: 'portfolio', ordem: 10 };
}

async function loadExcelRows(excelPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.getWorksheet('Catálogo SKUs');
  if (!ws) throw new Error('Aba "Catálogo SKUs" não encontrada');
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const pc = cellStr(row.getCell(4));
    const exA = cellStr(row.getCell(5));
    const exB = cellStr(row.getCell(6));
    if (!pc.startsWith('CERAM')) return;
    if (exB.toUpperCase() === 'ZUMBI') return;
    const cod = cellStr(row.getCell(2));
    const desc = cellStr(row.getCell(13));
    const est = cellStr(row.getCell(14));
    rows.push({
      cod,
      pc,
      exA,
      exB,
      desc,
      est: Number(est) || 0,
    });
  });
  return rows;
}

function resumoSaldavel(rows) {
  const byPc = new Map();
  for (const r of rows) {
    if (!byPc.has(r.pc)) byPc.set(r.pc, []);
    byPc.get(r.pc).push(r);
  }
  const resumo = [];
  for (const [pc, arr] of [...byPc.entries()].sort()) {
    const comMassa = arr.filter((x) => x.est >= MASSA_CRITICA).length;
    resumo.push({
      pc,
      skus: arr.length,
      linhas_com_massa: comMassa,
      saldavel: comMassa >= MIN_LINHAS_SALDAVEL,
    });
  }
  return resumo;
}

async function main() {
  const excelPath = resolveExcel();
  const rows = await loadExcelRows(excelPath);
  const linhasMap = new Map();
  const pcMap = new Map();

  for (const r of rows) {
    const linha = inferLinhaFromPc(r.pc);
    linhasMap.set(linha.codigo, linha);
    pcMap.set(`${linha.codigo}::${r.pc}`, { linhaCodigo: linha.codigo, nome: r.pc });
  }

  const saldavelResumo = resumoSaldavel(rows);

  console.log('[seed-ceramica]', {
    excel: excelPath,
    skus: rows.length,
    linhas: linhasMap.size,
    produtos_compra: pcMap.size,
    massa_critica_cx: MASSA_CRITICA,
    meta_vagas: META_VAGAS,
    min_linhas_saldavel: MIN_LINHAS_SALDAVEL,
    apply,
    reset,
  });
  console.log('\nProduto compra → saldável (>=9 linhas com >=16 cx):');
  for (const s of saldavelResumo) {
    console.log(
      `  ${s.saldavel ? '✓' : '○'} ${s.pc}: ${s.skus} pos., ${s.linhas_com_massa} com massa`,
    );
  }

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run modelo:seed-ceramica -- --apply [--reset]');
    return;
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  if (reset) {
    await client.query('delete from modelo_sku');
    await client.query('delete from modelo_eixo_valor');
    await client.query('delete from modelo_produto_compra');
    await client.query('delete from modelo_linha');
    console.log('[seed-ceramica] modelo_* limpo (--reset)');
  } else {
    await client.query(
      `delete from modelo_sku where linha_id in (select id from modelo_linha where codigo <> all($1::text[]))`,
      [PILOTO_LINHA_CODIGOS],
    );
    await client.query(`delete from modelo_linha where codigo <> all($1::text[])`, [PILOTO_LINHA_CODIGOS]);
  }

  const linhaIds = new Map();
  for (const linha of linhasMap.values()) {
    const { rows: ex } = await client.query('select id from modelo_linha where codigo = $1', [linha.codigo]);
    if (ex[0]?.id) {
      await client.query(
        `update modelo_linha set nome=$2, categoria_nome=$3, tipo=$4, ordem=$5,
         meta_vagas=$6, massa_critica=$7, min_linhas_saldavel=$8, updated_at=now() where id=$1`,
        [ex[0].id, linha.nome, CATEGORIA, linha.tipo, linha.ordem, META_VAGAS, MASSA_CRITICA, MIN_LINHAS_SALDAVEL],
      );
      linhaIds.set(linha.codigo, ex[0].id);
      continue;
    }
    const ins = await client.query(
      `insert into modelo_linha (codigo, nome, categoria_nome, tipo, eixo_a_rotulo, eixo_b_rotulo, ordem, meta_vagas, massa_critica, min_linhas_saldavel, ativo)
       values ($1,$2,$3,$4,'Formato','Cor / Modelo',$5,$6,$7,$8,true) returning id`,
      [linha.codigo, linha.nome, CATEGORIA, linha.tipo, linha.ordem, META_VAGAS, MASSA_CRITICA, MIN_LINHAS_SALDAVEL],
    );
    linhaIds.set(linha.codigo, ins.rows[0].id);
  }

  const pcIds = new Map();
  for (const [key, pc] of pcMap.entries()) {
    const linhaId = linhaIds.get(pc.linhaCodigo);
    const cod = slug(pc.nome);
    const { rows: ex } = await client.query(
      'select id from modelo_produto_compra where linha_id = $1 and codigo = $2',
      [linhaId, cod],
    );
    if (ex[0]?.id) {
      await client.query(
        `update modelo_produto_compra set nome=$2, meta_vagas=null, massa_critica=null, min_linhas_saldavel=null, updated_at=now() where id=$1`,
        [ex[0].id, pc.nome],
      );
      pcIds.set(key, ex[0].id);
      continue;
    }
    const ins = await client.query(
      `insert into modelo_produto_compra (linha_id, codigo, nome, meta_vagas, massa_critica, min_linhas_saldavel, eixo_a_rotulo, eixo_b_rotulo, ativo)
       values ($1,$2,$3,null,null,null,null,null,true) returning id`,
      [linhaId, cod, pc.nome],
    );
    pcIds.set(key, ins.rows[0].id);
  }

  const prodByCod = new Map();
  const { rows: prods } = await client.query(
    'select id, codigo_interno from produto where codigo_interno is not null and ativo = true',
  );
  for (const p of prods) prodByCod.set(p.codigo_interno, p.id);

  let inserted = 0;
  let updated = 0;

  for (const r of rows) {
    const linha = inferLinhaFromPc(r.pc);
    const linhaId = linhaIds.get(linha.codigo);
    const pcId = pcIds.get(`${linha.codigo}::${r.pc}`);
    const nome = [r.pc, r.exA, r.exB].filter(Boolean).join(' ').trim() || r.desc;
    const espelhoId = r.cod ? prodByCod.get(r.cod) || null : null;
    const atingeMassa = r.est >= MASSA_CRITICA;
    const dados = JSON.stringify({ atinge_massa_critica: atingeMassa, estoque_cx_ref: r.est });

    const { rows: dup } = await client.query(
      `select id from modelo_sku where linha_id = $1 and produto_compra_id = $2
       and coalesce(eixo_a_texto,'') = $3 and coalesce(eixo_b_texto,'') = $4 limit 1`,
      [linhaId, pcId, r.exA, r.exB],
    );
    if (dup[0]?.id) {
      await client.query(
        `update modelo_sku set nome=$2, estoque_simulado=$3, espelho_produto_id=$4, espelho_codigo_interno=$5, dados=$6::jsonb, updated_at=now() where id=$1`,
        [dup[0].id, nome, r.est, espelhoId, r.cod || null, dados],
      );
      updated += 1;
      continue;
    }

    await client.query(
      `insert into modelo_sku (
        linha_id, produto_compra_id, eixo_a_texto, eixo_b_texto, nome, codigo_interno,
        estoque_simulado, espelho_produto_id, espelho_codigo_interno, dados, ativo
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,true)`,
      [linhaId, pcId, r.exA, r.exB, nome, r.cod ? `M-${r.cod}` : null, r.est, espelhoId, r.cod || null, dados],
    );
    inserted += 1;
  }

  console.log('[seed-ceramica] Concluído:', { inserted, updated, linhas: linhaIds.size, pc: pcIds.size });
  await client.end();
}

main().catch((e) => {
  console.error('[seed-ceramica] ERRO:', e.message);
  process.exit(1);
});
