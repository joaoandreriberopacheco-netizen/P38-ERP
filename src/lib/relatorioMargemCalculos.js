/**
 * Cálculos do relatório de margem — reutilizáveis (ex.: Plano completo em Budgets).
 * Receita: valor_total do pedido (como Consulta de Vendas), rateado nas linhas.
 * Custo: `preco_custo_calculado` do cadastro (fator-1, mantido pelo trigger SQL
 * `p38_calc_preco_custo_fator1`). Componentes abaixo são só para detalhe na UI.
 * Desconto comercial diluído no valor de compra — não exibido como linha separada.
 */

import { toLocalDateKey } from '@/components/utils/dateUtils';
import { STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA } from '@/lib/pdvCaixaTurnoVendas';
import {
  resolveAvariaCompraFator1,
  resolveCustoTotalUnitBaseProduto,
  resolveValorDescontoCompraPadraoFator1,
} from '@/lib/productUnits';

export const CUSTO_MARGEM_CAMPOS = [
  {
    sourceKey: 'valor_compra',
    totalKey: 'custo_compra_total',
    unitKey: 'custo_compra_unit',
    label: 'Compra',
    shortLabel: 'Cmp',
  },
  {
    sourceKey: 'custo_avaria',
    totalKey: 'custo_avaria_total',
    unitKey: 'custo_avaria_unit',
    label: 'Avaria',
    shortLabel: 'Av',
  },
  {
    sourceKey: 'custo_frete',
    totalKey: 'custo_frete_total',
    unitKey: 'custo_frete_unit',
    label: 'Frete',
    shortLabel: 'Frt',
  },
  {
    sourceKey: 'custo_imposto1',
    totalKey: 'custo_imposto1_total',
    unitKey: 'custo_imposto1_unit',
    label: 'Imposto 1',
    shortLabel: 'Imp1',
  },
  {
    sourceKey: 'custo_imposto2',
    totalKey: 'custo_imposto2_total',
    unitKey: 'custo_imposto2_unit',
    label: 'Imposto 2',
    shortLabel: 'Imp2',
  },
  {
    sourceKey: 'custo_outros',
    totalKey: 'custo_outros_total',
    unitKey: 'custo_outros_unit',
    label: 'Outros',
    shortLabel: 'Out',
  },
];

function normalizeCustoNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function competenciaParaIntervalo(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return null;
  return {
    from: new Date(y, m - 1, 1),
    to: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

/** Mesmo recorte da aba Consulta em VendasGestao. */
export function pedidoElegivelMargem(pedido) {
  if (!pedido) return false;
  if (String(pedido.status) === 'Cancelado') return false;
  return STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA.includes(pedido.status);
}

/** Mesma data da Consulta de Vendas: created_date em UTC-5 (Rio Branco). */
export function vendaNoIntervaloConsulta(sale, from, to) {
  const key = toLocalDateKey(sale?.created_date);
  if (!key) return false;
  if (from) {
    const fromKey = toLocalDateKey(from);
    if (fromKey && key < fromKey) return false;
  }
  if (to) {
    const toKey = toLocalDateKey(to);
    if (toKey && key > toKey) return false;
  }
  return true;
}

/** Total da linha com fallbacks (espelho da ConsultaVendasCaixa). */
export function resolverTotalLinhaVenda(item = {}) {
  const qtdComercial = Number(item.quantidade) || 0;
  const direto = Number(
    item.total ?? item.valor_total ?? item.valor_total_item ?? item.subtotal ?? 0,
  );
  if (direto > 0) return direto;

  const preco = Number(item.preco_unitario_praticado ?? item.preco_unitario_fator1 ?? 0);
  if (qtdComercial > 0 && preco > 0) return qtdComercial * preco;

  const quantidadeBase =
    Number(
      item.quantidade_base ??
        (qtdComercial * Number(item.fator_conversao || 1)) ??
        qtdComercial ??
        0,
    ) || 0;
  const precoBase = Number(
    item.preco_final_unitario_fator1 ?? item.preco_unitario_praticado ?? item.preco_unitario_fator1 ?? 0,
  );
  if (quantidadeBase > 0 && precoBase > 0) return quantidadeBase * precoBase;

  return 0;
}

export function resolveMargemProdutoKey(item = {}) {
  if (item.produto_id) return String(item.produto_id);
  const nome = String(item.produto_nome || 'sem-nome').trim().toLowerCase();
  return `nome:${nome || 'sem-nome'}`;
}

/** Componentes de custo unitário na unidade base — cadastro atual (preços de hoje). */
export function resolveCustoComponentesUnitBaseMargem(product = null, item = {}) {
  if (product) {
    const valorCompraBruto = normalizeCustoNum(product.valor_compra);
    const desconto = resolveValorDescontoCompraPadraoFator1(product, valorCompraBruto);
    const valorCompraLiquido = roundMoney(Math.max(0, valorCompraBruto - desconto));
    const componentes = {
      valor_compra: valorCompraLiquido,
      custo_avaria: roundMoney(resolveAvariaCompraFator1(product, valorCompraBruto)),
      custo_frete: normalizeCustoNum(product.custo_frete_padrao),
      custo_imposto1: normalizeCustoNum(product.custo_imposto1_padrao),
      custo_imposto2: normalizeCustoNum(product.custo_imposto2_padrao),
      custo_outros: normalizeCustoNum(product.custo_outros_padrao),
    };
    const somaComponentes =
      componentes.valor_compra +
      componentes.custo_avaria +
      componentes.custo_frete +
      componentes.custo_imposto1 +
      componentes.custo_imposto2 +
      componentes.custo_outros;
    const salvo = normalizeCustoNum(product.preco_custo_calculado);
    if (somaComponentes <= 0 && salvo > 0) {
      return {
        valor_compra: salvo,
        custo_avaria: 0,
        custo_frete: 0,
        custo_imposto1: 0,
        custo_imposto2: 0,
        custo_outros: 0,
      };
    }
    return componentes;
  }

  const fallback = normalizeCustoNum(
    item.custo_unitario_momento ?? item.custo_unitario ?? item.custo_calculado,
  );
  return {
    valor_compra: fallback,
    custo_avaria: 0,
    custo_frete: 0,
    custo_imposto1: 0,
    custo_imposto2: 0,
    custo_outros: 0,
  };
}

export function criarCamposCustoComponentesZerados() {
  const fields = {};
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    fields[campo.totalKey] = 0;
    fields[campo.unitKey] = 0;
  }
  return fields;
}

export function acumularCustoComponentesMargem(entry, componentesUnit, quantidadeBase) {
  const qtd = Number(quantidadeBase) || 0;
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    const unit = normalizeCustoNum(componentesUnit[campo.sourceKey]);
    entry[campo.unitKey] = unit;
    entry[campo.totalKey] = roundMoney((entry[campo.totalKey] || 0) + unit * qtd);
  }
}

export function calcularCustoTotalDosComponentes(row = {}) {
  const unit = normalizeCustoNum(row.custo_unitario_cadastro);
  const qtdBase = normalizeCustoNum(row.quantidade_base_vendida);
  if (unit > 0 && qtdBase > 0) {
    return roundMoney(unit * qtdBase);
  }
  let total = 0;
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    total += normalizeCustoNum(row[campo.totalKey]);
  }
  return roundMoney(total);
}

export function somarCamposCustoComponentes(acc = {}, row = {}) {
  const out = { ...acc };
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    out[campo.totalKey] = roundMoney((out[campo.totalKey] || 0) + (row[campo.totalKey] || 0));
  }
  return out;
}

/**
 * Fator de conversão fator-1 → unidade de vitrine/exibição da linha.
 * Ex.: 54 m² em 27 CX → escala 2 (custo e componentes do hover em R$/CX).
 */
export function resolveMargemEscalaUnidadeExibicao(row = {}) {
  const qtdExib = Number(row.quantidade_vendida) || 0;
  const qtdBase = Number(row.quantidade_base_vendida) || 0;
  if (qtdExib > 0 && qtdBase > 0) {
    return qtdBase / qtdExib;
  }
  return 1;
}

export function escalarValorCustoMargemUnidadeExibicao(valorUnitBase, row = {}) {
  return roundMoney((Number(valorUnitBase) || 0) * resolveMargemEscalaUnidadeExibicao(row));
}

