import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/components/utils';
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
import FinanceiroListaMeta, { FinanceiroSummaryChip } from './fluxo/FinanceiroListaMeta';
import {
  calcularSaldosAposDataCorte,
  calcularSaldosTodasContas,
  getSaldoExibicaoConta,
} from '@/lib/saldoContaFinanceira';
import {
  DATA_CORTE_HISTORICO_PADRAO,
  gravarPreferenciasCorteHistorico,
  isContaTransicao,
  lerPreferenciasCorteHistorico,
  passaFiltroCorteHistorico,
} from '@/lib/filtroDataFinanceiro';
import { getDataAncoraFluxoKey } from '@/lib/lancamentoFinanceiroStatus';
import {
  contasParaSaldoKpi,
  gravarPreferenciasSaldoContas,
  lerPreferenciasSaldoContas,
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
  const [mostrarHistoricoAnterior, setMostrarHistoricoAnterior] = useState(
    () => lerPreferenciasCorteHistorico().mostrarHistoricoAnterior,
  );
  const [dataCorteHistorico, setDataCorteHistorico] = useState(
    () => lerPreferenciasCorteHistorico().dataCorte || DATA_CORTE_HISTORICO_PADRAO,
  );
  const [contasSaldoSelLocal, setContasSaldoSelLocal] = useState(() => lerPreferenciasSaldoContas());

  const atualizarCorteHistorico = useCallback((mostrar, dataCorte) => {
    setMostrarHistoricoAnterior(mostrar);
    setDataCorteHistorico(dataCorte);
    gravarPreferenciasCorteHistorico(mostrar, dataCorte);
  }, []);

  const accounts = shared?.contas ?? accountsLocal;
  const lancamentos = shared?.lancs ?? lancamentosLocal;
  const movimentosCaixa = shared?.movimentos ?? movimentosLocal;
  const loading = shared ? shared.loading : loadingLocal;
  const contasSaldoSel = shared?.contasSaldoSel ?? contasSaldoSelLocal;
  const contasSaldoOpcoes = shared?.contasSaldoOpcoes ?? accounts.filter(
    (c) => c.ativo !== false && !isContaTransicao(c),
  );

  const atualizarContasSaldoSel = useCallback((ids) => {
    if (shared?.atualizarContasSaldoSel) {
      shared.atualizarContasSaldoSel(ids);
      return;
    }
    setContasSaldoSelLocal(ids);
    gravarPreferenciasSaldoContas(ids);
  }, [shared]);

  const loadSaldosBase = useCallback(async () => {
    setCarregandoSaldosBase(true);
    try {
      const [lancsFull, movsFull] = await Promise.all([
        base44.entities.LancamentoFinanceiro.list(),
        base44.entities.MovimentosCaixa.list(),
      ]);
      setLancamentosSaldo(lancsFull);
      setMovimentosSaldo(movsFull);
    } catch (error) {
      console.error('Erro ao carregar base de saldos:', error);
    } finally {
      setCarregandoSaldosBase(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (shared?.reload) {
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
  }, [shared, loadSaldosBase]);

  useEffect(() => {
    loadSaldosBase();
  }, [loadSaldosBase]);

  useEffect(() => {
    if (shared) return;
    loadData();
  }, [shared, loadData]);

  useEffect(() => {
    if (shared) return;
    const ativas = accounts.filter((c) => c.ativo !== false);
    if (!ativas.length) return;
    setContasSaldoSelLocal((prev) => {
      if (!prev.length) return prev;
      const valid = prev.filter((id) => ativas.some((c) => c.id === id));
      if (valid.length !== prev.length) gravarPreferenciasSaldoContas(valid);
      return valid;
    });
  }, [shared, accounts]);

  const precisaBaseCompletaSaldo = !mostrarHistoricoAnterior && !!dataCorteHistorico;
  const baseSaldoDisponivel = lancamentosSaldo.length > 0 && movimentosSaldo.length > 0;
  const saldosProntos = !carregandoSaldosBase && (!precisaBaseCompletaSaldo || baseSaldoDisponivel);

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
      return calcularSaldosAposDataCorte(accounts, lancsParaSaldo, movsParaSaldo, dataCorteHistorico);
    }
    return calcularSaldosTodasContas(accounts, lancsParaSaldo, movsParaSaldo);
  }, [accounts, lancsParaSaldo, movsParaSaldo, mostrarHistoricoAnterior, dataCorteHistorico, saldosProntos]);

  const contasEnriquecidas = useMemo(() => accounts.map((account) => ({
    ...account,
    saldo_calculado: saldosCalculados ? saldosCalculados[account.id] : null,
  })), [accounts, saldosCalculados]);

  const contasOperacionais = useMemo(
    () => contasEnriquecidas.filter((account) => !isContaTransicao(account)),
    [contasEnriquecidas],
  );

  const contasNoSaldoKpi = useMemo(
    () => contasParaSaldoKpi(contasSaldoSel, contasSaldoOpcoes),
    [contasSaldoSel, contasSaldoOpcoes],
  );

  const filtrados = useMemo(() => contasOperacionais.filter((account) => {
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
  }), [contasOperacionais, statusFiltro, tipoFiltro, somentePendencias, pendenciasConciliacao, search]);

  const kpis = useMemo(() => {
    let saldoTotal = 0;
    let qtdAtivas = 0;
    let qtdInativas = 0;
    let negativas = 0;
    let saldoNegativo = 0;
    let pendencias = 0;

    contasOperacionais.forEach((a) => {
      if (!saldosProntos || !saldosCalculados) return;
      if (!contasNoSaldoKpi.some((c) => c.id === a.id)) return;
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
      qtdTotal: contasOperacionais.length,
      qtdAtivas,
      qtdInativas,
      negativas,
      saldoNegativo: Math.abs(saldoNegativo),
      pendencias,
    };
  }, [contasOperacionais, contasNoSaldoKpi, saldosCalculados, pendenciasConciliacao, saldosProntos]);

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
  const hasActiveFilters = tipoFiltro !== 'todos' || statusFiltro !== 'ativas' || somentePendencias || mostrarHistoricoAnterior;

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
    window.location.href = createPageUrl(`ExtratoConta?id=${account.id}`);
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
    contasSaldoSel,
    contasSaldoOpcoes,
    atualizarContasSaldoSel,
  };
}

