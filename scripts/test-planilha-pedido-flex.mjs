/**
 * Testa detecção flexível de colunas em planilha de pedido (sem template P38).
 */
import ExcelJS from 'exceljs';
import {
  parsePlanilhaPedidoFlexFromBuffer,
  parseNumeroPlanilhaBr,
} from '../src/lib/importarPlanilhaPedidoFlex.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(parseNumeroPlanilhaBr('1.234,56') === 1234.56, 'parse BR');
assert(parseNumeroPlanilhaBr('10') === 10, 'parse int');

async function buildSampleXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Orçamento Fornecedor X');
  ws.addRow(['Código ref.', 'Descrição do item', 'Qtd', 'VR. UNIT.', 'Total']);
  ws.addRow(['88421', 'MASSA ACRILICA BD 20KG HIPERCOR', 4, '89,90', '359,60']);
  ws.addRow(['99102', 'ARGAMASSA AC-III 20KG', 10, '32,50', '325,00']);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const buffer = await buildSampleXlsx();
const parsed = await parsePlanilhaPedidoFlexFromBuffer(buffer, 'orcamento.xlsx');

assert(parsed.itens.length === 2, `esperava 2 itens, veio ${parsed.itens.length}`);
assert(parsed.itens[0].descricao.includes('MASSA'), 'descricao item 1');
assert(parsed.itens[0].quantidade === 4, 'qtd item 1');
assert(Math.abs(parsed.itens[0].preco_unitario - 89.9) < 0.01, 'preco item 1');
assert(parsed.itens[1].codigo === '99102', 'codigo item 2');

console.log('OK planilha pedido flex:', JSON.stringify(parsed.itens, null, 2));