/** Detalhe de custo para tooltip — mesma unidade da coluna Qtd/UN (vitrine). */
export function buildCustoBreakdownLineMargem(row, { mode = 'unit', formatNum } = {}) {
  const fmt =
    formatNum ||
    ((val) =>
      (val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const qtdExib = Number(row.quantidade_vendida) || 0;
  const escala = resolveMargemEscalaUnidadeExibicao(row);

  const parts = CUSTO_MARGEM_CAMPOS.map((campo) => {
    let value;
    if (mode === 'unit') {
      const total = Number(row?.[campo.totalKey]) || 0;
      if (qtdExib > 0 && total !== 0) {
        value = total / qtdExib;
      } else {
        value = (Number(row?.[campo.unitKey]) || 0) * escala;
      }
    } else {
      value = Number(row?.[campo.totalKey]) || 0;
    }
    if (Math.abs(value) < 0.0001) return null;
    const signed = campo.subtract ? -value : value;
    return `${campo.shortLabel} ${fmt(signed)}`;
  }).filter(Boolean);

  return parts.join(' · ');
}

export function labelComposicaoCustoMargem(row = {}, { porUnidade = true } = {}) {
  const un = String(row.unidade_exibicao || '').trim().toUpperCase();
  if (porUnidade && un) {
    return `Composição do custo por ${un} (preços de hoje)`;
  }
  return 'Composição do custo (preços de hoje)';
}

/** Preço de venda unitário líquido — após rateio do desconto do pedido (receita ÷ qtd vitrine). */
export function resolvePrecoVendaLiquidoUnitarioMargem(row = {}) {
  if (row.valor_unitario_medio != null && !Number.isNaN(row.valor_unitario_medio)) {
    return row.valor_unitario_medio;
  }
  const qtd = Number(row.quantidade_vendida) || 0;
  if (qtd <= 0) return 0;
  const receita =
    Number(row.receita_liquida) ||
    (Number(row.total_recebido) || 0) - (Number(row.total_desconto_venda) || 0);
  return roundMoney(receita / qtd);
}

/** Custo unitário na unidade base — lê `preco_custo_calculado` (SQL). */
export function resolveCustoUnitarioMargem(item = {}, product = null) {
  if (product) {
    return roundMoney(resolveCustoTotalUnitBaseProduto(product));
  }
  return normalizeCustoNum(item.custo_unitario_momento ?? item.custo_unitario ?? item.custo_calculado);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function itensPedidoValidos(pedido = {}) {
  return (Array.isArray(pedido.itens) ? pedido.itens : []).filter(
    (item) => item && typeof item === 'object',
  );
}

/** Mesmo total da Consulta de Vendas (`valor_total` / `total` do pedido). */
export function resolverValorTotalPedido(pedido = {}) {
  const direto = Number(pedido.valor_total ?? pedido.total ?? 0);
  if (direto > 0) return roundMoney(direto);

  const somaLinhas = itensPedidoValidos(pedido).reduce(
    (acc, item) => acc + resolverTotalLinhaVenda(item),
    0,
  );
  return roundMoney(somaLinhas);
}

function distribuirValorProporcional(total, pesos = []) {
  const alvo = roundMoney(total);
  if (!pesos.length) return [];

  const somaPesos = pesos.reduce((acc, peso) => acc + (Number(peso) || 0), 0);
  if (somaPesos <= 0) {
    const partes = Array(pesos.length).fill(alvo / pesos.length);
    return distribuirValorProporcional(alvo, partes.map(() => 1));
  }

  const brutos = pesos.map((peso) => (Number(peso) / somaPesos) * alvo);
  const arredondados = brutos.map(roundMoney);
  let diffCentavos = Math.round((alvo - arredondados.reduce((acc, v) => acc + v, 0)) * 100);
  if (!diffCentavos) return arredondados;

  const ordem = brutos
    .map((bruto, index) => ({ index, resto: bruto - arredondados[index] }))
    .sort((a, b) => (diffCentavos > 0 ? b.resto - a.resto : a.resto - b.resto));

  let cursor = 0;
  while (diffCentavos !== 0 && ordem.length > 0) {
    const { index } = ordem[cursor % ordem.length];
    arredondados[index] = roundMoney(arredondados[index] + (diffCentavos > 0 ? 0.01 : -0.01));
    diffCentavos += diffCentavos > 0 ? -1 : 1;
    cursor += 1;
  }

  return arredondados;
}

/**
 * Rateia o valor_total do pedido nas linhas (peso = total bruto da linha).
 * Garante que a soma da receita líquida = valor do pedido na Consulta de Vendas.
 */
export function alocarReceitaPedidoNasLinhas(pedido = {}) {
  const itens = itensPedidoValidos(pedido);
  if (!itens.length) return [];

  const brutos = itens.map((item) => resolverTotalLinhaVenda(item));
  const somaBruta = brutos.reduce((acc, valor) => acc + valor, 0);
  const valorPedido = resolverValorTotalPedido(pedido);

  if (valorPedido <= 0 && somaBruta <= 0) {
    return itens.map(() => ({
      total_recebido: 0,
      total_desconto_venda: 0,
      receita_liquida: 0,
    }));
  }

  if (somaBruta <= 0) {
    const receitas = distribuirValorProporcional(valorPedido, Array(itens.length).fill(1));
    return receitas.map((receita_liquida) => ({
      total_recebido: receita_liquida,
      total_desconto_venda: 0,
      receita_liquida,
    }));
  }

  const receitas = distribuirValorProporcional(valorPedido, brutos);
  return brutos.map((bruto, index) => {
    const receita_liquida = receitas[index] ?? 0;
    const total_recebido = roundMoney(bruto);
    const total_desconto_venda = roundMoney(total_recebido - receita_liquida);
    return { total_recebido, total_desconto_venda, receita_liquida };
  });
}

function vendaNoIntervalo(sale, from, to) {
  return vendaNoIntervaloConsulta(sale, from, to);
}

/**
 * Agrega vendas por produto no intervalo — espelho do RelatorioMargem.
 */
export function calcularLinhasMargemVendas(sales = [], products = [], intervalo = null) {
  const prodMap = (products || []).reduce((acc, p) => {
    if (p?.id) acc[p.id] = p;
    return acc;
  }, {});

  const reportMap = {};
  const { from, to } = intervalo || {};

  for (const sale of sales || []) {
    if (!pedidoElegivelMargem(sale)) continue;
    if (!vendaNoIntervalo(sale, from, to)) continue;

    const itens = itensPedidoValidos(sale);
    const alocacoes = alocarReceitaPedidoNasLinhas(sale);

    for (let index = 0; index < itens.length; index += 1) {
      const item = itens[index];
      const prodKey = resolveMargemProdutoKey(item);
      const product = item.produto_id ? prodMap[item.produto_id] : null;
      const custoCalculado = resolveCustoUnitarioMargem(item, product);
      const alloc = alocacoes[index] || {
        total_recebido: 0,
        total_desconto_venda: 0,
        receita_liquida: 0,
      };

      if (!reportMap[prodKey]) {
        reportMap[prodKey] = {
          produto_id: item.produto_id || null,
          quantidade_base_vendida: 0,
          total_recebido: 0,
          total_desconto_venda: 0,
          custo_unitario_cadastro: custoCalculado,
          ...criarCamposCustoComponentesZerados(),
        };
      }

      const entry = reportMap[prodKey];
      const quantidadeBase =
        Number(
          item.quantidade_base ??
            (Number(item.quantidade || 0) * Number(item.fator_conversao || 1)) ??
            item.quantidade ??
            0,
        ) || 0;
      entry.quantidade_base_vendida += quantidadeBase;
      entry.total_recebido += alloc.total_recebido;
      entry.total_desconto_venda += alloc.total_desconto_venda;
      acumularCustoComponentesMargem(
        entry,
        resolveCustoComponentesUnitBaseMargem(product, item),
        quantidadeBase,
      );
    }
  }

  return Object.values(reportMap).map((item) => {
    const custo_total = calcularCustoTotalDosComponentes(item);
    const receita_liquida = item.total_recebido - item.total_desconto_venda;
    const lucro_total = receita_liquida - custo_total;
    return {
      ...item,
      custo_total,
      receita_liquida,
      lucro_total,
    };
  });
}

export function calcularTotaisMargem(linhas = []) {
  const receita_liquida = linhas.reduce((s, r) => s + (Number(r.receita_liquida) || 0), 0);
  const custo_total = linhas.reduce((s, r) => s + (Number(r.custo_total) || 0), 0);
  const lucro_bruto = linhas.reduce((s, r) => s + (Number(r.lucro_total) || 0), 0);
  return {
    receita_liquida,
    custo_total,
    lucro_bruto,
    quantidade_produtos: linhas.length,
  };
}

/** Lucro bruto do mês (competência YYYY-MM) — mesma base do relatório de margem. */
export function calcularLucroBrutoCompetencia(sales = [], products = [], competencia) {
  const intervalo = competenciaParaIntervalo(competencia);
  if (!intervalo) {
    return { receita_liquida: 0, custo_total: 0, lucro_bruto: 0, quantidade_produtos: 0 };
  }
  const linhas = calcularLinhasMargemVendas(sales, products, intervalo);
  return calcularTotaisMargem(linhas);
}
