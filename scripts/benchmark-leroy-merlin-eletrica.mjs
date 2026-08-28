#!/usr/bin/env node
/**
 * Benchmark elétrica P38 vs mix básico Leroy Merlin — hidratar o que já temos.
 *
 * Lê docs/exports/P38-sku-hierarquia-ab.xlsx (folha B — Elétrica) e compara
 * com src/data/leroyMerlinMixEletricaBasico.json.
 *
 *   npm run benchmark:leroy-eletrica
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const DEFAULT_IN = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');
const DEFAULT_MIX = path.join(process.cwd(), 'src', 'data', 'leroyMerlinMixEletricaBasico.json');
const DEFAULT_OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-eletrica-benchmark-lm.xlsx');

function parseArgs(argv) {
  const get = (p) => argv.find((a) => a.startsWith(p))?.slice(p.length);
  return {
    inPath: get('--in=') ?? DEFAULT_IN,
    mixPath: get('--mix=') ?? DEFAULT_MIX,
    outPath: get('--out=') ?? DEFAULT_OUT,
  };
}

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function styleHeader(row, color = 'FF4A5240') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

async function loadBEletrica(inPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inPath);
  const ws = wb.getWorksheet('B — Elétrica');
  if (!ws) throw new Error('Folha "B — Elétrica" em falta — corra npm run export:sku-hierarquia-ab');
  const headers = ws.getRow(1).values.slice(1);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k) => String(row.getCell(idx[k])?.value ?? '').trim();
    rows.push({
      sub_bloco: get('sub_bloco'),
      produto_compra: get('produto_compra'),
      eixo_a: get('eixo_a'),
      eixo_b: get('eixo_b'),
      codigo_interno: get('codigo_interno'),
      sku_atual: get('sku_atual'),
    });
  }
  return rows;
}

function parseDisjuntor(row) {
  if (norm(row.produto_compra) !== 'DISJUNTOR') return null;
  const blob = norm(`${row.eixo_a} ${row.eixo_b} ${row.sku_atual}`);
  let tipo = '';
  if (/MONOF/.test(blob)) tipo = 'MONOFÁSICO';
  else if (/BIF/.test(blob)) tipo = 'BIFÁSICO';
  else if (/TRIF/.test(blob)) tipo = 'TRIFÁSICO';
  const amp = blob.match(/(\d+)\s*A\b/);
  return tipo && amp ? { tipo, amperagem: `${amp[1]}A` } : null;
}

function matchFio(row, eixoMatch) {
  const blob = norm(`${row.eixo_a} ${row.eixo_b} ${row.sku_atual}`).replace(/\s/g, '');
  const key = norm(eixoMatch).replace(/\s/g, '');
  return blob.includes(key);
}

function matchCaixinha(row, eixoMatch) {
  const blob = norm(`${row.eixo_a} ${row.sku_atual}`);
  return blob.includes(norm(eixoMatch));
}

function findP38Match(p38Rows, matcher) {
  return p38Rows.filter(matcher);
}

function buildDisjuntorMatrix(p38Rows, familia, lmUrls) {
  const rows = [];
  for (const v of familia.variantes) {
    for (const amp of v.amperagens) {
      const hits = p38Rows.filter((r) => {
        const d = parseDisjuntor(r);
        return d && d.tipo === v.tipo && d.amperagem === amp;
      });
      const status = hits.length ? (hits.length > 1 ? 'duplicado' : 'tem') : 'falta';
      rows.push({
        familia: 'Disjuntor DIN',
        produto_compra: familia.produto_compra,
        variante: v.tipo,
        amperagem_ou_eixo: amp,
        status,
        qtd_p38: hits.length,
        codigos_p38: hits.map((h) => h.codigo_interno).join(', '),
        sku_exemplo: hits[0]?.sku_atual ?? '',
        lm_caminho: familia.lm_caminho,
        lm_url: lmUrls.disjuntor_mono,
        nota: v.nota ?? '',
        prioridade: familia.prioridade,
        acao: status === 'falta' ? 'cadastrar' : status === 'duplicado' ? 'revisar duplicado' : '',
      });
    }
  }
  return rows;
}

function tuboEletrodutoPolegada(row) {
  const sku = norm(row.sku_atual);
  const m = sku.match(/TUBO ELETRODUTO\s+(.+)$/);
  if (!m) return norm(row.eixo_a);
  return m[1].replace(/\s/g, ' ').trim();
}

function polegadaNorm(s) {
  return norm(s).replace(/['"]/g, '').trim();
}

function matchEletrodutoSize(row, size) {
  const got = polegadaNorm(tuboEletrodutoPolegada(row));
  const want = polegadaNorm(size);
  if (want === '1') return got === '1';
  return got === want || got.startsWith(want);
}

function buildEixoMatrix(p38Rows, familia, lmUrls, urlKey) {
  return familia.variantes.map((v) => {
    const matcher = (r) => {
      if (norm(r.produto_compra) !== norm(familia.produto_compra)) return false;
      if (v.eixo_a) {
        if (familia.id === 'eletroduto_tubo') return matchEletrodutoSize(r, v.eixo_a);
        return norm(r.eixo_a) === norm(v.eixo_a);
      }
      if (v.eixo_match) {
        if (familia.id === 'fio' || familia.id === 'fio_paralelo') return matchFio(r, v.eixo_match);
        if (familia.id === 'caixinha') return matchCaixinha(r, v.eixo_match);
        return norm(`${r.eixo_a} ${r.sku_atual}`).includes(norm(v.eixo_match));
      }
      return false;
    };
    const hits = findP38Match(p38Rows, matcher);
    const status = hits.length ? 'tem' : 'falta';
    return {
      familia: familia.id,
      produto_compra: familia.produto_compra,
      variante: v.label ?? v.eixo_a ?? v.eixo_match,
      amperagem_ou_eixo: v.label ?? v.eixo_a ?? v.eixo_match,
      status,
      qtd_p38: hits.length,
      codigos_p38: hits.map((h) => h.codigo_interno).join(', '),
      sku_exemplo: hits[0]?.sku_atual ?? '',
      lm_caminho: familia.lm_caminho,
      lm_url: lmUrls[urlKey] ?? lmUrls.disjuntores,
      nota: v.nota ?? '',
      prioridade: familia.prioridade,
      acao: status === 'falta' ? 'cadastrar' : '',
    };
  });
}

function buildBenchmark(p38Rows, mix) {
  const all = [];
  for (const fam of mix.familias) {
    if (fam.id === 'disjuntor') {
      all.push(...buildDisjuntorMatrix(p38Rows, fam, mix.lm_urls));
    } else {
      const urlKey = fam.id.startsWith('fio') ? 'fios' : fam.id.startsWith('eletroduto') ? 'eletroduto' : fam.id === 'quadro' ? 'quadros' : 'disjuntores';
      all.push(...buildEixoMatrix(p38Rows, fam, mix.lm_urls, urlKey));
    }
  }
  return all;
}

function addSheet(wb, name, headers, dataRows, color) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(headers);
  styleHeader(ws.getRow(1), color);
  for (const row of dataRows) ws.addRow(headers.map((h) => row[h] ?? ''));
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = [14, 22, 14, 18, 10, 8, 24, 40, 36, 60, 24, 12, 14][i] ?? 16;
  });
  if (dataRows.length) {
    ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}${dataRows.length + 1}` };
  }
}

async function writeXlsx(outPath, matrix, p38Rows, mix) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const headers = [
    'familia',
    'produto_compra',
    'variante',
    'amperagem_ou_eixo',
    'status',
    'qtd_p38',
    'codigos_p38',
    'sku_exemplo',
    'lm_caminho',
    'lm_url',
    'nota',
    'prioridade',
    'acao',
  ];

  const falta = matrix.filter((r) => r.status === 'falta');
  const tem = matrix.filter((r) => r.status === 'tem');
  const revisar = matrix.filter((r) => r.status === 'duplicado');

  const resumo = wb.addWorksheet('Resumo');
  resumo.addRow(['métrica', 'valor']);
  styleHeader(resumo.getRow(1), 'FF2D5016');
  resumo.addRow(['Mix básico LM (posições)', matrix.length]);
  resumo.addRow(['P38 — tem', tem.length]);
  resumo.addRow(['P38 — falta cadastrar', falta.length]);
  resumo.addRow(['P38 — revisar duplicado', revisar.length]);
  resumo.addRow(['SKUs folha B Elétrica (total)', p38Rows.length]);
  resumo.addRow([]);
  resumo.addRow(['Prioridade núcleo — falta', falta.filter((r) => r.prioridade === 'nucleo').length]);
  resumo.addRow(['Disjuntor trifásico — falta', falta.filter((r) => r.familia === 'Disjuntor DIN' && String(r.variante).includes('TRIF')).length]);
  resumo.getColumn(1).width = 36;
  resumo.getColumn(2).width = 12;

  addSheet(wb, 'Matriz completa', headers, matrix, 'FF3A4A5C');
  addSheet(wb, 'Falta cadastrar', headers, falta, 'FFB84A4A');
  addSheet(wb, 'Já temos', headers, tem, 'FF2D6B4A');

  const leg = wb.addWorksheet('Legenda LM');
  leg.addRow(['item', 'url']);
  styleHeader(leg.getRow(1));
  for (const [k, url] of Object.entries(mix.lm_urls)) leg.addRow([k, url]);
  leg.addRow([]);
  leg.addRow(['Método', mix.nota_metodo]);
  leg.addRow(['Fonte', mix.fonte]);
  leg.getColumn(2).width = 72;

  const inv = wb.addWorksheet('Inventário P38 B');
  inv.addRow(['sub_bloco', 'produto_compra', 'eixo_a', 'eixo_b', 'codigo_interno', 'sku_atual']);
  styleHeader(inv.getRow(1), 'FF1A4D6B');
  for (const r of p38Rows) {
    inv.addRow([r.sub_bloco, r.produto_compra, r.eixo_a, r.eixo_b, r.codigo_interno, r.sku_atual]);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);
}

async function main() {
  const { inPath, mixPath, outPath } = parseArgs(process.argv.slice(2));
  const mix = JSON.parse(fs.readFileSync(mixPath, 'utf8'));
  const p38Rows = await loadBEletrica(inPath);
  const matrix = buildBenchmark(p38Rows, mix);
  await writeXlsx(outPath, matrix, p38Rows, mix);

  const falta = matrix.filter((r) => r.status === 'falta');
  const faltaNucleo = falta.filter((r) => r.prioridade === 'nucleo');

  console.log('[benchmark-leroy-eletrica] OK');
  console.log(`  saída: ${outPath}`);
  console.log(`  mix LM: ${matrix.length} posições · tem: ${matrix.filter((r) => r.status === 'tem').length} · falta: ${falta.length}`);
  console.log(`  falta núcleo: ${faltaNucleo.length}`);
  console.log('  Lacunas disjuntor:');
  for (const r of falta.filter((x) => x.familia === 'Disjuntor DIN')) {
    console.log(`    - ${r.variante} ${r.amperagem_ou_eixo}`);
  }
}

main().catch((err) => {
  console.error('[benchmark-leroy-eletrica]', err.message);
  process.exit(1);
});
