import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { format, subDays } from 'date-fns';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { dateRangeFinanceiroCurto, diaBalanceteFromFiltros } from '@/lib/periodoFinanceiro';
import {
  calcularKpisFluxoPeriodo,
  calcularSaldosTodasContas,
  contaUsaRegraCaixaPDV,
  getDataMovimentoCaixa,
  isTransferenciaEntreContas,
  lancamentoPertenceContasSelecionadas,
} from '@/lib/saldoContaFinanceira';
import { reconciliarSaldoCaixaPDVSemTurnoAberto, backfillLancamentosMovimentosCaixaPDV } from '@/lib/contaDestinoCaixaPDV';
import { sincronizarSaldosContasFinanceiras } from '@/lib/sincronizarSaldoContasFinanceiras';
import { montarGruposFluxoCaixa, prepararGruposFluxoComSaldoAcumulado } from '@/lib/gruposMovimentacaoConta';
import {
  getDataAncoraFluxoKey,
  isLancamentoCancelado,
  isLancamentoRealizadoFluxo,
} from '@/lib/lancamentoFinanceiroStatus';
import { dataHoje, formatarSoData, toLocalDateKey } from '@/components/utils/dateUtils';
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Printer } from 'lucide-react';
import FluxoCaixaPrintDialog from './FluxoCaixaPrintDialog';
import CorteDiarioDialog from './corte-diario/CorteDiarioDialog';
import FolhaPrevisaoPage from '@/pages/FolhaPrevisao';
import PlanejamentoFinanceiroPage from '@/pages/PlanejamentoFinanceiro';
import BudgetsPage from '@/pages/Budgets';
import { gerarExtratoFluxoCaixa } from '@/functions/gerarExtratoFluxoCaixa';
import NovoLancamentoDialog from './NovoLancamentoDialog';
import LancamentoDetalheDialog from './LancamentoDetalheDialog';
import FiltrosFluxoCaixa, { PERIODO_LABELS } from './fluxo/FiltrosFluxoCaixa';
import FinanceiroPillTabs from './fluxo/FinanceiroPillTabs';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from './fluxo/FinanceiroListaMeta';
import KpiFluxoBar from './fluxo/KpiFluxoBar';
import ListaLancamentos from './fluxo/ListaLancamentos';
import { formatFinanceiroGrupoLabel } from './fluxo/FinanceiroListaShared';
import {
  GestaoContasEmbedded,
  GestaoContasKpis,
  GestaoContasPane,
} from './GestaoContasFinanceiras';
import AgefinImportador from '../agefin/AgefinImportador';
import ConciliacaoBancaria from './ConciliacaoBancaria';
import PagamentoLoteDialog from './PagamentoLoteDialog';
import FluxoToggleProgramadas from './fluxo/FluxoToggleProgramadas';
import usePagamentoLoteFluxo from './fluxo/usePagamentoLoteFluxo';
import { CONCILIACAO_LOTE_TAMANHO } from '@/lib/conciliacaoEmLote';
import { consumirArquivoLancamentoTorreDoBridge } from '@/lib/torreLancamentoBridge';
import { uploadAnexoParaLancamentoFinanceiro } from '@/lib/uploadAnexoReferencia';
import {
  calcularKpisProgramadas,
  calcularSaldoPrevisto,
  contarItensGrupos,
  filtrarProgramadasFluxo,
  mesclarProgramadasNosGrupos,
} from '@/lib/fluxoUnificado';
import { lerPreferenciasFluxoUnificado, gravarPreferenciasFluxoUnificado } from '@/lib/fluxoUnificadoPreferencias';
import { consolidarTransferenciasListaFluxo } from '@/lib/gruposMovimentacaoConta';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DATA_CORTE_HISTORICO_PADRAO,
  gravarPreferenciasCorteHistorico,
  lerPreferenciasCorteHistorico,
  passaFiltroCorteHistorico,
} from '@/lib/filtroDataFinanceiro';
import {
  lancamentoPassaBuscaFluxo,
  contasMatchBuscaFluxo,
  contasSelEfetivasFluxo,
  contasVisiveisFluxo,
  idsFiltroContasFluxo,
} from '@/lib/buscaFluxoCaixa';

// ─── utils ────────────────────────────────────────────────────────────────────
function parseDateKey(dateKey) {
  return new Date(`${dateKey}T12:00:00-05:00`);
}

const dateRange = dateRangeFinanceiroCurto;

