import { cn } from '@/components/utils';
import { P38_PAGE_TITLE } from '@/lib/p38FormTypography';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { formatarSoData } from '@/components/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, ArrowRightLeft } from 'lucide-react';
import ConciliacaoBancaria from './ConciliacaoBancaria';
import AjusteSaldoDialog from '@/components/config/AjusteSaldoDialog';
import KpiContasBar from './fluxo/KpiContasBar';
import ContasSaldoPicker from './fluxo/ContasSaldoPicker';
import FiltrosContasFinanceiras, { TIPOS_CONTA } from './fluxo/FiltrosContasFinanceiras';
import ListaContasFinanceiras from './fluxo/ListaContasFinanceiras';
import { marcarPadraoContasFluxo, marcarTodasContasFluxo } from './fluxo/contasFluxoSelecaoUi';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from './fluxo/FinanceiroListaMeta';
import {
  calcularSaldosAposDataCorte,
  calcularSaldosTodasContas,
  getSaldoExibicaoConta,
} from '@/lib/saldoContaFinanceira';
import {
  DATA_CORTE_HISTORICO_PADRAO,
  contasAtivasOperacionais,
  contasOpcoesSeletorContasFinanceiro,
  contasSelEfetivoFluxo,
  contasSelEquivaleFiltroFluxoPadrao,
  contasSelModoTodasContas,
  gravarPreferenciasCorteHistorico,
  isContaOcultaSaldoPadrao,
  isContaTransicao,
  lerPreferenciasCorteHistorico,
  passaFiltroCorteHistorico,
} from '@/lib/filtroDataFinanceiro';
import { getDataAncoraFluxoKey } from '@/lib/lancamentoFinanceiroStatus';
import {
  gravarPreferenciasSaldoContas,
  lerPreferenciasSaldoContas,
  migrarPreferenciasSaldoLegadoFluxo,
  sanitizarPreferenciasSaldoContas,
} from '@/lib/preferenciasSaldoContas';

const GestaoContasCtx = createContext(null);

const FORM_VAZIO = {
  nome: '',
  tipo: 'Caixa Físico',
  banco: '',
  agencia: '',
  conta: '',
  saldo_inicial: 0,
  observacoes: '',
  ativo: true,
};

