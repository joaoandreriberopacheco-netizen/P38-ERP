import { dataHoje, dataMenosDiasSistema, boundsMesCivil, inicioSemanaCivilDesdeYmd } from '@/components/utils/dateUtils';

export const PERIODOS_VENDAS = [
  { v: 'hoje', l: 'Hoje' },
  { v: 'ontem', l: 'Ontem' },
  { v: 'esta_semana', l: 'Esta semana' },
  { v: 'mes_atual', l: 'Mês atual' },
  { v: 'mes_anterior', l: 'Mês anterior' },
  { v: 'personalizado', l: 'Personalizado' },
];

/** Preset ao abrir Gestão de Vendas (escolha de negócio: visão do dia). */
export const VENDAS_GESTAO_PERIODO_PADRAO = 'hoje';

/** @returns {{ preset: string, start: string, end: string }} */
export function getVendasGestaoPeriodoPadrao() {
  const range = getVendasPeriodoRange(VENDAS_GESTAO_PERIODO_PADRAO);
  return {
    preset: VENDAS_GESTAO_PERIODO_PADRAO,
    start: range.start,
    end: range.end,
  };
}

export function getPeriodoMesCorrente() {
  const hoje = dataHoje();
  const [year, month] = hoje.split('-').map(Number);
  return boundsMesCivil(year, month - 1);
}

/** Segunda-feira da semana civil até hoje (Tabatinga). */
export function getPeriodoSemanaCorrente() {
  const hoje = dataHoje();
  return { start: inicioSemanaCivilDesdeYmd(hoje), end: hoje };
}

export function getPeriodoMesAnterior() {
  const hoje = dataHoje();
  const [year, month] = hoje.split('-').map(Number);
  const prevMonthIndex = month - 2;
  if (prevMonthIndex < 0) {
    return boundsMesCivil(year - 1, 11);
  }
  return boundsMesCivil(year, prevMonthIndex);
}

/** @returns {{ start: string, end: string } | null} */
export function getVendasPeriodoRange(preset) {
  switch (preset) {
    case 'hoje': {
      const hoje = dataHoje();
      return { start: hoje, end: hoje };
    }
    case 'ontem': {
      const ontem = dataMenosDiasSistema(1);
      return { start: ontem, end: ontem };
    }
    case 'esta_semana':
      return getPeriodoSemanaCorrente();
    case 'mes_atual':
      return getPeriodoMesCorrente();
    case 'mes_anterior':
      return getPeriodoMesAnterior();
    default:
      return null;
  }
}

export function detectVendasPeriodoPreset(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 'personalizado';

  const hoje = dataHoje();
  const ontem = dataMenosDiasSistema(1);
  if (dataInicio === hoje && dataFim === hoje) return 'hoje';
  if (dataInicio === ontem && dataFim === ontem) return 'ontem';

  const semanaAtual = getPeriodoSemanaCorrente();
  if (dataInicio === semanaAtual.start && dataFim === semanaAtual.end) return 'esta_semana';

  const mesAtual = getPeriodoMesCorrente();
  if (dataInicio === mesAtual.start && dataFim === mesAtual.end) return 'mes_atual';

  const mesAnterior = getPeriodoMesAnterior();
  if (dataInicio === mesAnterior.start && dataFim === mesAnterior.end) return 'mes_anterior';

  return 'personalizado';
}
