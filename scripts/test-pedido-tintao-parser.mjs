#!/usr/bin/env node
/** Teste do parser com texto OCR estilo Tintão (bloco único). */
import { repartirTextoOcrPedido } from '../src/lib/ocrPedidoNormalize.js';
import { parsePedidoCompraDocumento } from '../src/lib/ocrDocumentParser.js';

const ocrBlob = `TINTÃO NOVA CIDADE PEDIDO DE VENDA NRO: 303189 AV. MARGARITA,533 - MONTE DAS OLMEIRAS DATA DE EMISSÃO: 15/09/2026 09:52 PREVISÃO DE ENTREGA: 14/09/2026 E-MAIL: VITOR@TINTAOMANAUS.COM.BR VENDEDOR: 89 - ALISSON RAMAL CNP: 07.237.568/0002-50 IE: 05.368.918-6 EMP. QTD. UND. CÓDIGO DESCRIÇÃO FABRICANTE % IC VR. UNIT. TOTAL PAGAMENTO 1 100,000 M2 1547 GRAN COLORADO RT POLIDO 60X120 PREMIUM 0 47,90 4.790,00 2 19,500 M2 1099 LENÇÓIS SOFT RT 84X84 ARIELLE 0 97,66 1.904,37 QTD. TOTAL: 119,5 TOTAL ITENS: 2 SUBTOTAL 6.704,37 TOTAL R$:`;

console.log('--- repartido ---');
console.log(repartirTextoOcrPedido(ocrBlob));
console.log('--- parse ---');
console.log(JSON.stringify(parsePedidoCompraDocumento(ocrBlob), null, 2));
