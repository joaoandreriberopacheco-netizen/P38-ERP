import {
  dataHoje,
  dataMenosDiasSistema,
} from '@/components/utils/dateUtils';
import {
  getPeriodoMesAnterior,
  getPeriodoMesCorrente,
  getPeriodoSemanaCorrente,
  getVendasPeriodoRange,
} from '@/lib/vendasPeriodoFiltro';

export const PERIODOS_ORCAMENTO_SALVOS = [
  { v: 'ultimos_7_dias', l: 'Últimos 7 dias' },
  { v: 'ultimos_30_dias', l: 'Últimos 30 dias' },
  { v: 'esta_semana', l: 'Esta semana' },
  { v: 'mes_atual', l: 'Mês atual' },
  { v: 'mes_anterior', l: 'Mês anterior' },
  { v: 'personalizado', l: 'Personalizado' },
];

export const ORCAMENTO_SALVOS_PERIODO_PADRAO = 'ultimos_30_dias';

/** @returns {{ preset: string, start: string, end: string }} */
export function getOrcamentoSalvosPeriodoPadrao() {
  const range = getOrcamentoSalvosPeriodoRange(ORCAMENTO_SALVOS_PERIODO_PADRAO);
  return {
    preset: ORCAMENTO_SALVOS_PERIODO_PADRAO,
    start: range.start,
    end: range.end,
  };
}

/** @returns {{ start: string, end: string }} */
export function getOrcamentoSalvosPeriodoRange(preset) {
  switch (preset) {
    case 'ultimos_7_dias':
      return { start: dataMenosDiasSistema(6), end: dataHoje() };
    case 'ultimos_30_dias':
      return { start: dataMenosDiasSistema(29), end: dataHoje() };
    case 'esta_semana':
      return getPeriodoSemanaCorrente();
    case 'mes_atual':
      return getPeriodoMesCorrente();
    case 'mes_anterior':
      return getPeriodoMesAnterior();
    case 'hoje':
    case 'ontem': {
      const vendas = getVendasPeriodoRange(preset);
      return vendas || { start: dataHoje(), end: dataHoje() };
    }
    default:
      return getOrcamentoSalvosPeriodoRange(ORCAMENTO_SALVOS_PERIODO_PADRAO);
  }
}

export function detectOrcamentoSalvosPeriodoPreset(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 'personalizado';

  for (const { v } of PERIODOS_ORCAMENTO_SALVOS) {
    if (v === 'personalizado') continue;
    const range = getOrcamentoSalvosPeriodoRange(v);
    if (range.start === dataInicio && range.end === dataFim) return v;
  }
  return 'personalizado';
}

export function labelOrcamentoSalvosPeriodo(preset, dataInicio, dataFim) {
  const found = PERIODOS_ORCAMENTO_SALVOS.find((p) => p.v === preset);
  if (found && preset !== 'personalizado') return found.l;
  if (dataInicio && dataFim && dataInicio === dataFim) return `Dia ${dataInicio.split('-').reverse().join('/')}`;
  if (dataInicio && dataFim) {
    return `${dataInicio.split('-').reverse().join('/')} – ${dataFim.split('-').reverse().join('/')}`;
  }
  return 'Período';
}
