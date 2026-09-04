import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  calcPrecoCustoFromComponents,
  getCatalogoComercialView,
  resolveCustoTotalUnitBaseProduto,
} from '@/lib/productUnits';
import { calcMarkup } from '@/components/produtos/treegrid/useTreeGrid';
import { calcPrecoVendaFromMarkup } from '@/lib/catalogMarkupMassa';

export const PRECIFICACAO_MASSA_CAMPOS = [
  { id: 'valor_compra', label: 'Valor de compra', tipo: 'moeda', isCusto: true },
  { id: 'desconto_perc', label: 'Desconto comercial (%)', tipo: 'percentual', isCusto: true },
  { id: 'desconto_compra_padrao', label: 'Desconto comercial (R$)', tipo: 'moeda', isCusto: true },
  { id: 'custo_frete_padrao', label: 'Frete', tipo: 'moeda', isCusto: true },
  { id: 'custo_imposto1_padrao', label: 'Imposto 1', tipo: 'moeda', isCusto: true },
  { id: 'custo_imposto2_padrao', label: 'Imposto 2', tipo: 'moeda', isCusto: true },
  { id: 'custo_outros_padrao', label: 'Outros custos', tipo: 'moeda', isCusto: true },
  { id: 'avaria_percentual', label: 'Avaria (%)', tipo: 'percentual', isCusto: true },
  { id: 'preco_venda_percentual', label: 'Markup (%)', tipo: 'percentual', isCusto: false },
  { id: 'preco_venda_padrao', label: 'Preço de venda', tipo: 'moeda', isCusto: false },
];

function parseValorCampo(raw, tipo) {
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number(String(raw).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function valorAtualCampo(produto, campoId) {
  const val = produto?.[campoId];
  return val === null || val === undefined ? 0 : Number(val) || 0;
}

function markupAtualProduto(produto) {
  const stored = Number(produto?.preco_venda_percentual);
  if (Number.isFinite(stored) && stored > 0) return roundToTwoDecimals(stored);
  return roundToTwoDecimals(calcMarkup(produto));
}

function aplicarRecalculoCustoEVenda(produto, patch, { manterMarkup }) {
  const merged = { ...produto, ...patch };
  const novoCusto = calcPrecoCustoFromComponents(merged);
  const next = {
    ...patch,
    preco_custo_calculado: novoCusto,
  };

  if (!manterMarkup) return next;

  const markup = markupAtualProduto(produto);
  if (novoCusto > 0 && markup > 0) {
    const novoPreco = calcPrecoVendaFromMarkup(novoCusto, markup);
    if (novoPreco !== null) {
      next.preco_venda_padrao = novoPreco;
      next.preco_venda_percentual = markup;
      next.preco_venda_tipo = 'percentual';
    }
  }

  return next;
}

export function buildPrecificacaoMassaUpdate(
  produto,
  campoId,
  valorNovo,
  { somenteSeDiferente = true, manterMarkup = true } = {},
) {
  if (!produto?.id) {
    return { ok: false, reason: 'invalido', produto };
  }

  const campo = PRECIFICACAO_MASSA_CAMPOS.find((c) => c.id === campoId);
  if (!campo) {
    return { ok: false, reason: 'invalido', produto };
  }

  const valor = roundToTwoDecimals(valorNovo);
  const atual = roundToTwoDecimals(valorAtualCampo(produto, campoId));

  if (somenteSeDiferente && Math.abs(valor - atual) < 0.005) {
    return { ok: false, reason: 'sem_alteracao', produto, valorAtual: atual };
  }

  let patch = { [campoId]: valor };

  if (campoId === 'preco_venda_percentual') {
    const custoBase = resolveCustoTotalUnitBaseProduto(produto);
    if (custoBase <= 0) {
      return { ok: false, reason: 'sem_custo', produto };
    }
    const novoPreco = calcPrecoVendaFromMarkup(custoBase, valor);
    if (novoPreco === null) {
      return { ok: false, reason: 'sem_custo', produto };
    }
    patch = {
      preco_venda_percentual: valor,
      preco_venda_padrao: novoPreco,
      preco_venda_tipo: 'percentual',
    };
  } else if (campoId === 'preco_venda_padrao') {
    patch = {
      preco_venda_padrao: valor,
      preco_venda_tipo: 'numerico',
    };
  } else if (campo.isCusto) {
    patch = aplicarRecalculoCustoEVenda(produto, patch, { manterMarkup });
  }

  const custoAntes = resolveCustoTotalUnitBaseProduto(produto);
  const custoDepois = patch.preco_custo_calculado ?? calcPrecoCustoFromComponents({ ...produto, ...patch });
  const precoAntes = roundToTwoDecimals(produto.preco_venda_padrao || 0);
  const precoDepois = roundToTwoDecimals(patch.preco_venda_padrao ?? produto.preco_venda_padrao ?? 0);
  const cat = getCatalogoComercialView(produto);

  return {
    ok: true,
    produto,
    patch,
    preview: {
      id: produto.id,
      nome: produto.nome || produto.codigo_interno || produto.id,
      codigo: produto.codigo_interno || '',
      campo: campo.label,
      valorAtual: atual,
      valorNovo: valor,
      custoAntes: roundToTwoDecimals(custoAntes),
      custoDepois: roundToTwoDecimals(custoDepois),
      precoAntes,
      precoDepois,
      unidadeExibicao: cat.sigla || produto.unidade_principal || 'UN',
    },
  };
}

export function planPrecificacaoMassaUpdates(
  produtos,
  campoId,
  valorNovo,
  options = {},
) {
  const lista = Array.isArray(produtos) ? produtos : [];
  const updates = [];
  const skipped = { sem_custo: 0, sem_alteracao: 0, invalido: 0 };

  for (const produto of lista) {
    const result = buildPrecificacaoMassaUpdate(produto, campoId, valorNovo, options);
    if (result.ok) {
      updates.push(result);
    } else if (result.reason && skipped[result.reason] !== undefined) {
      skipped[result.reason] += 1;
    }
  }

  return { updates, skipped, total: lista.length };
}

export { parseValorCampo };
