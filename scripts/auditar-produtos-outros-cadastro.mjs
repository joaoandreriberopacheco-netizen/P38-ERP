#!/usr/bin/env node
/**
 * Lista produtos com "Outros Custos" (custo_outros_padrao) no cadastro — Supabase.
 *
 * Uso:
 *   npm run audit:produtos-outros-cadastro
 *   npm run audit:produtos-outros-cadastro -- --competencia=2026-07
 *   npm run audit:produtos-outros-cadastro -- --json --out=docs/audit/produtos-outros-cadastro.json
 *
 * Requer: DATABASE_URL
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadDotEnvFiles, REPO_ROOT } from './base44-env.mjs';
import {
  fmtR,
  loadMargemPeriodo,
  loadProdutosComOutrosCadastro,
  parseMargemPeriodArgs,
} from './lib/margemAuditCore.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const outArg = argv.find((a) => a.startsWith('--out='));
  const json = argv.includes('--json');
  const soAtivos = !argv.includes('--todos');
  const periodo = parseMargemPeriodArgs(argv);
  return { out: outArg ? outArg.slice('--out='.length) : '', json, soAtivos, periodo };
}

function agruparPorLinha(produtos) {
  const map = new Map();
  for (const p of produtos) {
    const key = p.linha || 'Outros';
    if (!map.has(key)) map.set(key, { linha: key, quantidade: 0 });
    map.get(key).quantidade += 1;
  }
  return [...map.values()].sort((a, b) => b.quantidade - a.quantidade);
}

function imprimir({ produtos, periodo, vendidosNoPeriodo }) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Produtos com "Outros Custos" cadastrado (Supabase)');
  console.log('═══════════════════════════════════════════════════════════');
  if (periodo) {
    console.log(`  Filtro vendas: ${periodo.from} a ${periodo.to}`);
    console.log(`  Cadastrados com Outros que venderam no período: ${produtos.length}`);
  } else {
    console.log(`  Total no catálogo: ${produtos.length}`);
  }
  console.log('');

  if (!produtos.length) {
    console.log('  Nenhum produto encontrado.');
    console.log('');
    return;
  }

  for (const g of agruparPorLinha(produtos)) {
    console.log(`  ${g.linha.padEnd(28)} ${g.quantidade} produto(s)`);
  }

  console.log('');
  console.log(
    '  Código'.padEnd(12) +
      'Produto'.padEnd(38) +
      'Linha'.padEnd(20) +
      'Out/Un'.padStart(10) +
      'UN'.padStart(6),
  );
  console.log('  ' + '─'.repeat(84));

  for (const p of produtos.slice(0, 80)) {
    const vendido = vendidosNoPeriodo?.get(p.produto_id);
    const sufixo = vendido
      ? ` · período: ${fmtR(vendido.quantidade_base)} base → R$ ${fmtR(vendido.custo_outros_total)}`
      : '';
    console.log(
      `  ${String(p.codigo_interno || '—').slice(0, 10).padEnd(12)}` +
        `${String(p.nome).slice(0, 36).padEnd(38)}` +
        `${String(p.linha).slice(0, 18).padEnd(20)}` +
        `${fmtR(p.outros_unit).padStart(10)}` +
        `${String(p.unidade).slice(0, 4).padStart(6)}` +
        sufixo,
    );
  }

  if (produtos.length > 80) {
    console.log(`  … e mais ${produtos.length - 80}. Use --json para lista completa.`);
  }
  console.log('');
}

async function main() {
  const { out, json, soAtivos, periodo } = parseArgs(process.argv.slice(2));
  const catalogo = await loadProdutosComOutrosCadastro({ soAtivos });

  let produtos = catalogo;
  let vendidosNoPeriodo = null;

  if (periodo) {
    const margem = await loadMargemPeriodo(periodo.from, periodo.to);
    vendidosNoPeriodo = new Map(
      margem.linhas
        .filter((l) => (l.custo_outros_total || 0) > 0)
        .map((l) => [l.produto_id, l]),
    );
    produtos = catalogo.filter((p) => vendidosNoPeriodo.has(p.produto_id));
  }

  imprimir({ produtos, periodo, vendidosNoPeriodo });

  if (out || json) {
    const payload = {
      exportedAt: new Date().toISOString(),
      fonte: 'supabase',
      filtro_periodo: periodo || null,
      total: produtos.length,
      por_linha: agruparPorLinha(produtos),
      produtos: produtos.map((p) => ({
        ...p,
        vendas_periodo: vendidosNoPeriodo?.get(p.produto_id)
          ? {
              quantidade_base: vendidosNoPeriodo.get(p.produto_id).quantidade_base,
              custo_outros_total: vendidosNoPeriodo.get(p.produto_id).custo_outros_total,
            }
          : null,
      })),
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
