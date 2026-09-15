#!/usr/bin/env node
/**
 * Junta os Excels de estudo hierarquia num único ficheiro com aba README.
 *
 *   npm run export:sku-hierarquia-unificado
 *
 * Entradas (docs/exports/):
 *   P38-sku-hierarquia-ab.xlsx
 *   P38-sku-hierarquia-core.xlsx
 *   P38-eletrica-benchmark-lm.xlsx
 *
 * Saída:
 *   docs/exports/P38-sku-hierarquia-unificado.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const EXPORTS = path.join(process.cwd(), 'docs', 'exports');
const SOURCES = {
  ab: path.join(EXPORTS, 'P38-sku-hierarquia-ab.xlsx'),
  core: path.join(EXPORTS, 'P38-sku-hierarquia-core.xlsx'),
  bench: path.join(EXPORTS, 'P38-eletrica-benchmark-lm.xlsx'),
};
const OUT = path.join(EXPORTS, 'P38-sku-hierarquia-unificado.xlsx');

/** @type {{ file: keyof SOURCES, sheet: string, tab: string, descricao: string, grupo: string }[]} */
const PLANO = [
  {
    grupo: 'Visão geral',
    file: 'ab',
    sheet: 'Resumo',
    tab: 'Resumo blocos',
    descricao: 'Contagem de SKUs e produtos de compra por bloco/sub-bloco (A Edificações, B Instalações, C prévias).',
  },
  {
    grupo: 'Bloco A — Edificações',
    file: 'ab',
    sheet: 'A — Edificações',
    tab: 'A · Edificações',
    descricao: 'Alvenaria, cobertura, revestimentos e acabamento seco — etapas 1, 2, 4 e 6 da obra.',
  },
  {
    grupo: 'Bloco B — Instalações',
    file: 'ab',
    sheet: 'B — Hidráulica',
    tab: 'B · Hidráulica',
    descricao: 'Soldável, esgoto, roscável, captação e componentes hidráulicos (~233 SKUs).',
  },
  {
    grupo: 'Bloco B — Instalações',
    file: 'ab',
    sheet: 'B — Elétrica',
    tab: 'B · Elétrica',
    descricao: 'Padrão, infra, quadro e caixas de espera — até instalação bruta (~82 SKUs).',
  },
  {
    grupo: 'Bloco C — Acabamentos (prévia)',
    file: 'ab',
    sheet: 'C prévia — elétrica visível',
    tab: 'C · Elétrica visível',
    descricao: 'Tomadas, lâmpadas e pontos visíveis — prévia fora do escopo B principal.',
  },
  {
    grupo: 'Catálogo completo',
    file: 'core',
    sheet: 'Catálogo',
    tab: 'Catálogo core',
    descricao: 'Todos os SKUs do estudo (~1 200 linhas): etapa → core → linha → produto compra → eixos.',
  },
  {
    grupo: 'Referência',
    file: 'ab',
    sheet: 'Legenda A-B',
    tab: 'Legenda blocos',
    descricao: 'Significado dos códigos de bloco, sub-bloco e status_mix.',
  },
  {
    grupo: 'Referência',
    file: 'core',
    sheet: 'Legenda linha',
    tab: 'Legenda LINHA',
    descricao: 'Tipos de LINHA: solo, mix, portfolio.',
  },
  {
    grupo: 'Referência',
    file: 'ab',
    sheet: 'Etapas ERP',
    tab: 'Etapas ERP',
    descricao: 'Mapa categoria ERP → etapa de obra (1–6).',
  },
  {
    grupo: 'Referência',
    file: 'ab',
    sheet: 'Referência cores',
    tab: 'Cores por core',
    descricao: 'Cores sugeridas por core/etapa para leitura visual no Excel.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Resumo',
    tab: 'Bench · Resumo',
    descricao: 'Síntese do benchmark: o que falta, o que já temos, novos SKUs propostos.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Matriz completa',
    tab: 'Bench · Matriz LM',
    descricao: 'Matriz P38 × mix básico Leroy Merlin (disjuntores, quadros, fios, eletroduto…).',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Falta ou parcial',
    tab: 'Bench · Falta cadastrar',
    descricao: 'Itens em falta ou só parcialmente cobertos no P38.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Já temos',
    tab: 'Bench · Já temos',
    descricao: 'Itens do mix LM que o P38 já cobre.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Novos — disjuntores',
    tab: 'Bench · Novos disjuntores',
    descricao: 'Disjuntores DIN mono/bi/tri propostos no estudo.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Novos — conexões',
    tab: 'Bench · Novos conexões',
    descricao: 'Conexões e acessórios elétricos novos.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Novos — contatores',
    tab: 'Bench · Novos contatores',
    descricao: 'Contatores propostos no complemento elétrico.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Novos — completar 06-08',
    tab: 'Bench · Completar 06-08',
    descricao: 'Complemento trifásico, flex, quadros plástico/metal.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Novos — trilho DR DPS',
    tab: 'Bench · Trilho DR DPS',
    descricao: 'Trilho DIN, DR/IDR, DPS — ecossistema Tigre.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Mix disjuntores alvo',
    tab: 'Bench · Mix disjuntores',
    descricao: 'Mix alvo de disjuntores para loja de bairro.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Inventário P38 B',
    tab: 'Bench · Inventário P38',
    descricao: 'Inventário actual da folha B — Elétrica no P38.',
  },
  {
    grupo: 'Benchmark elétrica vs Leroy Merlin',
    file: 'bench',
    sheet: 'Legado export zumbi',
    tab: 'Bench · Legado zumbi',
    descricao: 'Linhas legado marcadas zumbi — não usar no cadastro.',
  },
];

