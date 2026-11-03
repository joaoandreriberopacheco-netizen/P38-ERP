/**
 * Motor do relatório Fluxo orgânico × Encomenda (mês civil).
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  competenciaParaIntervalo,
  itensPedidoValidos,
  pedidoElegivelMargem,
  vendaNoIntervaloConsulta,
} from '@/lib/relatorioMargemCalculos';
import { formatEstoqueApresentacao } from '@/lib/productUnits';
import { isPedidoCompraEncomenda } from '@/lib/pedidoCompraEncomenda';
import { resolveQuantidadeBaseItemPedido } from '@/lib/sugestaoCompraEstoquePendente';
import { resolveProdutoAbcdClasse } from '@/lib/catalogAbcdEnrichment';
import { resolveProdutoCustoUnitarioBase } from '@/lib/catalogStockTotals';
import { buildResumoData } from '@/lib/relatorioEstoqueGlobalPdf/generateRelatorioEstoqueGlobalPdf';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function qtyBaseVendaItem(item = {}) {
  const base = Number(item.quantidade_base);
  if (Number.isFinite(base) && base > 0) return base;
  const q = Number(item.quantidade) || 0;
  const f = Number(item.fator_conversao) || 1;
  return q > 0 ? round2(q * f) : 0;
}

function qtyBaseCompraItem(item = {}) {
  return resolveQuantidadeBaseItemPedido(item);
}

function pedidoCompraMesKey(pedido = {}, competencia) {
  const raw =
    pedido.data_aprovacao_financeira ||
    pedido.created_date ||
    pedido.created_at;
  if (!raw) return null;
  const key = String(raw).slice(0, 7);
  return key === competencia ? key : null;
}

function valorCustoBaseProduto(produtosMap, produtoId, qtyBase) {
  const p = produtosMap.get(String(produtoId));
  if (!p || qtyBase <= 0) return 0;
  return round2(qtyBase * resolveProdutoCustoUnitarioBase(p));
}

/** Aloca vendas do mês aos slots de encomenda (FIFO por pedido). */
export function alocarVendasEncomenda(slots = [], vendasPorProduto = {}) {
  const restante = new Map(
    Object.entries(vendasPorProduto).map(([k, v]) => [k, Number(v) || 0]),
  );
  const linhas = slots.map((s) => ({ ...s, qtyAlocada: 0 }));

  for (const slot of linhas) {
    const pid = String(slot.produtoId || '');
    if (!pid) continue;
    const disp = restante.get(pid) || 0;
    const aloca = Math.min(Number(slot.qtyEncomenda) || 0, disp);
    if (aloca <= 0) continue;
    slot.qtyAlocada = round2(aloca);
    restante.set(pid, round2(disp - aloca));
  }

  const vendasOrganicas = {};
  for (const [pid, q] of restante.entries()) {
    if (q > 0.0001) vendasOrganicas[pid] = round2(q);
  }

  return { linhas, vendasOrganicas };
}

