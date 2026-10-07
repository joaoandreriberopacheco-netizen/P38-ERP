#!/usr/bin/env node
/**
 * Soma a composição de custos do Relatório de Margem (julho ou qualquer período).
 *
 * Uso:
 *   npm run audit:margem-composicao -- --competencia=2026-07
 *   npm run audit:margem-composicao -- --from=2026-07-01 --to=2026-07-31 --json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadDotEnvFiles, REPO_ROOT } from './base44-env.mjs';
import {
  CUSTO_MARGEM_CAMPOS,
  fmtR,
  loadMargemPeriodo,
  parseMargemPeriodArgs,
  roundMoney,
} from './lib/margemAuditCore.mjs';

loadDotEnvFiles();

function printComposicao({ from, to, fonte, totais, linhas }) {
  const somaComponentes = roundMoney(
    CUSTO_MARGEM_CAMPOS.reduce((s, c) => s + (totais[c.totalKey] || 0), 0),
  );

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Relatório de Margem — composição de custos');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Período: ${from} a ${to} (fuso Rio Branco, UTC-5)`);
  console.log(`  Fonte: ${fonte}`);
  console.log(`  Produtos no período: ${linhas.length}`);
  console.log(`  Regra: custos do cadastro ATUAL × qtd base vendida`);
  console.log('');
  console.log('── Resultado (espelho do relatório) ──');
  console.log('');
  console.log(`  Receita líquida     R$ ${fmtR(totais.receita_liquida)}`);
  console.log(`  Custo total         R$ ${fmtR(totais.custo_total)}`);
  console.log(`  Lucro               R$ ${fmtR(totais.lucro_total)}`);
  console.log(`  Markup              ${fmtR(totais.markup_percentual)}%`);
  console.log('');
  console.log('── Composição do custo ──');
  console.log('');

  for (const campo of CUSTO_MARGEM_CAMPOS) {
    const valor = totais[campo.totalKey] || 0;
    const pct = somaComponentes > 0 ? ((valor / somaComponentes) * 100).toFixed(1) : '0.0';
    console.log(
      `  ${campo.label.padEnd(14)} R$ ${fmtR(valor).padStart(14)}   (${pct}% do custo)`,
    );
  }

  console.log('  ' + '─'.repeat(44));
  console.log(`  ${'Soma componentes'.padEnd(14)} R$ ${fmtR(somaComponentes).padStart(14)}`);
  if (Math.abs(somaComponentes - totais.custo_total) > 0.02) {
    console.log(
      `  ${'Diferença*'.padEnd(14)} R$ ${fmtR(totais.custo_total - somaComponentes).padStart(14)}`,
    );
    console.log('  * Arredondamentos ou cadastros só com preco_custo_calculado preenchido.');
  }
  console.log('');
  console.log('  Nota: desconto comercial de compra já está diluído na linha Compra.');
  console.log('');
}

async function main() {
  const args = parseMargemPeriodArgs(process.argv.slice(2));
  if (!args) {
    console.error(
      'Uso: npm run audit:margem-composicao -- --competencia=YYYY-MM\n' +
        '     npm run audit:margem-composicao -- --from=YYYY-MM-DD --to=YYYY-MM-DD [--json] [--out=caminho.json]',
    );
    process.exit(1);
  }

  const { from, to, out, json } = args;
  const { fonte, linhas, totais } = await loadMargemPeriodo(from, to);
  printComposicao({ from, to, fonte, totais, linhas });

  if (out || json) {
    const payload = {
      exportedAt: new Date().toISOString(),
      periodo: { from, to },
      fonte,
      totais,
      composicao: Object.fromEntries(
        CUSTO_MARGEM_CAMPOS.map((c) => [c.label, totais[c.totalKey] || 0]),
      ),
      quantidade_produtos: linhas.length,
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
