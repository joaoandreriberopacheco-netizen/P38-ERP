#!/usr/bin/env node
/**
 * Excel catálogo modelo 4×3 — monitor Smart Supply / Novo Ecosistema.
 *
 *   npm run export:catalogo-4x3
 *   npm run export:catalogo-3x3  (alias)
 *
 * Drill-down: ETAPA · CATEGORIA · SUBCATEGORIA · LINHA + comp1 · comp2 · comp3
 *
 * Fonte: docs/exports/P38-sku-hierarquia-core.xlsx (+ enriquecimento ab.xlsx)
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  cellStr,
  to4x3,
  buildCodigosCaminho4x,
  lookupCodigoCaminho4x,
  legendaCaminho4x,
} from './lib/catalogo3x3Map.mjs';

const EXPORTS = path.join(process.cwd(), 'docs', 'exports');
const CORE_PATH = path.join(EXPORTS, 'P38-sku-hierarquia-core.xlsx');
const AB_PATH = path.join(EXPORTS, 'P38-sku-hierarquia-ab.xlsx');
const OUT = path.join(EXPORTS, 'P38-catalogo-4x3.xlsx');
const OUT_LEGACY = path.join(EXPORTS, 'P38-catalogo-3x3.xlsx');

function styleHeader(row, color = 'FF2D5016') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function keyPath(...parts) {
  return parts.map((p) => String(p ?? '').trim()).join('\x00');
}

async function loadAbLookup() {
  const map = new Map();
  if (!fs.existsSync(AB_PATH)) return map;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(AB_PATH);
  for (const sheetName of [
    'A — Edificações',
    'B — Hidráulica',
    'B — Elétrica',
    'C prévia — elétrica visível',
  ]) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const codigo = cellStr(row.getCell(9).value).toUpperCase();
      if (!codigo) return;
      map.set(codigo, {
        bloco: cellStr(row.getCell(1).value),
        sub: cellStr(row.getCell(2).value),
        core: cellStr(row.getCell(4).value),
      });
    });
  }
  return map;
}

async function loadCatalogRows() {
  if (!fs.existsSync(CORE_PATH)) {
    throw new Error(`Fonte em falta: ${CORE_PATH}`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  if (!ws) throw new Error('Aba Catálogo não encontrada no core');

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    rows.push({
      codigo_interno: cellStr(row.getCell(1).value),
      etapa: cellStr(row.getCell(2).value),
      core: cellStr(row.getCell(3).value),
      linha: cellStr(row.getCell(4).value),
      produto_compra: cellStr(row.getCell(5).value),
      eixo_a: cellStr(row.getCell(6).value),
      eixo_b: cellStr(row.getCell(7).value),
      novo_sku: cellStr(row.getCell(8).value),
      sku_atual: cellStr(row.getCell(9).value),
    });
  });
  return rows;
}

function buildReadme(wb, stats) {
  const ws = wb.getWorksheet('README') || wb.addWorksheet('README');
  ws.columns = [{ width: 4 }, { width: 30 }, { width: 58 }];

  ws.getCell('B2').value = 'P38 — Catálogo modelo 4×3';
  ws.getCell('B2').font = { bold: true, size: 16, color: { argb: 'FF2D5016' } };

  const lines = [
    ['Gerado em', stats.generatedAt],
    ['SKUs', stats.skuCount],
    ['Caminhos drill-down (completo)', stats.drillPaths],
    ['Caminhos visão unificada', stats.unifiedDrillPaths],
    ['Padrões componente (×3)', stats.compPatterns],
    ['', ''],
    ['Modelo', ''],
    ['Drill-down (4 colunas)', 'ETAPA > CATEGORIA > SUBCATEGORIA > LINHA'],
    ['Código caminho 4×3', 'Formato A01AB — A=etapa · 01=categoria · A=subcategoria · B=linha'],
    ['Componente SKU (3 colunas)', 'comp1 | comp2 | comp3 — conexões: sufixo (CURTA/LONGA…) no comp1; medida no comp2'],
    ['Visão unificada (opcional)', 'Junta acabamentos de domínio em b. Instalações'],
    ['', ''],
    ['Etapas (prefixo ordena)', ''],
    ['A / a. Edificações', 'Alvenaria · sub: Materiais / Estrutura / Aditivos'],
    ['B / b. Instalações', 'Hidráulica · Elétrica — sub c&c = Canos e conexões'],
    ['C / c. Acabamentos', 'Domínio: 05 Hidráulica · 06 Elétrica — sub = função · linha = gama'],
    ['D / d. Transversal', 'Itens transversais da obra'],
    ['', ''],
    ['Revestimentos', 'Sub Assentamento · linhas Cerâmica · Argamassa · Rejunte'],
    ['Hidráulica (acab.)', 'Sub Pontos de água · linhas Torneiras Premium / Torneiras Pop'],
    ['Elétrica (acab.)', 'Sub Iluminação · Pontos elétricos'],
    ['Ambiente', 'Coluna opcional (Banheiro · Cozinha…) — não entra no drill-down'],
    ['Abas', ''],
    ['2 · ETAPA · CATEGORIA · SUB · LINHA', 'Caminhos únicos com código A01AB'],
    ['3 · Visão unificada', 'Acabamentos hidráulica/elétrica fundidos em Instalações'],
    ['4 · Componentes ×3', 'Padrões Comp1+Comp2+Comp3'],
    ['5 · Catálogo 4×3', 'Um SKU por linha — modelo completo'],
    ['6 · Catálogo unificado', 'Colunas etapa_u … linha_u'],
    ['7 · Pivot — metadados', 'Guia tabela dinâmica'],
    ['', ''],
    ['Regenerar', 'npm run export:catalogo-4x3'],
    ['Fonte', 'P38-sku-hierarquia-core.xlsx + P38-sku-hierarquia-ab.xlsx'],
    ['Tags', 'Fase posterior — não incluídas neste Excel'],
  ];

  let r = 3;
  for (const [a, b] of lines) {
    ws.getCell(`B${r}`).value = a;
    ws.getCell(`C${r}`).value = b;
    if (a === 'Modelo' || a === 'Abas' || a === 'Revestimentos') ws.getCell(`B${r}`).font = { bold: true };
    r += 1;
  }
}

function writeSheet(ws, headers, dataRows, headerColor = 'FF2D5016') {
  ws.columns = headers.map((h) => ({ header: h.key, key: h.key, width: h.width || 18 }));
  styleHeader(ws.getRow(1), headerColor);
  for (const row of dataRows) ws.addRow(row);
  if (dataRows.length) {
    const col = Math.min(headers.length, 26);
    ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + col)}${dataRows.length + 1}` };
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const DRILL_HEADERS = [
  { key: 'codigo_4x', width: 10 },
  { key: 'legenda', width: 52 },
  { key: 'etapa', width: 18 },
  { key: 'categoria', width: 26 },
  { key: 'subcategoria', width: 22 },
  { key: 'linha', width: 24 },
  { key: 'caminho', width: 58 },
  { key: 'skus', width: 10 },
  { key: 'produtos_compra', width: 16 },
];

const CATALOG_HEADERS = [
  { key: 'codigo_4x', width: 10 },
  { key: 'legenda', width: 48 },
  { key: 'etapa', width: 16 },
  { key: 'categoria', width: 22 },
  { key: 'subcategoria', width: 20 },
  { key: 'linha', width: 22 },
  { key: 'comp1', width: 28 },
  { key: 'comp2', width: 20 },
  { key: 'comp3', width: 16 },
  { key: 'codigo_interno', width: 14 },
  { key: 'novo_sku', width: 42 },
  { key: 'caminho', width: 52 },
  { key: 'rotulo_componente', width: 40 },
  { key: 'qtd_sku', width: 10 },
  { key: 'sku_atual', width: 36 },
  { key: 'etapa_origem', width: 24 },
  { key: 'core_origem', width: 22 },
  { key: 'linha_origem', width: 22 },
  { key: 'ambiente', width: 18 },
  { key: 'linha_3x', width: 28 },
];

function attachPathMeta4(row, registry, fields = {
  etapa: 'etapa',
  categoria: 'categoria',
  subcategoria: 'subcategoria',
  linha: 'linha',
}) {
  const etapa = row[fields.etapa];
  const categoria = row[fields.categoria];
  const subcategoria = row[fields.subcategoria];
  const linha = row[fields.linha];
  const caminho = `${etapa} > ${categoria} > ${subcategoria} > ${linha}`;
  return {
    codigo_4x: lookupCodigoCaminho4x(registry, etapa, categoria, subcategoria, linha),
    legenda: legendaCaminho4x(etapa, categoria, subcategoria, linha),
    caminho,
    ...row,
  };
}

function aggregateDrill(skus, pick) {
  const map = new Map();
  for (const row of skus) {
    const p = pick(row);
    const k = keyPath(p.etapa, p.categoria, p.subcategoria, p.linha);
    if (!map.has(k)) {
      map.set(k, { ...p, skus: 0, produtos_compra: new Set() });
    }
    const e = map.get(k);
    e.skus += 1;
    if (row.comp1) e.produtos_compra.add(row.comp1);
  }
  return map;
}

async function main() {
  const abLookup = await loadAbLookup();
  const catalogRows = await loadCatalogRows();

  const skus = catalogRows.map((row) => {
    const cod = cellStr(row.codigo_interno).toUpperCase();
    return to4x3(row, abLookup.get(cod));
  });

  const drillMap = aggregateDrill(skus, (row) => ({
    etapa: row.etapa,
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    linha: row.linha,
  }));
  const codigos = buildCodigosCaminho4x([...drillMap.values()]);

  const sortPath = (a, b) => keyPath(a.etapa, a.categoria, a.subcategoria, a.linha)
    .localeCompare(keyPath(b.etapa, b.categoria, b.subcategoria, b.linha));

  const drillRows = [...drillMap.values()]
    .sort(sortPath)
    .map((e) => attachPathMeta4({
      etapa: e.etapa,
      categoria: e.categoria,
      subcategoria: e.subcategoria,
      linha: e.linha,
      skus: e.skus,
      produtos_compra: e.produtos_compra.size,
    }, codigos));

  const compMap = new Map();
  for (const row of skus) {
    const k = keyPath(row.comp1, row.comp2, row.comp3);
    if (!compMap.has(k)) {
      compMap.set(k, { comp1: row.comp1, comp2: row.comp2, comp3: row.comp3, skus: 0, caminhos: new Set() });
    }
    const e = compMap.get(k);
    e.skus += 1;
    e.caminhos.add(`${row.etapa} > ${row.categoria} > ${row.subcategoria} > ${row.linha}`);
  }
  const compRows = [...compMap.values()]
    .sort((a, b) => b.skus - a.skus || keyPath(a.comp1, a.comp2, a.comp3).localeCompare(keyPath(b.comp1, b.comp2, b.comp3)))
    .map((e) => ({
      comp1: e.comp1,
      comp2: e.comp2,
      comp3: e.comp3,
      skus: e.skus,
      caminhos_distintos: e.caminhos.size,
      rotulo: [e.comp1, e.comp2, e.comp3].filter(Boolean).join(' · '),
    }));

  const factRows = skus
    .sort((a, b) => keyPath(a.etapa, a.categoria, a.subcategoria, a.linha, a.comp1)
      .localeCompare(keyPath(b.etapa, b.categoria, b.subcategoria, b.linha, b.comp1)))
    .map((row) => attachPathMeta4({
      etapa: row.etapa,
      categoria: row.categoria,
      subcategoria: row.subcategoria,
      linha: row.linha,
      comp1: row.comp1,
      comp2: row.comp2,
      comp3: row.comp3,
      codigo_interno: row.codigo_interno,
      novo_sku: row.novo_sku,
      sku_atual: row.sku_atual,
      rotulo_componente: [row.comp1, row.comp2, row.comp3].filter(Boolean).join(' · '),
      qtd_sku: 1,
      etapa_origem: row.etapa_origem,
      core_origem: row.core_origem,
      linha_origem: row.linha_origem,
      ambiente: row.ambiente,
      linha_3x: row.linha_3x,
    }, codigos));

  const unifiedDrillMap = aggregateDrill(skus, (row) => ({
    etapa: row.etapa_u,
    categoria: row.categoria_u,
    subcategoria: row.subcategoria_u,
    linha: row.linha_u,
  }));
  const codigosU = buildCodigosCaminho4x([...unifiedDrillMap.values()]);

  const unifiedDrillRows = [...unifiedDrillMap.values()]
    .sort(sortPath)
    .map((e) => attachPathMeta4({
      etapa: e.etapa,
      categoria: e.categoria,
      subcategoria: e.subcategoria,
      linha: e.linha,
      skus: e.skus,
      produtos_compra: e.produtos_compra.size,
    }, codigosU));

  const unifiedFactRows = skus
    .sort((a, b) => keyPath(a.etapa_u, a.categoria_u, a.subcategoria_u, a.linha_u, a.comp1)
      .localeCompare(keyPath(b.etapa_u, b.categoria_u, b.subcategoria_u, b.linha_u, b.comp1)))
    .map((row) => attachPathMeta4({
      etapa: row.etapa_u,
      categoria: row.categoria_u,
      subcategoria: row.subcategoria_u,
      linha: row.linha_u,
      comp1: row.comp1,
      comp2: row.comp2,
      comp3: row.comp3,
      codigo_interno: row.codigo_interno,
      novo_sku: row.novo_sku,
      sku_atual: row.sku_atual,
      rotulo_componente: [row.comp1, row.comp2, row.comp3].filter(Boolean).join(' · '),
      qtd_sku: 1,
      etapa_origem: row.etapa,
      categoria_origem: row.categoria,
      subcategoria_origem: row.subcategoria,
      linha_origem: row.linha,
      linha_3x: row.linha_3x,
    }, codigosU));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 export:catalogo-4x3';
  wb.created = new Date();

  wb.addWorksheet('README');
  buildReadme(wb, {
    generatedAt: new Date().toISOString(),
    skuCount: factRows.length,
    drillPaths: drillRows.length,
    unifiedDrillPaths: unifiedDrillRows.length,
    compPatterns: compRows.length,
  });

  writeSheet(wb.addWorksheet('ETAPA · CATEGORIA · SUB · LINHA'), DRILL_HEADERS, drillRows, 'FF4A5240');
  writeSheet(wb.addWorksheet('Visão unificada'), DRILL_HEADERS, unifiedDrillRows, 'FF1E3A5F');
  writeSheet(
    wb.addWorksheet('Componentes ×3'),
    [
      { key: 'comp1', width: 32 },
      { key: 'comp2', width: 22 },
      { key: 'comp3', width: 18 },
      { key: 'rotulo', width: 48 },
      { key: 'skus', width: 10 },
      { key: 'caminhos_distintos', width: 18 },
    ],
    compRows,
    'FF4A5240',
  );
  writeSheet(wb.addWorksheet('Catálogo 4×3'), CATALOG_HEADERS, factRows, 'FF2D5016');
  writeSheet(
    wb.addWorksheet('Catálogo unificado'),
    [
      ...CATALOG_HEADERS.slice(0, 6),
      ...CATALOG_HEADERS.slice(6),
      { key: 'categoria_origem', width: 22 },
      { key: 'subcategoria_origem', width: 22 },
    ].filter((h, i, arr) => arr.findIndex((x) => x.key === h.key) === i),
    unifiedFactRows,
    'FF1E3A5F',
  );

  const pivotWs = wb.addWorksheet('Pivot — metadados');
  pivotWs.columns = [{ width: 22 }, { width: 14 }, { width: 18 }, { width: 48 }, { width: 24 }];
  pivotWs.getCell('B2').value = 'Metadados — Tabela dinâmica (aba Catálogo 4×3)';
  pivotWs.getCell('B2').font = { bold: true, size: 13 };

  const metaHeaders = pivotWs.getRow(4);
  metaHeaders.values = [null, 'campo', 'tipo', 'area_pivot', 'descrição', 'exemplo'];
  styleHeader(metaHeaders, 'FF6B7280');

  const metaRows = [
    ['codigo_4x', 'texto', 'Filtro / Linha', 'Código A01AB', 'A01AB'],
    ['legenda', 'texto', '—', 'Caminho legível', 'Edificações · Alvenaria · Estrutura · Armaduras'],
    ['etapa', 'texto', 'Filtro / Linha', 'Nível 1 — prefixo a./b./c.', 'a. Edificações'],
    ['categoria', 'texto', 'Linha', 'Nível 2', '01. Alvenaria'],
    ['subcategoria', 'texto', 'Linha', 'Nível 3', 'Pontos de água · Canos e conexões'],
    ['linha', 'texto', 'Linha', 'Nível 4 — família / gama', 'Torneiras Premium · Soldável'],
    ['comp1', 'texto', 'Coluna', 'Produto de compra', 'Estribo'],
    ['comp2', 'texto', 'Coluna', 'Variante principal', '7×17'],
    ['comp3', 'texto', 'Coluna', 'Variante secundária', '(vazio)'],
    ['qtd_sku', 'número', 'Valores', 'Sempre 1', '1'],
    ['ambiente', 'texto', 'Filtro', 'Banheiro · Cozinha (fora do drill)', 'Banheiro'],
    ['linha_3x', 'texto', 'Filtro', 'Linha intermédia 3×3 (auditoria)', 'Pontos de água|Torneiras Premium'],
  ];

  metaRows.forEach((vals, i) => {
    const row = pivotWs.getRow(5 + i);
    row.values = [null, ...vals];
    row.alignment = { wrapText: true, vertical: 'top' };
  });

  pivotWs.views = [{ state: 'frozen', ySplit: 4 }];

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  fs.copyFileSync(OUT, OUT_LEGACY);

  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-catalogo-4x3.xlsx');
  } catch {
    /* ok */
  }

  console.log(`[export:catalogo-4x3] ${factRows.length} SKUs → ${OUT}`);
  console.log(`  · ETAPA·CATEGORIA·SUB·LINHA: ${drillRows.length} caminhos`);
  console.log(`  · Visão unificada: ${unifiedDrillRows.length} caminhos`);
  console.log(`  · Componentes ×3: ${compRows.length} padrões`);
  console.log(`  · Cópia legado: ${OUT_LEGACY}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
