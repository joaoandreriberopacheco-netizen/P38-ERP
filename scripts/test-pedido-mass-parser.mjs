#!/usr/bin/env node
/** Teste do parser com orçamento MASS DISTRIBUIDORA (PDF digital, bloco único). */
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { repartirTextoOcrPedido } from '../src/lib/ocrPedidoNormalize.js';
import { parsePedidoCompraDocumento } from '../src/lib/ocrDocumentParser.js';
import { limparLinhas } from '../src/lib/ocrTextUtils.js';

const pdfPath =
  process.argv[2] ||
  '/home/ubuntu/.cursor/projects/workspace/uploads/17900041678463_06a3.pdf';

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;
let texto = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const linha = content.items
    .map((it) => String(it.str || '').trim())
    .filter(Boolean)
    .join(' ');
  if (linha) texto += `${linha}\n`;
}

const repartido = repartirTextoOcrPedido(texto);
const linhas = limparLinhas(repartido);
const parsed = parsePedidoCompraDocumento(texto);

console.log('linhas:', linhas.length);
console.log('fornecedor:', parsed.fornecedor);
console.log('itens:', parsed.itens.length);
parsed.itens.forEach((it, i) => {
  console.log(
    `${i + 1}. [${it.codigo}] ${it.descricao.slice(0, 50)} qtd=${it.quantidade} unit=${it.preco_unitario}`,
  );
});

if (parsed.itens.length !== 6) {
  console.error('FAIL: esperado 6 itens');
  process.exit(1);
}
if (parsed.fornecedor?.nome_identificado !== 'MASS DISTRIBUIDORA') {
  console.error('FAIL: fornecedor', parsed.fornecedor?.nome_identificado);
  process.exit(1);
}
console.log('OK');
