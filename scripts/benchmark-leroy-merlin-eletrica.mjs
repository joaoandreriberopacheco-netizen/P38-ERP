#!/usr/bin/env node
/**
 * Benchmark elétrica P38 vs mix básico Leroy Merlin — hidratar o que já temos.
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
  return { inPath: get('--in=') ?? DEFAULT_IN, mixPath: get('--mix=') ?? DEFAULT_MIX, outPath: get('--out=') ?? DEFAULT_OUT };
}

function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function polegadaNorm(s) {
  return norm(s).replace(/['"]/g, '').replace(/\s+/g, ' ').trim();
}

function blobRow(row) {
  return norm(`${row.produto_compra} ${row.eixo_a} ${row.eixo_b} ${row.sku_atual}`);
}

function styleHeader(row, color = 'FF4A5240') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

async function loadBEletrica(inPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inPath);
  const ws = wb.getWorksheet('B — Elétrica');
  if (!ws) throw new Error('Folha "B — Elétrica" em falta');
  const headers = ws.getRow(1).values.slice(1);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k) => String(row.getCell(idx[k])?.value ?? '').trim();
    rows.push({ sub_bloco: get('sub_bloco'), produto_compra: get('produto_compra'), eixo_a: get('eixo_a'), eixo_b: get('eixo_b'), codigo_interno: get('codigo_interno'), sku_atual: get('sku_atual') });
  }
  return rows;
}

function rowBase(familia, grupo, lmUrls, fields) {
  return {
    grupo: grupo?.nome ?? '',
    familia: familia.id,
    produto_compra: familia.produto_compra ?? fields.produto_compra ?? '',
    variante: fields.variante ?? '',
    amperagem_ou_eixo: fields.amperagem_ou_eixo ?? fields.variante ?? '',
    status: fields.status,
    qtd_p38: fields.qtd_p38 ?? 0,
    codigos_p38: fields.codigos_p38 ?? '',
    sku_exemplo: fields.sku_exemplo ?? '',
    lm_caminho: familia.lm_caminho ?? '',
    lm_url: fields.lm_url ?? lmUrls.disjuntores ?? '',
    nota: fields.nota ?? '',
    prioridade: fields.prioridade ?? familia.prioridade ?? 'nucleo',
    acao: fields.acao ?? '',
    detalhe: fields.detalhe ?? '',
  };
}

function parseDisjuntor(row) {
  if (norm(row.produto_compra) !== 'DISJUNTOR') return null;
  const blob = blobRow(row);
  let tipo = '';
  if (/MONOF/.test(blob)) tipo = 'MONOFÁSICO';
  else if (/BIF/.test(blob)) tipo = 'BIFÁSICO';
  else if (/TRIF/.test(blob)) tipo = 'TRIFÁSICO';
  const amp = blob.match(/(\d+)\s*A\b/);
  return tipo && amp ? { tipo, amperagem: `${amp[1]}A` } : null;
}

function matchFio(row, eixoMatch) {
  const blob = blobRow(row).replace(/\s/g, '');
  return blob.includes(norm(eixoMatch).replace(/\s/g, ''));
}

function matchSizeInRow(row, size) {
  const want = polegadaNorm(size);
  const blob = polegadaNorm(`${row.eixo_a} ${row.eixo_b} ${row.sku_atual}`);
  if (want === '1') return /\b1(\s|$)/.test(blob) && !/1\s*1\/4|1\s*1\/2|1\/2|1\/4/.test(blob.replace(/1\s*1\/4/g, 'XX').replace(/1\s*1\/2/g, 'YY'));
  return blob.includes(want.replace(/\s/g, '')) || blob.includes(want);
}

function matchPecaEletroduto(row, peca, size) {
  const pc = norm(row.produto_compra);
  const p = norm(peca);
  if (p === 'LUVA') {
    if (pc !== 'LUVA') return false;
    return /ELETRODUTO/.test(blobRow(row)) && matchSizeInRow(row, size);
  }
  if (!pc.includes(p.replace(' ELETRODUTO', '')) && pc !== p) return false;
  if (p.includes('ELETRODUTO') && !pc.includes('ELETRODUTO') && pc !== 'LUVA') return false;
  return matchSizeInRow(row, size);
}

function buildFamiliaRows(familia, p38Rows, mix) {
  const grupo = mix.grupos?.find((g) => g.codigo === familia.grupo);
  const lmUrls = mix.lm_urls;
  const tipo = familia.tipo_matriz ?? 'legacy';
  const rows = [];

  if (tipo === 'disjuntor') {
    for (const v of familia.variantes) {
      for (const amp of v.amperagens) {
        const hits = p38Rows.filter((r) => { const d = parseDisjuntor(r); return d && d.tipo === v.tipo && d.amperagem === amp; });
        const status = hits.length ? (hits.length > 1 ? 'duplicado' : 'tem') : 'falta';
        rows.push(rowBase(familia, grupo, lmUrls, {
          variante: v.tipo, amperagem_ou_eixo: amp, status, qtd_p38: hits.length,
          codigos_p38: hits.map((h) => h.codigo_interno).join(', '), sku_exemplo: hits[0]?.sku_atual,
          lm_url: lmUrls.disjuntores,
          acao: status === 'falta' ? 'cadastrar' : status === 'duplicado' ? 'revisar duplicado' : '',
        }));
      }
    }
    return rows;
  }

  if (tipo === 'eletroduto_kit') {
    for (const v of familia.variantes) {
      const pecasOk = [];
      const pecasFalta = [];
      for (const peca of familia.pecas) {
        const hits = p38Rows.filter((r) => matchPecaEletroduto(r, peca, v.size));
        if (hits.length) pecasOk.push(peca);
        else pecasFalta.push(peca);
      }
      const status = pecasFalta.length === 0 ? 'tem' : pecasFalta.length === familia.pecas.length ? 'falta' : 'parcial';
      rows.push(rowBase(familia, grupo, lmUrls, {
        variante: v.label, amperagem_ou_eixo: v.size, status, qtd_p38: pecasOk.length,
        detalhe: pecasFalta.length ? `Falta: ${pecasFalta.join(', ')}` : `Completo: ${pecasOk.join(', ')}`,
        lm_url: lmUrls.eletroduto,
        acao: pecasFalta.length ? `cadastrar ${pecasFalta.join(', ')}` : '',
      }));
    }
    return rows;
  }

  for (const v of familia.variantes) {
    const prio = v.prioridade ?? familia.prioridade ?? 'nucleo';
    let hits = [];

    if (tipo === 'quadro_polo') {
      hits = p38Rows.filter((r) => norm(r.produto_compra).includes('QUADRO DE DISTRIBUI') && norm(r.eixo_a).startsWith(norm(v.eixo_a)));
    } else if (tipo === 'eixo_a') {
      hits = p38Rows.filter((r) => norm(r.produto_compra) === norm(familia.produto_compra) && norm(r.eixo_a) === norm(v.eixo_a));
    } else if (tipo === 'fio') {
      hits = p38Rows.filter((r) => norm(r.produto_compra) === norm(familia.produto_compra) && matchFio(r, v.eixo_match));
    } else if (tipo === 'caixinha') {
      hits = p38Rows.filter((r) => {
        const b = norm(`${r.eixo_a} ${r.sku_atual}`).replace(/\s/g, '');
        const key = norm(v.eixo_match).replace(/\s/g, '');
        const isCaixa = norm(r.produto_compra).includes('CAIXINHA') || (key === '4X4' && norm(r.produto_compra) === 'CAIXA DE LUZ');
        return isCaixa && b.includes(key);
      });
    } else if (tipo === 'eletroduto_size') {
      hits = p38Rows.filter((r) => norm(r.produto_compra) === norm(familia.produto_compra) && matchSizeInRow(r, v.size));
    } else if (tipo === 'sku_contem') {
      hits = p38Rows.filter((r) => {
        const b = blobRow(r);
        if (familia.id === 'pontalete' && !norm(r.produto_compra).startsWith('PONTALETE')) return false;
        if (familia.id === 'caixa_contador' && !b.includes('CONTADOR')) return false;
        return b.includes(norm(v.sku_contem));
      });
    } else if (tipo === 'produto_compra_contem') {
      hits = p38Rows.filter((r) => norm(r.produto_compra).includes(norm(familia.produto_compra)) || norm(r.produto_compra).includes(norm(v.match)));
    } else if (tipo === 'produto_compra') {
      hits = p38Rows.filter((r) => norm(r.produto_compra).includes(norm(familia.produto_compra)));
    }

    const status = hits.length ? 'tem' : 'falta';
    rows.push(rowBase(familia, grupo, lmUrls, {
      variante: v.label ?? v.eixo_a ?? v.size ?? familia.produto_compra,
      amperagem_ou_eixo: v.label ?? v.eixo_a ?? v.size ?? '',
      status, qtd_p38: hits.length, prioridade: prio,
      codigos_p38: hits.map((h) => h.codigo_interno).join(', '),
      sku_exemplo: hits[0]?.sku_atual ?? '',
      lm_url: lmUrls[familia.id] ?? lmUrls.eletroduto ?? lmUrls.fios ?? lmUrls.padrao_entrada,
      acao: status === 'falta' ? 'cadastrar' : '',
    }));
  }
  return rows;
}

function buildBenchmark(p38Rows, mix) {
  return mix.familias.flatMap((fam) => buildFamiliaRows(fam, p38Rows, mix));
}

function addSheet(wb, name, headers, dataRows, color) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(headers);
  styleHeader(ws.getRow(1), color);
  for (const row of dataRows) ws.addRow(headers.map((h) => row[h] ?? ''));
  const widths = [16, 14, 22, 16, 22, 10, 8, 20, 40, 36, 50, 28, 12, 14, 36];
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = widths[i] ?? 16; });
  if (dataRows.length) ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(headers.length, 26))}${dataRows.length + 1}` };
}

async function writeXlsx(outPath, matrix, p38Rows, mix) {
  const wb = new ExcelJS.Workbook();
  const headers = ['grupo', 'familia', 'produto_compra', 'variante', 'amperagem_ou_eixo', 'status', 'qtd_p38', 'codigos_p38', 'sku_exemplo', 'lm_caminho', 'lm_url', 'nota', 'prioridade', 'acao', 'detalhe'];

  const falta = matrix.filter((r) => r.status === 'falta' || r.status === 'parcial');
  const tem = matrix.filter((r) => r.status === 'tem');
  const revisar = matrix.filter((r) => r.status === 'duplicado');

  const resumo = wb.addWorksheet('Resumo');
  resumo.addRow(['métrica', 'valor']);
  styleHeader(resumo.getRow(1), 'FF2D5016');
  resumo.addRow(['Mix LM (posições)', matrix.length]);
  resumo.addRow(['P38 — tem', tem.length]);
  resumo.addRow(['P38 — falta', matrix.filter((r) => r.status === 'falta').length]);
  resumo.addRow(['P38 — parcial (kit incompleto)', matrix.filter((r) => r.status === 'parcial').length]);
  resumo.addRow(['P38 — duplicado', revisar.length]);
  resumo.addRow(['SKUs B Elétrica', p38Rows.length]);
  resumo.addRow([]);
  for (const g of mix.grupos ?? []) {
    const gRows = matrix.filter((r) => r.grupo === g.nome);
    resumo.addRow([g.nome, `${gRows.filter((r) => r.status === 'tem').length}/${gRows.length} OK`]);
  }
  resumo.getColumn(1).width = 40;
  resumo.getColumn(2).width = 16;

  addSheet(wb, 'Matriz completa', headers, matrix, 'FF3A4A5C');
  addSheet(wb, 'Falta ou parcial', headers, falta, 'FFB84A4A');
  addSheet(wb, 'Já temos', headers, tem, 'FF2D6B4A');

  const inv = wb.addWorksheet('Inventário P38 B');
  inv.addRow(['sub_bloco', 'produto_compra', 'eixo_a', 'eixo_b', 'codigo_interno', 'sku_atual']);
  styleHeader(inv.getRow(1), 'FF1A4D6B');
  for (const r of p38Rows) inv.addRow([r.sub_bloco, r.produto_compra, r.eixo_a, r.eixo_b, r.codigo_interno, r.sku_atual]);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);
}

async function main() {
  const { inPath, mixPath, outPath } = parseArgs(process.argv.slice(2));
  const mix = JSON.parse(fs.readFileSync(mixPath, 'utf8'));
  const p38Rows = await loadBEletrica(inPath);
  const matrix = buildBenchmark(p38Rows, mix);
  await writeXlsx(outPath, matrix, p38Rows, mix);

  const falta = matrix.filter((r) => r.status === 'falta' && r.prioridade === 'nucleo');
  console.log('[benchmark-leroy-eletrica] OK');
  console.log(`  saída: ${outPath}`);
  console.log(`  mix: ${matrix.length} · tem: ${matrix.filter((r) => r.status === 'tem').length} · falta: ${matrix.filter((r) => r.status === 'falta').length} · parcial: ${matrix.filter((r) => r.status === 'parcial').length}`);
  console.log('  Falta núcleo:');
  for (const r of falta) console.log(`    [${r.familia}] ${r.variante} ${r.amperagem_ou_eixo}`);
  const parcial = matrix.filter((r) => r.status === 'parcial');
  if (parcial.length) {
    console.log('  Parcial (kits):');
    for (const r of parcial) console.log(`    [${r.familia}] ${r.variante} — ${r.detalhe}`);
  }
}

main().catch((err) => {
  console.error('[benchmark-leroy-eletrica]', err.message);
  process.exit(1);
});