function GestaoContasProvider({ shared, children }) {
  const value = useGestaoContasModel(shared);
  return <GestaoContasCtx.Provider value={value}>{children}</GestaoContasCtx.Provider>;
}

/** KPIs — faixa compacta (mobile e desktop). */
export function GestaoContasKpis() {
  const m = useContext(GestaoContasCtx);
  if (!m) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <KpiContasBar kpis={m.kpis} saldosProntos={m.saldosProntos} />
      </div>
      <ContasSaldoPicker
        contas={m.contasSaldoOpcoes}
        sel={m.contasSaldoSel}
        onSel={m.atualizarContasSaldoSel}
        className="self-start"
      />
    </div>
  );
}

/** Filtros + meta + lista + FAB + diálogos. */
export function GestaoContasPane() {
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
  } = m;

  const tipoLabel = TIPOS_CONTA.find((t) => t.v === tipoFiltro)?.l;
  const statusLabel = statusFiltro === 'inativas' ? 'Inativas' : statusFiltro === 'todas' ? 'Todas' : null;

  return (
    <>
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
      />

      <FinanceiroListaMeta
        total={filtrados.length}
        totalLabel={filtrados.length === 1 ? 'conta' : 'contas'}
        hasActiveFilters={hasActiveFilters || !!search}
        onLimparFiltros={() => {
          setTipoFiltro('todos');
          setStatusFiltro('ativas');
          setSomentePendencias(false);
          setSearch('');
        }}
        summaryChips={
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
              </>
        }
      />

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
}

/** Página completa (rota ContasFinanceiras). */
export default function GestaoContasFinanceiras() {
  return (
    <GestaoContasProvider>
      <div className="w-full min-w-0 max-w-full space-y-3 pb-[var(--p38-scroll-pad-below-nav)] font-din-1451 bg-background">
        <div className="min-w-0 max-w-full space-y-2">
          <div className="flex flex-col gap-2">
            <p className="text-lg font-semibold leading-none text-foreground font-glacial md:text-2xl">
              Contas Financeiras
            </p>
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
