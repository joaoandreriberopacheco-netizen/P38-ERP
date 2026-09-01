#!/usr/bin/env node
/**
 * Validação rápida do motor de cálculo do Dízimo.
 */
import {
  DIZIMO_MODOS,
  montarDemonstrativoDizimo,
  calcularFatorDedutivel,
} from '../src/lib/dizimoCalculos.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const plano = {
  competencia: '2026-03',
  grupos: [
    {
      id: 'fixas_recorrentes',
      items: [
        { id: 'fixa-a', nome: 'Aluguel', valor: 10_000 },
        { id: 'fixa-b', nome: 'Energia', valor: 10_000 },
      ],
    },
    {
      id: 'folha',
      items: [
        { id: 'folha-1', nome: 'Maria', detalhe: '', valor: 3_000 },
        { id: 'folha-2', nome: 'João', detalhe: '', valor: 2_000 },
        { id: 'folha-3', nome: 'André', detalhe: 'Sócio', valor: 25_000 },
      ],
    },
    {
      id: 'budgets',
      items: [{ id: 'budget-1', nome: 'Marketing', valor: 10_000 }],
    },
    {
      id: 'pontuais',
      items: [{ id: 'pauta-1', nome: 'Boleto X', valor: 5_000, entraNoTotal: true }],
    },
  ],
  resumo: {
    lucroBruto: 100_000,
    resultadoOperacional: 35_000,
  },
};

// Tudo dedutível
const tudo = montarDemonstrativoDizimo(plano, {});
assert(tudo.totalDedutivel === 65_000, 'tudo dedutível soma itens');
assert(tudo.lucroLiquidoOperacional === 35_000, 'base com tudo dedutível');
assert(tudo.dizimo === 3_500, '10% de 35k');

// Item único não dedutível
const aluguelFora = montarDemonstrativoDizimo(plano, {
  'fixa-a': { modo: DIZIMO_MODOS.NAO_DEDUTIVEL, percentual: 0 },
});
assert(aluguelFora.totalDedutivel === 55_000, 'aluguel fora da base');

// Pró-labore parcial 50%
assert(calcularFatorDedutivel({ modo: DIZIMO_MODOS.PARCIAL, percentual: 50 }) === 0.5, 'fator parcial');
const proLaboreParcial = montarDemonstrativoDizimo(plano, {
  'folha-3': { modo: DIZIMO_MODOS.PARCIAL, percentual: 50 },
});
assert(proLaboreParcial.totalDedutivel === 52_500, 'pró-labore metade dedutível');

// Folha com subseções
const folhaSecao = tudo.secoes.find((s) => s.id === 'folha');
assert(folhaSecao.subsecoes.length === 2, 'folha tem funcionários e pró-labore');
assert(folhaSecao.subsecoes[0].itens.length === 2, 'dois funcionários');
assert(folhaSecao.subsecoes[1].itens.length === 1, 'um pró-labore');

// Mês negativo → dízimo zero
const negativo = montarDemonstrativoDizimo(
  {
    grupos: [{ id: 'fixas_recorrentes', items: [{ id: 'fixa-x', nome: 'X', valor: 50_000 }] }],
    resumo: { lucroBruto: 10_000 },
  },
  {},
);
assert(negativo.lucroLiquidoOperacional === -40_000, 'prejuízo operacional');
assert(negativo.dizimo === 0, 'dízimo zero em prejuízo');

console.log('validate-dizimo-calculos: OK');
