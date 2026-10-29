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

const ROCHA_SIAH_CODE_RE = /^(PR|R)\d{3,}$/i;

/** Nome que não serve para vitrine (código loja, PR/R SIAH, só HD Incopisos). */
export function nomePareceCodigoFabricante(nome = '') {
  const s = String(nome || '').trim();
  if (!s || s.length < 2) return true;
  if (/^\d{4,5}$/.test(s)) return true;
  if (ROCHA_SIAH_CODE_RE.test(s)) return true;
  const hd = stripAccents(s).toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ');
  if (/^HD\s*\d+$/.test(hd)) return true;
  return false;
}

function limparPontuacaoModelo(modelo = '') {
  return String(modelo || '')
    .replace(/^\.\s*/, '')
    .trim();
}

/** "PEI: LD" no ERP vira "PEI LD" para não sobrar só ":" no modelo. */
function normalizarPeiColonNoTexto(text = '') {
  return String(text || '').replace(/PEI\s*:\s*/gi, 'PEI ');
}

function modeloSoPontuacao(s = '') {
  return !String(s || '').replace(/[^a-zA-Z0-9]/g, '').trim();
}

/** Referência Rochaprime/Rochamaxx na descrição SIAH (ex. PR70971). */
export function referenciaRochaprimeErp(descricao = '') {
  const raw = String(descricao || '');
  if (!/ROCHAPRIME|ROCHAMAXX|ROCHAFORTE/i.test(raw)) return '';
  const m = raw.match(/\b(PR|R)(\d{3,})\b/i);
  if (!m) return '';
  return `${m[1].toUpperCase()}${m[2]}`;
}

/**
 * Referência no catálogo portal Rocha (ex. PR70971 → PR7097).
 * Mesma regra do slug: 5+ dígitos terminados em 1 perdem o último 1.
 */
export function referenciaRochaprimeCatalogo(descricao = '') {
  const erp = referenciaRochaprimeErp(descricao);
  if (!erp) return '';
  const m = erp.match(/^(PR|R)(\d+)$/i);
  if (!m) return erp;
  let digits = m[2];
  if (digits.length >= 5 && digits.endsWith('1')) digits = digits.slice(0, -1);
  return `${m[1].toUpperCase()}${digits}`;
}

function nomeFromDescricaoNoSite(descricaoNoSite = '') {
  const first = String(descricaoNoSite || '').split('·')[0].trim();
  if (!first || nomePareceCodigoFabricante(first)) return '';
  return titleCaseModelo(limparPontuacaoModelo(first));
}