function styleHeader(row, color = 'FF4A5240') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function cloneCellStyle(source, target) {
  if (source.font) target.font = { ...source.font };
  if (source.alignment) target.alignment = { ...source.alignment };
  if (source.border) target.border = { ...source.border };
  if (source.fill) target.fill = { ...source.fill };
  if (source.numFmt) target.numFmt = source.numFmt;
}

function copyWorksheet(sourceWs, targetWb, tabName) {
  const targetWs = targetWb.addWorksheet(tabName, {
    views: sourceWs.views ? structuredClone(sourceWs.views) : [{ state: 'frozen', ySplit: 1 }],
    properties: sourceWs.properties ? { ...sourceWs.properties } : undefined,
  });

  sourceWs.columns?.forEach((col, idx) => {
    const tcol = targetWs.getColumn(idx + 1);
    if (col.width) tcol.width = col.width;
    if (col.hidden) tcol.hidden = col.hidden;
    if (col.outlineLevel) tcol.outlineLevel = col.outlineLevel;
  });

  sourceWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = targetWs.getRow(rowNumber);
    if (row.height) targetRow.height = row.height;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value;
      cloneCellStyle(cell, targetCell);
    });
  });

  for (const merge of Object.values(sourceWs._merges || {})) {
    try {
      targetWs.mergeCells(merge);
    } catch {
      /* ignore invalid merge copies */
    }
  }

  if (sourceWs.autoFilter) {
    targetWs.autoFilter = sourceWs.autoFilter;
  }

  return targetWs;
}

function populateReadme(ws, meta) {
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  ws.columns = [
    { width: 4 },
    { width: 28 },
    { width: 14 },
    { width: 52 },
    { width: 10 },
  ];

  ws.mergeCells('B2:E2');
  ws.getCell('B2').value = 'P38 — Estudo hierarquia (Excel unificado)';
  ws.getCell('B2').font = { bold: true, size: 16, color: { argb: 'FF2D5016' } };

  ws.getCell('B3').value = 'Gerado em';
  ws.getCell('C3').value = meta.generatedAt;
  ws.getCell('B4').value = 'Ficheiros origem';
  ws.getCell('C4').value = 'P38-sku-hierarquia-ab · core · eletrica-benchmark-lm';

  ws.mergeCells('B6:E6');
  ws.getCell('B6').value = 'Como usar';
  ws.getCell('B6').font = { bold: true, size: 12 };
  ws.getCell('B7').value = '1. Leia o Resumo blocos para ver volumes por área.';
  ws.getCell('B8').value = '2. Trabalhe hidráulica e elétrica nas abas B · Hidráulica e B · Elétrica.';
  ws.getCell('B9').value = '3. Use Catálogo core para pesquisa global ou filtro por linha.';
  ws.getCell('B10').value = '4. Benchmark · * para ver lacunas vs Leroy Merlin e SKUs novos propostos.';
  ws.getCell('B11').value = '5. Regenerar: npm run export:sku-hierarquia-unificado (após actualizar os 3 Excels fonte).';

  const headerRow = ws.getRow(13);
  headerRow.values = [null, 'Grupo', 'Aba', 'O que contém', 'Linhas'];
  styleHeader(headerRow, 'FF2D5016');

  meta.entries.forEach((entry, idx) => {
    const row = ws.getRow(14 + idx);
    row.values = [null, entry.grupo, entry.tab, entry.descricao, entry.rows];
    row.alignment = { vertical: 'top', wrapText: true };
  });

  ws.autoFilter = { from: 'B13', to: `E${13 + meta.entries.length}` };
}

async function loadWorkbooks() {
  const cache = {};
  for (const [key, filePath] of Object.entries(SOURCES)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Ficheiro em falta: ${filePath}. Copie da branch cursor/sku-hierarquia-excel-ab-3291.`);
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    cache[key] = wb;
  }
  return cache;
}

async function main() {
  const workbooks = await loadWorkbooks();
  const outWb = new ExcelJS.Workbook();
  outWb.created = new Date();
  outWb.creator = 'P38 export:sku-hierarquia-unificado';

  outWb.addWorksheet('README');

  const entries = [];

  for (const item of PLANO) {
    const srcWb = workbooks[item.file];
    const srcWs = srcWb.getWorksheet(item.sheet);
    if (!srcWs) {
      throw new Error(`Aba "${item.sheet}" não encontrada em ${SOURCES[item.file]}`);
    }
    copyWorksheet(srcWs, outWb, item.tab);
    entries.push({
      grupo: item.grupo,
      tab: item.tab,
      descricao: item.descricao,
      rows: Math.max(0, srcWs.rowCount - 1),
    });
  }

  populateReadme(outWb.getWorksheet('README'), {
    generatedAt: new Date().toISOString(),
    entries,
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await outWb.xlsx.writeFile(OUT);

  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-sku-hierarquia-unificado.xlsx');
  } catch {
    /* ok outside cloud agent */
  }

  console.log(`[export:sku-hierarquia-unificado] ${outWb.worksheets.length} abas → ${OUT}`);
  for (const ws of outWb.worksheets) {
    console.log(`  · ${ws.name} (${Math.max(0, ws.rowCount - 1)} linhas)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
