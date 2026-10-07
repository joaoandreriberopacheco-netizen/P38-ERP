#!/usr/bin/env node
/**
 * Job Curva ABCD local (Postgres) — mesma regra que calcularIEP / abcdCurvaOrganizacao.
 * Evita timeout da Edge Function em catálogos grandes.
 *
 *   node scripts/executar-abcd-job-local.mjs
 *   node scripts/executar-abcd-job-local.mjs --somente-vazios
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { resolveP38Secrets } from './p38-secrets.mjs';
import {
  classificarGruposAbcdPareto,
  grupoAbcdKey,
  ABCD_CURVA_VERSAO,
  ABCD_REGRAS,
} from '../src/lib/abcdCurvaOrganizacao.js';

const BATCH = 100;
const args = new Set(process.argv.slice(2));
const somenteVazios = args.has('--somente-vazios');

function q3(values) {
  if (!values?.length) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function lineQuantityBase(item) {
  const qtyBase = item?.quantidade_base;
  if (qtyBase != null && Number(qtyBase) > 0) return Number(qtyBase);
  const qty = Number(item?.quantidade_comercial ?? item?.quantidade) || 0;
  const fator = Number(item?.fator_aplicado ?? item?.fator_conversao) || 1;
  return qty * fator;
}

function lineReceitaItem(it) {
  const total = Number(it?.total);
  if (Number.isFinite(total) && total > 0) return total;
  const qtyBase = lineQuantityBase(it);
  if (qtyBase > 0) {
    const unit =
      Number(it?.preco_final_unitario_fator1) ||
      Number(it?.preco_unitario_fator1) ||
      Number(it?.preco_unitario_praticado) ||
      Number(it?.preco_unitario) ||
      0;
    if (unit > 0) return qtyBase * unit;
  }
  const qtyCom = Number(it?.quantidade_comercial ?? it?.quantidade) || 0;
  const precoCom = Number(it?.preco_unitario_comercial) || 0;
  if (qtyCom > 0 && precoCom > 0) return qtyCom * precoCom;
  return 0;
}

function resolveCusto(produto) {
  const v = Number(produto.preco_custo_calculado ?? produto.dados?.preco_custo_calculado);
  return Number.isFinite(v) ? v : 0;
}

function pedidoElegivel(row) {
  const status = String(row.pedido_status ?? '');
  if (status === 'Cancelado' || status === 'Rascunho') return false;
  const tipo = String(row.pedido_tipo ?? 'PDV').trim().toUpperCase();
  return tipo === 'PEDIDO' || tipo === 'PDV' || tipo.startsWith('PDV ');
}

function calcularLucroSku(produto, itens) {
  const custoUnit = resolveCusto(produto);
  if (!itens?.length) {
    return { lucro: 0, receita: 0, teveVenda: false };
  }
  const linhas = itens
    .map((it) => {
      const qtyBase = lineQuantityBase(it);
      const total = lineReceitaItem(it);
      const unitPrice = qtyBase > 0 ? total / qtyBase : 0;
      return { unitPrice, qtyBase, total };
    })
    .filter((l) => l.qtyBase > 0 && l.total > 0);

  if (!linhas.length) {
    return { lucro: 0, receita: 0, teveVenda: false };
  }

  const unitPrices = linhas.map((l) => l.unitPrice);
  const limiteQ3 = q3(unitPrices);
  const linhasCore = linhas.length < 4 ? linhas : linhas.filter((l) => l.unitPrice <= limiteQ3);
  const quantidade = linhasCore.reduce((a, l) => a + l.qtyBase, 0);
  const receita = linhasCore.reduce((a, l) => a + l.total, 0);
  const lucro = receita - custoUnit * quantidade;
  return { lucro, receita, teveVenda: quantidade > 0 };
}

function produtoAbcdVazio(p) {
  return !String(p.abcd ?? p.dados?.abcd ?? '').trim();
}

function buildAbcd(produto, mapa, skusSemVenda) {
  if (skusSemVenda.has(String(produto.id))) return 'E';
  return mapa[grupoAbcdKey(produto)] || 'D';
}

const client = new pg.Client({
  connectionString: resolveP38Secrets().databaseUrl.trim(),
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('[abcd:local] Versão', ABCD_CURVA_VERSAO);
console.log('[abcd:local] Regras', ABCD_REGRAS);
console.log('[abcd:local] somente_vazios:', somenteVazios);

const produtos = await client.query(`
  select id, campo_hierarquico_1, campo_hierarquico_2, abcd, dados,
         preco_custo_calculado
  from public.produto
  order by created_at desc nulls last
`);

const itensRows = await client.query(`
  select pvi.*,
         coalesce(pv.status, pv.dados->>'status') as pedido_status,
         coalesce(pv.tipo, pv.dados->>'tipo') as pedido_tipo
  from public.pedido_venda_item pvi
  join public.pedido_venda pv on pv.id = pvi.pedido_venda_id
  where pv.created_at >= now() - interval '90 days'
     or pvi.created_at >= now() - interval '90 days'
`);

const itensPorProduto = {};
let pedidosEleg = 0;
const pedidosVistos = new Set();

for (const row of itensRows.rows) {
  if (!pedidoElegivel(row)) continue;
  if (row.pedido_venda_id) pedidosVistos.add(row.pedido_venda_id);
  const pid = row.produto_id;
  if (!pid) continue;
  if (!itensPorProduto[pid]) itensPorProduto[pid] = [];
  itensPorProduto[pid].push(row);
}
pedidosEleg = pedidosVistos.size;

const lucroPorGrupo = {};
const receitaPorGrupo = {};
const metricas = {};
const skusSemVenda = new Set();

for (const p of produtos.rows) {
  const m = calcularLucroSku(p, itensPorProduto[p.id]);
  metricas[p.id] = m;
  if (!m.teveVenda) skusSemVenda.add(String(p.id));
  const key = grupoAbcdKey(p);
  lucroPorGrupo[key] = (lucroPorGrupo[key] || 0) + m.lucro;
  receitaPorGrupo[key] = (receitaPorGrupo[key] || 0) + m.receita;
}

const entradas = Object.keys(lucroPorGrupo).map((id) => ({
  id,
  lucro: lucroPorGrupo[id],
  receita: receitaPorGrupo[id] || 0,
}));

const { mapaAbcdGrupo } = classificarGruposAbcdPareto(entradas);

const targets = produtos.rows.filter((p) => !somenteVazios || produtoAbcdVazio(p));
console.log('[abcd:local] Produtos:', produtos.rows.length, '| a gravar:', targets.length, '| pedidos eleg. 90d:', pedidosEleg, '| grupos:', entradas.length);

let atualizados = 0;
const dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

for (let i = 0; i < targets.length; i += BATCH) {
  const chunk = targets.slice(i, i + BATCH);
  await client.query('BEGIN');
  try {
    for (const p of chunk) {
      const abcd = buildAbcd(p, mapaAbcdGrupo, skusSemVenda);
      dist[abcd] = (dist[abcd] || 0) + 1;
      await client.query(
        `update public.produto set abcd = $2, updated_at = now() where id = $1`,
        [p.id, abcd],
      );
      atualizados += 1;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  console.log(`[abcd:local] … ${atualizados}/${targets.length}`);
}

const piso45 = entradas
  .filter((e) => e.id.toUpperCase().includes('PISO') && e.id.toUpperCase().includes('45'))
  .map((e) => ({
    grupo: e.id.replace('\x00', ' > '),
    lucro: Math.round(e.lucro * 100) / 100,
    receita: Math.round(e.receita * 100) / 100,
    classe: mapaAbcdGrupo[e.id],
  }));

console.log(JSON.stringify({
  ok: true,
  atualizados,
  distribuicao: dist,
  grupos_piso_45: piso45,
  run_id: randomUUID(),
}, null, 2));

await client.end();
