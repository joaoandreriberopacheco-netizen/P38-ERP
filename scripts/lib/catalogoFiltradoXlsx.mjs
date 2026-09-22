/**
 * Exporta Excel a partir de catálogo 4×3 filtrado (JSON de filtro).
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

function cellStr(v) {
  return String(v ?? '').trim();
}

function styleHeader(row, color = 'FF2D5016') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  row.alignment = { vertical: 'middle', wrapText: true };
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

function produtoKey(etapa, categoria, sub, linha, comp1) {
  return [etapa, categoria, sub, linha, comp1].map(cellStr).join('\x00');
}

function loadFilter(filterPath) {
  const data = JSON.parse(fs.readFileSync(filterPath, 'utf8'));
  const codigos = new Set(
    (data.codigos ?? []).map((c) => cellStr(c).toUpperCase()).filter(Boolean),
  );
  const nomes = data.nomesSupabase ?? {};
  return { data, codigos, nomes };
}

async function readCatalogSheet(catalogPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(catalogPath);
  const ws = wb.getWorksheet('Catálogo 4×3');
  if (!ws) throw new Error('Aba Catálogo 4×3 não encontrada');
  const keys = ws.getRow(1).values.slice(1).map((h) => cellStr(h));
  /** @type {Record<string, string>[]} */
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const obj = {};
    keys.forEach((key, i) => {
      obj[key] = cellStr(row.getCell(i + 1).value);
    });
    if (cellStr(obj.codigo_interno)) rows.push(obj);
  });
  return rows;
}

function sortCatalogRows(rows) {
  return [...rows].sort(
    (a, b) =>
      produtoKey(a.etapa, a.categoria, a.subcategoria, a.linha, a.comp1).localeCompare(
        produtoKey(b.etapa, b.categoria, b.subcategoria, b.linha, b.comp1),
      ) || cellStr(a.codigo_interno).localeCompare(cellStr(b.codigo_interno)),
  );
}

async function loadCatalogRows(catalogPath, codigos) {
  const rows = sortCatalogRows(await readCatalogSheet(catalogPath)).filter((r) =>
    codigos.has(cellStr(r.codigo_interno).toUpperCase()),
  );
  return rows;
}

function supabaseUrl() {
  return (
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://zhonvxkkqabfdyehyxpu.supabase.co'
  );
}

function supabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  );
}

/** @returns {Promise<Record<string, string>>} */
export async function loadNomesSupabasePorCodigos(codigos) {
  const key = supabaseKey();
  if (!key) throw new Error('Supabase key em falta para nomes do cadastro');
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl(), key);
  /** @type {Record<string, string>} */
  const nomes = {};
  const list = [...codigos];
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100);
    const { data, error } = await sb
      .from('produto')
      .select('codigo_interno, nome')
      .in('codigo_interno', batch);
    if (error) throw error;
    for (const r of data ?? []) {
      const cod = cellStr(r.codigo_interno).toUpperCase();
      if (cod) nomes[cod] = cellStr(r.nome);
    }
  }
  return nomes;
}

async function writePack({ rows, nomes, meta, out4x3, outNivel, outUnificado }) {
  const nivel = aggregateNivel(rows);
  const unificado = rows.map((r) => ({
    ...r,
    sku_supabase:
      cellStr(nomes[cellStr(r.codigo_interno).toUpperCase()]) || r.sku_atual || r.novo_sku,
  }));

  for (const [out, build] of [
    [
      out4x3,
      () => {
        const wb = new ExcelJS.Workbook();
        wb.created = new Date();
        wb.addWorksheet('README');
        buildReadme(wb, { ...meta, titulo: meta.titulo4x3 ?? 'Catálogo 4×3' });
        writeSheet(wb.addWorksheet('Catálogo 4×3'), CATALOG_HEADERS, rows);
        return wb;
      },
    ],
    [
      outNivel,
      () => {
        const wb = new ExcelJS.Workbook();
        wb.created = new Date();
        wb.addWorksheet('README');
        buildReadme(wb, { ...meta, titulo: meta.tituloNivel ?? 'Catálogo 4× drill (produto compra)' });
        writeSheet(wb.addWorksheet('Produtos compra'), NIVEL_HEADERS, nivel, 'FF4A5240');
        return wb;
      },
    ],
    [
      outUnificado,
      () => {
        const wb = new ExcelJS.Workbook();
        wb.created = new Date();
        wb.addWorksheet('README');
        buildReadme(wb, { ...meta, titulo: meta.tituloUnificado ?? 'Catálogo unificado + SKU Supabase' });
        writeSheet(wb.addWorksheet('Unificado'), UNIFICADO_HEADERS, unificado, 'FF1E3A5F');
        return wb;
      },
    ],
  ]) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await build().xlsx.writeFile(out);
  }

  return { skus: rows.length, produtosCompra: nivel.length, out4x3, outNivel, outUnificado };
}

