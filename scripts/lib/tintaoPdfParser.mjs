/**
 * Parser das listas PDF Tintão Televendas (A7 ERP / SIAH).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ITEM_RE = /(\d{4,6})\s+([\d,]+(?:M2|UN))\s+([\d,]+)\s+([\d,]+)FORMIGRES\s+([\d,]+)((?:PISO|REVEST\.?|REV\.?)\s+.+?)(?=\d{4,6}\s+[\d,]+(?:M2|UN)\s+[\d,]+\s+[\d,]+FORMIGRES|Subtotal:|$)/gis;

const LISTA_NOME_RE = /1\s*-\s*LISTA\s+DE\s+(.+?)(?:\n|RUA)/i;

export function slugLista(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function inferirListaContexto(nomeLista) {
  const n = String(nomeLista || '').toUpperCase();
  if (/POLID/.test(n)) return 'polidos';
  if (/33\s*[xX]\s*59|RETIF/.test(n)) return 'retificada';
  return 'geral';
}

function extractPdfText(pdfPath) {
  const py = `
import sys
from pathlib import Path
try:
    from pypdf import PdfReader
except ImportError:
    from PyPDF2 import PdfReader
pdf = Path(sys.argv[1])
text = "\\n".join((p.extract_text() or "") for p in PdfReader(str(pdf)).pages)
print(text)
`;
  const res = spawnSync('python3', ['-c', py, pdfPath], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (res.status !== 0) {
    throw new Error(`Falha ao ler PDF ${pdfPath}: ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

function parseItemBlock(block, listaMeta) {
  const m = ITEM_RE.exec(block);
  if (!m) return null;
  const descricao = m[6].replace(/\s+/g, ' ').trim();
  const precoUnit = Number(m[4].replace(',', '.'));
  const total = Number(m[5].replace(',', '.'));
  return {
    codigo_tintao: m[1],
    unidade: m[2],
    peso_kg: m[3],
    preco_m2: precoUnit,
    total,
    descricao,
    fabricante: 'FORMIGRES',
    lista: listaMeta.slug,
    lista_nome: listaMeta.nome,
    lista_contexto: listaMeta.contexto,
    pdf: listaMeta.pdf,
  };
}

export function parseTintaoPdf(pdfPath) {
  const text = extractPdfText(pdfPath);
  const nomeMatch = text.match(LISTA_NOME_RE);
  const nomeLista = nomeMatch ? nomeMatch[1].trim() : path.basename(pdfPath, '.PDF');
  const meta = {
    nome: nomeLista,
    slug: slugLista(nomeLista),
    contexto: inferirListaContexto(nomeLista),
    pdf: path.basename(pdfPath),
  };

  const itens = [];
  let match;
  const re = new RegExp(ITEM_RE.source, 'gis');
  while ((match = re.exec(text)) !== null) {
    const descricao = match[6].replace(/\s+/g, ' ').trim().replace(/\s*Usu[aá]rio:.*/i, '').replace(/\s*Impresso em:.*/i, '').trim();
    itens.push({
      codigo_tintao: match[1],
      unidade: match[2],
      peso_kg: match[3],
      preco_m2: Number(match[4].replace(',', '.')),
      total: Number(match[5].replace(',', '.')),
      descricao,
      fabricante: 'FORMIGRES',
      lista: meta.slug,
      lista_nome: meta.nome,
      lista_contexto: meta.contexto,
      pdf: meta.pdf,
    });
  }

  return { meta, itens, raw_chars: text.length };
}

/** Lê todos os PDFs Tintão de um diretório ou lista de paths. */
export function parseTintaoPdfs(pathsOrDir) {
  let files;
  if (Array.isArray(pathsOrDir)) {
    files = pathsOrDir;
  } else if (fs.statSync(pathsOrDir).isDirectory()) {
    files = fs.readdirSync(pathsOrDir)
      .filter((f) => /^LISTA_DE_.*\.PDF$/i.test(f))
      .map((f) => path.join(pathsOrDir, f));
  } else {
    files = [pathsOrDir];
  }

  const listas = [];
  const itens = [];
  for (const file of files.sort()) {
    const parsed = parseTintaoPdf(file);
    listas.push({ ...parsed.meta, count: parsed.itens.length });
    itens.push(...parsed.itens);
  }
  return { listas, itens };
}
