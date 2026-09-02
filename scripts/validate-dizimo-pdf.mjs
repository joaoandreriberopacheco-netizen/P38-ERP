#!/usr/bin/env node
/**
 * Gera PDF de amostra do Dízimo e grava em /tmp para inspeção.
 */
import { writeFileSync } from 'node:fs';
import { montarDemonstrativoDizimo, DIZIMO_MODOS } from '../src/lib/dizimoCalculos.js';
import { generateRelatorioDizimoEnxutoPdf } from '../src/lib/relatorioDizimoPdf/generateRelatorioDizimoEnxutoPdf.js';

const plano = {
  competencia: '2026-08',
  grupos: [
    {
      id: 'fixas_recorrentes',
      items: [
        { id: 'fixa-a', nome: 'Aluguel', valor: 10_000 },
        { id: 'fixa-b', nome: 'Energia', valor: 8_500 },
        { id: 'fixa-c', nome: 'Internet', valor: 450 },
      ],
    },
    {
      id: 'folha',
      items: [
        { id: 'folha-1', nome: 'Maria', detalhe: '', valor: 3_200 },
        { id: 'folha-2', nome: 'Rayne', detalhe: '', valor: 2_800 },
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
      items: [{ id: 'pauta-1', nome: 'Importação pendente', valor: 5_000, entraNoTotal: true }],
    },
  ],
  resumo: {
    lucroBruto: 120_000,
    resultadoOperacional: 45_000,
  },
  margemDetalhe: { receita_liquida: 500_000, custo_total: 380_000 },
};

const demonstrativo = montarDemonstrativoDizimo(plano, {
  'folha-2': { modo: DIZIMO_MODOS.PARCIAL, percentual: 50 },
  'pauta-1': { modo: DIZIMO_MODOS.NAO_DEDUTIVEL, percentual: 0 },
  'budget-1': { modo: DIZIMO_MODOS.PARCIAL, percentual: 40 },
});

const { data, version } = await generateRelatorioDizimoEnxutoPdf({
  competenciaLabel: 'ago/2026',
  demonstrativo,
  generatedAt: '01/09/2026 03:38',
});

const outPath = '/tmp/RelatorioDizimo_sample.pdf';
writeFileSync(outPath, Buffer.from(data));

if (!version.includes('template_joao')) {
  throw new Error(`versão inesperada: ${version}`);
}

console.log(`validate-dizimo-pdf: OK → ${outPath} (${Buffer.from(data).length} bytes, ${version})`);
