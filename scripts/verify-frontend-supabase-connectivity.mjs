#!/usr/bin/env node
/**
 * Verifica ligação front ↔ Supabase nos fluxos críticos:
 * PDV, orçamento rápido, tabela de preços, catálogo, pedidos de compra.
 *
 * Uso: node scripts/verify-frontend-supabase-connectivity.mjs
 * Requer: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (e opcional DATABASE_URL para SQL).
 */
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';
import { ENTITY_TO_TABLE } from '../src/integrations/p38/entityTableMap.js';
import { createSupabaseEntityLayer } from '../src/integrations/p38/supabaseEntityLayer.js';

loadDotEnvFiles();

const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

function ok(label, detail) {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function warn(label, detail) {
  console.log(`  ⚠ ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail) {
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function sampleFieldCoverage(rows, fields) {
  if (!rows?.length) return { total: 0, coverage: {} };
  const coverage = {};
  for (const f of fields) {
    const filled = rows.filter((r) => r?.[f] != null && r[f] !== '').length;
    coverage[f] = { filled, pct: Math.round((filled / rows.length) * 100) };
  }
  return { total: rows.length, coverage };
}

async function runEntityChecks(entities) {
  const results = { errors: [], warnings: [] };

  console.log('\n== 1. Produto (PDV, orçamento, tabela de preços, catálogo) ==');

  let produtosAtivos = [];
  try {
    produtosAtivos = await entities.Produto.filter({ ativo: true });
    ok('Produto.filter({ ativo: true })', `${fmt(produtosAtivos.length)} linhas`);
  } catch (e) {
    fail('Produto.filter({ ativo: true })', e.message);
    results.errors.push(e.message);
  }

  try {
    const catalogo = await entities.Produto.list('-created_date', 50);
    ok('Produto.list(-created_date, 50)', `${fmt(catalogo.length)} linhas`);
  } catch (e) {
    fail('Produto.list(-created_date)', e.message);
    results.errors.push(e.message);
  }

  if (produtosAtivos.length) {
    const fields = [
      'nome',
      'codigo_interno',
      'preco_venda_padrao',
      'estoque_atual',
      'unidade_principal',
      'campo_hierarquico_1',
      'unidades_alternativas',
    ];
    const { total, coverage } = sampleFieldCoverage(produtosAtivos.slice(0, 200), fields);
    for (const [f, { filled, pct }] of Object.entries(coverage)) {
      if (pct >= 95) ok(`campo ${f}`, `${pct}% preenchido (${filled}/${total})`);
      else if (pct >= 50) warn(`campo ${f}`, `${pct}% preenchido (${filled}/${total})`);
      else fail(`campo ${f}`, `${pct}% preenchido (${filled}/${total})`);
    }

    const comUnidadesAlt = produtosAtivos.filter(
      (p) => Array.isArray(p.unidades_alternativas) && p.unidades_alternativas.length > 0
    ).length;
    ok('produtos com unidades_alternativas[]', `${fmt(comUnidadesAlt)} de ${fmt(produtosAtivos.length)}`);
  }

  console.log('\n== 2. TabelaPreco (PDV, orçamento, consulta) ==');
  try {
    const tabelas = await entities.TabelaPreco.filter({ ativo: true });
    ok('TabelaPreco.filter({ ativo: true })', `${fmt(tabelas.length)} linhas`);
    const sample = tabelas[0];
    if (sample) {
      const needed = ['nome_tabela', 'fator_ajuste', 'is_default'];
      const missing = needed.filter((k) => sample[k] == null);
      if (missing.length) warn('campos na 1ª tabela', `ausentes: ${missing.join(', ')}`);
      else ok('campos na 1ª tabela', needed.join(', '));
    }
  } catch (e) {
    fail('TabelaPreco.filter', e.message);
    results.errors.push(e.message);
  }

  console.log('\n== 3. PedidoCompra + itens (lista de compras) ==');
  let pedidos = [];
  try {
    pedidos = await entities.PedidoCompra.list('-created_date', 50);
    ok('PedidoCompra.list(-created_date, 50)', `${fmt(pedidos.length)} pedidos`);
  } catch (e) {
    fail('PedidoCompra.list', e.message);
    results.errors.push(e.message);
  }

  if (pedidos.length) {
    const comItensJson = pedidos.filter((p) => Array.isArray(p.itens) && p.itens.length > 0);
    const semItens = pedidos.length - comItensJson.length;
    if (comItensJson.length) {
      ok('pedidos com itens[] (JSON legado)', `${fmt(comItensJson.length)}/${fmt(pedidos.length)}`);
      const totalLinhas = comItensJson.reduce((acc, p) => acc + p.itens.length, 0);
      ok('linhas em itens[] (amostra)', fmt(totalLinhas));
      const comProdutoId = comItensJson.flatMap((p) => p.itens).filter((i) => i?.produto_id).length;
      if (comProdutoId > 0) ok('itens com produto_id', `${fmt(comProdutoId)} linhas`);
      else warn('itens com produto_id', 'nenhum na amostra');
    } else {
      warn('pedidos com itens[]', 'nenhum na amostra — verificar pedido_compra_item');
    }
    if (semItens) warn('pedidos sem itens[]', `${fmt(semItens)} na amostra`);
  }

  console.log('\n== 4. PedidoCompraItem (tabela estruturada) ==');
  try {
    const pci = await entities.PedidoCompraItem.list('-created_at', 20);
    ok('PedidoCompraItem.list', `${fmt(pci.length)} linhas (amostra)`);
    if (pci.length) {
      const fields = ['pedido_compra_id', 'produto_id', 'produto_nome', 'quantidade_comercial'];
      const { coverage } = sampleFieldCoverage(pci, fields);
      for (const [f, { filled, pct }] of Object.entries(coverage)) {
        if (pct >= 90) ok(`PCI.${f}`, `${pct}%`);
        else warn(`PCI.${f}`, `${pct}%`);
      }
    }
  } catch (e) {
    fail('PedidoCompraItem.list', e.message);
    results.errors.push(e.message);
  }

  console.log('\n== 5. Produto.get (detalhe catálogo / compras) ==');
  const idFromPedido = pedidos
    .flatMap((p) => (Array.isArray(p.itens) ? p.itens : []))
    .map((i) => i?.produto_id)
    .find(Boolean);
  const idFromAtivos = produtosAtivos[0]?.id;
  const testId = idFromPedido || idFromAtivos;
  if (testId) {
    try {
      const one = await entities.Produto.get(testId);
      if (one?.id === testId && one?.nome) ok('Produto.get', `"${one.nome}" (${testId.slice(0, 8)}…)`);
      else warn('Produto.get', 'retornou vazio ou incompleto');
    } catch (e) {
      fail('Produto.get', e.message);
      results.errors.push(e.message);
    }
  } else {
    warn('Produto.get', 'sem id para testar');
  }

  console.log('\n== 6. Terceiro (fornecedores em compras) ==');
  try {
    const fornecedores = await entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] }, 'nome', 20);
    ok('Terceiro.filter tipo Fornecedor/Ambos', `${fmt(fornecedores.length)} linhas`);
  } catch (e) {
    fail('Terceiro.filter', e.message);
    results.errors.push(e.message);
  }

  console.log('\n== 7. Embarque (logística compras) ==');
  try {
    const embarques = await entities.Embarque.list('-created_date', 10);
    ok('Embarque.list', `${fmt(embarques.length)} linhas`);
  } catch (e) {
    fail('Embarque.list', e.message);
    results.errors.push(e.message);
  }

  return results;
}

async function runSqlChecks(databaseUrl) {
  console.log('\n== 8. SQL — coerência colunas vs JSONB legado ==');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  try {
    const { rows: prodStats } = await client.query(`
      select
        count(*)::int as total,
        count(*) filter (where nome is not null and nome <> '')::int as nome_col,
        count(*) filter (where (dados->>'nome') is not null)::int as nome_json,
        count(*) filter (where ativo = true)::int as ativos
      from public.produto
    `);
    const p = prodStats[0];
    ok('produto.nome em coluna', `${fmt(p.nome_col)}/${fmt(p.total)}`);
    if (p.nome_json > p.nome_col) warn('produto.nome ainda em dados', `${fmt(p.nome_json)} em JSONB`);

    const { rows: pciStats } = await client.query(`
      select
        (select count(*)::int from public.pedido_compra_item) as pci,
        (select count(*)::int from public.pedido_compra where jsonb_array_length(coalesce(itens, '[]'::jsonb)) > 0) as pc_com_itens_json
    `);
    ok('pedido_compra_item (SQL)', fmt(pciStats[0].pci));
    ok('pedido_compra com itens[] JSON', fmt(pciStats[0].pc_com_itens_json));

    const { rows: tabelaStats } = await client.query(`
      select count(*)::int as total, count(*) filter (where ativo = true)::int as ativos
      from public.tabela_preco
    `);
    ok('tabela_preco', `${fmt(tabelaStats[0].ativos)} ativas / ${fmt(tabelaStats[0].total)} total`);
  } finally {
    await client.end();
  }
}

async function main() {
  const secrets = resolveP38Secrets();
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

  console.log('== Verificação front ↔ Supabase ==');
  console.log(`URL: ${url ? url.replace(/https:\/\/([^.]+).*/, 'https://$1…') : '(ausente)'}`);
  console.log(`Entidades mapeadas: ${Object.keys(ENTITY_TO_TABLE).length}`);

  if (!url || !anonKey) {
    console.error('\nFalta VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY.');
    process.exit(1);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const entities = createSupabaseEntityLayer(null, supabase);
  const results = await runEntityChecks(entities);

  if (secrets.databaseUrl) {
    try {
      await runSqlChecks(secrets.databaseUrl);
    } catch (e) {
      fail('SQL checks', e.message);
      results.errors.push(e.message);
    }
  } else {
    warn('SQL checks', 'DATABASE_URL ausente — só REST testado');
  }

  console.log('\n== Resumo ==');
  if (results.errors.length === 0) {
    console.log('Ligação OK: queries do frontend respondem no Supabase.');
    console.log('Para testar na UI: VITE_P38_PROVIDER=supabase + npm run dev');
    process.exit(0);
  }
  console.log(`${results.errors.length} erro(s):`);
  results.errors.forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
