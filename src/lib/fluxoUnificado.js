import { sortLancamentosPorDescricao } from '@/lib/financialUtils';
import { consolidarTransferenciasListaFluxo } from '@/lib/gruposMovimentacaoConta';
import { lancamentoPertenceContasSelecionadas, isTransferenciaEntreContas } from '@/lib/saldoContaFinanceira';
import {
  getDataAncoraFluxoKey,
  getValorContaAberta,
  isLancamentoCancelado,
  isLancamentoEmAberto,
  isLancamentoRealizadoFluxo,
  isLancamentoVencido,
  lancamentoPassaFiltroContasAbertas,
} from '@/lib/lancamentoFinanceiroStatus';
import { passaFiltroCorteHistorico } from '@/lib/filtroDataFinanceiro';
import { lancamentoPassaBuscaFluxo } from '@/lib/buscaFluxoCaixa';
import { dataHoje } from '@/components/utils/dateUtils';
import { endOfMonth, format, startOfMonth } from 'date-fns';

/** Escopo inicial das programadas: vencidas + vencimento no mês corrente. */
export function escopoProgramadasPadrao(hojeKey = dataHoje()) {
  const hoje = new Date(`${hojeKey}T12:00:00`);
  return {
    hojeKey,
    inicioMes: format(startOfMonth(hoje), 'yyyy-MM-dd'),
    fimMes: format(endOfMonth(hoje), 'yyyy-MM-dd'),
  };
}

/** Vencidas (qualquer mês) ou com vencimento ainda neste mês. */
export function passaFiltroProgramadasEscopoPadrao(dataKey, escopo = escopoProgramadasPadrao()) {
  if (!dataKey) return false;
  if (dataKey < escopo.hojeKey) return true;
  return dataKey >= escopo.inicioMes && dataKey <= escopo.fimMes;
}

/** Lançamentos programados (não realizados) visíveis no fluxo unificado. */
export function filtrarProgramadasFluxo(lancs, {
  contasSel = [],
  contasById = {},
  contasAtivas = [],
  tiposSel = [],
  cmvOnly = false,
  search = '',
  mostrarHistoricoAnterior,
  dataCorteHistorico,
  hojeKey = dataHoje(),
}) {
  const escopo = escopoProgramadasPadrao(hojeKey);

  return lancs.filter((l) => {
    if (isLancamentoCancelado(l)) return false;
    if (isLancamentoRealizadoFluxo(l)) return false;
    if (!lancamentoPassaFiltroContasAbertas(l)) return false;
    if (!isLancamentoEmAberto(l)) return false;

    const dataKey = (l.data_vencimento || '').slice(0, 10) || null;
    if (!passaFiltroProgramadasEscopoPadrao(dataKey, escopo)) return false;
    if (!passaFiltroCorteHistorico(dataKey, { mostrarHistoricoAnterior, dataCorte: dataCorteHistorico })) return false;

    if (contasSel.length && !lancamentoPertenceContasSelecionadas(l, contasSel, contasById)) return false;

    if (tiposSel.length) {
      const matchTipo = tiposSel.includes(l.tipo);
      const matchTransf = tiposSel.includes('Transferência') && isTransferenciaEntreContas(l);
      if (!matchTipo && !matchTransf) return false;
    }

    if (cmvOnly && !l.is_custo_mercadoria) return false;
    if (search && !lancamentoPassaBuscaFluxo(l, search, contasAtivas, contasById)) return false;

    return true;
  });
}

/** KPIs das contas programadas no período filtrado. */
export function calcularKpisProgramadas(programadas, hojeKey = dataHoje()) {
  let aReceber = 0;
  let aPagar = 0;
  let qtdReceber = 0;
  let qtdPagar = 0;
  let vencidas = 0;
  let qtdVencidas = 0;

  programadas.forEach((l) => {
    const valor = getValorContaAberta(l);
    if (l.tipo === 'Receita') {
      aReceber += valor;
      qtdReceber += 1;
    } else if (l.tipo === 'Despesa') {
      aPagar += valor;
      qtdPagar += 1;
    }
    if (isLancamentoVencido(l, hojeKey)) {
      vencidas += valor;
      qtdVencidas += 1;
    }
  });

  return {
    aReceber,
    aPagar,
    saldoProjetado: aReceber - aPagar,
    qtdReceber,
    qtdPagar,
    vencidas,
    qtdVencidas,
  };
}

/** Insere lançamentos programados nos grupos do fluxo (por data de vencimento). */
export function mesclarProgramadasNosGrupos(
  grupos = [],
  programadas = [],
  ordemLancamentos = 'desc',
  { movimentos = [] } = {},
) {
  if (!programadas.length) return grupos;

  const porDia = new Map();
  programadas.forEach((l) => {
    const k = (l.data_vencimento || '').slice(0, 10) || 'sem-data';
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k).push(l);
  });

  const gruposMap = new Map(grupos.map((g) => [g.k, { ...g, items: [...g.items] }]));

  porDia.forEach((items, k) => {
    const ordenados = sortLancamentosPorDescricao(items);
    const consolidados = consolidarTransferenciasListaFluxo(ordenados, { movimentos }).map((l) => ({
      ...l,
      _isProgramada: true,
    }));

    if (gruposMap.has(k)) {
      const grupo = gruposMap.get(k);
      grupo.items = [...grupo.items, ...consolidados];
    } else {
      gruposMap.set(k, {
        k,
        label: null,
        items: consolidados,
        totais: { r: 0, d: 0, entrou: 0, saiu: 0, liquido: 0, liquidoOperacional: 0 },
        _somenteProgramadas: true,
      });
    }
  });

  const merged = [...gruposMap.values()].sort((a, b) => {
    if (a.k === 'sem-data') return 1;
    if (b.k === 'sem-data') return -1;
    return ordemLancamentos === 'asc' ? a.k.localeCompare(b.k) : b.k.localeCompare(a.k);
  });

  return merged;
}

/** Saldo previsto = saldo atual das contas + (a receber − a pagar) do filtro. */
export function calcularSaldoPrevisto(saldoContas, kpisProgramadas) {
  return (saldoContas || 0) + (kpisProgramadas.saldoProjetado || 0);
}

/** Contagem total de itens na lista (realizados + programadas quando visíveis). */
export function contarItensGrupos(grupos = []) {
  return grupos.reduce((acc, g) => acc + (g.items?.length || 0), 0);
}

/** Data de referência para exibição de item na lista unificada. */
export function getDataExibicaoUnificada(l) {
  if (l?._isProgramada) return l.data_vencimento;
  return l?.data_pagamento || l?.data_vencimento || getDataAncoraFluxoKey(l);
}
