#!/usr/bin/env node
/**
 * Grava snapshot de lucro bruto (Relatório de Margem) para competências fechadas.
 * Uso: npx vite-node scripts/margem-competencia-backfill.mjs 2026-08 [2026-07 ...]
 */
import { obterLucroBrutoCompetencia } from '../src/lib/budgetService.js';
import { competenciaMargemPodeUsarSnapshot } from '../src/lib/margemCompetenciaSnapshot.js';

const months = process.argv.slice(2);
if (!months.length) {
  console.error('Uso: npx vite-node scripts/margem-competencia-backfill.mjs YYYY-MM [YYYY-MM ...]');
  process.exit(1);
}

for (const competencia of months) {
  const prefix = String(competencia).slice(0, 7);
  if (!competenciaMargemPodeUsarSnapshot(prefix)) {
    console.warn(`skip ${prefix}: competência ainda não fechada civilmente`);
    continue;
  }

  console.log(`Calculando margem ${prefix}...`);
  const totals = await obterLucroBrutoCompetencia(prefix);
  console.log(
    `OK ${prefix}: lucro_bruto=${totals.lucro_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} receita=${totals.receita_liquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  );
}

console.log('margem-competencia-backfill: concluído');
