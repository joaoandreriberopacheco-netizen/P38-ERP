#!/usr/bin/env node
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePedidoCompraDocumento } from '../src/lib/ocrDocumentParser.js';

const pdfPath =
  process.argv[2] ||
  '/home/ubuntu/.cursor/projects/workspace/uploads/MaxAndroid-_Pedido_10195-1_b883.pdf';

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;
let texto = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  texto += `${content.items.map((it) => String(it.str || '').trim()).filter(Boolean).join(' ')}\n`;
}

const parsed = parsePedidoCompraDocumento(texto);
console.log('fornecedor:', parsed.fornecedor?.nome_identificado);
console.log('itens:', parsed.itens.length);
parsed.itens.forEach((it, i) => {
  console.log(
    `${i + 1}. [${it.codigo}] ${it.descricao.slice(0, 45)} q=${it.quantidade} u=${it.preco_unitario} ean=${it.codigo_barras}`,
  );
});

if (parsed.itens.length !== 10) {
  console.error('FAIL: esperado 10 itens');
  process.exit(1);
}
if (!parsed.fornecedor?.nome_identificado?.includes('CCG DISTRIBUIDORA')) {
  console.error('FAIL: fornecedor', parsed.fornecedor?.nome_identificado);
  process.exit(1);
}
console.log('OK');
