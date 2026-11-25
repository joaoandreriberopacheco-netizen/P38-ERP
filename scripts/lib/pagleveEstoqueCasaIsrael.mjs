/**
 * Estoque exportado para Casa Israel (SIAH) — referência e descrição fiáveis no negócio.
 * Colunas: código | formato | descrição | quantidade.
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs');

function cellStr(v) {
  if (v == null) return '';
  if (typeof v === 'object' && v.text != null) return String(v.text).trim();
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

/** Último ficheiro `ESTOQUE PARA CASA ISRAEL*.XLSX` em docs/ (ou env). */
export function resolveEstoqueCasaIsraelPath() {
  const fromEnv = String(process.env.PAGLEVE_ESTOQUE_CASA_ISRAEL || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  if (!fs.existsSync(DOCS_DIR)) return '';
  const candidates = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => /^ESTOQUE PARA CASA ISRAEL/i.test(f) && /\.xlsx$/i.test(f))
    .map((f) => path.join(DOCS_DIR, f))
  ;
  if (!candidates.length) return '';
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0];
}

/**
 * @returns {Map<string, { codigo: string, formato: string, descricao: string, qtd: number|null }>}
 */
export async function loadEstoqueCasaIsrael(filePath = resolveEstoqueCasaIsraelPath()) {
  const map = new Map();
  if (!filePath || !fs.existsSync(filePath)) return map;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) return map;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const codigo = cellStr(row.getCell(1).value).replace(/\.0+$/, '').trim();
    const formato = cellStr(row.getCell(2).value).replace(/×/g, 'X');
    const descricao = cellStr(row.getCell(3).value);
    const qtdRaw = row.getCell(4).value;
    const qtd =
      typeof qtdRaw === 'number' && Number.isFinite(qtdRaw)
        ? qtdRaw
        : Number(String(qtdRaw ?? '').replace(',', '.'));
    if (!codigo || !descricao) return;
    map.set(codigo, {
      codigo,
      formato,
      descricao,
      qtd: Number.isFinite(qtd) ? qtd : null,
    });
  });

  return map;
}