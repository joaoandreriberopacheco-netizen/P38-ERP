/**
 * "Raio-X" de produto a partir da descrição do ERP (ex. relatório SIAH / estoque).
 * Campos pedidos: código, formato, modelo, m²/cx, acabamento (bold/RT), superfície.
 */
import { normFmt, sanitizeTintaoDesc, stripAccents } from './formigresCatalog.mjs';
import { resolveFormatoPagLeve } from './pagleveFormatoOcr.mjs';

const TIPO_RE = /^(PISO|REV\.?|REVESTIMENTO|PORCELANATO)\b/i;

const MODELO_NOISE_RE =
  /\b(A|PEI\s*\w*|LD|LC|JU|LA|LB|LE|LU|ESM|HD|MRE|MRU|EXT|AD|PE|PLUS|LUX|PRIME|ROCHAPRIME|ROCHAMAXX?|G\d+)\b/gi;

const FABRICA_PREFIX_RE = /\b(PISO|REV\.?|REVESTIMENTO|PORCELANATO|SEMI\s*GRES?|GRES)\b/gi;

function titleCaseModelo(str = '') {
  return String(str || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Campo `modelo` do fornecedor costuma trazer “5x75 …” ou aspas — não usar como nome comercial. */
export function modeloFieldPareceErroDigitacao(modelo = '') {
  const m = String(modelo || '').trim();
  if (!m || /^\(ver descri/i.test(m)) return true;
  if (/^\d{1,2}\s*[x×]\s*\d/i.test(m)) return true;
  if (/^0\s*[x×]\s*\d/i.test(m)) return true;
  if (/["'`]\s*$/.test(m)) return true;
  return false;
}

/**
 * Nome para catálogo (fábrica): só o modelo, sem formato OCR nem códigos SIAH.
 */
export function modeloComercialCatalogo(codigo, descricao = '', modeloField = '') {
  const desc = String(descricao || '').trim();
  let campo = String(modeloField || '').trim();
  if (modeloFieldPareceErroDigitacao(campo)) campo = '';

  const rx = raioXProdutoDescricao(codigo, desc || campo);
  let modelo = rx.modelo || campo;
  modelo = modelo.replace(/^\s*\d{1,2}\s*[x×]\s*\d{1,2}\s*/gi, ' ');
  modelo = modelo.replace(/^0\s*[x×]\s*\d+\s*/gi, ' ');
  modelo = modelo.replace(FABRICA_PREFIX_RE, ' ');
  modelo = modelo.replace(/\b(POL|POLIDO|SEMI|GRES)\b/gi, ' ');
  modelo = modelo.replace(/["'`]+/g, ' ');
  modelo = modelo.replace(MODELO_NOISE_RE, ' ');
  modelo = modelo.replace(/\s+/g, ' ').trim();
  modelo = modelo.replace(/\s+[a-z]\s*$/i, '').trim();

  const low = stripAccents(modelo).toLowerCase();
  if (/nero\s*portor/i.test(low)) return 'Nero Portorio';
  if (/^asphalt\b/.test(low)) return 'Asphalt';

  return titleCaseModelo(modelo);
}

/**
 * @param {string} codigo
 * @param {string} descricao — só a descrição (sem código) ou linha completa com código
 */
export function raioXProdutoDescricao(codigo, descricao) {
  let raw = sanitizeTintaoDesc(descricao || '');
  const codeFromLine = raw.match(/^(\d{4,5})\s+/);
  const codigoFinal = String(codigo || codeFromLine?.[1] || '').trim();
  if (codeFromLine) raw = raw.replace(/^\d{4,5}\s+/, '');

  const formato = resolveFormatoPagLeve(raw, normFmt(raw));
  const m2Match = raw.match(/\((\d+[,.]?\d*)\)/);
  const m2_cx = m2Match ? m2Match[1].replace(',', '.') : '';

  const acab = /\bRT\b|\bRET\b|\bRETI\b/i.test(raw) ? 'RT' : 'bold';

  let superficie = 'não especificado';
  const u = stripAccents(raw).toUpperCase();
  if (/\bACETINAD|\bACET\b/.test(u)) superficie = 'acetinado';
  else if (/\bPOLID|\bPLD\b/.test(u)) superficie = 'polido';
  else if (/\bBRILH|\bBRILHO\b/.test(u)) superficie = 'brilho';
  else if (/\bMATE\b|\bMATTE\b|\bMAT\b(?![A-Z])/.test(u)) superficie = 'mate';
  else if (/\bGRANILH/.test(u)) superficie = 'granilhado';
  else if (/\bLAPAD/.test(u)) superficie = 'lapatto';
  else if (/\bESMALT/.test(u)) superficie = 'esmaltado';

  let modelo = raw;
  modelo = modelo.replace(TIPO_RE, ' ').trim();
  modelo = modelo.replace(FABRICA_PREFIX_RE, ' ');
  if (formato) modelo = modelo.replace(new RegExp(formato.replace('x', '[xX]'), 'i'), ' ');
  modelo = modelo.replace(/^\s*\d{1,2}\s*[x×]\s*\d{1,2}\s*/i, ' ');
  modelo = modelo.replace(/\s*\([^)]*\).*/g, ' ');
  modelo = modelo.replace(/["']/g, ' ');
  modelo = modelo.replace(/\b(RT|RET|RETI|BOLD)\b/gi, ' ');
  modelo = modelo.replace(
    /\b(POLIDO|POL|PLD|MATE|MATTE|ACETINADO|ACET|BRILHANTE|BRILHO|GRANILHADO|LAPADATO|ESMALTADO)\b/gi,
    ' ',
  );
  modelo = modelo.replace(MODELO_NOISE_RE, ' ');
  modelo = modelo.replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim();

  const tipo = (raw.match(TIPO_RE) || [])[0]?.toUpperCase().replace(/\.$/, '') || '';

  return {
    codigo: codigoFinal,
    formato: formato || '',
    modelo,
    m2_cx,
    acab,
    superficie,
    tipo,
    descricao_original: raw,
  };
}
