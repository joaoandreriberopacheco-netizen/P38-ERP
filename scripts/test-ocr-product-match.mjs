#!/usr/bin/env node
/**
 * Teste do match local OCR → catálogo (sem BD).
 * Uso: npx vite-node --config legacy/vite/vite.config.js scripts/test-ocr-product-match.mjs
 */
import { findLocalBestProductMatch, resolveOcrProductMatch } from '../src/components/compras/productMatchingUtils.js';

const catalogo = [
  {
    id: 'p1',
    nome: 'ARGAMASSA AC-3 20KG EXTERNA',
    codigo_interno: 'AR3-20K',
    codigo_barras: '7891234567890',
    marca: 'VOTORAN',
    campo_hierarquico_1: 'ARGAMASSA',
    campo_hierarquico_2: 'AC-3',
    campo_hierarquico_3: '20KG',
  },
  {
    id: 'p2',
    nome: 'TINTA ACR BRANCO FOSCO 18L',
    codigo_interno: 'TA1-18L',
    codigo_barras: '7899876543210',
    marca: 'SUvinil',
    campo_hierarquico_1: 'TINTA',
    campo_hierarquico_2: 'ACRILICA',
    campo_hierarquico_3: 'BRANCO FOSCO 18L',
  },
];

const casos = [
  {
    nome: 'código barras MASS',
    item: {
      descricao: 'ARGAMASSA COLANTE EXTERNO AC III 20KG',
      codigo: '121161',
      codigo_barras: '7891234567890',
      quantidade: 24,
      preco_unitario: 4.28,
    },
    esperadoId: 'p1',
  },
  {
    nome: 'descrição longa tinta',
    item: {
      descricao: 'TINTA ACRILICA FOSCO BRANCO 18 LITROS',
      codigo: '998877',
      quantidade: 2,
      preco_unitario: 120,
    },
    esperadoId: 'p2',
  },
];

const semMatch = findLocalBestProductMatch(null, catalogo, {
  descricao: 'PRODUTO DESCONHECIDO XYZ',
  codigo: '121161',
  quantidade: 1,
  preco_unitario: 10,
});
if (semMatch?.produto) {
  console.error('FAIL: código fornecedor não deve dar match sozinho');
  process.exit(1);
}
console.log('OK código fornecedor ignorado sem EAN');

let falhas = 0;
for (const caso of casos) {
  const local = findLocalBestProductMatch(null, catalogo, caso.item);
  const resolved = resolveOcrProductMatch(caso.item, catalogo, '');
  const id = resolved.produto_id_match || resolved.selected_product_id || local?.produto?.id;
  const ok = id === caso.esperadoId;
  console.log(`${ok ? 'OK' : 'FAIL'} ${caso.nome}:`, {
    id,
    confianca: resolved.confianca,
    score: local?.score,
  });
  if (!ok) falhas += 1;
}

if (falhas) process.exit(1);
console.log('Todos os casos passaram.');
