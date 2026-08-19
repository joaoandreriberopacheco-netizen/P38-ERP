#!/usr/bin/env node
/**
 * Lista produtos com campo "Outros Custos" (custo_outros_padrao) preenchido no cadastro.
 *
 * Uso:
 *   npm run audit:produtos-outros-cadastro
 *   npm run audit:produtos-outros-cadastro -- --competencia=2026-07
 *     (só produtos que também venderam no período)
 *   npm run audit:produtos-outros-cadastro -- --json --out=docs/audit/produtos-outros-cadastro.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { loadDotEnvFiles, REPO_ROOT, requireBase44Client } from './base44-env.mjs';
import {
  fmtR,
  loadMargemPeriodo,
  mapProductRow,
  parseMargemPeriodArgs,
  roundMoney,
} from './lib/margemAuditCore.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const outArg = argv.find((a) => a.startsWith('--out='));
  const json = argv.includes('--json');
  const soAtivos = !argv.includes('--todos');
  const periodo = parseMargemPeriodArgs(argv);
  return {
    out: outArg ? outArg.slice('--out='.length) : '',
    json,
    soAtivos,
    periodo,
  };
}

async function loadCatalogoPostgres(soAtivos) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const filtroAtivo = soAtivos ? 'and coalesce(p.ativo, (p.dados->>\'ativo\')::boolean, true) = true' : '';
    const { rows } = await client.query(
      `
      select
        p.id,
        coalesce(p.nome, p.dados->>'nome', '') as nome,
        coalesce(p.codigo_interno, p.dados->>'codigo_interno', '') as codigo_interno,
        coalesce(p.campo_hierarquico_1, p.dados->>'campo_hierarquico_1', 'Outros') as linha,
        coalesce(p.campo_hierarquico_2, p.dados->>'campo_hierarquico_2', '') as grupo,
        coalesce(p.categoria_nome, p.dados->>'categoria_nome', '') as categoria,
        coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) as outros_unit,
        coalesce(p.unidade_principal, p.dados->>'unidade_principal', 'UN') as unidade,
        coalesce(p.ativo, (p.dados->>'ativo')::boolean, true) as ativo
      from public.produto p
      where coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) > 0
      ${filtroAtivo}
      order by outros_unit desc, nome asc
      `,
    );
    return rows.map((r) => ({
      produto_id: r.id,
      codigo_interno: r.codigo_interno,
      nome: r.nome,
      linha: r.linha || 'Outros',
      grupo: r.grupo || '',
      categoria: r.categoria || '',
      outros_unit: roundMoney(r.outros_unit),
      unidade: r.unidade || 'UN',
      ativo: r.ativo !== false,
    }));
  } finally {
    await client.end();
  }
}

async function loadCatalogoBase44(soAtivos) {
  const base44 = requireBase44Client();
  const produtos = [];
  let skip = 0;
  for (let page = 0; page < 80; page += 1) {
    const batch = await base44.entities.Produto.list('-created_date', 500, skip);
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
    if (!rows.length) break;
    let novos = 0;
    for (const row of rows) {
      if (!row?.id || produtos.some((p) => p.id === row.id)) continue;
      const mapped = mapProductRow(row);
      if (soAtivos && row.ativo === false) continue;
      if (mapped.custo_outros_padrao > 0) {
        produtos.push({
          produto_id: mapped.id,
          codigo_interno: row.codigo_interno ?? row.dados?.codigo_interno ?? '',
          nome: mapped.nome,
          linha: mapped.campo_hierarquico_1,
          grupo: mapped.campo_hierarquico_2,
          categoria: mapped.categoria_nome,
          outros_unit: roundMoney(mapped.custo_outros_padrao),
          unidade: row.unidade_principal ?? row.dados?.unidade_principal ?? 'UN',
          ativo: row.ativo !== false,
        });
      }
      novos += 1;
    }
    if (rows.length < 500 || novos === 0) break;
    skip += 500;
  }
  return produtos.sort((a, b) => b.outros_unit - a.outros_unit || a.nome.localeCompare(b.nome));
}

async function loadCatalogo(soAtivos) {
  const pgRows = await loadCatalogoPostgres(soAtivos).catch((err) => {
    console.warn('[postgres]', err?.message || err);
    return null;
  });
  if (pgRows) return { fonte: 'postgres', produtos: pgRows };
  const b44Rows = await loadCatalogoBase44(soAtivos);
  return { fonte: 'base44', produtos: b44Rows };
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

function imprimir({ fonte, produtos, periodo, vendidosNoPeriodo }) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Produtos com "Outros Custos" cadastrado');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Fonte: ${fonte}`);
  if (periodo) {
    console.log(`  Filtro vendas: ${periodo.from} a ${periodo.to}`);
    console.log(`  Produtos cadastrados com Outros que venderam no período: ${produtos.length}`);
  } else {
    console.log(`  Total no catálogo: ${produtos.length}`);
  }
  console.log('');

  if (!produtos.length) {
    console.log('  Nenhum produto encontrado.');
    console.log('');
    return;
  }

  const linhas = agruparPorLinha(produtos);
  console.log('── Por linha de produto ──');
  for (const g of linhas) {
    console.log(`  ${g.linha.padEnd(28)} ${g.quantidade} produto(s)`);
  }

  console.log('');
  console.log('── Lista (Outros/unidade base) ──');
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
      ? ` · jul: ${fmtR(vendido.quantidade_base)} base → R$ ${fmtR(vendido.custo_outros_total)}`
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
  const { fonte, produtos: catalogo } = await loadCatalogo(soAtivos);

  let produtos = catalogo;
  let vendidosNoPeriodo = null;

  if (periodo) {
    const margem = await loadMargemPeriodo(periodo.from, periodo.to);
    vendidosNoPeriodo = new Map(
      margem.linhas
        .filter((l) => (l.custo_outros_total || 0) > 0)
        .map((l) => [l.produto_id, l]),
    );
    const idsVendidos = new Set(vendidosNoPeriodo.keys());
    produtos = catalogo.filter((p) => idsVendidos.has(p.produto_id));
  }

  imprimir({ fonte, produtos, periodo, vendidosNoPeriodo });

  if (out || json) {
    const payload = {
      exportedAt: new Date().toISOString(),
      fonte,
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