const FAB_ITEMS = [
  { tipo: 'Receita', icon: ArrowDownLeft, label: 'Receita' },
  { tipo: 'Despesa', icon: ArrowUpRight, label: 'Despesa' },
  { tipo: 'Transferência', icon: ArrowRightLeft, label: 'Transf.' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ExecucaoOrcamentaria() {
  const [lancs, setLancs] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState('mes');
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [contasSel, setContasSel] = useState([]);
  const [tiposSel, setTiposSel] = useState([]);
  const [statusSel, setStatusSel] = useState([]);
  const [pendentes, setPendentes] = useState(false);
  const [cmvOnly, setCmvOnly] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState('Despesa');
  const [detalhe, setDetalhe] = useState(null);
  const [editando, setEditando] = useState(null);
  const [conciliacaoConta, setConciliacaoConta] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showCorteDiario, setShowCorteDiario] = useState(false);
  const [printFilterState, setPrintFilterState] = useState({
    periodo: 'hoje',
    customStart: '',
    customEnd: '',
    contasSel: [],
  });
  const [corteDiarioInitial, setCorteDiarioInitial] = useState(null);
  const [aba, setAba] = useState('fluxo'); // 'fluxo' | 'caixas' | 'planejamento' | 'folha'
  const [showImportadorAgefin, setShowImportadorAgefin] = useState(false);
  const [mostrarProgramadas, setMostrarProgramadas] = useState(
    () => lerPreferenciasFluxoUnificado().mostrarProgramadas,
  );
  const [showNovoFluxo, setShowNovoFluxo] = useState(false);
  const [ordemLancamentos, setOrdemLancamentos] = useState('desc');
  const [urlDescricao, setUrlDescricao] = useState('');
  const [urlValor, setUrlValor] = useState('');
  const [urlReferenciaId, setUrlReferenciaId] = useState('');
  const [urlReferenciaTipo, setUrlReferenciaTipo] = useState('');
  const [mostrarHistoricoAnterior, setMostrarHistoricoAnterior] = useState(
    () => lerPreferenciasCorteHistorico().mostrarHistoricoAnterior,
  );
  const [dataCorteHistorico, setDataCorteHistorico] = useState(
    () => lerPreferenciasCorteHistorico().dataCorte || DATA_CORTE_HISTORICO_PADRAO,
  );

  const atualizarCorteHistorico = useCallback((mostrar, dataCorte) => {
    setMostrarHistoricoAnterior(mostrar);
    setDataCorteHistorico(dataCorte);
    gravarPreferenciasCorteHistorico(mostrar, dataCorte);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const abaParam = params.get('aba');
    if (abaParam === 'folha') {
      setAba('folha');
    } else if (abaParam === 'budgets') {
      setAba('budgets');
    } else if (abaParam === 'planejamento' || abaParam === 'agefin') {
      setAba('planejamento');
    }
    if (abaParam === 'folha' || abaParam === 'budgets' || abaParam === 'planejamento' || abaParam === 'agefin') {
      params.delete('aba');
      const next = params.toString();
      window.history.replaceState({}, '', next ? `${window.location.pathname}?${next}` : window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Ler params de URL e abrir dialog ou seletor de tipo (atalho PWA ?novo=1)
    const params = new URLSearchParams(window.location.search);
    const desc = params.get('descricao');
    const valor = params.get('valor');
    const refId = params.get('referencia_id');
    const refTipo = params.get('referencia_tipo');
    const tipo = params.get('tipo');
    const novoAtalho = params.get('novo');

    if (novoAtalho === '1' || novoAtalho === 'true') {
      if (tipo && FAB_ITEMS.some((item) => item.tipo === tipo)) {
        setNovoTipo(tipo);
        setShowNovoFluxo(true);
      } else {
        setFabOpen(true);
      }
    } else if (desc) {
      setUrlDescricao(desc);
      setShowNovoFluxo(true);
    }

    if (valor) setUrlValor(valor);
    if (refId) setUrlReferenciaId(refId);
    if (refTipo) setUrlReferenciaTipo(refTipo);
    if (tipo && novoAtalho !== '1' && novoAtalho !== 'true') setNovoTipo(tipo);

    // Limpar URL
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showNovoFluxo) return;
    setFabOpen(false);
  }, [showNovoFluxo]);

  const syncCaixaPDVMaintenance = async (cts, movs, lancamentosIniciais) => {
    let lancamentos = lancamentosIniciais;
    let changed = false;
    const pdvContas = cts.filter((c) => contaUsaRegraCaixaPDV(c));

    const backfill = await backfillLancamentosMovimentosCaixaPDV(base44, cts);
    if (backfill) {
      changed = true;
      lancamentos = await base44.entities.LancamentoFinanceiro.list('-data_vencimento');
    }

    for (const conta of pdvContas) {
      const reconciliou = await reconciliarSaldoCaixaPDVSemTurnoAberto(
        base44,
        conta,
        cts,
        lancamentos,
        movs,
      );
      if (reconciliou) {
        changed = true;
        lancamentos = await base44.entities.LancamentoFinanceiro.list('-data_vencimento');
      }
    }

    if (changed) {
      setLancs(lancamentos);
    }
  };

  const load = async () => {
    setLoading(true);
    let snapshot = null;
    try {
      const [ls, cts, movs] = await Promise.all([
        base44.entities.LancamentoFinanceiro.list('-data_vencimento'),
        base44.entities.ContasFinanceiras.list(),
        base44.entities.MovimentosCaixa.list(),
      ]);
      snapshot = { ls, cts, movs };

      setLancs(ls);
      setMovimentos(movs);
      setContas(cts);
      const ativas = cts.filter((c) => c.ativo !== false);
      setContasSel((prev) => (prev.length ? prev : ativas.map((c) => c.id)));
    } catch (error) {
      console.error('[Fluxo de Caixa] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }

    if (!snapshot) return null;
    try {
      await syncCaixaPDVMaintenance(snapshot.cts, snapshot.movs, snapshot.ls);
      const [ls2, movs2] = await Promise.all([
        base44.entities.LancamentoFinanceiro.list('-data_vencimento'),
        base44.entities.MovimentosCaixa.list(),
      ]);
      const contaIds = snapshot.cts.filter((c) => c.ativo !== false).map((c) => c.id);
      await sincronizarSaldosContasFinanceiras(base44, {
        contas: snapshot.cts,
        lancamentos: ls2,
        movimentos: movs2,
        contaIds,
      });
      const cts2 = await base44.entities.ContasFinanceiras.list();
      setLancs(ls2);
      setMovimentos(movs2);
      setContas(cts2);
      return { ...snapshot, ls: ls2, movs: movs2, cts: cts2 };
    } catch (error) {
      console.error('[Fluxo de Caixa] Erro na manutenção PDV/sincronização:', error);
    }
    return snapshot;
  };

  const { s: ds, e: de } = useMemo(() => dateRange(periodo, cs, ce), [periodo, cs, ce]);

  const contasById = useMemo(
    () => Object.fromEntries(contas.map((c) => [c.id, c])),
    [contas],
  );

  const contasAtivas = useMemo(
    () => contas.filter((c) => c.ativo !== false),
    [contas],
  );

  const contasBuscaFluxo = useMemo(
    () => contasMatchBuscaFluxo(search, contasAtivas),
    [search, contasAtivas],
  );

  const contasSelBusca = useMemo(
    () => contasSelEfetivasFluxo(contasSel, contasAtivas, contasBuscaFluxo),
    [contasSel, contasAtivas, contasBuscaFluxo],
  );

  const contasFiltroIds = useMemo(
    () => idsFiltroContasFluxo(contasSel, contasSelBusca),
    [contasSel, contasSelBusca],
  );

  const contasVisiveisSaldo = useMemo(
    () => contasVisiveisFluxo(contasSel, contasAtivas, contasSelBusca),
    [contasSel, contasAtivas, contasSelBusca],
  );

  const filtrados = useMemo(() => lancs.filter(l => {
    if (isLancamentoCancelado(l) && !statusSel.includes('Cancelado')) return false;
    if (!isLancamentoRealizadoFluxo(l)) return false;
    const dataKey = getDataAncoraFluxoKey(l);
    if ((ds || de) && !dataKey) return false;
    if (ds && dataKey < ds) return false;
    if (de && dataKey > de) return false;
    if (!passaFiltroCorteHistorico(dataKey, { mostrarHistoricoAnterior, dataCorte: dataCorteHistorico })) return false;
    if (contasSel.length && !lancamentoPertenceContasSelecionadas(l, contasSel, contasById)) return false;
    if (tiposSel.length) {
      const matchTipo = tiposSel.includes(l.tipo);
      const matchTransf = tiposSel.includes('Transferência') && isTransferenciaEntreContas(l);
      if (!matchTipo && !matchTransf) return false;
    }
    if (statusSel.length && !statusSel.includes(l.status)) return false;
    if (pendentes && l.status_conciliacao !== 'Pendente') return false;
    if (cmvOnly && !l.is_custo_mercadoria) return false;
    if (search && !lancamentoPassaBuscaFluxo(l, search, contasAtivas, contasById)) return false;
    return true;
  }), [lancs, ds, de, contasSel, contasById, contasAtivas, tiposSel, statusSel, pendentes, cmvOnly, search, mostrarHistoricoAnterior, dataCorteHistorico]);

  const movimentosFiltrados = useMemo(() => movimentos.filter((m) => {
    if (contasFiltroIds.length && !contasFiltroIds.includes(m.conta_id)) return false;
    const dataKey = getDataMovimentoCaixa(m) ? toLocalDateKey(getDataMovimentoCaixa(m)) : null;
    if ((ds || de) && !dataKey) return false;
    if (ds && dataKey < ds) return false;
    if (de && dataKey > de) return false;
    if (!passaFiltroCorteHistorico(dataKey, { mostrarHistoricoAnterior, dataCorte: dataCorteHistorico })) return false;
    return true;
  }), [movimentos, ds, de, contasFiltroIds, mostrarHistoricoAnterior, dataCorteHistorico]);

  const kpis = useMemo(() => {
    const baseKpis = calcularKpisFluxoPeriodo(
      filtrados,
      movimentosFiltrados,
      lancs,
      contasById,
      contasFiltroIds,
    );
    const saldosMap = calcularSaldosTodasContas(contasVisiveisSaldo, lancs, movimentos);
    const saldoContas = contasVisiveisSaldo.reduce((acc, c) => acc + (saldosMap[c.id] || 0), 0);
    return {
      ...baseKpis,
      saldoContas: roundToTwoDecimals(saldoContas),
    };
  }, [filtrados, movimentosFiltrados, lancs, contasById, contasVisiveisSaldo, contasFiltroIds, movimentos]);

  const grupos = useMemo(() => {
    const hStr = dataHoje();
    const oStr = format(subDays(parseDateKey(hStr), 1), 'yyyy-MM-dd');

    const base = montarGruposFluxoCaixa({
      lancamentos: filtrados,
      movimentos: movimentosFiltrados,
      todosLancamentos: lancs,
      contas,
      contasSel: contasFiltroIds,
      contasById,
      formatGrupoLabel: formatFinanceiroGrupoLabel,
      hStr,
      oStr,
      ordemLancamentos,
    });

    return prepararGruposFluxoComSaldoAcumulado({
      grupos: base,
      saldoContasAtual: kpis.saldoContas,
      lancamentos: lancs,
      movimentos,
      todosLancamentos: lancs,
      contas,
      contasSel: contasFiltroIds,
      contasById,
    });
  }, [filtrados, movimentosFiltrados, lancs, contas, contasFiltroIds, contasById, ordemLancamentos, kpis.saldoContas, movimentos]);

  const programadasFiltradas = useMemo(() => filtrarProgramadasFluxo(lancs, {
    contasSel,
    contasById,
    contasAtivas,
    tiposSel,
    cmvOnly,
    search,
    mostrarHistoricoAnterior,
    dataCorteHistorico,
  }), [lancs, contasSel, contasById, contasAtivas, tiposSel, cmvOnly, search, mostrarHistoricoAnterior, dataCorteHistorico]);

  const programadasLista = useMemo(
    () => consolidarTransferenciasListaFluxo(programadasFiltradas),
    [programadasFiltradas],
  );

  const kpisProgramadas = useMemo(
    () => calcularKpisProgramadas(programadasFiltradas),
    [programadasFiltradas],
  );

  const saldoPrevisto = useMemo(
    () => calcularSaldoPrevisto(kpis.saldoContas, kpisProgramadas),
    [kpis.saldoContas, kpisProgramadas],
  );

  const gruposExibicao = useMemo(() => {
    if (!mostrarProgramadas) return grupos;
    const hStr = dataHoje();
    const oStr = format(subDays(parseDateKey(hStr), 1), 'yyyy-MM-dd');
    const merged = mesclarProgramadasNosGrupos(grupos, programadasLista, ordemLancamentos);
    return merged.map((g) => ({
      ...g,
      label: g.label || (g.k === 'sem-data' ? 'Sem data' : formatFinanceiroGrupoLabel(g.k, hStr, oStr)),
    }));
  }, [grupos, mostrarProgramadas, programadasLista, ordemLancamentos]);

  const lote = usePagamentoLoteFluxo({
    programadas: programadasLista,
    contas: contasAtivas,
    movimentos,
    reload: load,
  });

  const totalPend = useMemo(() => lancs.filter(l => l.status_conciliacao === 'Pendente').length, [lancs]);
  const hasActiveFilters = tiposSel.length > 0 || contasSel.length > 0 || statusSel.length > 0 || pendentes || cmvOnly || mostrarHistoricoAnterior || !!search;

  const abrirConciliacao = useCallback((conta) => {
    if (conta === null) {
      setConciliacaoConta({ id: null, nome: 'Todas as contas' });
      return;
    }
    setConciliacaoConta(conta);
  }, []);

  const periodoLabel = useMemo(() => {
    if (periodo === 'tudo') return 'Todo o período';
    if (periodo === 'hoje') return 'Hoje';
    if (periodo === 'ontem') return 'Ontem';
    if (periodo === 'semana') return 'Esta semana';
    if (periodo === 'mes') return 'Este mês';
    if (periodo === 'periodo' && cs && ce) return `${formatarSoData(cs)} até ${formatarSoData(ce)}`;
    return 'Período atual';
  }, [periodo, cs, ce]);

  const contasSelecionadasLabel = useMemo(() => {
    if (contas.length && contasSel.length === contas.length) return 'Todas as contas';
    if (contasSel.length === 1) {
      return contas.find(conta => conta.id === contasSel[0])?.nome || '1 conta';
    }
    if (contasSel.length > 1) return `${contasSel.length} contas`;
    return 'Nenhuma conta';
  }, [contas, contasSel]);

  const buildGruposComFiltros = useCallback(({
    periodoFiltro,
    csFiltro,
    ceFiltro,
    contasSelFiltro,
    tiposSelFiltro = [],
    statusSelFiltro = [],
    pendentesFiltro = false,
    cmvOnlyFiltro = false,
    searchFiltro = '',
  }) => {
    const { s: dsF, e: deF } = dateRange(periodoFiltro, csFiltro, ceFiltro);
    const contasBuscaF = searchFiltro
      ? contasMatchBuscaFluxo(searchFiltro, contasAtivas)
      : contasAtivas;
    const contasSelBuscaF = contasSelEfetivasFluxo(contasSelFiltro, contasAtivas, contasBuscaF);
    const contasFiltroIdsF = idsFiltroContasFluxo(contasSelFiltro, contasSelBuscaF);
    const contasVisiveisF = contasVisiveisFluxo(contasSelFiltro, contasAtivas, contasSelBuscaF);

    const filtradosF = lancs.filter((l) => {
      if (isLancamentoCancelado(l) && !statusSelFiltro.includes('Cancelado')) return false;
      if (!isLancamentoRealizadoFluxo(l)) return false;
      const dataKey = getDataAncoraFluxoKey(l);
      if ((dsF || deF) && !dataKey) return false;
      if (dsF && dataKey < dsF) return false;
      if (deF && dataKey > deF) return false;
      if (!passaFiltroCorteHistorico(dataKey, { mostrarHistoricoAnterior, dataCorte: dataCorteHistorico })) return false;
      if (contasSelFiltro.length && !lancamentoPertenceContasSelecionadas(l, contasSelFiltro, contasById)) return false;
      if (tiposSelFiltro.length) {
        const matchTipo = tiposSelFiltro.includes(l.tipo);
        const matchTransf = tiposSelFiltro.includes('Transferência') && isTransferenciaEntreContas(l);
        if (!matchTipo && !matchTransf) return false;
      }
      if (statusSelFiltro.length && !statusSelFiltro.includes(l.status)) return false;
      if (pendentesFiltro && l.status_conciliacao !== 'Pendente') return false;
      if (cmvOnlyFiltro && !l.is_custo_mercadoria) return false;
      if (searchFiltro && !lancamentoPassaBuscaFluxo(l, searchFiltro, contasAtivas, contasById)) return false;
      return true;
    });

    const movimentosFiltradosF = movimentos.filter((m) => {
      if (contasFiltroIdsF.length && !contasFiltroIdsF.includes(m.conta_id)) return false;
      const dataKey = getDataMovimentoCaixa(m) ? toLocalDateKey(getDataMovimentoCaixa(m)) : null;
      if ((dsF || deF) && !dataKey) return false;
      if (dsF && dataKey < dsF) return false;
      if (deF && dataKey > deF) return false;
      if (!passaFiltroCorteHistorico(dataKey, { mostrarHistoricoAnterior, dataCorte: dataCorteHistorico })) return false;
      return true;
    });

    const kpisF = (() => {
      const baseKpis = calcularKpisFluxoPeriodo(
        filtradosF,
        movimentosFiltradosF,
        lancs,
        contasById,
        contasFiltroIdsF,
      );
      const saldosMap = calcularSaldosTodasContas(contasVisiveisF, lancs, movimentos);
      const saldoContas = contasVisiveisF.reduce((acc, c) => acc + (saldosMap[c.id] || 0), 0);
      return { ...baseKpis, saldoContas: roundToTwoDecimals(saldoContas) };
    })();

    const hStr = dataHoje();
    const oStr = format(subDays(parseDateKey(hStr), 1), 'yyyy-MM-dd');
    const baseGrupos = montarGruposFluxoCaixa({
      lancamentos: filtradosF,
      movimentos: movimentosFiltradosF,
      todosLancamentos: lancs,
      contas,
      contasSel: contasFiltroIdsF,
      contasById,
      formatGrupoLabel: formatFinanceiroGrupoLabel,
      hStr,
      oStr,
      ordemLancamentos,
    });
    const gruposF = prepararGruposFluxoComSaldoAcumulado({
      grupos: baseGrupos,
      saldoContasAtual: kpisF.saldoContas,
      lancamentos: lancs,
      movimentos,
      todosLancamentos: lancs,
      contas,
      contasSel: contasFiltroIdsF,
      contasById,
    });

    return { grupos: gruposF, kpis: kpisF, ds: dsF, de: deF, contasSelFiltro };
  }, [
    lancs,
    movimentos,
    contas,
    contasAtivas,
    contasById,
    contasBuscaFluxo,
    ordemLancamentos,
    mostrarHistoricoAnterior,
    dataCorteHistorico,
  ]);

  const abrirMenuRelatorios = useCallback(() => {
    setFabOpen(false);
    setPrintFilterState({
      periodo,
      customStart: cs,
      customEnd: ce,
      contasSel: contasSel.length ? contasSel : contasAtivas.map((c) => c.id),
    });
    setShowPrintDialog(true);
  }, [periodo, cs, ce, contasSel, contasAtivas]);

  const abrirBalanceteDiario = useCallback((filters) => {
    const dia = diaBalanceteFromFiltros(filters);
    setCorteDiarioInitial({
      dia,
      contasSel: filters?.contasSel,
    });
    setShowCorteDiario(true);
  }, []);

  const handlePrintExtratoLista = useCallback(async ({
    periodo: periodoPrint,
    customStart: csPrint,
    customEnd: cePrint,
    contasSel: contasSelPrint,
  }) => {
    const { grupos: gruposPrint, kpis: kpisPrint, ds: dsP, de: deP } = buildGruposComFiltros({
      periodoFiltro: periodoPrint,
      csFiltro: csPrint,
      ceFiltro: cePrint,
      contasSelFiltro: contasSelPrint,
    });

    const partes = [];
    if (dsP === deP && dsP) partes.push(dsP);
    else if (dsP && deP) partes.push(`${dsP} até ${deP}`);
    else partes.push('Todo o período');
    if (contasSelPrint?.length) {
      partes.push(
        contasSelPrint.length === contasAtivas.length
          ? 'Todas as contas'
          : `${contasSelPrint.length} conta(s)`,
      );
    }

    const response = await gerarExtratoFluxoCaixa({
      grupos: gruposPrint,
      filtros_desc: partes.join(' · '),
      kpis: kpisPrint,
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ExtratoFluxoCaixa.pdf';
    link.click();
    window.URL.revokeObjectURL(url);
  }, [buildGruposComFiltros, contasAtivas.length]);

  const caixasAtiva = aba === 'caixas';
  const planejamentoAtiva = aba === 'planejamento';
  const folhaAtiva = aba === 'folha';
  const budgetsAtiva = aba === 'budgets';
  const financeiroShared = useMemo(
    () => ({
      lancs,
      movimentos,
      contas,
      contasAtivas,
      loading,
      reload: load,
    }),
    [lancs, movimentos, contas, contasAtivas, loading],
  );

  const abasPrincipais = [
    { value: 'fluxo', label: 'Fluxo de Caixa', shortLabel: 'Fluxo' },
    { value: 'caixas', label: 'Caixas e Bancos', shortLabel: 'Caixas' },
    { value: 'folha', label: 'Folha (previsão)', shortLabel: 'Folha' },
    { value: 'budgets', label: 'Budgets', shortLabel: 'Bdg.' },
    { value: 'planejamento', label: 'Planejamento', shortLabel: 'Plan.' },
  ];

  const handleToggleProgramadas = useCallback((next) => {
    setMostrarProgramadas(next);
    gravarPreferenciasFluxoUnificado({ mostrarProgramadas: next });
    if (!next) lote.sairModoLote();
  }, [lote.sairModoLote]);

  return (
    <GestaoContasEmbedded active={caixasAtiva} shared={financeiroShared}>
    <div className="w-full min-w-0 max-w-full space-y-3 pb-[var(--p38-scroll-pad-below-nav)] font-din-1451">
      {/* Header unificado — título, KPIs do fluxo, abas */}
      <div className="min-w-0 max-w-full space-y-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold leading-none text-foreground font-glacial md:text-2xl">Financeiro</p>
            {aba === 'fluxo' && (
              <button
                onClick={abrirMenuRelatorios}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p38-field-surface border-0 hover:opacity-90 transition-opacity"
                aria-label="Relatórios — balancete e extrato"
              >
                <Printer className="w-4 h-4 text-foreground/90" />
              </button>
            )}
          </div>

          {aba === 'fluxo' && (
            <KpiFluxoBar
              kpis={kpis}
              periodoLabel={periodoLabel}
              mostrarProgramadas={mostrarProgramadas}
              saldoPrevisto={saldoPrevisto}
              aReceber={kpisProgramadas.aReceber}
              aPagar={kpisProgramadas.aPagar}
            />
          )}

          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
            <FinanceiroPillTabs
              stretch
              compact
              value={aba}
              onChange={setAba}
              items={abasPrincipais}
              className="md:w-auto md:shrink-0"
            />
          </div>

          {caixasAtiva && <GestaoContasKpis />}
          {planejamentoAtiva && <PlanejamentoFinanceiroPage />}
        </div>
      </div>

      {aba === 'fluxo' && (
        <>
          <FluxoToggleProgramadas
            checked={mostrarProgramadas}
            onCheckedChange={handleToggleProgramadas}
          />

          <FiltrosFluxoCaixa
            search={search}
            onSearch={setSearch}
            periodo={periodo}
            onPeriodo={setPeriodo}
            customStart={cs}
            customEnd={ce}
            onCustom={(k, v) => (k === 'start' ? setCs(v) : setCe(v))}
            contas={contasAtivas}
            contasSel={contasSel}
            onContasSel={setContasSel}
            tiposSel={tiposSel}
            onTiposSel={setTiposSel}
            statusSel={statusSel}
            onStatusSel={setStatusSel}
            pendentes={pendentes}
            onPendentes={setPendentes}
            cmvOnly={cmvOnly}
            onCmvOnly={setCmvOnly}
            onOpenConciliacao={abrirConciliacao}
            conciliacaoPendente={totalPend}
            ordemLancamentos={ordemLancamentos}
            onOrdemLancamentosChange={setOrdemLancamentos}
            mostrarHistoricoAnterior={mostrarHistoricoAnterior}
            dataCorteHistorico={dataCorteHistorico}
            onMostrarHistoricoAnterior={(v) => atualizarCorteHistorico(v, dataCorteHistorico)}
            onDataCorteHistorico={(v) => atualizarCorteHistorico(mostrarHistoricoAnterior, v || DATA_CORTE_HISTORICO_PADRAO)}
          />

          <FinanceiroListaMeta
            total={contarItensGrupos(gruposExibicao)}
            totalLabel={contarItensGrupos(gruposExibicao) === 1 ? 'lançamento' : 'lançamentos'}
            hasActiveFilters={hasActiveFilters}
            onLimparFiltros={() => {
              setPeriodo('mes');
              setCs('');
              setCe('');
              setTiposSel([]);
              setContasSel(contasAtivas.map((conta) => conta.id));
              setStatusSel([]);
              setPendentes(false);
              setCmvOnly(false);
              setSearch('');
            }}
            summaryChips={
              <>
                {mostrarProgramadas && (
                  <FinanceiroSummaryChip className="text-amber-700 dark:text-amber-400">
                    Com programadas
                  </FinanceiroSummaryChip>
                )}
                {periodo !== 'mes' && (
                  <FinanceiroSummaryChip>{PERIODO_LABELS[periodo] || periodo}</FinanceiroSummaryChip>
                )}
                {contas.length > 0 && contasSel.length > 0 && contasSel.length < contas.length && (
                  <FinanceiroSummaryChip>
                    {contasSel.length} conta{contasSel.length > 1 ? 's' : ''}
                  </FinanceiroSummaryChip>
                )}
                {tiposSel.length > 0 && (
                  <FinanceiroSummaryChip>{tiposSel.join(', ')}</FinanceiroSummaryChip>
                )}
                {statusSel.length > 0 && (
                  <FinanceiroSummaryChip>{statusSel.length} status</FinanceiroSummaryChip>
                )}
                {pendentes && <FinanceiroSummaryChip>Conciliação</FinanceiroSummaryChip>}
                {cmvOnly && <FinanceiroSummaryChip>CMV</FinanceiroSummaryChip>}
                {mostrarHistoricoAnterior && (
                  <FinanceiroSummaryChip>Histórico completo</FinanceiroSummaryChip>
                )}
              </>
            }
            extraActions={mostrarProgramadas ? (
              <button
                type="button"
                onClick={lote.entrarModoPagarLote}
                className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${lote.modoSelecaoLote ? 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]' : 'bg-secondary/80 text-muted-foreground dark:bg-[#383e47]'}`}
              >
                {lote.modoSelecaoLote ? 'Cancelar lote' : 'Pagar em lote'}
              </button>
            ) : null}
          />

          {lote.modoSelecaoLote && (
            <div className="min-w-0 overflow-hidden rounded-xl border border-border/40 bg-card/60 p-3 dark:border-white/10 dark:bg-[#26262e]/80">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Pagamento em lote</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lote.lancamentosSelecionados.length} de {lote.idsSelecionaveis.length} programada(s) selecionada(s)
                  </p>
                  {lote.lancamentosSelecionados.length > CONCILIACAO_LOTE_TAMANHO && (
                    <p className="text-[10px] text-muted-foreground">
                      Serão processados em {Math.ceil(lote.lancamentosSelecionados.length / CONCILIACAO_LOTE_TAMANHO)} lotes de {CONCILIACAO_LOTE_TAMANHO}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={lote.handleSelecionarTodos}
                    disabled={lote.idsSelecionaveis.length === 0}
                    className="h-9 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 disabled:opacity-40"
                  >
                    {lote.todosSelecionados ? 'Limpar tudo' : 'Selecionar filtradas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => lote.setShowPagamentoLote(true)}
                    disabled={lote.lancamentosSelecionados.length === 0}
                    className="h-9 shrink-0 rounded-xl bg-[#4a5240] px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-[#a4ce33] dark:text-[#1f1d22]"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          )}

          <ListaLancamentos
            grupos={gruposExibicao}
            loading={loading}
            emSelecao={lote.modoSelecaoLote}
            selecionados={lote.selectedIds}
            onToggleSelecionado={lote.handleToggleSelecionado}
            onRow={(l) => {
              if (l.origem === 'movimento') return;
              setDetalhe(l);
            }}
          />

          {fabOpen && !showNovoFluxo && !showPrintDialog && !showCorteDiario && (
            <div className="fixed inset-0 z-[54] bg-muted/55 backdrop-blur-[2px]" onClick={() => setFabOpen(false)} />
          )}
          <div className="fixed right-4 z-[55] flex flex-col items-end gap-2 p38-bottom-fab1 lg:right-6">
            {fabOpen && FAB_ITEMS.map(({ tipo, icon: Icon, label }) => (
              <button key={tipo}
                onClick={() => {
                  setFabOpen(false);
                  setNovoTipo(tipo);
                  setShowNovoFluxo(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg whitespace-nowrap active:scale-95 transition-transform">
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
            <button
              onClick={() => setFabOpen(o => !o)}
              className={`w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all ${fabOpen ? 'bg-[#383e47] rotate-45' : 'bg-[#4a5240] dark:bg-[#a4ce33]'}`}>
              <Plus className={`w-6 h-6 ${fabOpen ? 'text-white' : 'text-white dark:text-[#1f1d22]'}`} />
            </button>
          </div>

          <PagamentoLoteDialog
            open={lote.showPagamentoLote}
            onOpenChange={lote.setShowPagamentoLote}
            contas={contasAtivas}
            contaId={lote.contaLoteId}
            setContaId={lote.setContaLoteId}
            dataPagamento={lote.dataPagamentoLote}
            setDataPagamento={lote.setDataPagamentoLote}
            selecionados={lote.lancamentosSelecionados}
            onConfirm={lote.handleConfirmarPagamentoLote}
            loading={lote.processingLote}
            progresso={lote.progressoLote}
            tamanhoLote={CONCILIACAO_LOTE_TAMANHO}
          />

          {detalhe && (
            <LancamentoDetalheDialog
              lancamento={detalhe}
              onClose={() => setDetalhe(null)}
              onEdit={(l) => {
                setDetalhe(null);
                setEditando(l);
                setShowNovoFluxo(true);
              }}
              onSaved={async () => {
                await load();
                setDetalhe(null);
              }}
            />
          )}
          <NovoLancamentoDialog
            open={showNovoFluxo}
            lancamentoExistente={editando}
            tipoInicial={novoTipo}
            descricaoInicial={urlDescricao}
            valorInicial={urlValor}
            referenciaId={urlReferenciaId}
            referenciaTipo={urlReferenciaTipo}
            onClose={() => {
              setShowNovoFluxo(false);
              setEditando(null);
              setFabOpen(false);
              setUrlDescricao('');
              setUrlValor('');
              setUrlReferenciaId('');
              setUrlReferenciaTipo('');
            }}
            onSaved={async (lancamentoSalvo) => {
              setEditando(null);
              await load();
              const fromTorre = consumirArquivoLancamentoTorreDoBridge();
              const lancamentoId = lancamentoSalvo?.id;
              if (fromTorre?.file && lancamentoId) {
                try {
                  await uploadAnexoParaLancamentoFinanceiro(base44, {
                    file: fromTorre.file,
                    lancamentoId,
                    descricao: lancamentoSalvo?.descricao || '',
                    tipoDocumento: fromTorre.tipoDocumento || 'Comprovante',
                    origem: 'torre_novo_lancamento',
                  });
                } catch (e) {
                  console.warn('[Torre→Lançamento] falha ao anexar comprovante:', e);
                }
              }
            }}
          />

          <Dialog open={conciliacaoConta != null} onOpenChange={(open) => !open && setConciliacaoConta(null)}>
            <DialogContent className="flex h-[min(85dvh,90vh)] max-h-[min(85dvh,90vh)] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden border-border/40 p-0 dark:border-border/40 dark:bg-muted">
              <DialogHeader className="shrink-0 px-6 pb-3 pt-6">
                <DialogTitle className="text-foreground">Conciliação em lote — {conciliacaoConta?.nome || 'Todas as contas'}</DialogTitle>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 md:px-6 md:pb-6">
                <ConciliacaoBancaria
                  contaId={conciliacaoConta?.id || null}
                  contaNome={conciliacaoConta?.nome || 'Todas as contas'}
                  onClose={() => setConciliacaoConta(null)}
                  onConciliado={() => {
                    load();
                    setConciliacaoConta(null);
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {caixasAtiva && <GestaoContasPane />}

      {folhaAtiva && <FolhaPrevisaoPage />}

      {budgetsAtiva && <BudgetsPage />}

      {planejamentoAtiva && (
        <Dialog open={showImportadorAgefin} onOpenChange={setShowImportadorAgefin}>
          <DialogContent className="flex h-[100dvh] min-h-0 w-screen max-w-none flex-col overflow-hidden rounded-none border-0 bg-card/95 p-0 shadow-xl backdrop-blur-xl dark:bg-card/95 md:h-auto md:max-h-[92vh] md:w-[min(42rem,calc(100vw-2rem))] md:max-w-2xl md:rounded-3xl">
            <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border/40">
              <DialogTitle className="text-foreground">Importar conta</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none">
              <AgefinImportador
                onSuccess={(_, options) => {
                  load();
                  if (options?.close) {
                    setShowImportadorAgefin(false);
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <FluxoCaixaPrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        initialFilters={printFilterState}
        contas={contasAtivas}
        onBalanceteDiario={abrirBalanceteDiario}
        onExtratoPdf={handlePrintExtratoLista}
      />
      <CorteDiarioDialog
        open={showCorteDiario}
        onOpenChange={(next) => {
          setShowCorteDiario(next);
          if (!next) setCorteDiarioInitial(null);
        }}
        contas={contas}
        lancamentos={lancs}
        movimentos={movimentos}
        initialDia={corteDiarioInitial?.dia ?? dataHoje()}
        initialContasSel={corteDiarioInitial?.contasSel ?? contasSel}
        abrirDiretoNoMapa={!!corteDiarioInitial}
      />
    </div>
    </GestaoContasEmbedded>
  );
}