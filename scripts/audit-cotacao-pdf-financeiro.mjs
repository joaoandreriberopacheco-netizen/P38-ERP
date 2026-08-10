/**
 * Validação objetiva da normalização financeira do importador PDF (caso MARFEL).
 * Uso: node scripts/audit-cotacao-pdf-financeiro.mjs
 */
import {
  aplicarDescontoUnitarioCotacaoPdf,
  calcularRatioDescontoCotacaoPdf,
  normalizarFinanceiroCotacaoPdf,
} from '../src/lib/cotacaoExpressPdfFinanceiro.js';

const MARFEL_LLM = {
  subtotal: 8993.75,
  total_final: 5576.13,
  desconto_global: 6763.31,
  desconto_comercial: 3417.63,
  desconto_suframa: 1115.23,
};

const MARFEL_LLM_ERRADO = {
  ...MARFEL_LLM,
  total_final: 2230.44,
};

const MARFEL_LLM_CORRETO = {
  subtotal: 8993.75,
  total_final: 4460.9,
  desconto_global: 4532.85,
  desconto_comercial: 3417.63,
  desconto_suframa: 1115.23,
};

const ITENS_MARFEL = [
  { descricao_pdf: 'VTS - ESGOTO 50MM', quantidade_pdf: 10, preco_unitario_pdf: 68.75 },
  { descricao_pdf: 'VTS - ESGOTO 75MM', quantidade_pdf: 10, preco_unitario_pdf: 93.75 },
];

function assertNear(label, actual, expected, tolerance = 0.5) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: esperado ~${expected}, obteve ${actual}`);
  }
}

function runCase(name, input) {
  const fin = normalizarFinanceiroCotacaoPdf(input);
  assertNear(`${name} total_final`, fin.total_final, 4460.9, 1);
  assertNear(`${name} desconto_global`, fin.desconto_global, 4532.85, 1);

  const subtotalItens = ITENS_MARFEL.reduce(
    (sum, item) => sum + item.quantidade_pdf * item.preco_unitario_pdf,
    0,
  );
  const ratio = calcularRatioDescontoCotacaoPdf(subtotalItens, fin);
  assertNear(`${name} ratio`, ratio * 100, 49.6, 1);

  const precos = aplicarDescontoUnitarioCotacaoPdf(ITENS_MARFEL, fin);
  assertNear(`${name} preço 50mm`, precos[0].preco_unitario_liquido, 34.11, 0.5);

  console.log(`OK ${name}: total R$ ${fin.total_final}, ratio ${(ratio * 100).toFixed(1)}%`);
}

try {
  runCase('MARFEL líquido comercial', MARFEL_LLM);
  runCase('MARFEL total errado (2230)', MARFEL_LLM_ERRADO);
  runCase('MARFEL total NF correto', MARFEL_LLM_CORRETO);
  console.log('audit-cotacao-pdf-financeiro: todos os casos passaram');
} catch (error) {
  console.error('FALHA:', error.message);
  process.exit(1);
}
