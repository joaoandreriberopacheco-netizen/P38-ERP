import { dataHoje, dataMenosDiasSistema, boundsMesCivil } from '@/components/utils/dateUtils';

export const PERIODOS_VENDAS = [
  { v: 'hoje', l: 'Hoje' },
  { v: 'ontem', l: 'Ontem' },
  { v: 'mes_atual', l: 'Mês atual' },
  { v: 'mes_anterior', l: 'Mês anterior' },
  { v: 'personalizado', l: 'Personalizado' },
];

export function getPeriodoMesCorrente() {
  const hoje = dataHoje();
  const [year, month] = hoje.split('-').map(Number);
  return boundsMesCivil(year, month - 1);
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

  const mesAtual = getPeriodoMesCorrente();
  if (dataInicio === mesAtual.start && dataFim === mesAtual.end) return 'mes_atual';

  const mesAnterior = getPeriodoMesAnterior();
  if (dataInicio === mesAnterior.start && dataFim === mesAnterior.end) return 'mes_anterior';

  return 'personalizado';
}