/** Rochaprime: texto entre formato e ROCHAPRIME (ex. BEGE em R7041). */
function extractTextBetweenFormatoAndRochaprime(descricao = '') {
  const raw = String(descricao || '');
  const m = raw.match(/\d{1,3}\s*[x×]\s*\d{1,3}\s+(.+?)\s+ROCHAPRIME/i);
  if (!m) return '';
  let chunk = m[1]
    .replace(/\b(PR|R)\d+\b/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(
      /\b(RT|RET|RETI|POLIDO|POL|PLD|MATE|MATTE|ACETINAD\w*|GRANILHAD\w*|BRILH\w*)\b/gi,
      ' ',
    )
    .replace(MODELO_NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!chunk || chunk.length < 2 || nomePareceCodigoFabricante(chunk)) return '';
  return titleCaseModelo(chunk);
}

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
 * @param {string} [descricaoNoSite] — título da ficha oficial (primeiro segmento antes de ·)
 */
export function modeloComercialCatalogo(codigo, descricao = '', modeloField = '', descricaoNoSite = '') {
  const desc = normalizarPeiColonNoTexto(String(descricao || '').trim());
  let campo = String(modeloField || '').trim();
  if (modeloFieldPareceErroDigitacao(campo)) campo = '';
  campo = limparPontuacaoModelo(campo);

  const rx = raioXProdutoDescricao(codigo, desc || campo);
  let modelo = rx.modelo || campo;
  modelo = normalizarPeiColonNoTexto(modelo);
  modelo = modelo.replace(/\bJUNTA\s*\d+\s*MM\b/gi, ' ');
  modelo = modelo.replace(/^\s*\d{1,2}\s*[x×]\s*\d{1,2}\s*/gi, ' ');
  modelo = modelo.replace(/^0\s*[x×]\s*\d+\s*/gi, ' ');
  modelo = modelo.replace(FABRICA_PREFIX_RE, ' ');
  modelo = modelo.replace(/\b(POL|POLIDO|SEMI|GRES)\b/gi, ' ');
  modelo = modelo.replace(/["'`]+/g, ' ');
  modelo = modelo.replace(MODELO_NOISE_RE, ' ');
  modelo = modelo.replace(/[:;]+/g, ' ').replace(/\s+/g, ' ').trim();
  modelo = modelo.replace(/\s+[a-z]\s*$/i, '').trim();
  modelo = limparPontuacaoModelo(modelo);

  const low = stripAccents(modelo).toLowerCase();
  if (/nero\s*portor/i.test(low)) return 'Nero Portorio';
  if (/^asphalt\b/.test(low)) return 'Asphalt';

  let result = titleCaseModelo(modelo);
  const refCat = referenciaRochaprimeCatalogo(desc);

  if (refCat && ROCHA_SIAH_CODE_RE.test(String(result).replace(/\s/g, ''))) return refCat;

  if (!modeloSoPontuacao(result) && !nomePareceCodigoFabricante(result)) return result;

  const fromSite = nomeFromDescricaoNoSite(descricaoNoSite);
  if (fromSite) return fromSite;

  const fromRocha = extractTextBetweenFormatoAndRochaprime(desc);
  if (fromRocha) return fromRocha;

  if (campo && !nomePareceCodigoFabricante(campo)) return titleCaseModelo(campo);

  if (refCat) return refCat;

  return result;
}

/**
 * @param {string} codigo
 * @param {string} descricao — só a descrição (sem código) ou linha completa com código
 */
export function raioXProdutoDescricao(codigo, descricao) {
  let raw = sanitizeTintaoDesc(normalizarPeiColonNoTexto(descricao || ''));
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
  // m²/caixa (2,16) — não confundir com referência Incopisos (HD 160.105)
  modelo = modelo.replace(/\(\s*\d+[,.]\d+\s*\)/g, ' ');
  modelo = modelo.replace(/["']/g, ' ');
  modelo = modelo.replace(/\b(RT|RET|RETI|BOLD)\b/gi, ' ');
  modelo = modelo.replace(
    /\b(POLIDO|POL|PLD|MATE|MATTE|ACETINADO|ACET|BRILHANTE|BRILHO|GRANILHADO|LAPADATO|ESMALTADO)\b/gi,
    ' ',
  );
  modelo = modelo.replace(MODELO_NOISE_RE, ' ');
  modelo = modelo.replace(/\bJUNTA\s*\d+\s*MM\b/gi, ' ');
  modelo = modelo.replace(/[:;]+/g, ' ').replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!modelo || modeloSoPontuacao(modelo)) {
    const ref = referenciaRochaprimeCatalogo(raw);
    if (ref) modelo = ref;
  } else if (ROCHA_SIAH_CODE_RE.test(modelo.replace(/\s/g, ''))) {
    const ref = referenciaRochaprimeCatalogo(raw);
    if (ref) modelo = ref;
  }

  const hdRef = modelo.match(/\(\s*HD\s+([0-9][0-9.]+)\s*\)/i);
  if (hdRef && !modelo.replace(/\(\s*HD\s+[0-9][0-9.]+\s*\)/i, '').trim()) {
    modelo = `HD ${hdRef[1].replace(/\./g, '')}`;
  }
  modelo = modelo.replace(/\(\s*HD\s+[0-9][0-9.]+\s*\)/gi, ' ').replace(/\s+/g, ' ').trim();

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