function aggregateNivel(rows) {
  /** @type {Map<string, { etapa: string, categoria: string, subcategoria: string, linha: string, produto_compra: string, skus: number }>} */
  const map = new Map();
  for (const r of rows) {
    const pk = produtoKey(r.etapa, r.categoria, r.subcategoria, r.linha, r.comp1);
    if (!map.has(pk)) {
      map.set(pk, {
        etapa: r.etapa,
        categoria: r.categoria,
        subcategoria: r.subcategoria,
        linha: r.linha,
        produto_compra: r.comp1,
        skus: 0,
      });
    }
    map.get(pk).skus += 1;
  }
  return [...map.values()].sort((a, b) =>
    produtoKey(a.etapa, a.categoria, a.subcategoria, a.linha, a.produto_compra).localeCompare(
      produtoKey(b.etapa, b.categoria, b.subcategoria, b.linha, b.produto_compra),
    ),
  );
}

function buildReadme(wb, meta) {
  const ws = wb.getWorksheet('README') || wb.addWorksheet('README');
  ws.columns = [{ width: 4 }, { width: 28 }, { width: 56 }];
  ws.getCell('B2').value = `P38 — ${meta.titulo}`;
  ws.getCell('B2').font = { bold: true, size: 14 };
  const lines = [
    ['Gerado em', meta.generatedAt],
    ['Filtro', meta.kind],
    ['Critério', meta.criterio],
    ['Cutoff', meta.cutoff ?? '—'],
    ['Produtos compra', String(meta.produtosCompra)],
    ['SKUs', String(meta.skus)],
    ['Fonte catálogo', path.basename(meta.catalogPath)],
  ];
  let r = 4;
  for (const [a, b] of lines) {
    ws.getCell(`B${r}`).value = a;
    ws.getCell(`C${r}`).value = b;
    r += 1;
  }
}

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

const NIVEL_HEADERS = [
  { key: 'etapa', width: 18 },
  { key: 'categoria', width: 26 },
  { key: 'subcategoria', width: 22 },
  { key: 'linha', width: 24 },
  { key: 'produto_compra', width: 40 },
  { key: 'skus', width: 10 },
];

const UNIFICADO_HEADERS = [
  ...CATALOG_HEADERS,
  { key: 'sku_supabase', width: 52 },
];

/**
 * @param {{ catalogPath: string, filterPath: string, out4x3: string, outNivel: string, outUnificado: string }} opts
 */
export async function exportCatalogoFiltradoXlsx(opts) {
  const { catalogPath, filterPath, out4x3, outNivel, outUnificado } = opts;
  const { data: filter, codigos, nomes } = loadFilter(filterPath);
  const rows = await loadCatalogRows(catalogPath, codigos);
  const meta = {
    generatedAt: new Date().toISOString(),
    kind: filter.kind ?? 'filtro',
    criterio:
      filter.kind === 'sem-movimento-45d'
        ? `sem estoque · sem movimentação ${filter.diasSemMovimento ?? 45} dias`
        : filter.kind ?? 'filtro',
    cutoff: filter.cutoff,
    produtosCompra: aggregateNivel(rows).length,
    skus: rows.length,
    catalogPath,
    titulo4x3: 'Catálogo 4×3 filtrado',
    tituloNivel: 'Catálogo 4× drill filtrado',
    tituloUnificado: 'Catálogo unificado filtrado + SKU Supabase',
  };
  return writePack({ rows, nomes, meta, out4x3, outNivel, outUnificado });
}

/**
 * Catálogo activo completo — 3 Excel (detalhe, drill, unificado + nome Supabase).
 */
export async function exportCatalogoCompletoXlsx(opts) {
  const { catalogPath, out4x3, outNivel, outUnificado } = opts;
  const rows = sortCatalogRows(await readCatalogSheet(catalogPath));
  const codigos = rows.map((r) => cellStr(r.codigo_interno).toUpperCase()).filter(Boolean);
  const nomes = await loadNomesSupabasePorCodigos(codigos);
  const meta = {
    generatedAt: new Date().toISOString(),
    kind: 'catalogo-completo',
    criterio: 'catálogo activo 4×3 (todos os SKUs)',
    cutoff: '—',
    produtosCompra: aggregateNivel(rows).length,
    skus: rows.length,
    catalogPath,
    titulo4x3: 'Catálogo 4×3 completo',
    tituloNivel: 'Catálogo 4× drill completo (produto compra)',
    tituloUnificado: 'Catálogo unificado completo + SKU Supabase',
  };
  return writePack({ rows, nomes, meta, out4x3, outNivel, outUnificado });
}
