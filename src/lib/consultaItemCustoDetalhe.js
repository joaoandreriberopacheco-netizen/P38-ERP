import { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';

const fmtMoeda = (v) => (Number.isFinite(Number(v)) ? formatCaixaR(v) : '--');
const fmtPct = (v) => (
  Number.isFinite(Number(v))
    ? `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : '--'
);

/** Métricas de custo por linha — alinhado ao relatório expandido/PDF. */
export function resolveConsultaItemCustoMetricas(item = {}, produto = {}) {
  const fator = Number(item.fator_conversao) || 1;
  const comp = Number(item.valor_unitario_compra)
    || Number(item.custo_final_unitario)
    || Number(item.preco_unitario)
    || 0;
  const frete = Number(item.frete_unitario)
    || (Number(produto.custo_frete_padrao) || 0) * fator;
  const outros = Number(item.custo_outros)
    || (
      (Number(produto.custo_imposto1_padrao) || 0)
      + (Number(produto.custo_imposto2_padrao) || 0)
      + (Number(produto.custo_outros_padrao) || 0)
    ) * fator;
  const custo = Number(item.custo_calculado) || comp + frete + outros;
  const venda = (Number(produto.preco_venda_padrao) || 0) * fator;
  const markup = custo > 0 ? ((venda - custo) / custo) * 100 : NaN;
  return { comp, custo, venda, markup };
}

export function buildConsultaItemCustoDetalhe(item = {}, produto = {}) {
  const { comp, custo, venda, markup } = resolveConsultaItemCustoMetricas(item, produto);
  return {
    linha1: `Comp. ${fmtMoeda(comp)} · Custo ${fmtMoeda(custo)}`,
    linha2: `Venda ${fmtMoeda(venda)} · Mk ${fmtPct(markup)}`,
  };
}
