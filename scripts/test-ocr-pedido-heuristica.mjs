import {
  pedidoExtracaoPareceIncompleta,
  precisaFallbackNuvemIa,
  OCR_IMPORT_TIPOS,
} from '../src/lib/ocrImportPipeline.js';

const textoArcelor = 'DESCRIÇÃO QTDE UN PREÇO (R$) 101785 - CA50 80 BR R$ 24,08 R$ 1.926,63 TOTAL R$ 6.637,76';

const iaOk = {
  itens: [
    { descricao: 'CA50 8MM', quantidade: 80, preco_unitario: 24.08 },
    { descricao: 'CA50 10MM', quantidade: 100, preco_unitario: 35.91 },
    { descricao: 'CA50 6.3MM', quantidade: 75, preco_unitario: 14.94 },
  ],
};

if (precisaFallbackNuvemIa(iaOk, OCR_IMPORT_TIPOS.PEDIDO_COMPRA)) {
  throw new Error('IA com 3 itens válidos não deveria pedir fallback');
}

if (!pedidoExtracaoPareceIncompleta(textoArcelor, { itens: [] })) {
  throw new Error('parser local vazio deveria parecer incompleto');
}

if (pedidoExtracaoPareceIncompleta(textoArcelor, iaOk)) {
  throw new Error('3 itens válidos no doc pequeno não deveria marcar incompleto (local)');
}

console.log('OK heurística IA vs parser local');
