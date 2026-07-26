import { DEFAULT_SUGESTAO_COLUMN_SORT } from '@/lib/sugestaoCompraColumnSort';
import { sugestaoPrecisaReposicao, sugestaoProjecaoEstoque30dNegativa } from '@/lib/calcularSugestaoCompraVelocidade';
import { aggregateSugestaoTreeGroupMetrics } from '@/lib/sugestaoCompraTree';
import { TREE_GRID_EXPAND_ALL_LEVEL } from '@/components/produtos/treegrid/useTreeGrid';

export const SUGESTAO_OPERATIONAL_MODES = {
  livre: 'livre',
  radar: 'radar',
  bisturi: 'bisturi',
};

export const SUGESTAO_VIEW_MODES = {
  familias: 'familias',
  detalhe: 'detalhe',
};

/** Gatilho operacional: QTD SUG > 0 ou P.FUT < 0 (projeção 30d negativa). */
export function linhaExigeAcaoCompra(linha) {
  return sugestaoPrecisaReposicao(linha?.sugestao);
}

export function treeGroupExigeAcaoRadar(row, linhaLookup, options = {}) {
  if (!row || row.type !== 'group' || !row.node) return false;

  const agg = aggregateSugestaoTreeGroupMetrics(row, linhaLookup, options);
  if (!agg) return false;

  if (sugestaoProjecaoEstoque30dNegativa(agg.projecao)) return true;
  if ((Number(agg.qtdSugeridaBase) || 0) > 0) return true;

  return false;
}

export function applySugestaoOperationalMode(mode, current = {}) {
  const base = {
    groupByCategory: false,
    agruparHierarquia: true,
    somenteAbaixoPontoFuturo: true,
    considerarPedidosAprovadosEstoque: current.considerarPedidosAprovadosEstoque !== false,
  };

  if (mode === SUGESTAO_OPERATIONAL_MODES.radar) {
    return {
      ...base,
      treeLevel: 2,
      groupByCategory: false,
      columnSort: { column: 'pontoFuturo', direction: 'asc' },
      filtersPatch: {
        somenteAbaixoPontoFuturo: true,
        agruparHierarquia: true,
      },
    };
  }

  if (mode === SUGESTAO_OPERATIONAL_MODES.bisturi) {
    return {
      ...base,
      treeLevel: TREE_GRID_EXPAND_ALL_LEVEL,
      groupByCategory: false,
      columnSort: { column: 'pontoFuturo', direction: 'asc' },
      filtersPatch: {
        somenteAbaixoPontoFuturo: true,
        agruparHierarquia: true,
      },
    };
  }

  return {
    treeLevel: current.treeLevel ?? 1,
    groupByCategory: current.groupByCategory ?? false,
    columnSort: current.columnSort ?? { ...DEFAULT_SUGESTAO_COLUMN_SORT },
    filtersPatch: {},
  };
}

export function operationalModeLabel(mode) {
  if (mode === SUGESTAO_OPERATIONAL_MODES.radar) return 'Radar (macro)';
  if (mode === SUGESTAO_OPERATIONAL_MODES.bisturi) return 'Bisturi (micro)';
  return 'Livre';
}
