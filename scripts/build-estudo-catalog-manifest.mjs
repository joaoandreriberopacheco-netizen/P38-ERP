#!/usr/bin/env node
/**
 * Gera manifest JSON a partir do Excel de estudo (P38-sku-hierarquia-ab.xlsx).
 * Fonte canónica: o Excel — sem overrides JSON. Actualizar o xlsx e regenerar.
 *
 *   npm run estudo:catalog-manifest
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const EXCEL_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');
const LINHAS_JSON = path.join(process.cwd(), 'src', 'data', 'hierarquiaPortalLinhas.json');
const OUT = path.join(process.cwd(), 'src', 'data', 'estudoCatalogManifest.generated.json');

const DATA_SHEETS = [
  'A — Edificações',
  'B — Hidráulica',
  'B — Elétrica',
  'C — Acabamentos (prévia)',
  'C prévia — elétrica visível',
];

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function normLinha(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/·[NRC]$/i, '')
    .trim()
    .toUpperCase();
}

function loadLinhasMestre() {
  const raw = JSON.parse(fs.readFileSync(LINHAS_JSON, 'utf8'));
  const byNome = new Map();
  const byCodigo = new Map();
  for (const l of raw.linhas || []) {
    byNome.set(normLinha(l.nome), l);
    byCodigo.set(normLinha(l.codigo), l);
  }
  return { byNome, byCodigo, version: raw.version };
}

function resolveLinhaMeta(linhaCell, { byNome, byCodigo }) {
  const base = normLinha(linhaCell);
  return byNome.get(base) || byCodigo.get(base) || {
    codigo: base.replace(/[^A-Z0-9]+/g, '_').slice(0, 48) || 'OUTROS',
    nome: String(linhaCell || '').trim() || 'OUTROS',
    tipo: 'mix',
    ordem: 900,
    grupo: 'fallback',
  };
}

async function readSheet(ws, linhasIndex) {
  const headerRow = ws.getRow(1);
  const idx = {};
  const headers = [];
  for (let c = 1; c <= headerRow.cellCount; c += 1) {
    const h = cellStr(headerRow.getCell(c));
    if (!h) continue;
    if (idx[h] == null) {
      idx[h] = c;
      headers.push(h);
    }
  }
  const rows = [];

  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const get = (k) => cellStr(row.getCell(idx[k]));
    const codigo = get('codigo_interno');
    if (!codigo) continue;

    const linhaCell = get('linha');
    const meta = resolveLinhaMeta(linhaCell, linhasIndex);
    const pathway = (() => {
      const match = linhaCell.match(/^(.*)·([NRC])$/i);
      if (!match) return { sufixo: '', papel: 'default' };
      const sufixo = match[2].toUpperCase();
      const papel = { N: 'nucleo', C: 'complemento', R: 'receita' }[sufixo] || 'default';
      return { sufixo, papel };
    })();
    const pc = get('produto_compra');
    const solo = meta.tipo === 'solo';

    rows.push({
      bloco: get('bloco'),
      sub_bloco: get('sub_bloco'),
      grupo: get('grupo'),
      grupo_ordem: Number(get('grupo_ordem')) || 0,
      etapa: get('etapa'),
      core: get('core') || '',
      linha: linhaCell,
      linha_display: linhaCell.replace(/·[NRC]$/i, '').trim() || linhaCell,
      pathway_sufixo: pathway.sufixo,
      pathway_papel: pathway.papel,
      linha_pathway_key: pathway.sufixo ? `${meta.codigo}::${pathway.sufixo}` : meta.codigo,
      linha_codigo: meta.codigo,
      linha_nome: meta.nome,
      linha_tipo: meta.tipo,
      linha_ordem: meta.ordem ?? 900,
      linha_grupo: meta.grupo || '',
      produto_compra: solo ? '' : pc,
      produto_compra_nome: solo ? '' : pc,
      eixo_a: get('eixo_a'),
      eixo_b: get('eixo_b'),
      codigo_interno: codigo.toUpperCase(),
      novo_sku: get('novo_sku') || get('sku_atual'),
      sku_atual: get('sku_atual'),
      status_mix: get('status_mix') || 'tem',
      solo,
    });
  }
  return rows;
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel não encontrado: ${EXCEL_PATH}`);
  }

  const linhasIndex = loadLinhasMestre();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const skus = [];
  const sheetsRead = [];

  for (const name of DATA_SHEETS) {
    const ws = wb.getWorksheet(name);
    if (!ws) {
      console.warn(`[estudo-manifest] folha omitida (não existe): ${name}`);
      continue;
    }
    const part = await readSheet(ws, linhasIndex);
    skus.push(...part);
    sheetsRead.push({ name, count: part.length });
  }

  const linhasMap = new Map();
  for (const row of skus) {
    if (!linhasMap.has(row.linha_codigo)) {
      linhasMap.set(row.linha_codigo, {
        codigo: row.linha_codigo,
        nome: row.linha_nome,
        tipo: row.linha_tipo,
        ordem: row.linha_ordem,
        grupo: row.linha_grupo,
        sku_count: 0,
      });
    }
    linhasMap.get(row.linha_codigo).sku_count += 1;
  }

  const blocosMap = new Map();
  for (const row of skus) {
    const k = `${row.bloco}\x00${row.sub_bloco}\x00${row.grupo || ''}`;
    if (!blocosMap.has(k)) {
      blocosMap.set(k, {
        bloco: row.bloco,
        sub_bloco: row.sub_bloco,
        grupo: row.grupo || '',
        sku_count: 0,
      });
    }
    blocosMap.get(k).sku_count += 1;
  }

  const payload = {
    version: new Date().toISOString().slice(0, 10),
    source: 'docs/exports/P38-sku-hierarquia-ab.xlsx',
    linhas_mestre_version: linhasIndex.version,
    sheets: sheetsRead,
    count: skus.length,
    linhas: [...linhasMap.values()].sort((a, b) => a.ordem - b.ordem),
    blocos: [...blocosMap.values()],
    skus,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[estudo-manifest] ${skus.length} SKUs → ${OUT} (fonte: Excel, sem overrides)`);
  for (const s of sheetsRead) console.log(`  · ${s.name}: ${s.count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
