import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePedidoCompraDocumento } from '../src/lib/ocrDocumentParser.js';
import {
  findLocalBestProductMatch,
  findOcrSiblingProduct,
  resolveOcrProductMatch,
  getProdutoLabel,
  tokenizeForProductMatch,
  getProductSearchText,
} from '../src/components/compras/productMatchingUtils.js';

const path = process.argv[2] || '/home/ubuntu/.cursor/projects/workspace/uploads/MaxAndroid-_Pedido_10195-2_5daf.pdf';
const data = new Uint8Array(fs.readFileSync(path));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;
const texto = (await pdf.getPage(1).then((p) => p.getTextContent())).items.map((it) => it.str).join(' ');
const pedido = parsePedidoCompraDocumento(texto);

const catalogo = [
  { id: 'lux-20', nome: 'MASSA ACRILICA LUX 20KG', marca: 'LUX', campo_hierarquico_1: 'MASSA ACRILICA', campo_hierarquico_5: 'LUX' },
  { id: 'lux-5', nome: 'MASSA ACRILICA LUX 5KG', marca: 'LUX', campo_hierarquico_1: 'MASSA ACRILICA', campo_hierarquico_5: 'LUX' },
  { id: 'hip-20', nome: 'MASSA ACRILICA BD 20KG HIPERCOR', marca: 'HIPERCOR', campo_hierarquico_1: 'MASSA ACRILICA', campo_hierarquico_5: 'HIPERCOR' },
  { id: 'hip-5', nome: 'MASSA ACRILICA BD 5KG HIPERCOR', marca: 'HIPERCOR', campo_hierarquico_1: 'MASSA ACRILICA', campo_hierarquico_5: 'HIPERCOR' },
];

for (const item of pedido.itens.slice(0, 2)) {
  console.log('\n===', item.descricao, '===');
  const local = findLocalBestProductMatch(null, catalogo, item);
  const resolved = resolveOcrProductMatch(item, catalogo, '');
  const sibling = findOcrSiblingProduct(item, catalogo);
  console.log('match:', local ? getProdutoLabel(local.produto) : null, '| score', local?.score, '| conf', local?.confianca);
  console.log('resolved:', JSON.stringify(resolved));
  console.log('irmao:', sibling ? getProdutoLabel(sibling.produto) : null);
}
