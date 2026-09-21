#!/usr/bin/env node
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseItensMaxAndroid, segmentosMaxAndroid } from '../src/lib/ocrDocumentParser.js';
import { repartirTextoOcrPedido } from '../src/lib/ocrPedidoNormalize.js';

const data = new Uint8Array(fs.readFileSync('/home/ubuntu/.cursor/projects/workspace/uploads/MaxAndroid-_Pedido_10195-1_b883.pdf'));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;
const page = await pdf.getPage(1);
const texto = (await page.getTextContent()).items.map((it) => it.str).join(' ');

const segs = segmentosMaxAndroid(texto);
console.log('segments', segs.length);
segs.forEach((s, i) => console.log('---', i, s.slice(0, 100)));

const rep = repartirTextoOcrPedido(texto);
console.log('raw parsed', parseItensMaxAndroid(texto).length);
console.log('repart parsed', parseItensMaxAndroid(rep).length);
import { segmentosMaxAndroid } from '../src/lib/ocrDocumentParser.js';

// inline parse test
function testSeg(seg) {
  const m = seg.trim().match(/^(\d{1,3})\s+(\d{4,6})\s+(789\d{10})\s+(.+)$/i);
  if (!m) return 'no-regex';
  const parts = m[4].trim().split(/\s+/);
  const monetarios = [];
  const moneyTokenRe = /^\d+(?:\.\d{3})*,\d{1,2}$/;
  while (parts.length) {
    const last = parts[parts.length - 1];
    if (moneyTokenRe.test(last)) { monetarios.unshift(parseFloat(last.replace(/\./g,'').replace(',','.'))); parts.pop(); continue; }
    if (monetarios.length > 0 && /^[1-9]$/.test(last)) { parts.pop(); continue; }
    break;
  }
  const q = Number(parts.pop());
  return { q, preco: monetarios[0], desc: parts.join(' ').slice(0,40), mon: monetarios.length };
}

segs.forEach((s, i) => console.log(i, testSeg(s)));

const itens = parseItensMaxAndroid(texto);
console.log('parsed', itens.length, itens.map((x) => x.codigo));
