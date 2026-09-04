/**
 * Reconstrução retroativa do estoque físico para o gráfico mensal.
 *
 * Âncora: estoque actual do catálogo (confiável a partir de 2026-08-11).
 * Para cada mês passado: estoque no fim do mês = estoque hoje − movimentos (Compra/Venda/Consumo interno)
 * ocorridos depois desse fim de mês. Ajustes de inventário e outras entradas/saídas genéricas são ignorados.
 *
 * Marcas mensais: no fecho de cada mês, registar valores em ESTOQUE_DASHBOARD_MARCAS_MENSAIS
 * para servir de corte oficial (substituem a reconstrução daquele mês).
 */

/** Data a partir da qual o saldo actual do catálogo é considerado confiável como âncora. */
export const ESTOQUE_DASHBOARD_ANCORAGEM = '2026-08-11';

/**
 * Marcas de fecho mensal (valores do card Localização na data de corte).
 * Preencher manualmente no fim de cada mês, ex.:
 * '2026-08': { estoqueFisico: 234618, transitoFinanceiroAprovado: 131110 },
 */
export const ESTOQUE_DASHBOARD_MARCAS_MENSAIS = {
  '2026-08': {
    registradoEm: '2026-08-11',
    estoqueFisico: 234618,
    transitoFinanceiroAprovado: 131110,
  },
};

const MOTIVOS_RECONSTRUCAO = new Set(['compra', 'venda', 'consumo interno']);

function normalizeMotivo(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Compra, venda e consumo interno entram; ajustes e demais motivos ficam de fora. */
export function movimentoContaNaReconstrucaoEstoque(movimento = {}) {
  return MOTIVOS_RECONSTRUCAO.has(normalizeMotivo(movimento.motivo));
}

export function getMovimentoDeltaReconstrucao(movimento = {}) {
  if (!movimentoContaNaReconstrucaoEstoque(movimento)) return 0;

  const quantidade = Number(movimento.quantidade || 0);
  const motivo = normalizeMotivo(movimento.motivo);

  if (motivo === 'compra') return Math.abs(quantidade);
  if (motivo === 'venda' || motivo === 'consumo interno') return -Math.abs(quantidade);
  return 0;
}

export function getMarcaMensalEstoque(monthKey) {
  const marca = ESTOQUE_DASHBOARD_MARCAS_MENSAIS[monthKey];
  if (!marca) return null;
  const estoqueFisico = Number(marca.estoqueFisico);
  const transitoFinanceiroAprovado = Number(marca.transitoFinanceiroAprovado);
  if (!Number.isFinite(estoqueFisico) || !Number.isFinite(transitoFinanceiroAprovado)) {
    return null;
  }
  return {
    estoqueFisico,
    transitoFinanceiroAprovado,
    totalLocalizacao: estoqueFisico + transitoFinanceiroAprovado,
  };
}

/**
 * Quantidade física por produto no fim do mês (só activos), ancorada no estoque actual.
 */
export function buildEstoqueFisicoPorProdutoNoFimDoMes(produtosAtivos, skuBase, deltaAfterBySku) {
  const estoqueFisicoPorProdutoId = new Map();

  produtosAtivos.forEach((produto) => {
    if (!produto?.ativo) return;
    const skuData = skuBase.get(produto.id);
    if (!skuData) return;
    const deltaAfterMonth = deltaAfterBySku.get(produto.id) || 0;
    estoqueFisicoPorProdutoId.set(produto.id, Math.max(0, skuData.estoqueAtual - deltaAfterMonth));
  });

  return estoqueFisicoPorProdutoId;
}
