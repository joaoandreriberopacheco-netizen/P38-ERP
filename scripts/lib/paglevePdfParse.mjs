/**
 * Extração de texto de PDFs PagLeve (PRE_OS preços + relatório 510 por marca).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { raioXProdutoDescricao } from './raioXProdutoDescricao.mjs';
import { resolveFormatoPagLeve } from './pagleveFormatoOcr.mjs';

export function pdftotext(filePath) {
  return execSync(`pdftotext ${JSON.stringify(filePath)} -`, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** @typedef {{ codigo_loja: string, classe_pei: string, formato_raw: string, descricao: string, preco_varejo_m2: number, estoque_m2: number|null }} PreOsItem */

function parseBrDecimal(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Linha após M2: só preço ou `preço estoque` na mesma linha. */
function parsePrecoExistAfterM2(val, nextVal) {
  const line = String(val || '').trim();
  const two = line.match(/^(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d+(?:\.\d{3})*,\d{2})$/);
  if (two) {
    return {
      preco_varejo_m2: parseBrDecimal(two[1]),
      estoque_m2: parseBrDecimal(two[2]),
    };
  }
  const preco = parseBrDecimal(line);
  if (preco == null) return null;
  const estoque = nextVal ? parseBrDecimal(nextVal) : null;
  return { preco_varejo_m2: preco, estoque_m2: estoque };
}

const PEI_CLASS_RE = /^(LE|LD|LM|LB|LC|LA|LU|LZ|LW)$/i;

function findClasseAndFormato(rawLines, startIdx, nextNonEmpty) {
  let pos = startIdx;
  let classe_pei = '';
  let formato_raw = '';
  for (let step = 0; step < 12 && pos < rawLines.length; step++) {
    const hit = nextNonEmpty(pos);
    if (!hit) break;
    pos = hit.idx + 1;
    if (PEI_CLASS_RE.test(hit.val)) {
      classe_pei = hit.val.toUpperCase();
      continue;
    }
    if (/^\d{5}$/.test(hit.val)) continue;
    if (/^\d{1,3}X\d{1,3}/i.test(hit.val)) {
      formato_raw = hit.val;
      break;
    }
  }
  if (!classe_pei || !formato_raw) return null;
  return { classe_pei, formato_raw, descStart: pos };
}

/** PRE_OS: código + LE/LD/LM… + formato + descrição + M2 + preço + exist */
export function parsePreOsText(text) {
  const rawLines = text.split(/\n/).map((l) => l.trim());
  /** @type {PreOsItem[]} */
  const items = [];

  function nextNonEmpty(from) {
    for (let k = from; k < rawLines.length; k++) {
      const v = rawLines[k];
      if (v) return { idx: k, val: v };
    }
    return null;
  }

  for (let i = 0; i < rawLines.length; i++) {
    if (!/^\d{5}$/.test(rawLines[i])) continue;
    const codigo_loja = rawLines[i];
    const cf = findClasseAndFormato(rawLines, i + 1, nextNonEmpty);
    if (!cf) continue;

    let j = cf.descStart;
    let descricao = '';
    while (j < rawLines.length) {
      const v = rawLines[j];
      if (v === 'M2') break;
      if (v && !/^\d{5}$/.test(v)) descricao += (descricao ? ' ' : '') + v;
      j++;
    }
    if (rawLines[j] !== 'M2') continue;
    const precoHit = nextNonEmpty(j + 1);
    if (!precoHit) continue;
    const existHit = nextNonEmpty(precoHit.idx + 1);
    const pe = parsePrecoExistAfterM2(
      precoHit.val,
      existHit && !/^\d{5}$/.test(existHit.val) ? existHit.val : null,
    );
    if (!pe || pe.preco_varejo_m2 == null) continue;

    items.push({
      codigo_loja,
      classe_pei: cf.classe_pei,
      formato_raw: cf.formato_raw,
      descricao: descricao.replace(/\s+/g, ' ').trim(),
      preco_varejo_m2: pe.preco_varejo_m2,
      estoque_m2: pe.estoque_m2,
    });
  }
  return items;
}

export function parsePreOsPdf(pdfPath) {
  return parsePreOsText(pdftotext(pdfPath));
}

const MARCA_TAIL_RE =
  /\s+(FORMIGRES|ARIELLE|CARMELO\s*FIOR|CARMELO|FIOR|ROCHAPRIME|ROCHAMAXX|INCOPISO|S)\s*$/gi;

/** @typedef {{ codigo_loja: string, codigo_barras: string, descricao: string, marca_erp: string }} Estoque510Item */

/**
 * Relatório 510 — linhas `codigo EAN descrição` (texto achatado).
 * @param {{ origem: string, fabricante_grupo: string, marca_catalogo: string }} meta
 */
export function parse510EstoqueText(text, meta) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const re = /(\d{5})\s+(789\d{10}|790\d{10})\s+(.+?)(?=\s\d{5}\s+(?:789|790)\d|$)/gi;
  /** @type {Estoque510Item[]} */
  const items = [];
  let m;
  while ((m = re.exec(flat))) {
    let descricao = m[3].replace(/\s+/g, ' ').trim();
    descricao = descricao.replace(MARCA_TAIL_RE, '').trim();
    descricao = descricao.replace(/\s+\d[\d.,]*\s*$/, '').trim();
    items.push({
      codigo_loja: m[1],
      codigo_barras: m[2],
      descricao,
      marca_erp: meta.origem,
      fabricante_grupo: meta.fabricante_grupo,
      marca_catalogo: meta.marca_catalogo,
    });
  }
  return items;
}

