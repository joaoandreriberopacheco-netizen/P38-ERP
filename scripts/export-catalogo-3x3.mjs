#!/usr/bin/env node
/**
 * Excel catálogo modelo 3×3 — monitor Smart Supply / Novo Ecosistema.
 *
 *   npm run export:catalogo-3x3
 *
 * Abas:
 *   1. README
 *   2. ETAPA · CATEGORIA · LINHA — caminhos drill-down únicos (com prefixo a./b./c.)
 *   3. Visão unificada — caminhos com Acabamentos de domínio colapsado em Instalações
 *   4. Componentes ×3   — padrões de nome SKU (Comp1 | Comp2 | Comp3)
 *   5. Catálogo 3×3     — um SKU por linha (modelo completo)
 *   6. Catálogo unificado — mesmo catálogo com etapa_u / categoria_u / linha_u
 *   7. Pivot — metadados — guia para tabela dinâmica
 *
 * Fonte: docs/exports/P38-sku-hierarquia-core.xlsx (+ enriquecimento ab.xlsx)
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { cellStr, to3x3 } from './lib/catalogo3x3Map.mjs';

const EXPORTS = path.join(process.cwd(), 'docs', 'exports');
const CORE_PATH = path.join(EXPORTS, 'P38-sku-hierarquia-core.xlsx');
const AB_PATH = path.join(EXPORTS, 'P38-sku-hierarquia-ab.xlsx');
const OUT = path.join(EXPORTS, 'P38-catalogo-3x3.xlsx');

function styleHeader(row, color = 'FF2D5016') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function key3(...parts) {
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

  ws.getCell('B2').value = 'P38 — Catálogo modelo 3×3';
  ws.getCell('B2').font = { bold: true, size: 16, color: { argb: 'FF2D5016' } };

  const lines = [
    ['Gerado em', stats.generatedAt],
    ['SKUs', stats.skuCount],
    ['Caminhos drill-down (completo)', stats.drillPaths],
    ['Caminhos visão unificada', stats.unifiedDrillPaths],
    ['Padrões componente (×3)', stats.compPatterns],
    ['', ''],
    ['Modelo', ''],
    ['Drill-down (3 colunas)', 'ETAPA > CATEGORIA > LINHA  (ex.: a. Edificações > 01. Alvenaria > Armaduras)'],
    ['Componente SKU (3 colunas)', 'comp1 | comp2 | comp3  (ex.: Estribo | 7×17 | vazio)'],
    ['Visão unificada (opcional)', 'Aba 3 e Catálogo unificado — junta hidráulica/elétrica de acabamento com instalação'],
    ['', ''],
    ['Etapas (prefixo ordena)', ''],
    ['a. Edificações', 'Alvenaria, cobertura (forro PVC → c. Acabamentos)'],
    ['b. Instalações', '01. Hidráulica · 02. Elétrica — linhas c&c = canos e conexões (soldável, esgoto, roscável, eletroduto)'],
    ['c. Acabamentos', 'Revestimentos, forro, pintura, portas, 07. Iluminação, 08. Pontos elétricos, 05. Banheiro'],
    ['d. Transversal', 'Itens transversais da obra'],
    ['', ''],
    ['Abas', ''],
    ['2 · ETAPA · CATEGORIA · LINHA', 'Modelo completo — caminhos únicos com prefixo a./b./c.'],
    ['3 · Visão unificada', 'Caminhos com banheiro/iluminação/pontos fundidos em b. Instalações'],
    ['4 · Componentes ×3', 'Dimensão identidade — padrões únicos Comp1+Comp2+Comp3'],
    ['5 · Catálogo 3×3', 'Facto — um SKU por linha (modelo completo)'],
    ['6 · Catálogo unificado', 'Facto — colunas etapa_u / categoria_u / linha_u para monitor sem camada c.'],
    ['7 · Pivot — metadados', 'Campos, tipos e sugestões para tabela dinâmica'],
    ['', ''],
    ['Regenerar', 'npm run export:catalogo-3x3'],
    ['Fonte', 'P38-sku-hierarquia-core.xlsx + P38-sku-hierarquia-ab.xlsx'],
    ['Tags', 'Fase posterior — não incluídas neste Excel'],
  ];

  let r = 3;
  for (const [a, b] of lines) {
    ws.getCell(`B${r}`).value = a;
    ws.getCell(`C${r}`).value = b;
    if (a === 'Modelo' || a === 'Abas') ws.getCell(`B${r}`).font = { bold: true };
    r += 1;
  }
}

function writeSheet(ws, headers, dataRows, headerColor = 'FF2D5016') {
  ws.columns = headers.map((h) => ({ header: h.key, key: h.key, width: h.width || 18 }));
  styleHeader(ws.getRow(1), headerColor);
  for (const row of dataRows) ws.addRow(row);
  if (dataRows.length) {
    ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}${dataRows.length + 1}` };
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

async function main() {
  const abLookup = await loadAbLookup();
  const catalogRows = await loadCatalogRows();

  const skus3x3 = catalogRows.map((row) => {
    const cod = cellStr(row.codigo_interno).toUpperCase();
    return to3x3(row, abLookup.get(cod));
  });

  // --- Dimensão ETAPA > CATEGORIA > LINHA ---
  const drillMap = new Map();
  for (const row of skus3x3) {
    const k = key3(row.etapa, row.categoria, row.linha);
    if (!drillMap.has(k)) {
      drillMap.set(k, {
        etapa: row.etapa,
        categoria: row.categoria,
        linha: row.linha,
        skus: 0,
        produtos_compra: new Set(),
      });
    }
    const e = drillMap.get(k);
    e.skus += 1;
    if (row.comp1) e.produtos_compra.add(row.comp1);
  }
  const drillRows = [...drillMap.values()]
    .sort((a, b) => key3(a.etapa, a.categoria, a.linha).localeCompare(key3(b.etapa, b.categoria, b.linha)))
    .map((e) => ({
      etapa: e.etapa,
      categoria: e.categoria,
      linha: e.linha,
      skus: e.skus,
      produtos_compra: e.produtos_compra.size,
      caminho: `${e.etapa} > ${e.categoria} > ${e.linha}`,
    }));

  // --- Dimensão componentes ×3 ---
  const compMap = new Map();
  for (const row of skus3x3) {
    const k = key3(row.comp1, row.comp2, row.comp3);
    if (!compMap.has(k)) {
      compMap.set(k, { comp1: row.comp1, comp2: row.comp2, comp3: row.comp3, skus: 0, caminhos: new Set() });
    }
    const e = compMap.get(k);
    e.skus += 1;
    e.caminhos.add(`${row.etapa} > ${row.categoria} > ${row.linha}`);
  }
  const compRows = [...compMap.values()]
    .sort((a, b) => b.skus - a.skus || key3(a.comp1, a.comp2, a.comp3).localeCompare(key3(b.comp1, b.comp2, b.comp3)))
    .map((e) => ({
      comp1: e.comp1,
      comp2: e.comp2,
      comp3: e.comp3,
      skus: e.skus,
      caminhos_distintos: e.caminhos.size,
      rotulo: [e.comp1, e.comp2, e.comp3].filter(Boolean).join(' · '),
    }));

  // --- Facto catálogo ---
  const factRows = skus3x3
    .sort((a, b) => key3(a.etapa, a.categoria, a.linha, a.comp1).localeCompare(key3(b.etapa, b.categoria, b.linha, b.comp1)))
    .map((row) => ({
      etapa: row.etapa,
      categoria: row.categoria,
      linha: row.linha,
      comp1: row.comp1,
      comp2: row.comp2,
      comp3: row.comp3,
      codigo_interno: row.codigo_interno,
      novo_sku: row.novo_sku,
      sku_atual: row.sku_atual,
      caminho: `${row.etapa} > ${row.categoria} > ${row.linha}`,
      rotulo_componente: [row.comp1, row.comp2, row.comp3].filter(Boolean).join(' · '),
      qtd_sku: 1,
      etapa_origem: row.etapa_origem,
      core_origem: row.core_origem,
      linha_origem: row.linha_origem,
    }));

  const unifiedDrillMap = new Map();
  for (const row of skus3x3) {
    const k = key3(row.etapa_u, row.categoria_u, row.linha_u);
    if (!unifiedDrillMap.has(k)) {
      unifiedDrillMap.set(k, {
        etapa: row.etapa_u,
        categoria: row.categoria_u,
        linha: row.linha_u,
        skus: 0,
        produtos_compra: new Set(),
      });
    }
    const e = unifiedDrillMap.get(k);
    e.skus += 1;
    if (row.comp1) e.produtos_compra.add(row.comp1);
  }
  const unifiedDrillRows = [...unifiedDrillMap.values()]
    .sort((a, b) => key3(a.etapa, a.categoria, a.linha).localeCompare(key3(b.etapa, b.categoria, b.linha)))
    .map((e) => ({
      etapa: e.etapa,
      categoria: e.categoria,
      linha: e.linha,
      skus: e.skus,
      produtos_compra: e.produtos_compra.size,
      caminho: `${e.etapa} > ${e.categoria} > ${e.linha}`,
    }));

  const unifiedFactRows = skus3x3
    .sort((a, b) => key3(a.etapa_u, a.categoria_u, a.linha_u, a.comp1).localeCompare(key3(b.etapa_u, b.categoria_u, b.linha_u, b.comp1)))
    .map((row) => ({
      etapa: row.etapa_u,
      categoria: row.categoria_u,
      linha: row.linha_u,
      comp1: row.comp1,
      comp2: row.comp2,
      comp3: row.comp3,
      codigo_interno: row.codigo_interno,
      novo_sku: row.novo_sku,
      sku_atual: row.sku_atual,
      caminho: `${row.etapa_u} > ${row.categoria_u} > ${row.linha_u}`,
      rotulo_componente: [row.comp1, row.comp2, row.comp3].filter(Boolean).join(' · '),
      qtd_sku: 1,
      etapa_origem: row.etapa,
      categoria_origem: row.categoria,
      linha_origem: row.linha,
    }));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 export:catalogo-3x3';
  wb.created = new Date();

  wb.addWorksheet('README');
  buildReadme(wb, {
    generatedAt: new Date().toISOString(),
    skuCount: factRows.length,
    drillPaths: drillRows.length,
    unifiedDrillPaths: unifiedDrillRows.length,
    compPatterns: compRows.length,
  });

  writeSheet(
    wb.addWorksheet('ETAPA · CATEGORIA · LINHA'),
    [
      { key: 'etapa', width: 18 },
      { key: 'categoria', width: 28 },
      { key: 'linha', width: 28 },
      { key: 'caminho', width: 52 },
      { key: 'skus', width: 10 },
      { key: 'produtos_compra', width: 16 },
    ],
    drillRows,
    'FF4A5240',
  );

  writeSheet(
    wb.addWorksheet('Visão unificada'),
    [
      { key: 'etapa', width: 20 },
      { key: 'categoria', width: 28 },
      { key: 'linha', width: 28 },
      { key: 'caminho', width: 52 },
      { key: 'skus', width: 10 },
      { key: 'produtos_compra', width: 16 },
    ],
    unifiedDrillRows,
    'FF1E3A5F',
  );

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

  writeSheet(
    wb.addWorksheet('Catálogo 3×3'),
    [
      { key: 'etapa', width: 16 },
      { key: 'categoria', width: 24 },
      { key: 'linha', width: 22 },
      { key: 'comp1', width: 28 },
      { key: 'comp2', width: 20 },
      { key: 'comp3', width: 16 },
      { key: 'codigo_interno', width: 14 },
      { key: 'novo_sku', width: 42 },
      { key: 'caminho', width: 48 },
      { key: 'rotulo_componente', width: 40 },
      { key: 'qtd_sku', width: 10 },
      { key: 'sku_atual', width: 36 },
      { key: 'etapa_origem', width: 24 },
      { key: 'core_origem', width: 22 },
      { key: 'linha_origem', width: 22 },
    ],
    factRows,
    'FF2D5016',
  );

  writeSheet(
    wb.addWorksheet('Catálogo unificado'),
    [
      { key: 'etapa', width: 18 },
      { key: 'categoria', width: 24 },
      { key: 'linha', width: 24 },
      { key: 'comp1', width: 28 },
      { key: 'comp2', width: 20 },
      { key: 'comp3', width: 16 },
      { key: 'codigo_interno', width: 14 },
      { key: 'novo_sku', width: 42 },
      { key: 'caminho', width: 48 },
      { key: 'rotulo_componente', width: 40 },
      { key: 'qtd_sku', width: 10 },
      { key: 'sku_atual', width: 36 },
      { key: 'etapa_origem', width: 18 },
      { key: 'categoria_origem', width: 22 },
      { key: 'linha_origem', width: 22 },
    ],
    unifiedFactRows,
    'FF1E3A5F',
  );

  const pivotWs = wb.addWorksheet('Pivot — metadados');
  pivotWs.columns = [{ width: 22 }, { width: 14 }, { width: 18 }, { width: 48 }, { width: 24 }];

  pivotWs.getCell('B2').value = 'Metadados — Tabela dinâmica (aba Catálogo 3×3)';
  pivotWs.getCell('B2').font = { bold: true, size: 13 };

  const metaHeaders = pivotWs.getRow(4);
  metaHeaders.values = [null, 'campo', 'tipo', 'area_pivot', 'descrição', 'exemplo'];
  styleHeader(metaHeaders, 'FF6B7280');

  const metaRows = [
    ['etapa', 'texto', 'Filtro / Linha', 'Macro-etapa (nível 1) — prefixo a./b./c.', 'a. Edificações'],
    ['categoria', 'texto', 'Linha', 'Sub-ramo (nível 2)', '01. Alvenaria · 07. Iluminação'],
    ['linha', 'texto', 'Linha', 'Família operacional (nível 3)', 'Armaduras · Eletroduto · Lâmpadas'],
    ['comp1', 'texto', 'Coluna', 'Produto de compra / peça', 'Estribo'],
    ['comp2', 'texto', 'Coluna', 'Variante principal (medida, cor…)', '7×17'],
    ['comp3', 'texto', 'Coluna', 'Variante secundária ou marca', '(vazio)'],
    ['codigo_interno', 'texto', 'Filtro', 'ID único P38', 'S58-EAP'],
    ['novo_sku', 'texto', '—', 'Nome comercial sugerido', ''],
    ['caminho', 'texto', '—', 'ETAPA > CATEGORIA > LINHA concatenado', ''],
    ['rotulo_componente', 'texto', '—', 'comp1 · comp2 · comp3 concatenado', ''],
    ['qtd_sku', 'número', 'Valores', 'Sempre 1 — usar Σ para contar SKUs', '1'],
    ['etapa_origem', 'texto', 'Filtro', 'Campo legado estudo (auditoria)', '1 — Estrutura / alvenaria'],
    ['core_origem', 'texto', 'Filtro', 'Core legado estudo (auditoria)', 'ARMADURA'],
    ['linha_origem', 'texto', 'Filtro', 'LINHA legado (auditoria)', 'MATERIAIS BÁSICOS·N'],
  ];

  metaRows.forEach((vals, i) => {
    const row = pivotWs.getRow(5 + i);
    row.values = [null, ...vals];
    row.alignment = { wrapText: true, vertical: 'top' };
  });

  const sugRow = 5 + metaRows.length + 2;
  pivotWs.getCell(`B${sugRow}`).value = 'Sugestões de pivot';
  pivotWs.getCell(`B${sugRow}`).font = { bold: true };

  const sugestoes = [
    'Monitor por corredor: Linhas = etapa + categoria + linha · Valores = Σ qtd_sku',
    'Visão unificada: usar aba Catálogo unificado (hidráulica/elétrica de acabamento junta com instalação)',
    'Produtos por etapa: Linhas = etapa · Colunas = comp1 · Valores = Σ qtd_sku',
    'Variantes: Linhas = comp1 · Colunas = comp2 · Filtro = linha · Valores = Σ qtd_sku',
    'Auditoria legado: Linhas = core_origem · Colunas = linha_origem · Filtro = etapa',
  ];
  sugestoes.forEach((s, i) => {
    pivotWs.getCell(`B${sugRow + 1 + i}`).value = `${i + 1}. ${s}`;
    pivotWs.getCell(`B${sugRow + 1 + i}`).alignment = { wrapText: true };
  });

  pivotWs.views = [{ state: 'frozen', ySplit: 4 }];

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-catalogo-3x3.xlsx');
  } catch {
    /* ok */
  }

  console.log(`[export:catalogo-3x3] ${factRows.length} SKUs → ${OUT}`);
  console.log(`  · ETAPA·CATEGORIA·LINHA: ${drillRows.length} caminhos`);
  console.log(`  · Visão unificada: ${unifiedDrillRows.length} caminhos`);
  console.log(`  · Componentes ×3: ${compRows.length} padrões`);
  console.log(`  · Abas: ${wb.worksheets.map((w) => w.name).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