export function computeFluxoOrganicoEncomenda({
  competencia,
  pedidosVenda = [],
  pedidosCompra = [],
  produtos = [],
}) {
  const intervalo = competenciaParaIntervalo(competencia);
  const produtosMap = new Map((produtos || []).filter((p) => p?.id).map((p) => [String(p.id), p]));

  const vendasPorProduto = {};
  for (const pedido of pedidosVenda || []) {
    if (!pedidoElegivelMargem(pedido)) continue;
    if (!vendaNoIntervaloConsulta(pedido, intervalo?.from, intervalo?.to)) continue;
    for (const item of itensPedidoValidos(pedido)) {
      const pid = String(item.produto_id || '');
      if (!pid) continue;
      const q = qtyBaseVendaItem(item);
      if (q <= 0) continue;
      vendasPorProduto[pid] = round2((vendasPorProduto[pid] || 0) + q);
    }
  }

  const slotsEncomenda = [];
  const compraEncomendaPorProduto = {};

  for (const pedido of pedidosCompra || []) {
    if (!isPedidoCompraEncomenda(pedido)) continue;
    if (!pedidoCompraMesKey(pedido, competencia)) continue;
    for (const item of pedido.itens || []) {
      const pid = String(item.produto_id || '');
      const q = qtyBaseCompraItem(item);
      if (!pid || q <= 0) continue;
      compraEncomendaPorProduto[pid] = round2((compraEncomendaPorProduto[pid] || 0) + q);
      slotsEncomenda.push({
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero,
        fornecedor: pedido.fornecedor_nome || '—',
        produtoId: pid,
        produtoNome: item.produto_nome || produtosMap.get(pid)?.nome || pid,
        qtyEncomenda: q,
        qtyAlocada: 0,
      });
    }
  }

  slotsEncomenda.sort((a, b) =>
    String(a.pedidoNumero || '').localeCompare(String(b.pedidoNumero || ''), 'pt-BR'),
  );

  const { linhas: linhasEncomenda, vendasOrganicas } = alocarVendasEncomenda(
    slotsEncomenda,
    vendasPorProduto,
  );

  const compraOrganicaPorProduto = {};
  const compraOrganicaPorFornecedor = {};

  for (const pedido of pedidosCompra || []) {
    if (isPedidoCompraEncomenda(pedido)) continue;
    if (!pedidoCompraMesKey(pedido, competencia)) continue;
    const forn = String(pedido.fornecedor_nome || 'Sem fornecedor').trim();
    if (!compraOrganicaPorFornecedor[forn]) {
      compraOrganicaPorFornecedor[forn] = { qtyBase: 0, valorCusto: 0 };
    }
    for (const item of pedido.itens || []) {
      const pid = String(item.produto_id || '');
      const q = qtyBaseCompraItem(item);
      if (!pid || q <= 0) continue;
      compraOrganicaPorProduto[pid] = round2((compraOrganicaPorProduto[pid] || 0) + q);
      compraOrganicaPorFornecedor[forn].qtyBase = round2(compraOrganicaPorFornecedor[forn].qtyBase + q);
      compraOrganicaPorFornecedor[forn].valorCusto = round2(
        compraOrganicaPorFornecedor[forn].valorCusto + valorCustoBaseProduto(produtosMap, pid, q),
      );
    }
  }

  let vendaOrganicaQty = 0;
  let vendaOrganicaCusto = 0;
  for (const [pid, q] of Object.entries(vendasOrganicas)) {
    vendaOrganicaQty = round2(vendaOrganicaQty + q);
    vendaOrganicaCusto = round2(vendaOrganicaCusto + valorCustoBaseProduto(produtosMap, pid, q));
  }

  let compraOrganicaQty = 0;
  let compraOrganicaCusto = 0;
  for (const [pid, q] of Object.entries(compraOrganicaPorProduto)) {
    compraOrganicaQty = round2(compraOrganicaQty + q);
    compraOrganicaCusto = round2(compraOrganicaCusto + valorCustoBaseProduto(produtosMap, pid, q));
  }

  let compraEncomendaQty = 0;
  let vendaAlocadaQty = 0;
  for (const row of linhasEncomenda) {
    compraEncomendaQty = round2(compraEncomendaQty + (Number(row.qtyEncomenda) || 0));
    vendaAlocadaQty = round2(vendaAlocadaQty + (Number(row.qtyAlocada) || 0));
  }

  const estoqueFisico = buildResumoData(produtos, {
    resolveProdutoCustoUnitarioBase,
    formatEstoqueApresentacao,
    resolveProdutoAbcdClasse,
  });

  const abcdMovimento = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const [pid, q] of Object.entries(vendasOrganicas)) {
    const p = produtosMap.get(pid);
    if (!p) continue;
    const cls = resolveProdutoAbcdClasse(p) || 'E';
    if (abcdMovimento[cls] != null) {
      abcdMovimento[cls] = round2(abcdMovimento[cls] + valorCustoBaseProduto(produtosMap, pid, q));
    }
  }

  const topProdutos = Object.entries(vendasOrganicas)
    .map(([pid, vendaQty]) => {
      const p = produtosMap.get(pid);
      const compraQty = compraOrganicaPorProduto[pid] || 0;
      const estoqueVal =
        Math.max(0, Number(p?.estoque_atual) || 0) * (p ? resolveProdutoCustoUnitarioBase(p) : 0);
      return {
        produtoId: pid,
        nome: p?.nome || pid,
        vendaQty,
        compraQty,
        saldoQty: round2(compraQty - vendaQty),
        estoqueValor: round2(estoqueVal),
        abcd: resolveProdutoAbcdClasse(p) || '—',
      };
    })
    .sort((a, b) => b.vendaQty - a.vendaQty)
    .slice(0, 18);

  const fornecedores = Object.entries(compraOrganicaPorFornecedor)
    .map(([nome, agg]) => ({
      nome,
      qtyBase: agg.qtyBase,
      valorCusto: agg.valorCusto,
    }))
    .sort((a, b) => b.valorCusto - a.valorCusto)
    .slice(0, 12);

  const labelMes = intervalo?.from
    ? format(intervalo.from, 'MMMM yyyy', { locale: ptBR })
    : competencia;

  return {
    competencia,
    labelMes,
    geradoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' }),
    organico: {
      vendaQty: vendaOrganicaQty,
      vendaCusto: vendaOrganicaCusto,
      compraQty: compraOrganicaQty,
      compraCusto: compraOrganicaCusto,
      saldoQty: round2(compraOrganicaQty - vendaOrganicaQty),
      saldoCusto: round2(compraOrganicaCusto - vendaOrganicaCusto),
      fornecedores,
      abcdMovimento,
      topProdutos,
      estoqueFinal: estoqueFisico,
    },
    encomenda: {
      compraQty: compraEncomendaQty,
      vendaAlocadaQty,
      saldoQty: round2(compraEncomendaQty - vendaAlocadaQty),
      pedidos: new Set(linhasEncomenda.map((l) => l.pedidoId)).size,
      linhas: linhasEncomenda.slice(0, 40),
    },
  };
}
