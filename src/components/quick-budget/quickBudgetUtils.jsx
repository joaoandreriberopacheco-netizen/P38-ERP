import React from 'react';
import { getPrecoPisoCustoUnidade, getPrecoUnitarioNaUnidade, getSaleUnitContextForTabela } from '@/lib/orcamentoPrecoTabela';
import { buildSaleUnitOptions, calculateBaseQuantity, formatEstoqueDisponivelApresentacao, getItemUnitKey } from '@/lib/productUnits';
import { normalizeProductCodeForSearch } from '@/lib/productCode';

export function formatCurrency(value) {
  return `R$ ${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getProductSearchText(produto) {
  const codigoInternoRaw = normalizeProductCodeForSearch(produto?.codigo_interno);
  return [
    produto.nome,
    produto.codigo_interno,
    codigoInternoRaw,
    produto.codigo_barras,
    produto.campo_hierarquico_1,
    produto.campo_hierarquico_2,
    produto.campo_hierarquico_3,
    produto.campo_hierarquico_4,
    produto.campo_hierarquico_5,
    produto.marca,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function getQuickBudgetUnitContext(produto, tabelaPreco) {
  return getSaleUnitContextForTabela(produto, tabelaPreco);
}

/** Piso de preço livre: custo na embalagem (não preço da tabela). */
export function getMinimumPrice(produto, tabelaPreco, unitOption = null) {
  void tabelaPreco;
  return getPrecoPisoCustoUnidade(produto, unitOption);
}

/** Preço de tabela aplicado ao produto na embalagem escolhida. */
export function getFullPrice(produto, tabelaPreco, unitOption = null) {
  return getPrecoUnitarioNaUnidade(produto, tabelaPreco, unitOption);
}

/**
 * Lista (cadastro) riscada quando a tabela aplica fator ≠ 1; valor em destaque = piso na tabela.
 * variant="quickBudget" alinha à direita em coluna compacta (lista de busca).
 */
export function PrecoVendaTabelaLinhas({
  produto,
  tabelaPreco,
  unitOption = null,
  finalClassName = 'text-sm font-bold text-foreground tabular-nums',
  labelBottom,
  variant = 'default',
}) {
  const ctx = getQuickBudgetUnitContext(produto, tabelaPreco);
  const unit = unitOption || ctx.unidadeDefault;
  const precoFinal = getPrecoUnitarioNaUnidade(produto, tabelaPreco, unit);
  const listaOpts = buildSaleUnitOptions(produto, 1);
  const listaUnit = listaOpts.find((o) => o.unidade === unit?.unidade) || listaOpts[0];
  const precoOriginal = Number(listaUnit?.valor_unitario ?? produto?.preco_venda_padrao ?? 0);
  const sigla = unit?.unidade || listaUnit?.unidade || produto?.unidade_principal || 'UN';
  const temAjuste = tabelaPreco && tabelaPreco.fator_ajuste !== 1;
  const qb = variant === 'quickBudget';

  const precos = (
    <>
      {temAjuste && precoOriginal > 0 && (
        <div className="text-xs text-muted-foreground line-through tabular-nums whitespace-nowrap">
          {formatCurrency(precoOriginal)}
        </div>
      )}
      {precoFinal > 0 && (
        <div className={`tabular-nums whitespace-nowrap ${finalClassName}`}>
          {formatCurrency(precoFinal)}
          <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/{sigla}</span>
        </div>
      )}
    </>
  );

  return (
    <>
      {qb ? (
        <div className="flex flex-col items-end justify-center gap-0.5">{precos}</div>
      ) : (
        precos
      )}
      {labelBottom != null && labelBottom !== false && (
        <p className="text-xs text-muted-foreground">{labelBottom}</p>
      )}
    </>
  );
}

export function buildQuickBudgetItem(produto, tabelaPreco, unitOption = null) {
  const ctx = getQuickBudgetUnitContext(produto, tabelaPreco);
  const unitPick = unitOption || ctx.unidadeDefault || {
    unidade: String(produto.unidade_principal || 'UN').trim().toUpperCase(),
    fator_conversao: 1,
    valor_unitario: ctx.precoSelecionado,
  };
  const sigla = unitPick.unidade || 'UN';
  const precoTabela = getPrecoUnitarioNaUnidade(produto, tabelaPreco, unitPick);
  const precoPisoCusto = getPrecoPisoCustoUnidade(produto, unitPick);
  const quantidade = 1;
  const listaOpts = buildSaleUnitOptions(produto, 1);
  const listaUnit = listaOpts.find((o) => o.unidade === sigla) || listaOpts[0];
  const precoLista = Number(listaUnit?.valor_unitario ?? produto.preco_venda_padrao ?? 0);
  const temAjusteTabela = !!(tabelaPreco && tabelaPreco.fator_ajuste !== 1);
  const fator = Number(unitPick.fator_conversao) || 1;
  const quantidadeBase = calculateBaseQuantity(quantidade, fator);
  const estoqueDisp = formatEstoqueDisponivelApresentacao(produto);
  return {
    produto_id: produto.id,
    produto_nome: produto.nome,
    codigo_interno: produto.codigo_interno || '',
    estoque_atual: Number(produto.estoque_atual || 0),
    estoque_exibicao_qtd: estoqueDisp.quantidade,
    estoque_exibicao_sigla: estoqueDisp.sigla,
    item_key: getItemUnitKey(produto.id, sigla),
    preco_cheio: precoTabela,
    preco_minimo: precoPisoCusto,
    preco_unitario: precoTabela,
    preco_venda_lista: precoLista,
    tem_ajuste_tabela: temAjusteTabela,
    preco_livre: !!produto.preco_livre,
    desconto: 0,
    quantidade,
    unidade: sigla,
    unidade_medida: sigla,
    unidade_sigla: sigla,
    fator_conversao: fator,
    quantidade_base: quantidadeBase,
    total: precoTabela * quantidade,
  };
}

export function recalculateItem(item) {
  const quantidade = Math.max(Number(item.quantidade || 0), 1);
  const desconto = Math.max(Number(item.desconto || 0), 0);
  const preco = Number(item.preco_unitario || 0);
  const subtotal = quantidade * preco;
  const fator = Number(item.fator_conversao) || 1;
  return {
    ...item,
    quantidade,
    desconto,
    preco_unitario: preco,
    quantidade_base: calculateBaseQuantity(quantidade, fator),
    total: Math.max(subtotal - desconto, 0),
  };
}

export function matchesProduct(produto, query) {
  if (!query?.trim()) return true;
  const searchable = getProductSearchText(produto);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => searchable.includes(word));
}

export function getBudgetSummary(items, cartDiscount = null) {
  const subtotal = items.reduce((sum, item) => sum + ((Number(item.quantidade) || 0) * (Number(item.preco_unitario) || 0)), 0);
  const descontoItens = items.reduce((sum, item) => sum + (Number(item.desconto) || 0), 0);
  let descontoCarrinho = 0;
  if (cartDiscount?.valor > 0) {
    if (cartDiscount.tipo === 'percentual') {
      descontoCarrinho = subtotal * (cartDiscount.valor / 100);
    } else {
      descontoCarrinho = cartDiscount.valor;
    }
  }
  const desconto = descontoItens + descontoCarrinho;
  return {
    subtotal,
    desconto,
    descontoItens,
    descontoCarrinho,
    total: Math.max(subtotal - desconto, 0),
    quantidadeItens: items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0),
  };
}

/** Subtotal no preço de catálogo (sem acréscimo da tabela) — limite visual do desconto. */
export function getCatalogSubtotal(items = []) {
  return items.reduce((sum, item) => {
    const qtd = Number(item.quantidade) || 0;
    const precoCatalogo = Number(item.preco_venda_lista) || Number(item.preco_unitario) || 0;
    return sum + qtd * precoCatalogo;
  }, 0);
}

/**
 * Desconto no estilo PDV vendedor (% ↔ R$) com limite de perfil/tabela
 * e referência ao preço de catálogo.
 */
export function computeOrcamentoRapidoDesconto({
  items = [],
  ajustePercentual = '',
  ajusteValor = '',
  tipoValorAjuste = 'percentual',
  limiteUsuario = 0,
  limiteTabela = 0,
} = {}) {
  const subtotal = items.reduce((sum, item) => sum + ((Number(item.quantidade) || 0) * (Number(item.preco_unitario) || 0)), 0);
  const catalogSubtotal = getCatalogSubtotal(items);

  const pct = parseFloat(ajustePercentual) || 0;
  const val = parseFloat(ajusteValor) || 0;

  let valorDesconto = 0;
  if (tipoValorAjuste === 'percentual' && pct > 0) {
    valorDesconto = subtotal * pct / 100;
  } else if (tipoValorAjuste === 'valor' && val > 0) {
    valorDesconto = val;
  }
  valorDesconto = Math.min(valorDesconto, subtotal);

  const percent = subtotal > 0 ? (valorDesconto / subtotal) * 100 : 0;
  const limite = Math.max(Number(limiteUsuario) || 0, Number(limiteTabela) || 0);
  const ajusteExcedido = limite > 0 && percent > limite;
  const total = Math.max(subtotal - valorDesconto, 0);
  const abaixoCatalogo = catalogSubtotal > 0 && total < catalogSubtotal;

  return {
    subtotal,
    catalogSubtotal,
    valorDesconto,
    total,
    percent,
    limite,
    ajusteExcedido,
    abaixoCatalogo,
  };
}

export const ORCAMENTO_RAPIDO_AVISO_PRECO =
  'Preços sujeitos a variação. Valores informados para consulta; confirme no caixa antes da venda.';
