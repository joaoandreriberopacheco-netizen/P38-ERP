#!/usr/bin/env node
/**
 * Validação rápida do motor de cálculo do Dízimo.
 */
import {
  DIZIMO_MODOS,
  montarDemonstrativoDizimo,
  calcularFatorDedutivel,
  resolverConfigItensDizimo,
  formatarNomeItemDizimoLista,
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
      items: [
        { id: 'budget-1', nome: 'Marketing', valor: 4_000, centroCusto: 'Casa' },
        { id: 'budget-2', nome: 'Combustível', valor: 3_000, centroCusto: 'Transportadora' },
        { id: 'budget-3', nome: 'Manutenção', valor: 3_000, centroCusto: 'Propriedades' },
      ],
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

// Padrão: recorrentes total, ocasionais não dedutíveis
const padrao = montarDemonstrativoDizimo(plano, {});
assert(padrao.totalDedutivel === 60_000, 'recorrentes dedutíveis, pauta fora');
assert(padrao.dizimo === 4_000, '10% de 40k');

// Tudo dedutível explicitamente
const tudo = montarDemonstrativoDizimo(plano, {
  'pauta-1': { modo: DIZIMO_MODOS.TOTAL, percentual: 100 },
});
assert(tudo.totalDedutivel === 65_000, 'tudo dedutível soma itens');
assert(tudo.lucroLiquidoOperacional === 35_000, 'base com tudo dedutível');
assert(tudo.dizimo === 3_500, '10% de 35k');

// Item único não dedutível
const aluguelFora = montarDemonstrativoDizimo(plano, {
  'fixa-a': { modo: DIZIMO_MODOS.NAO_DEDUTIVEL, percentual: 0 },
});
assert(aluguelFora.totalDedutivel === 50_000, 'aluguel fora da base');

// Pró-labore parcial 50%
assert(calcularFatorDedutivel({ modo: DIZIMO_MODOS.PARCIAL, percentual: 50 }) === 0.5, 'fator parcial');
const proLaboreParcial = montarDemonstrativoDizimo(plano, {
  'folha-3': { modo: DIZIMO_MODOS.PARCIAL, percentual: 50 },
});
assert(proLaboreParcial.totalDedutivel === 47_500, 'pró-labore metade dedutível');

// Folha com subseções
const folhaSecao = padrao.secoes.find((s) => s.id === 'folha');
assert(folhaSecao.subsecoes.length === 2, 'folha tem funcionários e pró-labore');
assert(folhaSecao.subsecoes[0].itens.length === 2, 'dois funcionários');
assert(folhaSecao.subsecoes[1].itens.length === 1, 'um pró-labore');

const budgetsSecao = padrao.secoes.find((s) => s.id === 'budgets');
assert(budgetsSecao.subsecoes.length === 3, 'budgets por centro de custo');
assert(
  budgetsSecao.subsecoes.map((s) => s.label).join(',') === 'Casa,Propriedades,Transportadora',
  'rótulos dos centros de custo',
);

// Anexo com despesas fora da base
const comAnexo = montarDemonstrativoDizimo(plano, {
  'pauta-1': { modo: DIZIMO_MODOS.NAO_DEDUTIVEL, percentual: 0 },
  'fixa-a': { modo: DIZIMO_MODOS.PARCIAL, percentual: 50 },
  'budget-1': { modo: DIZIMO_MODOS.NAO_DEDUTIVEL, percentual: 0 },
});
assert(comAnexo.anexoForaBase.totalFora === 14_000, 'anexo soma fora da base');
assert(comAnexo.anexoForaBase.secoes.some((s) => s.id === 'pontuais'), 'pauta no anexo');
const budgetsAnexo = comAnexo.anexoForaBase.secoes.find((s) => s.id === 'budgets');
assert(budgetsAnexo?.subsecoes?.some((sub) => sub.label === 'Casa'), 'budget Casa no anexo');

// Herança mês anterior para recorrentes
const herdado = resolverConfigItensDizimo({
  configExplicita: {},
  configMesAnterior: {
    'fixa-a': { modo: DIZIMO_MODOS.PARCIAL, percentual: 40 },
    'pauta-1': { modo: DIZIMO_MODOS.TOTAL, percentual: 100 },
  },
  recorrentes: ['fixa-a', 'fixa-b'],
  ocasionais: ['pauta-1'],
});
assert(herdado['fixa-a'].modo === DIZIMO_MODOS.PARCIAL, 'herda parcial do mês anterior');
assert(herdado['fixa-a'].percentual === 40, 'herda percentual');
assert(herdado['fixa-b'].modo === DIZIMO_MODOS.TOTAL, 'novo recorrente = total');
assert(herdado['pauta-1'].modo === DIZIMO_MODOS.NAO_DEDUTIVEL, 'ocasional sempre não dedutível por padrão');

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

assert(
  formatarNomeItemDizimoLista({
    nome: 'Rayne',
    config: { modo: DIZIMO_MODOS.PARCIAL, percentual: 50 },
  }) === 'Rayne (50%)',
  'nome parcial na listagem',
);
assert(
  formatarNomeItemDizimoLista({
    nome: 'Maria',
    config: { modo: DIZIMO_MODOS.TOTAL, percentual: 100 },
  }) === 'Maria',
  'nome total sem sufixo',
);

console.log('validate-dizimo-calculos: OK');
