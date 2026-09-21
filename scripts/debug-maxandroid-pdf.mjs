#!/usr/bin/env node
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePedidoCompraDocumento } from '../src/lib/ocrDocumentParser.js';
import { repartirTextoOcrPedido } from '../src/lib/ocrPedidoNormalize.js';
import { limparLinhas } from '../src/lib/ocrTextUtils.js';

const pdfPath =
  process.argv[2] ||
  '/home/ubuntu/.cursor/projects/workspace/uploads/MaxAndroid-_Pedido_10195-1_b883.pdf';

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;
let texto = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const linha = content.items.map((it) => String(it.str || '').trim()).filter(Boolean).join(' ');
  if (linha) texto += `${linha}\n`;
}

console.log('PAGES', pdf.numPages, 'TEXT LEN', texto.length);
console.log('\n=== FIRST 3000 ===\n', texto.slice(0, 3000));
console.log('\n=== LAST 2000 ===\n', texto.slice(-2000));

const rep = repartirTextoOcrPedido(texto);
const linhas = limparLinhas(rep);
console.log('\n=== LINHAS', linhas.length, '===');
linhas.forEach((l, i) => console.log(String(i + 1).padStart(3), l.slice(0, 140)));

const parsed = parsePedidoCompraDocumento(texto);
console.log('\n=== PARSED ===');
console.log('fornecedor:', parsed.fornecedor);
console.log('itens:', parsed.itens.length);
parsed.itens.forEach((it, i) => {
  console.log(`${i + 1}. [${it.codigo}] ${it.descricao?.slice(0, 60)} q=${it.quantidade} u=${it.preco_unitario}`);
});
