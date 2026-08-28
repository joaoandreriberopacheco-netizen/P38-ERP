#!/usr/bin/env node
/**
 * Excel estudo — A (Edificações) e B (Instalações: hidráulica + elétrica até caixa de espera).
 *
 *   npm run export:sku-hierarquia-ab
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  getMacroConfig,
  isEtapaEdificacoes,
  isHidraulica,
  isEletricaInstalacao,
  isEletricaAcabamentos,
  subBlocoEdificacoes,
  subBlocoHidraulica,
  subBlocoEletrica,
} from './lib/hierarquiaMacroBlocos.mjs';
import { getLegendaLinha, getMapaEtapasCategoria } from './lib/etapaCategoriaMap.mjs';
import { listarCoresObra } from './lib/inferenciaCoreObra.mjs';

const DEFAULT_IN = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');
const DEFAULT_OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');

const ROW_HEADERS = [
  'bloco',
  'sub_bloco',
  'etapa',
  'core',
  'linha',
  'produto_compra',
  'eixo_a',
  'eixo_b',
  'codigo_interno',
  'novo_sku',
  'sku_atual',
  'status_mix',
];

function parseArgs(argv) {
  const inArg = argv.find((a) => a.startsWith('--in='));
  const outArg = argv.find((a) => a.startsWith('--out='));
  return {
    inPath: inArg ? inArg.slice(5) : DEFAULT_IN,
    outPath: outArg ? outArg.slice(6) : DEFAULT_OUT,
  };
}

function styleHeader(row, color = 'FF4A5240') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function sortKey(parts) {
  return parts.map((p) => String(p ?? '')).join('\x00');
}

async function loadCatalogRows(inPath) {
  if (inPath.endsWith('.csv')) {
    const raw = fs.readFileSync(inPath, 'utf8').replace(/^\ufeff/, '');
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(',');
    const idx = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));
    return lines.slice(1).map((line) => {
      const cols = line.split(',');
      const get = (k) => (cols[idx[k]] ?? '').trim();
      return {
        etapa: get('etapa'),
        core: get('core'),
        linha: get('linha'),
        produto_compra: get('produto_compra'),
        eixo_a: get('eixo_a'),
        eixo_b: get('eixo_b'),
        codigo_interno: get('codigo_interno'),
        novo_sku: get('novo_sku'),
        sku_atual: get('sku_atual'),
      };
    });
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inPath);
  const ws = wb.getWorksheet('Catálogo') ?? wb.worksheets[0];
  const headers = ws.getRow(1).values.slice(1);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k) => String(row.getCell(idx[k])?.value ?? '').trim();
    rows.push({
      etapa: get('etapa'),
      core: get('core'),
      linha: get('linha'),
      produto_compra: get('produto_compra'),
      eixo_a: get('eixo_a'),
      eixo_b: get('eixo_b'),
      codigo_interno: get('codigo_interno'),
      novo_sku: get('novo_sku'),
      sku_atual: get('sku_atual'),
    });
  }
  return rows;
}

function buildEdificacoesRows(catalog) {
  return catalog
    .filter((row) => isEtapaEdificacoes(row.etapa))
    .map((row) => {
      const sub = subBlocoEdificacoes(row.etapa);
      return {
        bloco: 'A — Edificações',
        sub_bloco: sub.nome,
        ...row,
        status_mix: 'tem',
        _sort: sortKey([sub.codigo, row.core, row.linha, row.produto_compra, row.sku_atual]),
      };
    })
    .sort((a, b) => a._sort.localeCompare(b._sort, 'pt-BR'));
}

function buildHidraulicaRows(catalog) {
  return catalog
    .filter((row) => isHidraulica(row))
    .map((row) => {
      const sub = subBlocoHidraulica(row);
      const subNome = sub ? sub.nome : '(classificar)';
      const subCod = sub?.codigo ?? 'B??';
      return {
        bloco: 'B — Instalações',
        sub_bloco: subNome,
        ...row,
        status_mix: 'tem',
        _sort: sortKey([subCod, row.produto_compra, row.eixo_a, row.eixo_b, row.sku_atual]),
      };
    })
    .filter((row) => row.sub_bloco !== '(classificar)')
    .sort((a, b) => a._sort.localeCompare(b._sort, 'pt-BR'));
}

function buildEletricaInstalacaoRows(catalog) {
  return catalog
    .filter((row) => isEletricaInstalacao(row))
    .map((row) => {
      const sub = subBlocoEletrica(row);
      const subNome = sub ? sub.nome : '(classificar)';
      const subCod = sub?.codigo ?? 'B??';
      return {
        bloco: 'B — Instalações',
        sub_bloco: subNome,
        ...row,
        status_mix: 'tem',
        _sort: sortKey([subCod, row.produto_compra, row.eixo_a, row.sku_atual]),
      };
    })
    .sort((a, b) => a._sort.localeCompare(b._sort, 'pt-BR'));
}

function buildAcabamentosPreviaRows(catalog) {
  return catalog
    .filter((row) => isEletricaAcabamentos(row))
    .map((row) => ({
      bloco: 'C — Acabamentos (prévia)',
      sub_bloco: 'C-Elétrica visível',
      ...row,
      status_mix: '→ acabamentos',
      _sort: sortKey([row.produto_compra, row.sku_atual]),
    }))
    .sort((a, b) => a._sort.localeCompare(b._sort, 'pt-BR'));
}

function addDataSheet(wb, name, rows, headerColor) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(ROW_HEADERS);
  styleHeader(ws.getRow(1), headerColor);
  for (const row of rows) {
    const { _sort, ...data } = row;
    ws.addRow(ROW_HEADERS.map((h) => data[h] ?? ''));
  }
  const widths = [18, 26, 28, 20, 24, 28, 10, 14, 14, 40, 40, 14];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  if (rows.length) {
    ws.autoFilter = { from: 'A1', to: `L${rows.length + 1}` };
  }
  return ws;
}

function addResumoSheet(wb, edifRows, hidRows, elecRows, acabPreviaRows) {
  const ws = wb.addWorksheet('Resumo', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(['bloco', 'sub_bloco', 'skus', 'produtos_compra']);
  styleHeader(ws.getRow(1), 'FF2D5016');

  const countGroups = (rows) => {
    const map = new Map();
    for (const r of rows) {
      const k = `${r.bloco}\x00${r.sub_bloco}`;
      if (!map.has(k)) map.set(k, { bloco: r.bloco, sub: r.sub_bloco, skus: 0, pcs: new Set() });
      const g = map.get(k);
      g.skus++;
      if (r.produto_compra) g.pcs.add(r.produto_compra);
    }
    return [...map.values()].sort((a, b) => a.sub.localeCompare(b.sub, 'pt-BR'));
  };

  for (const g of [...countGroups(edifRows), ...countGroups(hidRows), ...countGroups(elecRows), ...countGroups(acabPreviaRows)]) {
    ws.addRow([g.bloco, g.sub, g.skus, g.pcs.size]);
  }

  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 8;
  ws.getColumn(4).width = 16;

  ws.addRow([]);
  ws.addRow(['Total A — Edificações', '', edifRows.length, new Set(edifRows.map((r) => r.produto_compra).filter(Boolean)).size]);
  ws.addRow(['Total B — Hidráulica', '', hidRows.length, new Set(hidRows.map((r) => r.produto_compra).filter(Boolean)).size]);
  ws.addRow(['Total B — Elétrica (instalação)', '', elecRows.length, new Set(elecRows.map((r) => r.produto_compra).filter(Boolean)).size]);
  ws.addRow(['Total B — Instalações', '', hidRows.length + elecRows.length, '']);
  ws.addRow(['→ C prévia (elétrica visível)', '', acabPreviaRows.length, new Set(acabPreviaRows.map((r) => r.produto_compra).filter(Boolean)).size]);
}

function addLegendaSheet(wb) {
  const cfg = getMacroConfig();
  const ws = wb.addWorksheet('Legenda A-B');
  ws.addRow(['Tipo', 'Código', 'Descrição']);
  styleHeader(ws.getRow(1));

  for (const b of cfg.blocos) {
    ws.addRow(['Bloco', b.codigo, `${b.nome} — ${b.descricao}`]);
  }
  ws.addRow([]);
  ws.addRow(['Regra', '', cfg.regra_limite.instalacao]);
  ws.addRow(['Regra', '', cfg.regra_limite.acabamentos]);
  ws.addRow(['Regra', '', cfg.regra_limite.gas]);
  ws.addRow([]);
  ws.addRow(['Sub A', 'Código', 'Etapa']);
  for (const s of cfg.sub_blocos_a) {
    ws.addRow(['Sub A', s.codigo, s.etapa]);
  }
  ws.addRow([]);
  ws.addRow(['Sub B', 'Código', 'Ramo hidráulico']);
  for (const s of cfg.sub_blocos_b_hidraulica) {
    ws.addRow(['Sub B', s.codigo, s.nome]);
  }
  ws.addRow([]);
  ws.addRow(['Sub B', 'Código', 'Ramo elétrico (até caixa de espera)']);
  for (const s of cfg.sub_blocos_b_eletrica) {
    ws.addRow(['Sub B', s.codigo, `${s.nome}${s.nota ? ` — ${s.nota}` : ''}`]);
  }
  ws.addRow([]);
  ws.addRow(['Linha ·N/·C/·R', 'Sufixo', 'Significado']);
  for (const [suf, desc] of Object.entries(getLegendaLinha())) {
    ws.addRow(['Glitch linha', suf, desc]);
  }

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 72;
}

function addReferenciaSheets(wb) {
  const etapas = wb.addWorksheet('Etapas ERP');
  etapas.addRow(['categoria_erp', 'etapa', 'etapa_codigo']);
  styleHeader(etapas.getRow(1), 'FF5C4A3A');
  for (const m of getMapaEtapasCategoria()) {
    etapas.addRow([m.categoria_erp, m.etapa, m.etapa_codigo]);
  }
  etapas.getColumn(1).width = 36;
  etapas.getColumn(2).width = 32;

  const ref = wb.addWorksheet('Referência cores');
  ref.addRow(['core', 'etapa', 'descricao']);
  styleHeader(ref.getRow(1), 'FF3A4A5C');
  for (const c of listarCoresObra()) {
    ref.addRow([c.codigo, c.etapa, c.descricao]);
  }
  ref.getColumn(1).width = 22;
  ref.getColumn(3).width = 48;
}

async function main() {
  const { inPath, outPath } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(inPath)) {
    throw new Error(`Entrada em falta: ${inPath}\nCorra antes: npm run export:sku-hierarquia-core -- --skip-regen`);
  }

  const catalog = await loadCatalogRows(inPath);
  const edifRows = buildEdificacoesRows(catalog);
  const hidRows = buildHidraulicaRows(catalog);
  const elecRows = buildEletricaInstalacaoRows(catalog);
  const acabPreviaRows = buildAcabamentosPreviaRows(catalog);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 export-sku-hierarquia-ab';
  wb.created = new Date();

  addResumoSheet(wb, edifRows, hidRows, elecRows, acabPreviaRows);
  addDataSheet(wb, 'A — Edificações', edifRows, 'FF2D5016');
  addDataSheet(wb, 'B — Hidráulica', hidRows, 'FF1A4D6B');
  addDataSheet(wb, 'B — Elétrica', elecRows, 'FF4A3A8C');
  addDataSheet(wb, 'C prévia — elétrica visível', acabPreviaRows, 'FF6B5A2D');
  addLegendaSheet(wb);
  addReferenciaSheets(wb);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);

  console.log('[export-sku-hierarquia-ab] OK');
  console.log(`  saída: ${outPath}`);
  console.log(`  A — Edificações:           ${edifRows.length} SKUs`);
  console.log(`  B — Hidráulica:            ${hidRows.length} SKUs`);
  console.log(`  B — Elétrica (instalação): ${elecRows.length} SKUs`);
  console.log(`  → C prévia (visível):      ${acabPreviaRows.length} SKUs`);

  const bySub = {};
  for (const r of elecRows) bySub[r.sub_bloco] = (bySub[r.sub_bloco] || 0) + 1;
  console.log('  Elétrica por ramo:');
  for (const [k, v] of Object.entries(bySub).sort()) console.log(`    ${k}: ${v}`);
}

main().catch((err) => {
  console.error('[export-sku-hierarquia-ab]', err.message);
  process.exit(1);
});
