#!/usr/bin/env node
/**
 * Detalha custos "Outros" do Relatório de Margem por produto/linha — Supabase.
 *
 * Uso:
 *   npm run audit:margem-outros -- --competencia=2026-07
 *   npm run audit:margem-outros -- --from=2026-07-01 --to=2026-07-31 --json
 *
 * Requer: DATABASE_URL
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadDotEnvFiles, REPO_ROOT } from './base44-env.mjs';
import {
  fmtR,
  loadMargemPeriodo,
  parseMargemPeriodArgs,
  roundMoney,
} from './lib/margemAuditCore.mjs';

loadDotEnvFiles();

function agruparPorLinha(produtos) {
  const map = new Map();
  for (const row of produtos) {
    const key = row.linha || 'Outros';
    if (!map.has(key)) {
      map.set(key, { linha: key, produtos: 0, quantidade_base: 0, custo_outros_total: 0 });
    }
    const g = map.get(key);
    g.produtos += 1;
    g.quantidade_base += row.quantidade_base || 0;
    g.custo_outros_total = roundMoney(g.custo_outros_total + (row.custo_outros_total || 0));
  }
  return [...map.values()].sort((a, b) => b.custo_outros_total - a.custo_outros_total);
}

function imprimirRelatorio({ from, to, produtos }) {
  const totalOutros = roundMoney(produtos.reduce((s, r) => s + (r.custo_outros_total || 0), 0));
  const totalImp1 = roundMoney(produtos.reduce((s, r) => s + (r.custo_imposto1_total || 0), 0));
  const totalImp2 = roundMoney(produtos.reduce((s, r) => s + (r.custo_imposto2_total || 0), 0));
  const linhas = agruparPorLinha(produtos);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Relatório de Margem — detalhe "Outros Custos" (Supabase)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Período: ${from} a ${to}`);
  console.log(`  Total Outros: R$ ${fmtR(totalOutros)}`);
  console.log(`  Produtos com Outros no período: ${produtos.length}`);
  console.log('');

  if (!produtos.length) {
    console.log('  Nenhum produto com custo Outros no período.');
    console.log('');
    return { totalOutros, totalImp1, totalImp2, linhas, produtos };
  }

  console.log('── Por linha de produto ──');
  for (const g of linhas) {
    const pct = totalOutros > 0 ? ((g.custo_outros_total / totalOutros) * 100).toFixed(1) : '0.0';
    console.log(
      `  ${g.linha.padEnd(28)} R$ ${fmtR(g.custo_outros_total).padStart(12)}  (${pct}% · ${g.produtos} prod.)`,
    );
  }

  console.log('');
  console.log('── Top produtos ──');
  for (const row of produtos.slice(0, 40)) {
    console.log(
      `  ${String(row.nome).slice(0, 40).padEnd(42)}` +
        `${String(row.linha).slice(0, 18).padEnd(20)}` +
        `${fmtR(row.outros_unit || 0).padStart(10)}` +
        `${fmtR(row.quantidade_base).padStart(12)}` +
        `${fmtR(row.custo_outros_total).padStart(14)}`,
    );
  }
  console.log('');
  return { totalOutros, totalImp1, totalImp2, linhas, produtos };
}

async function main() {
  const args = parseMargemPeriodArgs(process.argv.slice(2));
  if (!args) {
    console.error(
      'Uso: npm run audit:margem-outros -- --competencia=YYYY-MM\n' +
        '     npm run audit:margem-outros -- --from=YYYY-MM-DD --to=YYYY-MM-DD',
    );
    process.exit(1);
  }

  const { from, to, out, json } = args;
  const { linhas } = await loadMargemPeriodo(from, to);
  const produtos = linhas
    .filter((r) => (r.custo_outros_total || 0) > 0.0001)
    .sort((a, b) => b.custo_outros_total - a.custo_outros_total);

  const resumo = imprimirRelatorio({ from, to, produtos });

  if (out || json) {
    const payload = {
      exportedAt: new Date().toISOString(),
      periodo: { from, to },
      fonte: 'supabase',
      totais: {
        custo_outros_total: resumo.totalOutros,
        custo_imposto1_total: resumo.totalImp1,
        custo_imposto2_total: resumo.totalImp2,
      },
      por_linha: resumo.linhas,
      produtos: resumo.produtos,
    };
    if (out) {
      const abs = join(REPO_ROOT, out);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`JSON gravado em ${out}`);
    } else {
      console.log(JSON.stringify(payload, null, 2));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
