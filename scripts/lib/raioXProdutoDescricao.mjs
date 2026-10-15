/**
 * "Raio-X" de produto a partir da descrição do ERP (ex. relatório SIAH / estoque).
 * Campos pedidos: código, formato, modelo, m²/cx, acabamento (bold/RT), superfície.
 */
import { normFmt, sanitizeTintaoDesc, stripAccents } from './formigresCatalog.mjs';

const TIPO_RE = /^(PISO|REV\.?|REVESTIMENTO|PORCELANATO)\b/i;

const MODELO_NOISE_RE =
  /\b(A|PEI\s*\w*|LD|LC|JU|LA|LB|LE|LU|ESM|HD|MRE|MRU|EXT|AD|PE|PLUS|LUX|PRIME|ROCHAPRIME|ROCHAMAXX?|G\d+)\b/gi;

/**
 * @param {string} codigo
 * @param {string} descricao — só a descrição (sem código) ou linha completa com código
 */
export function raioXProdutoDescricao(codigo, descricao) {
  let raw = sanitizeTintaoDesc(descricao || '');
  const codeFromLine = raw.match(/^(\d{4,5})\s+/);
  const codigoFinal = String(codigo || codeFromLine?.[1] || '').trim();
  if (codeFromLine) raw = raw.replace(/^\d{4,5}\s+/, '');

  const formato = normFmt(raw);
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
  if (formato) modelo = modelo.replace(new RegExp(formato.replace('x', '[xX]'), 'i'), ' ');
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
