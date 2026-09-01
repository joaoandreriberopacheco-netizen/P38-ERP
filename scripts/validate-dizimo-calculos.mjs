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
  resumo: {
    lucroBruto: 100_000,
    fixasRecorrentes: 20_000,
    folha: 30_000,
    budgets: 10_000,
    pontuaisExtraPlano: 5_000,
    resultadoOperacional: 35_000,
  },
};

// Tudo dedutível → igual ao resultado operacional do plano
const tudo = montarDemonstrativoDizimo(plano, {});
assert(tudo.lucroLiquidoOperacional === 35_000, 'base com tudo dedutível');
assert(tudo.dizimo === 3_500, '10% de 35k');

// Folha não dedutível
const folhaFora = montarDemonstrativoDizimo(plano, {
  folha: { modo: DIZIMO_MODOS.NAO_DEDUTIVEL, percentual: 0 },
});
assert(folhaFora.lucroLiquidoOperacional === 65_000, 'folha fora da base');
assert(folhaFora.dizimo === 6_500, '10% de 65k');

// Parcial 50% em budgets
assert(calcularFatorDedutivel({ modo: DIZIMO_MODOS.PARCIAL, percentual: 50 }) === 0.5, 'fator parcial');
const parcial = montarDemonstrativoDizimo(plano, {
  budgets: { modo: DIZIMO_MODOS.PARCIAL, percentual: 50 },
});
assert(parcial.totalDedutivel === 60_000, 'budgets metade dedutível');
assert(parcial.dizimo === 4_000, '10% de 40k');

// Mês negativo → dízimo zero
const negativo = montarDemonstrativoDizimo(
  { resumo: { lucroBruto: 10_000, fixasRecorrentes: 50_000, folha: 0, budgets: 0, pontuaisExtraPlano: 0 } },
  {},
);
assert(negativo.lucroLiquidoOperacional === -40_000, 'prejuízo operacional');
assert(negativo.dizimo === 0, 'dízimo zero em prejuízo');

console.log('validate-dizimo-calculos: OK');