function useGestaoContasModel(shared) {
  const navigate = useNavigate();
  const [accountsLocal, setAccountsLocal] = useState([]);
  const [lancamentosLocal, setLancamentosLocal] = useState([]);
  const [movimentosLocal, setMovimentosLocal] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(!shared);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState('ativas');
  const [somentePendencias, setSomentePendencias] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [conciliacaoConta, setConciliacaoConta] = useState(null);
  const [ajusteConta, setAjusteConta] = useState(null);
  const [ajusteDialogOpen, setAjusteDialogOpen] = useState(false);
  const [formData, setFormData] = useState(FORM_VAZIO);
  /** Base completa para saldos — o Fluxo partilha só o período filtrado. */
  const [lancamentosSaldo, setLancamentosSaldo] = useState([]);
  const [movimentosSaldo, setMovimentosSaldo] = useState([]);
  const [carregandoSaldosBase, setCarregandoSaldosBase] = useState(true);
  const [mostrarHistoricoLocal, setMostrarHistoricoLocal] = useState(
    () => lerPreferenciasCorteHistorico().mostrarHistoricoAnterior,
  );
  const [dataCorteLocal, setDataCorteLocal] = useState(
    () => lerPreferenciasCorteHistorico().dataCorte || DATA_CORTE_HISTORICO_PADRAO,
  );

  const mostrarHistoricoAnterior = shared?.mostrarHistoricoAnterior ?? mostrarHistoricoLocal;
  const dataCorteHistorico = shared?.dataCorteHistorico ?? dataCorteLocal;
  /** Mesma semântica do Fluxo: `[]` = operacionais (sem PP/PJ). */
  const [contasSelLocal, setContasSelLocal] = useState([]);

  const atualizarCorteHistorico = useCallback((mostrar, dataCorte) => {
    if (shared?.atualizarCorteHistorico) {
      shared.atualizarCorteHistorico(mostrar, dataCorte);
      return;
    }
    setMostrarHistoricoLocal(mostrar);
    setDataCorteLocal(dataCorte);
    gravarPreferenciasCorteHistorico(mostrar, dataCorte);
  }, [shared]);

  const accounts = shared?.contas ?? accountsLocal;
  const lancamentos = shared?.lancs ?? lancamentosLocal;
  const movimentosCaixa = shared?.movimentos ?? movimentosLocal;
  const loading = shared ? shared.loading : loadingLocal;
  const contasAtivasLista = shared?.contasAtivas ?? contasAtivasOperacionais(accounts);
  const contasSel = shared?.contasSel ?? contasSelLocal;
  const contasPickerOpcoes = shared?.contasPickerOpcoes
    ?? contasOpcoesSeletorContasFinanceiro(contasAtivasLista);

  const atualizarSelecaoContas = useCallback((ids) => {
    if (shared?.atualizarSelecaoContasFluxo) {
      shared.atualizarSelecaoContasFluxo(ids);
      return;
    }
    if (shared?.atualizarContasSaldoSel) {
      shared.atualizarContasSaldoSel(ids);
      return;
    }
    setContasSelLocal(ids);
    gravarPreferenciasSaldoContas(ids);
  }, [shared]);

  const incluiContasOcultas = useMemo(() => {
    const ocultas = contasAtivasLista.filter((c) => isContaOcultaSaldoPadrao(c));
    if (!ocultas.length) return false;
    const efetivos = new Set(contasSelEfetivoFluxo(contasSel, contasAtivasLista));
    return ocultas.some((c) => efetivos.has(c.id));
  }, [contasSel, contasAtivasLista]);

  const toggleContasOcultasLista = useCallback(() => {
    if (incluiContasOcultas) {
      atualizarSelecaoContas(marcarPadraoContasFluxo());
      return;
    }
    atualizarSelecaoContas(marcarTodasContasFluxo(contasAtivasLista));
  }, [atualizarSelecaoContas, contasAtivasLista, incluiContasOcultas]);

  const aplicarSaldoBase = useCallback((lancsFull, movsFull) => {
    if (!Array.isArray(lancsFull) || !Array.isArray(movsFull)) return false;
    if (!lancsFull.length) return false;
    setLancamentosSaldo(lancsFull);
    setMovimentosSaldo(movsFull);
    setCarregandoSaldosBase(false);
    return true;
  }, []);

  const loadSaldosBase = useCallback(async () => {
    if (aplicarSaldoBase(shared?.lancsSaldo, shared?.movsSaldo)) return;

    setCarregandoSaldosBase(true);
    try {
      const [lancsFull, movsFull] = await Promise.all([
        base44.entities.LancamentoFinanceiro.list(),
        base44.entities.MovimentosCaixa.list(),
      ]);
      aplicarSaldoBase(lancsFull, movsFull);
    } catch (error) {
      console.error('Erro ao carregar base de saldos:', error);
    } finally {
      setCarregandoSaldosBase(false);
    }
  }, [shared?.lancsSaldo, shared?.movsSaldo, aplicarSaldoBase]);

  const loadData = useCallback(async () => {
    if (shared?.reload) {
      if (!aplicarSaldoBase(shared.lancsSaldo, shared.movsSaldo)) {
        setCarregandoSaldosBase(true);
      }
      await shared.reload();
      await loadSaldosBase();
      return;
    }
    setLoadingLocal(true);
    setCarregandoSaldosBase(true);
    try {
      const [contas, lancs, movs] = await Promise.all([
        base44.entities.ContasFinanceiras.list(),
        base44.entities.LancamentoFinanceiro.list(),
        base44.entities.MovimentosCaixa.list(),
      ]);
      setAccountsLocal(contas);
      setLancamentosLocal(lancs);
      setMovimentosLocal(movs);
      setLancamentosSaldo(lancs);
      setMovimentosSaldo(movs);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoadingLocal(false);
      setCarregandoSaldosBase(false);
    }
  }, [shared, loadSaldosBase, aplicarSaldoBase]);

  useEffect(() => {
    if (aplicarSaldoBase(shared?.lancsSaldo, shared?.movsSaldo)) return;
    loadSaldosBase();
  }, [shared?.lancsSaldo, shared?.movsSaldo, loadSaldosBase, aplicarSaldoBase]);

  useEffect(() => {
    if (shared) return;
    loadData();
  }, [shared, loadData]);

  useEffect(() => {
    if (shared) return;
    const ativas = accounts.filter((c) => c.ativo !== false);
    if (!ativas.length) return;
    const brutos = migrarPreferenciasSaldoLegadoFluxo(lerPreferenciasSaldoContas(), ativas);
    const restaurar = sanitizarPreferenciasSaldoContas(brutos, ativas);
    setContasSelLocal((prev) => {
      const base = prev.length ? sanitizarPreferenciasSaldoContas(prev, ativas) : restaurar;
      if (base.length !== prev.length) gravarPreferenciasSaldoContas(base);
      return base;
    });
  }, [shared, accounts]);

  const precisaBaseCompletaSaldo = !mostrarHistoricoAnterior && !!dataCorteHistorico;
  /** Com corte ativo, saldo usa base completa de lançamentos (movimentos podem ser vazios). */
  const baseSaldoDisponivel = lancamentosSaldo.length > 0;
  const saldosProntos = !carregandoSaldosBase && (!precisaBaseCompletaSaldo || baseSaldoDisponivel);

  const contasParaMapaSaldo = useMemo(
    () => accounts.filter((c) => c && !isContaTransicao(c)),
    [accounts],
  );

  const lancsParaSaldo = baseSaldoDisponivel
    ? lancamentosSaldo
    : (precisaBaseCompletaSaldo ? [] : lancamentos);
  const movsParaSaldo = baseSaldoDisponivel
    ? movimentosSaldo
    : (precisaBaseCompletaSaldo ? [] : movimentosCaixa);

  const pendenciasConciliacao = useMemo(() => {
    const mapa = {};
    lancamentos.forEach((l) => {
      if (l.status_conciliacao !== 'Pendente' || !l.conta_financeira_id) return;
      const dataKey = getDataAncoraFluxoKey(l);
      if (!passaFiltroCorteHistorico(dataKey, {
        mostrarHistoricoAnterior,
        dataCorte: dataCorteHistorico,
      })) return;
      mapa[l.conta_financeira_id] = (mapa[l.conta_financeira_id] || 0) + 1;
    });
    return mapa;
  }, [lancamentos, mostrarHistoricoAnterior, dataCorteHistorico]);

  const saldosCalculados = useMemo(() => {
    if (!saldosProntos) return null;
    if (!mostrarHistoricoAnterior && dataCorteHistorico) {
      return calcularSaldosAposDataCorte(
        contasParaMapaSaldo,
        lancsParaSaldo,
        movsParaSaldo,
        dataCorteHistorico,
      );
    }
    return calcularSaldosTodasContas(contasParaMapaSaldo, lancsParaSaldo, movsParaSaldo);
  }, [
    contasParaMapaSaldo,
    lancsParaSaldo,
    movsParaSaldo,
    mostrarHistoricoAnterior,
    dataCorteHistorico,
    saldosProntos,
  ]);

  const contasEnriquecidas = useMemo(() => accounts.map((account) => ({
    ...account,
    saldo_calculado: saldosCalculados ? saldosCalculados[account.id] : null,
  })), [accounts, saldosCalculados]);

  const contasOperacionais = useMemo(
    () => contasEnriquecidas.filter((account) => !isContaTransicao(account)),
    [contasEnriquecidas],
  );

  const idsContasVisiveis = useMemo(
    () => new Set(contasSelEfetivoFluxo(contasSel, contasAtivasLista)),
    [contasSel, contasAtivasLista],
  );

  const contasVisiveisSelecao = useMemo(
    () => contasOperacionais.filter((account) => idsContasVisiveis.has(account.id)),
    [contasOperacionais, idsContasVisiveis],
  );

  const filtrados = useMemo(() => contasVisiveisSelecao.filter((account) => {
    if (statusFiltro === 'ativas' && account.ativo === false) return false;
    if (statusFiltro === 'inativas' && account.ativo !== false) return false;
    if (tipoFiltro !== 'todos' && account.tipo !== tipoFiltro) return false;
    if (somentePendencias && !(pendenciasConciliacao[account.id] > 0)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (account.nome || '').toLowerCase().includes(q) ||
        (account.tipo || '').toLowerCase().includes(q) ||
        (account.banco || '').toLowerCase().includes(q) ||
        (account.agencia || '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [contasVisiveisSelecao, statusFiltro, tipoFiltro, somentePendencias, pendenciasConciliacao, search]);

  const kpis = useMemo(() => {
    let saldoTotal = 0;
    let qtdAtivas = 0;
    let qtdInativas = 0;
    let negativas = 0;
    let saldoNegativo = 0;
    let pendencias = 0;

    contasVisiveisSelecao.forEach((a) => {
      if (!saldosProntos || !saldosCalculados) return;
      const saldo = getSaldoExibicaoConta(a, saldosCalculados);
      saldoTotal += saldo;
      if (a.ativo !== false) qtdAtivas++;
      else qtdInativas++;
      if (saldo < 0) {
        negativas++;
        saldoNegativo += saldo;
      }
      pendencias += pendenciasConciliacao[a.id] || 0;
    });

    return {
      saldoTotal: saldosProntos ? saldoTotal : null,
      qtdTotal: contasVisiveisSelecao.length,
      qtdAtivas,
      qtdInativas,
      negativas,
      saldoNegativo: Math.abs(saldoNegativo),
      pendencias,
    };
  }, [contasVisiveisSelecao, saldosCalculados, pendenciasConciliacao, saldosProntos]);

  const grupos = useMemo(() => {
    const map = {};
    filtrados.forEach((account) => {
      const k = account.tipo || 'Outros';
      (map[k] = map[k] || []).push(account);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([k, items]) => ({
        k,
        label: k,
        items: [...items].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')),
      }));
  }, [filtrados]);

  const totalPendencias = kpis.pendencias;
  const selecaoContasPersonalizada = contasSel.length > 0
    && !contasSelEquivaleFiltroFluxoPadrao(contasSel, contasAtivasLista)
    && !contasSelModoTodasContas(contasSel, contasAtivasLista);
  const hasActiveFilters = tipoFiltro !== 'todos' || statusFiltro !== 'ativas' || somentePendencias || mostrarHistoricoAnterior || incluiContasOcultas || selecaoContasPersonalizada;

  const resetForm = () => {
    setSelectedAccount(null);
    setFormData(FORM_VAZIO);
  };

  const handleSave = async () => {
    if (selectedAccount) {
      await base44.entities.ContasFinanceiras.update(selectedAccount.id, formData);
    } else {
      await base44.entities.ContasFinanceiras.create({
        ...formData,
        saldo_atual: formData.saldo_inicial,
      });
    }
    await loadData();
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (account) => {
    setSelectedAccount(account);
    setFormData({
      nome: account.nome || '',
      tipo: account.tipo || 'Caixa Físico',
      banco: account.banco || '',
      agencia: account.agencia || '',
      conta: account.conta || '',
      saldo_inicial: account.saldo_inicial ?? 0,
      observacoes: account.observacoes || '',
      ativo: account.ativo !== false,
    });
    setIsDialogOpen(true);
    setFabOpen(false);
  };

  const handleNova = () => {
    resetForm();
    setIsDialogOpen(true);
    setFabOpen(false);
  };

  const handleExtrato = (account) => {
    const lancsPreload = lancamentosSaldo.length ? lancamentosSaldo : shared?.lancsSaldo;
    const movsPreload = movimentosSaldo.length ? movimentosSaldo : shared?.movsSaldo;
    navigate(`${createPageUrl('ExtratoConta')}?id=${account.id}`, {
      state: {
        extratoPreload: {
          conta: account,
          lancsSaldo: lancsPreload?.length ? lancsPreload : undefined,
          movsSaldo: movsPreload?.length ? movsPreload : undefined,
        },
      },
    });
  };

  const handleAjuste = (account) => {
    setAjusteConta(account);
    setAjusteDialogOpen(true);
  };

  return {
    loading,
    filtrados,
    grupos,
    kpis,
    saldosCalculados,
    pendenciasConciliacao,
    search,
    setSearch,
    tipoFiltro,
    setTipoFiltro,
    statusFiltro,
    setStatusFiltro,
    somentePendencias,
    setSomentePendencias,
    filtersOpen,
    setFiltersOpen,
    hasActiveFilters,
    totalPendencias,
    fabOpen,
    setFabOpen,
    isDialogOpen,
    setIsDialogOpen,
    selectedAccount,
    conciliacaoConta,
    setConciliacaoConta,
    formData,
    setFormData,
    handleSave,
    handleEdit,
    handleNova,
    handleExtrato,
    handleAjuste,
    loadData,
    resetForm,
    ajusteConta,
    setAjusteConta,
    ajusteDialogOpen,
    setAjusteDialogOpen,
    mostrarHistoricoAnterior,
    dataCorteHistorico,
    atualizarCorteHistorico,
    saldosProntos,
    contasSel,
    contasPickerOpcoes,
    contasAtivasLista,
    atualizarSelecaoContas,
    incluiContasOcultas,
    toggleContasOcultasLista,
  };
}

function GestaoContasProvider({ shared, children }) {
  const value = useGestaoContasModel(shared);
  return <GestaoContasCtx.Provider value={value}>{children}</GestaoContasCtx.Provider>;
}

/** KPIs — faixa compacta (mobile e desktop). Ícone carteira abre o seletor ao lado do saldo. */
export function GestaoContasKpis() {
  const m = useContext(GestaoContasCtx);
  if (!m) return null;
  return (
    <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
      <div className="min-w-0 flex-1">
        <KpiContasBar kpis={m.kpis} saldosProntos={m.saldosProntos} />
      </div>
      <ContasSaldoPicker
        variant="icon"
        contas={m.contasPickerOpcoes}
        sel={m.contasSel}
        onSel={m.atualizarSelecaoContas}
        contasTodasParaMarcar={m.contasAtivasLista}
        modoFluxo
        className="shrink-0"
      />
    </div>
  );
}

/** Filtros + meta + lista + FAB + diálogos. */
export function GestaoContasPane({ mobileShell = false, listScrollRef = null }) {
  const m = useContext(GestaoContasCtx);
  if (!m) return null;

  const {
    loading,
    filtrados,
    grupos,
    pendenciasConciliacao,
    search,
    setSearch,
    tipoFiltro,
    setTipoFiltro,
    statusFiltro,
    setStatusFiltro,
    somentePendencias,
    setSomentePendencias,
    filtersOpen,
    setFiltersOpen,
    hasActiveFilters,
    totalPendencias,
    fabOpen,
    setFabOpen,
    isDialogOpen,
    setIsDialogOpen,
    selectedAccount,
    conciliacaoConta,
    setConciliacaoConta,
    formData,
    setFormData,
    handleSave,
    handleEdit,
    handleNova,
    handleExtrato,
    handleAjuste,
    loadData,
    resetForm,
    saldosCalculados,
    ajusteConta,
    setAjusteConta,
    ajusteDialogOpen,
    setAjusteDialogOpen,
    mostrarHistoricoAnterior,
    dataCorteHistorico,
    atualizarCorteHistorico,
    saldosProntos,
    incluiContasOcultas,
    toggleContasOcultasLista,
    atualizarSelecaoContas,
  } = m;

  const tipoLabel = TIPOS_CONTA.find((t) => t.v === tipoFiltro)?.l;
  const statusLabel = statusFiltro === 'inativas' ? 'Inativas' : statusFiltro === 'todas' ? 'Todas' : null;

  const filtrosBlock = (
    <FiltrosContasFinanceiras
      search={search}
      onSearch={setSearch}
      filtersOpen={filtersOpen}
      onFiltersOpenChange={setFiltersOpen}
      tipoFiltro={tipoFiltro}
      onTipoFiltro={setTipoFiltro}
      statusFiltro={statusFiltro}
      onStatusFiltro={setStatusFiltro}
      somentePendencias={somentePendencias}
      onSomentePendencias={setSomentePendencias}
      totalPendencias={totalPendencias}
      mostrarHistoricoAnterior={mostrarHistoricoAnterior}
      dataCorteHistorico={dataCorteHistorico}
      onMostrarHistoricoAnterior={(v) => atualizarCorteHistorico(v, dataCorteHistorico)}
      onDataCorteHistorico={(v) => atualizarCorteHistorico(mostrarHistoricoAnterior, v || DATA_CORTE_HISTORICO_PADRAO)}
      mostrarContasOcultas={incluiContasOcultas}
      onMostrarContasOcultas={toggleContasOcultasLista}
    />
  );

  const showMetaOnMobile = hasActiveFilters || !!search;

  const metaBlock = (
    <FinanceiroListaMeta
      total={filtrados.length}
      totalLabel={filtrados.length === 1 ? 'conta' : 'contas'}
      hasActiveFilters={hasActiveFilters || !!search}
      onLimparFiltros={() => {
        setTipoFiltro('todos');
        setStatusFiltro('ativas');
        setSomentePendencias(false);
        atualizarSelecaoContas(marcarPadraoContasFluxo());
        setSearch('');
      }}
      summaryChips={
        mobileShell ? (
          <>
            {tipoFiltro !== 'todos' && tipoLabel && (
              <FinanceiroSummaryChip>{tipoLabel}</FinanceiroSummaryChip>
            )}
            {statusFiltro !== 'ativas' && statusLabel && (
              <FinanceiroSummaryChip>{statusLabel}</FinanceiroSummaryChip>
            )}
            {somentePendencias && (
              <FinanceiroSummaryChip className="text-amber-700 dark:text-amber-400">
                Conciliação
              </FinanceiroSummaryChip>
            )}
          </>
        ) : (
          <>
            {tipoFiltro !== 'todos' && tipoLabel && (
              <FinanceiroSummaryChip>{tipoLabel}</FinanceiroSummaryChip>
            )}
            {statusLabel && <FinanceiroSummaryChip>{statusLabel}</FinanceiroSummaryChip>}
            {somentePendencias && (
              <FinanceiroSummaryChip className="text-amber-700 dark:text-amber-400">
                Conciliação
              </FinanceiroSummaryChip>
            )}
            {!mostrarHistoricoAnterior && (
              <FinanceiroSummaryChip>
                Saldos desde {formatarSoData(dataCorteHistorico)}
              </FinanceiroSummaryChip>
            )}
            {mostrarHistoricoAnterior && (
              <FinanceiroSummaryChip>Histórico completo</FinanceiroSummaryChip>
            )}
            {incluiContasOcultas && (
              <FinanceiroSummaryChip>Caixa PP / PJ visíveis</FinanceiroSummaryChip>
            )}
          </>
        )
      }
    />
  );

  const listaBlock = (
    <ListaContasFinanceiras
      grupos={grupos}
      loading={loading}
      pendenciasMap={pendenciasConciliacao}
      saldosCalculados={saldosCalculados}
      saldosProntos={saldosProntos}
      onExtrato={handleExtrato}
      onEdit={handleEdit}
      onAjuste={handleAjuste}
      onConciliar={setConciliacaoConta}
    />
  );

  const fabAndDialogs = (
    <>
      {fabOpen && (
        <div
          className="fixed inset-0 z-[54] bg-muted/55 backdrop-blur-[2px]"
          onClick={() => setFabOpen(false)}
        />
      )}
      <div className="fixed right-4 z-[55] flex flex-col items-end gap-2 p38-bottom-fab1 lg:right-6">
        {fabOpen && (
          <button
            type="button"
            onClick={handleNova}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg whitespace-nowrap transition-transform active:scale-95 dark:bg-primary dark:text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Nova conta
          </button>
        )}
        <button
          type="button"
          onClick={() => setFabOpen((o) => !o)}
          className={`flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-xl transition-all active:scale-95 ${fabOpen ? 'rotate-45 bg-[#383e47]' : 'bg-[#4a5240] dark:bg-[#a4ce33]'}`}
        >
          <Plus className={`h-6 w-6 ${fabOpen ? 'text-white' : 'text-white dark:text-[#1f1d22]'}`} />
        </button>
      </div>

      <AjusteSaldoDialog
        open={ajusteDialogOpen}
        onOpenChange={(open) => {
          setAjusteDialogOpen(open);
          if (!open) setAjusteConta(null);
        }}
        conta={ajusteConta}
        saldoCalculado={ajusteConta ? getSaldoExibicaoConta(ajusteConta, saldosCalculados) : 0}
        onSaved={loadData}
      />

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="dark:bg-muted dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedAccount ? 'Editar conta' : 'Nova conta financeira'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground/90">Nome da conta</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Caixa Loja 1"
                className="dark:bg-muted dark:border-border/40"
              />
            </div>
            <div>
              <Label className="text-foreground/90">Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger className="dark:bg-muted dark:border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted dark:border-border/40">
                  <SelectItem value="Caixa Físico">Caixa Físico</SelectItem>
                  <SelectItem value="Conta Bancária">Conta Bancária</SelectItem>
                  <SelectItem value="Carteira Digital">Carteira Digital</SelectItem>
                  <SelectItem value="Poupança">Poupança</SelectItem>
                  <SelectItem value="Investimento">Investimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.tipo === 'Conta Bancária' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-foreground/90">Banco</Label>
                  <Input
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    className="dark:bg-muted dark:border-border/40"
                  />
                </div>
                <div>
                  <Label className="text-foreground/90">Agência</Label>
                  <Input
                    value={formData.agencia}
                    onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    className="dark:bg-muted dark:border-border/40"
                  />
                </div>
                <div>
                  <Label className="text-foreground/90">Conta</Label>
                  <Input
                    value={formData.conta}
                    onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    className="dark:bg-muted dark:border-border/40"
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-foreground/90">Saldo inicial</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.saldo_inicial}
                onChange={(e) => setFormData({ ...formData, saldo_inicial: parseFloat(e.target.value) || 0 })}
                className="dark:bg-muted dark:border-border/40"
                disabled={!!selectedAccount}
              />
            </div>
            {selectedAccount && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="conta-ativa"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="rounded border-border"
                />
                <Label htmlFor="conta-ativa" className="text-foreground/90 cursor-pointer">Conta ativa</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="dark:bg-muted dark:border-border/40">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!conciliacaoConta} onOpenChange={(open) => !open && setConciliacaoConta(null)}>
        <DialogContent className="flex h-[min(85dvh,90vh)] max-h-[min(85dvh,90vh)] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden border-border/40 p-0 dark:border-border/40 dark:bg-muted">
          <DialogHeader className="shrink-0 px-6 pb-3 pt-6">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ArrowRightLeft className="h-5 w-5 text-amber-500" />
              Conciliação — {conciliacaoConta?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 md:px-6 md:pb-6">
            {conciliacaoConta && (
              <ConciliacaoBancaria
                contaId={conciliacaoConta.id}
                contaNome={conciliacaoConta.nome}
                onClose={() => setConciliacaoConta(null)}
                onConciliado={loadData}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (mobileShell) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 z-10 space-y-2 border-b border-border/25 bg-background/95 px-4 pb-2 backdrop-blur-sm md:px-6">
          {filtrosBlock}
          {showMetaOnMobile ? metaBlock : null}
        </div>
        <div
          ref={listScrollRef}
          className="flex-1 min-h-0 min-w-0 p38-stage-panel-scroll overflow-x-hidden touch-pan-y p38-scroll-pad-fab"
        >
          {listaBlock}
        </div>
        {fabAndDialogs}
      </div>
    );
  }

  return (
    <>
      {filtrosBlock}
      {metaBlock}
      {listaBlock}
      {fabAndDialogs}
    </>
  );
}

/** Página completa (rota ContasFinanceiras). */
export default function GestaoContasFinanceiras() {
  return (
    <GestaoContasProvider>
      <div className="w-full min-w-0 max-w-full space-y-3 pb-[var(--p38-scroll-pad-below-nav)] font-din-1451 bg-background">
        <div className="min-w-0 max-w-full space-y-2">
          <div className="flex flex-col gap-2">
            <h1 className={cn(P38_PAGE_TITLE, 'text-lg md:text-2xl font-glacial leading-none')}>
              Contas Financeiras
            </h1>
            <GestaoContasKpis />
          </div>
        </div>
        <GestaoContasPane />
      </div>
    </GestaoContasProvider>
  );
}

/** Provider + painel para embutir no módulo Financeiro (ExecucaoOrcamentaria). */
export function GestaoContasEmbedded({ active, shared, children }) {
  if (shared) {
    return (
      <GestaoContasProvider shared={shared}>
        {children}
      </GestaoContasProvider>
    );
  }
  if (!active) return <>{children}</>;
  return (
    <GestaoContasProvider>
      {children}
    </GestaoContasProvider>
  );
}
