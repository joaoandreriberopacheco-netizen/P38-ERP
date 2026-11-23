import { roundToTwoDecimals } from '@/lib/financialUtils';
import { totalLinhaPedidoCompraAtualizado } from '@/lib/pedidoCompraFinanceiro';
import {
  calcTotalItemCompraPedido,
  normalizeItemToCanonicalFactorOne,
  repararLinhaCompraApresentacaoComProduto,
  syncItemDescontoApresentacao,
} from '@/lib/productUnits';

const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;

export function newDespesaRateadaRow({ descricao = '', valor = 0 } = {}) {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    descricao: String(descricao || '').trim(),
    valor: roundToTwoDecimals(Math.max(0, Number(valor) || 0)),
  };
}

/** Normaliza linhas para edição (mantém rascunho vazio recém-adicionado). */
export function normalizeDespesasRateadasForEdit(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => ({
    id: row?.id || newDespesaRateadaRow().id,
    descricao: String(row?.descricao || '').trim(),
    valor: roundToTwoDecimals(Math.max(0, Number(row?.valor) || 0)),
  }));
}

/** Linha com dados mínimos para entrar no pedido (gravar ou ratear). */
export function despesaRateadaProntaParaPersistir(row) {
  const descricao = String(row?.descricao || '').trim();
  const valor = roundToTwoDecimals(Math.max(0, Number(row?.valor) || 0));
  return Boolean(descricao || valor > 0);
}

/** Lista para gravar no pedido — omite linhas sem descrição nem valor. */
export function normalizeDespesasRateadas(raw) {
  return normalizeDespesasRateadasForEdit(raw).filter(despesaRateadaProntaParaPersistir);
}

export function somaDespesasRateadas(despesas) {
  return roundToTwoDecimals(
    normalizeDespesasRateadas(despesas).reduce((acc, row) => acc + row.valor, 0),
  );
}

/** Acréscimo no total do pedido (cabeçalho) — despesas não entram na soma de mercadoria do catálogo. */
export function acrescimoDespesasRateadasNoTotalPedido(despesas) {
  return somaDespesasRateadas(despesas);
}

function resolveQuantidadeBase(item = {}) {
  const qb = Number(item.quantidade_base);
  if (Number.isFinite(qb) && qb > 0) return qb;
  const q = Number(item.quantidade) || 0;
  const f = Number(item.fator_conversao) || 1;
  return q * f;
}

/** Outros por unidade fator-1 sem a parte rateada (manual). */
export function resolveOutrosUnitarioManual(item = {}) {
  if (item.outros_unitario_fator1_manual != null) {
    return Math.max(0, Number(item.outros_unitario_fator1_manual) || 0);
  }
  const outros = Number(item.outros_unitario_fator1 ?? item.custo_outros_unitario) || 0;
  const rateado = Number(item.despesa_rateada_outros_fator1) || 0;
  return Math.max(0, outros - rateado);
}

/**
 * Valor financeiro da linha (mercadoria), base do rateio proporcional — sem despesas rateadas.
 */
export function valorFinanceiroLinhaPedido(item = {}, produto = null) {
  const manual = resolveOutrosUnitarioManual(item);
  const base = {
    ...item,
    outros_unitario_fator1: manual,
    custo_outros_unitario: manual,
    despesa_rateada_outros_fator1: 0,
  };
  return Math.max(0, totalLinhaPedidoCompraAtualizado(base, produto));
}

function finalizeItemAposRateio(item = {}, produto = null) {
  let line = produto ? repararLinhaCompraApresentacaoComProduto(item, produto) : { ...item };
  line = syncItemDescontoApresentacao(line);
  const cost = roundToTwoDecimals(parseFloat(line.custo_unitario) || 0);
  const descUnit = roundToTwoDecimals(parseFloat(line.valor_desconto_item) || 0);
  const frete = Number(line.frete_unitario_fator1 ?? line.custo_frete_unitario) || 0;
  const outros = Number(line.outros_unitario_fator1) || 0;
  const fator = Number(line.fator_conversao) || 1;
  const custoFinalUnitario = roundToTwoDecimals(cost - descUnit + frete + outros);
  line.custo_final_unitario = custoFinalUnitario;
  line.custo_final_unitario_apresentacao = roundToTwoDecimals(custoFinalUnitario * fator);
  line.custo_total_unitario_fator1 = custoFinalUnitario;
  line.total = calcTotalItemCompraPedido(line);
  line.valor_total_item = line.total;
  return normalizeItemToCanonicalFactorOne(line, 'custo');
}

/**
 * Distribui despesas (ex.: frete do fornecedor) nas linhas via `outros_unitario_fator1`.
 * Persistência: `despesas_rateadas` no pedido; rateio fica nos itens (espelho + PedidoCompraItem).
 */
export function aplicarRateioDespesasNosItens(itens = [], despesas = [], produtosById = {}) {
  const lista = (itens || []).filter((i) => i?.produto_id);
  const totalDespesas = somaDespesasRateadas(despesas);

  if (!lista.length) return [...(itens || [])];

  if (totalDespesas <= 0) {
    return (itens || []).map((it) => {
      if (!it?.produto_id) return it;
      const manual = resolveOutrosUnitarioManual(it);
      const produto = produtosById[it.produto_id];
      return finalizeItemAposRateio(
        {
          ...it,
          outros_unitario_fator1: manual,
          custo_outros_unitario: manual,
          despesa_rateada_outros_fator1: 0,
          outros_unitario_fator1_manual: manual,
        },
        produto,
      );
    });
  }

  const pesos = lista.map((it) => {
    const produto = produtosById[it.produto_id];
    const manual = resolveOutrosUnitarioManual(it);
    const vFin = valorFinanceiroLinhaPedido(it, produto);
    return { it, produto, manual, vFin };
  });
  const somaPeso = pesos.reduce((s, p) => s + p.vFin, 0);

  let residual = totalDespesas;
  const alocadoPorId = new Map();

  pesos.forEach((p, idx) => {
    let share = 0;
    if (somaPeso > 0) {
      share = idx === pesos.length - 1 ? residual : roundToTwoDecimals(totalDespesas * (p.vFin / somaPeso));
      if (idx < pesos.length - 1) residual = roundToTwoDecimals(residual - share);
    } else if (pesos.length > 0) {
      share = idx === pesos.length - 1 ? residual : roundToTwoDecimals(totalDespesas / pesos.length);
      if (idx < pesos.length - 1) residual = roundToTwoDecimals(residual - share);
    }
    const qBase = resolveQuantidadeBase(p.it);
    const rateioF1 = qBase > 0 ? share / qBase : 0;
    const outros = p.manual + rateioF1;
    const key = p.it.item_key || p.it.produto_id;
    alocadoPorId.set(
      key,
      finalizeItemAposRateio(
        {
          ...p.it,
          outros_unitario_fator1: round6(outros),
          custo_outros_unitario: round6(outros),
          despesa_rateada_outros_fator1: round6(rateioF1),
          outros_unitario_fator1_manual: p.manual,
        },
        p.produto,
      ),
    );
  });

  return (itens || []).map((it) => {
    const key = it?.item_key || it?.produto_id;
    if (key && alocadoPorId.has(key)) return alocadoPorId.get(key);
    return it;
  });
}