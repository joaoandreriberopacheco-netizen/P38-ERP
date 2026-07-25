#!/usr/bin/env node
/**
 * Audita estoque em trânsito (estoque virtual) para um grupo hierárquico do catálogo.
 * Usa só Postgres — sem Base44/browser.
 *
 * Uso:
 *   node scripts/audit-grupo-transito-catalogo.mjs --h1=PISO --h2=45X45
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const PEDIDO_STATUS_QUERY = [
  'Aprovado', 'Aguardando Recepção', 'Aguardando Embarque', 'Enviado', 'Despachado',
  'Em Recepção', 'Em Trânsito', 'Recebido Parcialmente', 'Recebido Parcial', 'Pendência', 'Aguardando',
];

function parseArgs(argv) {
  return {
    h1: argv.find((a) => a.startsWith('--h1='))?.slice(5) || 'PISO',
    h2: argv.find((a) => a.startsWith('--h2='))?.slice(5) || '45X45',
  };
}

function normalizeStatus(value = '') {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function commercialQuantityFromBase(qtyBase, fator) {
  const f = Number(fator) || 1;
  return f > 0 ? (Number(qtyBase) || 0) / f : Number(qtyBase) || 0;
}

function formatEstoqueApresentacao(produto) {
  const alt = Array.isArray(produto.unidades_alternativas) ? produto.unidades_alternativas : [];
  const pref = String(produto.unidade_vitrine || produto.unidade_exibicao || '').trim().toUpperCase();
  const up = String(produto.unidade_principal || 'UN').trim().toUpperCase();
  const option = alt.find((a) => String(a?.unidade || '').toUpperCase() === pref)
    || alt.find((a) => Number(a?.fator_conversao) > 1);
  if (!option?.unidade || !option?.fator_conversao) return null;
  const fator = Number(option.fator_conversao) || 1;
  if (fator <= 0 || option.unidade === up) return null;
  return {
    sigla: option.unidade,
    quantidade: commercialQuantityFromBase(produto.estoque_atual, fator),
  };
}

function resolveExibicao(produto, pendenteBase = 0) {
  const ap = formatEstoqueApresentacao(produto);
  const fisico = ap ? ap.quantidade : Number(produto.estoque_atual) || 0;
  const unidade = ap?.sigla || String(produto.unidade_principal || 'UN').toUpperCase();
  let pendente = 0;
  if (pendenteBase > 0) {
    pendente = ap
      ? commercialQuantityFromBase(pendenteBase, (produto.unidades_alternativas || []).find((a) => a.unidade === ap.sigla)?.fator_conversao || 1)
      : pendenteBase;
  }
  return { fisico, pendente, unidade, total: fisico + pendente };
}

function resolveQuantidadeBaseItemPedido(item = {}) {
  const base = Number(item.quantidade_base);
  if (Number.isFinite(base) && base > 0) return base;
  const qtd = Number(item.quantidade_comercial ?? item.quantidade) || 0;
  const fator = Number(item.fator_aplicado ?? item.fator_conversao) || 1;
  return qtd * fator;
}

function pedidoCompraEstaConcluido(pedido = {}) {
  const statusPedido = normalizeStatus(pedido.status);
  const excl = new Set(['rascunho', 'cancelado', 'rejeitado financeiramente', 'rejeitado', 'concluido', 'devolvido']);
  if (excl.has(statusPedido)) return true;
  const statusReceb = normalizeStatus(pedido.status_recebimento_geral);
  return statusReceb.startsWith('concluido') || statusReceb === 'recebido ok';
}

function pedidoCompraAprovadoNaoConcluido(pedido = {}) {
  if (pedidoCompraEstaConcluido(pedido)) return false;
  const aprov = normalizeStatus(pedido.status_aprovacao_financeira);
  const status = normalizeStatus(pedido.status);
  const ok = new Set(['aprovado financeiramente', 'aprovado', 'enviado', 'despachado', 'em transito', 'em trânsito', 'aguardando recepcao', 'aguardando recepção']);
  return ok.has(aprov) || ok.has(status);
}

function quantidadePendenteItem(item, recebidos = {}) {
  const key = String(item.produto_id || '');
  const pedido = resolveQuantidadeBaseItemPedido(item);
  const recebido = Number(recebidos[key] || 0);
  return Math.max(0, pedido - recebido);
}

async function main() {
  const { h1, h2 } = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const { rows: grupo } = await pool.query(
    `select id, nome, codigo_interno, estoque_atual, unidade_principal,
            campo_hierarquico_1, campo_hierarquico_2, unidades_alternativas, dados
     from public.produto
     where coalesce(ativo, true) = true
       and upper(trim(coalesce(campo_hierarquico_1, ''))) = upper(trim($1))
       and upper(trim(coalesce(campo_hierarquico_2, ''))) like '%' || upper(trim($2)) || '%'
     order by nome`,
    [h1, h2],
  );

  const produtos = grupo.map((row) => ({
    ...row,
    unidades_alternativas: row.unidades_alternativas || row.dados?.unidades_alternativas || [],
    unidade_vitrine: row.dados?.unidade_vitrine,
  }));
  const ids = produtos.map((p) => p.id);

  const { rows: pedidos } = await pool.query(
    `select id, numero, status, status_aprovacao_financeira, status_recebimento_geral
     from public.pedido_compra
     where status = any($1::text[])`,
    [PEDIDO_STATUS_QUERY],
  );

  const { rows: itens } = await pool.query(
    `select pci.*, pc.numero as pedido_numero, pc.status as pedido_status
     from public.pedido_compra_item pci
     join public.pedido_compra pc on pc.id = pci.pedido_compra_id
     where pci.produto_id = any($1::text[])`,
    [ids],
  );

  const { rows: embarques } = await pool.query(
    `select e.id, e.pedido_compra_id, e.status, e.status_recebimento,
            ei.produto_id, ei.quantidade_embarcada_comercial, ei.quantidade_recebida_comercial,
            ei.quantidade_pedida_comercial, ei.unidade_sigla,
            pci.fator_aplicado, pci.quantidade_base, pci.quantidade_comercial
     from public.embarque e
     join public.embarque_item ei on ei.embarque_id = e.id
     left join public.pedido_compra_item pci on pci.id = ei.pedido_compra_item_id
     where ei.produto_id = any($1::text[])`,
    [ids],
  );

  const recebidosPorPedido = {};
  for (const emb of embarques) {
    const pedidoKey = String(emb.pedido_compra_id);
    if (!recebidosPorPedido[pedidoKey]) recebidosPorPedido[pedidoKey] = {};
    const qty = Number(emb.quantidade_recebida_comercial) || 0;
    const qtdPedido = Number(emb.quantidade_comercial) || 0;
    const basePedido = Number(emb.quantidade_base) || 0;
    const fator = Number(emb.fator_aplicado) || (qtdPedido > 0 && basePedido > 0 ? basePedido / qtdPedido : 1);
    const base = qty * fator;
    if (base > 0) {
      const pk = String(emb.produto_id);
      recebidosPorPedido[pedidoKey][pk] = Math.max(recebidosPorPedido[pedidoKey][pk] || 0, base);
    }
  }

  const pendingMap = {};
  const pedidosDetalhe = [];
  const pedidosById = new Map(pedidos.map((p) => [String(p.id), p]));

  for (const item of itens) {
    const pedido = pedidosById.get(String(item.pedido_compra_id));
    if (!pedido || !pedidoCompraAprovadoNaoConcluido(pedido)) continue;
    const recebidos = recebidosPorPedido[String(pedido.id)] || {};
    const pendente = quantidadePendenteItem(item, recebidos);
    if (pendente <= 0) continue;
    const pk = String(item.produto_id);
    pendingMap[pk] = (pendingMap[pk] || 0) + pendente;
    pedidosDetalhe.push({
      pedido: pedido.numero,
      status: pedido.status,
      produto: item.produto_nome,
      qtd_comercial: item.quantidade_comercial,
      unidade: item.unidade_sigla,
      qtd_base_pedido: item.quantidade_base,
      pendente_base: pendente,
    });
  }

  const skus = [];
  let totalFisico = 0;
  let totalTransito = 0;
  let totalVirtual = 0;
  for (const p of produtos) {
    const pendenteBase = Number(pendingMap[String(p.id)] || 0);
    const ex = resolveExibicao(p, pendenteBase);
    totalFisico += ex.fisico;
    totalTransito += ex.pendente;
    totalVirtual += ex.total;
    if (pendenteBase > 0) {
      skus.push({
        nome: p.nome,
        codigo: p.codigo_interno,
        fisico: ex.fisico,
        transito: ex.pendente,
        transito_base: pendenteBase,
        total_virtual: ex.total,
        unidade: ex.unidade,
      });
    }
  }

  await pool.end();

  const report = {
    grupo: `${h1} > ${h2}`,
    resumo: {
      skus_no_grupo: produtos.length,
      skus_com_transito: skus.length,
      fisico_agregado: Number(totalFisico.toFixed(2)),
      transito_agregado: Number(totalTransito.toFixed(2)),
      total_virtual_agregado: Number(totalVirtual.toFixed(2)),
      unidade: skus[0]?.unidade || produtos[0]?.unidade_principal || 'UN',
    },
    skus_com_transito: skus.sort((a, b) => b.transito - a.transito),
    linhas_pedido_aberto: pedidosDetalhe.sort((a, b) => a.pedido.localeCompare(b.pedido)),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