export const MARCA_PDF_META = {
  'incopisos_ca4d.pdf': {
    origem: 'INCOPISO',
    fabricante_grupo: 'Grupo Incopisos',
    marca_catalogo: 'Incopisos',
  },
  'arielle_80b6.pdf': {
    origem: 'ARIELLE',
    fabricante_grupo: 'Carmelo Fior',
    marca_catalogo: 'Arielle',
  },
  'carmelo_fior_6d00.pdf': {
    origem: 'CARMELO FIOR',
    fabricante_grupo: 'Carmelo Fior',
    marca_catalogo: 'Carmelo Fior',
  },
  'rochaprime_e08d.pdf': {
    origem: 'ROCHAPRIME',
    fabricante_grupo: 'Grupo Rocha',
    marca_catalogo: 'Rochaprime',
  },
  'formigres_6933.pdf': {
    origem: 'FORMIGRES',
    fabricante_grupo: 'Grupo Formigres',
    marca_catalogo: 'Formigres',
  },
};

export function inferFabricanteFromDescricao(descricao = '') {
  const u = descricao.toUpperCase();
  if (/ROCHAPRIME|ROCHAMAXX|ROCHAFORTE/.test(u)) return { fabricante_grupo: 'Grupo Rocha', marca_catalogo: 'Rochaprime' };
  if (/FORMIGRES|\bGRAN\s/.test(u) && !/INCOP/.test(u)) {
    if (/^REV\.|^PISO/.test(u)) return { fabricante_grupo: 'Grupo Formigres', marca_catalogo: 'Formigres' };
  }
  if (/INCOP/.test(u)) return { fabricante_grupo: 'Grupo Incopisos', marca_catalogo: 'Incopisos' };
  if (/SEMI\s*GRES|LUMECERAMICA|RELEV\/\/OUTS|RELEV\/OUTS/.test(u)) {
    return { fabricante_grupo: 'Lume Cerâmica', marca_catalogo: 'Lume' };
  }
  if (/CECafi|IDEALLE|FIORANO|ETNA|CARMELO/.test(u)) {
    return { fabricante_grupo: 'Carmelo Fior', marca_catalogo: 'Carmelo Fior' };
  }
  return { fabricante_grupo: '', marca_catalogo: '' };
}

export function rowFromPreOsCross(pre, marca510) {
  const descricao = (marca510?.descricao || pre.descricao).replace(/\s+/g, ' ').trim();
  const codigo = pre.codigo_loja;
  const rx = raioXProdutoDescricao(codigo, descricao);
  let formato = resolveFormatoPagLeve(descricao, rx.formato || pre.formato_raw) || rx.formato || pre.formato_raw;
  formato = String(formato || '').replace(/×/gi, 'x').toLowerCase();

  let fabricante_grupo = marca510?.fabricante_grupo || '';
  let marca_catalogo = marca510?.marca_catalogo || '';
  if (!fabricante_grupo) {
    const inf = inferFabricanteFromDescricao(descricao);
    fabricante_grupo = inf.fabricante_grupo;
    marca_catalogo = inf.marca_catalogo || marca_catalogo;
  }
  if (marca510?.marca_erp === 'ARIELLE') {
    fabricante_grupo = 'Carmelo Fior';
    marca_catalogo = 'Arielle';
  }

  const modelo = rx.modelo || '';
  return {
    codigo,
    codigo_loja: codigo,
    codigo_barras: marca510?.codigo_barras || '',
    formato,
    modelo,
    descricao_erp: descricao,
    descricao_original: descricao,
    fabricante_grupo,
    marca_no_site: marca_catalogo,
    marca_erp: marca510?.marca_erp || '',
    classe_pei: pre.classe_pei,
    preco_varejo_m2: pre.preco_varejo_m2,
    disponivel: true,
    cruzamento: marca510 ? '510_marca' : 'pre_os_apenas',
    descricao_no_site: '',
    evidencia_url: '',
    imagem_url: '',
    imagens_json: '',
    status: 'pendente',
    sites_consultados: '',
    match_metodo: '',
    match_score: '',
    observacao: marca510 ? `base PRE_OS×510 (${marca510.marca_erp})` : 'base PRE_OS; origem inferida ou pendente 510',
  };
}
