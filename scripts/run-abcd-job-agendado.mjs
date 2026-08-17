#!/usr/bin/env node
/**
 * Recalcula curva ABCDE e grava em produto.abcd (SQL directo + mesma regra do job calcularIEP).
 * Usado pelo workflow GitHub Actions (sábado 00:00 Tabatinga) e manualmente:
 *   npm run abcd:recalcular
 *
 * Secrets: DATABASE_URL
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import {
  ABCD_CURVA_VERSAO,
  abcdClasseParaProduto,
  agregarLucroPorGrupoAbcd,
  classificarGruposAbcdPareto,
} from '../src/lib/abcdCurvaOrganizacao.js';

loadDotEnvFiles();

const BATCH_SIZE = 50;
const JANELA_DIAS = 90;

function q3(values) {
  if (!values || values.length === 0) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function lineQuantityBase(item) {
  const qtyBase = item?.quantidade_base;
  if (qtyBase != null && Number.isFinite(Number(qtyBase)) && Number(qtyBase) > 0) {
    return Number(qtyBase) || 0;
  }
  const qty = Number(item?.quantidade ?? item?.quantidade_comercial) || 0;
  const fator = Number(item?.fator_conversao ?? item?.fator_aplicado) || 1;
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

function resolveCustoCalculado(produto) {
  const salvo = Number(produto?.preco_custo_calculado);
  return Number.isFinite(salvo) ? salvo : 0;
}

function calcularLucroSkuComQ4(produto, itens) {
  const custoUnit = resolveCustoCalculado(produto);
  const list = Array.isArray(itens) ? itens : [];

  if (list.length === 0) {
    return { lucro: 0, precoMedio: 0, quantidade: 0, teveVenda: false, receita: 0 };
  }

  const linhas = list
    .map((it) => {
      const qtyBase = lineQuantityBase(it);
      const total = lineReceitaItem(it);
      const unitPrice = qtyBase > 0 ? total / qtyBase : 0;
      return { unitPrice, qtyBase, total };
    })
    .filter((l) => l.qtyBase > 0 && l.total > 0);

  if (linhas.length === 0) {
    return { lucro: 0, precoMedio: 0, quantidade: 0, teveVenda: false, receita: 0 };
  }

  const unitPrices = linhas.map((l) => l.unitPrice);
  const limiteQ3 = q3(unitPrices);
  const linhasCore = linhas.length < 4 ? linhas : linhas.filter((l) => l.unitPrice <= limiteQ3);

  const quantidade = linhasCore.reduce((acc, l) => acc + l.qtyBase, 0);
  const receita = linhasCore.reduce((acc, l) => acc + l.total, 0);
  const precoMedio = quantidade > 0 ? receita / quantidade : 0;
  const lucro = receita - custoUnit * quantidade;

  return { lucro, precoMedio, quantidade, teveVenda: quantidade > 0, receita };
}

function mapItemRow(row) {
  return {
    produto_id: row.produto_id,
    quantidade_base: row.quantidade_base,
    quantidade_comercial: row.quantidade_comercial,
    fator_aplicado: row.fator_aplicado,
    total: row.total,
    preco_final_unitario_fator1: row.preco_final_unitario_fator1,
    preco_unitario_fator1: row.preco_unitario_fator1,
    preco_unitario_praticado: row.preco_unitario_praticado,
    preco_unitario: row.preco_unitario,
    preco_unitario_comercial: row.preco_unitario_comercial,
  };
}

async function carregarProdutos(client) {
  const { rows } = await client.query(`
    select
      id,
      campo_hierarquico_1,
      campo_hierarquico_2,
      preco_custo_calculado,
      abcd,
      coalesce(ativo, true) as ativo
    from public.produto
    order by created_at desc nulls last
  `);
  return rows;
}

async function carregarItens90d(client) {
  const { rows } = await client.query(`
    select
      pvi.produto_id,
      pvi.quantidade_base,
      pvi.quantidade_comercial,
      pvi.fator_aplicado,
      pvi.total,
      pvi.preco_final_unitario_fator1,
      pvi.preco_unitario_fator1,
      (pvi.dados->>'preco_unitario_praticado')::numeric as preco_unitario_praticado,
      coalesce((pvi.dados->>'preco_unitario')::numeric, pvi.preco_unitario_fator1) as preco_unitario,
      pvi.preco_unitario_comercial
    from public.pedido_venda_item pvi
    inner join public.pedido_venda pv on pv.id = pvi.pedido_venda_id
    where coalesce(pv.status, pv.dados->>'status', '') <> 'Cancelado'
      and coalesce(pv.created_at, (pv.dados->>'created_date')::timestamptz, pv.updated_at)
          >= now() - interval '${JANELA_DIAS} days'
      and (
        upper(trim(coalesce(pv.tipo, pv.dados->>'tipo', 'PDV'))) = 'PEDIDO'
        or upper(trim(coalesce(pv.tipo, pv.dados->>'tipo', 'PDV'))) like 'PDV%'
      )
      and pvi.produto_id is not null
  `);

  const itensPorProduto = {};
  for (const row of rows) {
    const pid = String(row.produto_id);
    if (!itensPorProduto[pid]) itensPorProduto[pid] = [];
    itensPorProduto[pid].push(mapItemRow(row));
  }
  return itensPorProduto;
}

function produtoAbcdVazio(produto) {
  return !String(produto?.abcd ?? '').trim();
}

async function gravarLote(client, updates) {
  if (!updates.length) return 0;
  const ids = updates.map((u) => u.id);
  const letters = updates.map((u) => u.abcd);
  await client.query(
    `
    update public.produto p
    set abcd = v.letra,
        updated_at = now()
    from (
      select unnest($1::text[]) as id, unnest($2::text[]) as letra
    ) v
    where p.id::text = v.id
    `,
    [ids, letters],
  );
  return updates.length;
}

async function main() {
  const somenteVazios = process.argv.includes('--somente-vazios');
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('[abcd:recalcular] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log('[abcd:recalcular] Carregando produtos e vendas 90d…');
    const [produtos, itensPorProduto] = await Promise.all([
      carregarProdutos(client),
      carregarItens90d(client),
    ]);

    const elegiveis = produtos.filter((p) => !somenteVazios || produtoAbcdVazio(p));
    if (!elegiveis.length) {
      console.log('[abcd:recalcular] Nenhum produto pendente.');
      return;
    }

    const metricasPorSku = {};
    for (const produto of produtos) {
      const pid = String(produto.id);
      metricasPorSku[pid] = calcularLucroSkuComQ4(produto, itensPorProduto[pid]);
    }

    const entradasGrupo = agregarLucroPorGrupoAbcd(produtos, metricasPorSku);
    const { mapaAbcdGrupo, grupos } = classificarGruposAbcdPareto(entradasGrupo);

    const updates = [];
    for (const produto of elegiveis) {
      const pid = String(produto.id);
      const abcd = abcdClasseParaProduto(produto, mapaAbcdGrupo, metricasPorSku[pid]);
      updates.push({ id: produto.id, abcd });
    }

    console.log(
      '[abcd:recalcular] Classificação pronta —',
      updates.length,
      'produtos,',
      grupos,
      'grupos, versão',
      ABCD_CURVA_VERSAO,
    );

    let gravados = 0;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const lote = updates.slice(i, i + BATCH_SIZE);
      gravados += await gravarLote(client, lote);
      console.log(`[abcd:recalcular] Gravado ${gravados}/${updates.length}`);
    }

    const porLetra = updates.reduce((acc, u) => {
      acc[u.abcd] = (acc[u.abcd] || 0) + 1;
      return acc;
    }, {});

    console.log('[abcd:recalcular] Concluído.');
    console.log(JSON.stringify({ status: 'sucesso', atualizados: gravados, abcd_por_letra: porLetra }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[abcd:recalcular]', err.message);
  process.exit(1);
});
