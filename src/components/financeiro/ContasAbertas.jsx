import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  format, isWithinInterval, startOfDay, endOfDay, addDays,
  startOfMonth, endOfMonth, isBefore, isAfter, addMonths,
  eachDayOfInterval, getDay, isSameDay, subDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowDownLeft, ArrowUpRight, Plus,
  AlertTriangle, FileText, Upload,
} from 'lucide-react';
import FiltrosContasAbertas, { PERIODOS_CONTAS } from './fluxo/FiltrosContasAbertas';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from './fluxo/FinanceiroListaMeta';
import ListaContasAbertas from './fluxo/ListaContasAbertas';
import { formatFinanceiroGrupoLabel } from './fluxo/FinanceiroListaShared';
import { P38_ACCENT } from './fluxo/financeiroP38';
import {
  FinanceiroKpiItem,
  FinanceiroKpiStrip,
  formatKpiValor,
} from './fluxo/FinanceiroKpiInline';
import { dataHoje } from '@/components/utils/dateUtils';
import { sortLancamentosPorDescricao } from '@/lib/financialUtils';
import NovoLancamentoDialog from './NovoLancamentoDialog';
import LancamentoDetalheDialog from './LancamentoDetalheDialog';
import PagamentoLoteDialog from './PagamentoLoteDialog';
import CorrigirDataLoteDialog from './CorrigirDataLoteDialog';
import { useToast } from '@/components/ui/use-toast';
import { CONCILIACAO_LOTE_TAMANHO, processarEmLotes } from '@/lib/conciliacaoEmLote';
import {
  getValorContaAberta,
  isLancamentoEmAberto,
  isLancamentoPago,
  isLancamentoVencido,
  lancamentoPassaFiltroContasAbertas,
} from '@/lib/lancamentoFinanceiroStatus';
import { sincronizarSaldosContasFinanceiras } from '@/lib/sincronizarSaldoContasFinanceiras';
import {
  dataFinanceiraKey,
  hojeFinanceiroStr,
  passaFiltroPeriodo,
  periodoRangeFinanceiro,
  PERIODOS_DATA_PAGAMENTO,
} from '@/lib/filtroDataFinanceiro';

// ─── utils ────────────────────────────────────────────────────────────────────
const R = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date();
const hojeStr = () => hojeFinanceiroStr();

function parseVencimento(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getVencimento(l) {
  return dataFinanceiraKey(l.data_vencimento);
}

function getDataPagamento(l) {
  return dataFinanceiraKey(l.data_pagamento);
}

function getDataCampo(l, campo) {
  return campo === 'pagamento' ? getDataPagamento(l) : getVencimento(l);
}

function KpiAbertas({ kpis, layout = 'card' }) {
  return (
    <FinanceiroKpiStrip layout={layout}>
      <FinanceiroKpiItem
        layout={layout}
        icon={ArrowDownLeft}
        iconClass={P38_ACCENT}
        label="A receber"
        value={formatKpiValor(kpis.aReceber)}
        sub={kpis.qtdReceber > 0 ? `${kpis.qtdReceber} lç.` : null}
      />
      <FinanceiroKpiItem
        layout={layout}
        icon={ArrowUpRight}
        iconClass="text-foreground/50"
        label="A pagar"
        value={formatKpiValor(kpis.aPagar)}
        sub={kpis.qtdPagar > 0 ? `${kpis.qtdPagar} lç.` : null}
      />
      <FinanceiroKpiItem
        layout={layout}
        label="Saldo proj."
        value={
          <>
            <span className={kpis.saldoProjetado >= 0 ? P38_ACCENT : 'text-foreground/80'}>
              {kpis.saldoProjetado >= 0 ? '+' : '−'}
            </span>
            {formatKpiValor(Math.abs(kpis.saldoProjetado))}
          </>
        }
      />
      {kpis.vencidas > 0 && (
        <FinanceiroKpiItem
          layout={layout}
          icon={AlertTriangle}
          iconClass="text-amber-600 dark:text-amber-400"
          label="Vencidas"
          value={
            <>
              <span className="text-amber-600 dark:text-amber-400">−</span>
              {formatKpiValor(kpis.vencidas)}
            </>
          }
          sub={kpis.qtdVencidas > 0 ? `${kpis.qtdVencidas} lç.` : null}
        />
      )}
    </FinanceiroKpiStrip>
  );
}

function periodoRange(p, cs, ce) {
  return periodoRangeFinanceiro(p, cs, ce);
}

// ─── Context (layout espelha Fluxo: KPIs no card; filtros + lista fora) ───────
const ContasAbertasCtx = createContext(null);

function useContasAbertasModel(onOpenImportador, shared) {
  const { toast } = useToast();
  const [lancsLocal, setLancsLocal] = useState([]);
  const [contasLocal, setContasLocal] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(!shared);
  const [periodo, setPeriodo]     = useState('mes');
  const [cs, setCs]               = useState('');
  const [ce, setCe]               = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [contasSel] = useState([]);
  const [search, setSearch]       = useState('');
  const [showNovo, setShowNovo]       = useState(false);
  const [novoTipo, setNovoTipo]       = useState('Despesa');
  const [fabOpen, setFabOpen]         = useState(false);
  const [detalhe, setDetalhe]         = useState(null);
  const [editando, setEditando]         = useState(null);
  const [mostrarPagas, setMostrarPagas] = useState(false);
  const [campoPeriodo, setCampoPeriodo] = useState('vencimento');
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modoSelecaoLote, setModoSelecaoLote] = useState(false);
  const [modoCorrigirDataLote, setModoCorrigirDataLote] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPagamentoLote, setShowPagamentoLote] = useState(false);
  const [showCorrigirDataLote, setShowCorrigirDataLote] = useState(false);
  const [contaLoteId, setContaLoteId] = useState('');
  const [dataPagamentoLote, setDataPagamentoLote] = useState(dataHoje());
  const [processingLote, setProcessingLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState({ atual: 0, total: 0 });

  const lancs = shared?.lancs ?? lancsLocal;
  const contas = shared?.contasAtivas ?? shared?.contas ?? contasLocal;
  const movimentos = shared?.movimentos ?? [];
  const todasContas = shared?.contas ?? contas;
  const loading = shared ? shared.loading : loadingLocal;

  const load = async () => {
    if (shared?.reload) {
      return shared.reload();
    }
    setLoadingLocal(true);
    const [ls, cts] = await Promise.all([
      base44.entities.LancamentoFinanceiro.list('-data_vencimento'),
      base44.entities.ContasFinanceiras.filter({ ativo: true }),
    ]);
    setLancsLocal(ls);
    setContasLocal(cts);
    setLoadingLocal(false);
    return { ls, cts };
  };

  useEffect(() => {
    if (shared) return;
    load();
  }, []);

  // Lançamentos não cancelados (inclui pagas se mostrarPagas ativo)
  const emAberto = useMemo(() =>
    lancs.filter(l => {
      if (!lancamentoPassaFiltroContasAbertas(l)) return false;
      const exigePago = mostrarPagas || campoPeriodo === 'pagamento';
      if (!exigePago && isLancamentoPago(l)) return false;
      if (campoPeriodo === 'pagamento' && !isLancamentoPago(l)) return false;
      return true;
    }),
  [lancs, mostrarPagas, campoPeriodo]);

  const { s: ds, e: de } = useMemo(() => periodoRange(periodo, cs, ce), [periodo, cs, ce]);

  const filtrados = useMemo(() => emAberto.filter(l => {
    const dataStr = getDataCampo(l, campoPeriodo);
    const dataDate = parseVencimento(dataStr);

    if (campoPeriodo === 'pagamento' && !dataStr) return false;

    if (!passaFiltroPeriodo(dataStr, dataDate, periodo, ds, de, hojeStr())) return false;

    if (tipoFiltro === 'compras') {
      if (l.referencia_tipo !== 'PedidoCompra' && !l.is_custo_mercadoria) return false;
    } else if (tipoFiltro !== 'todos' && l.tipo !== tipoFiltro) return false;

    if (contasSel.length && l.conta_financeira_id && !contasSel.includes(l.conta_financeira_id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (l.descricao || '').toLowerCase().includes(q) ||
             (l.categoria || '').toLowerCase().includes(q) ||
             (l.terceiro_nome || '').toLowerCase().includes(q);
    }
    return true;
  }), [emAberto, periodo, ds, de, tipoFiltro, contasSel, search, cs, ce, campoPeriodo]);

  const kpis = useMemo(() => {
    let aReceber = 0, aPagar = 0, qtdReceber = 0, qtdPagar = 0, vencidas = 0, qtdVencidas = 0;
    const hStr = hojeStr();
    // KPIs consideram apenas Em Aberto/Vencido (não as pagas)
    filtrados.filter((l) => isLancamentoEmAberto(l)).forEach((l) => {
      const valor = getValorContaAberta(l);
      if (l.tipo === 'Receita') { aReceber += valor; qtdReceber++; }
      else { aPagar += valor; qtdPagar++; }
      if (isLancamentoVencido(l, hStr)) {
        vencidas += valor;
        qtdVencidas++;
      }
    });
    return { aReceber, aPagar, saldoProjetado: aReceber - aPagar, qtdReceber, qtdPagar, vencidas, qtdVencidas };
  }, [filtrados]);

  const grupos = useMemo(() => {
    const hStr = hojeStr();
    const oStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const map = {};
    filtrados.forEach((l) => {
      const k = getDataCampo(l, campoPeriodo) || 'sem-data';
      (map[k] = map[k] || []).push(l);
    });

    const totaisGrupo = (items) => ({
      aReceberDia: items.filter((l) => l.tipo === 'Receita').reduce((s, l) => s + getValorContaAberta(l), 0),
      aPagarDia: items.filter((l) => l.tipo === 'Despesa').reduce((s, l) => s + getValorContaAberta(l), 0),
    });

    const sortPorDataAntiga = (items) =>
      [...items].sort((a, b) => {
        const da = getDataCampo(a, campoPeriodo) || '';
        const db = getDataCampo(b, campoPeriodo) || '';
        if (da !== db) return da.localeCompare(db);
        return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' });
      });

    const vencidasItems = [];
    const outros = [];

    Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([k, items]) => {
        const isVencido = campoPeriodo === 'vencimento' && k !== 'sem-data' && k < hStr;
        if (isVencido) {
          vencidasItems.push(...items);
        } else {
          outros.push([k, items]);
        }
      });

    const resultado = [];

    if (vencidasItems.length > 0) {
      const itemsOrdenados = sortPorDataAntiga(vencidasItems);
      resultado.push({
        k: 'vencidas',
        label: 'Vencidas',
        items: itemsOrdenados,
        ...totaisGrupo(itemsOrdenados),
        isVencido: true,
        isTreeBucket: true,
      });
    }

    outros.forEach(([k, items]) => {
      const itemsOrdenados = sortLancamentosPorDescricao(items);
      const label = k === 'sem-data'
        ? (campoPeriodo === 'pagamento' ? 'Sem data de pagamento' : 'Sem vencimento')
        : formatFinanceiroGrupoLabel(k, hStr, oStr);
      resultado.push({
        k,
        label,
        items: itemsOrdenados,
        ...totaisGrupo(itemsOrdenados),
        isVencido: false,
        isTreeBucket: false,
      });
    });

    return resultado;
  }, [filtrados, campoPeriodo]);

  const handleCampoPeriodo = (campo) => {
    setCampoPeriodo(campo);
    if (campo === 'pagamento') {
      setMostrarPagas(true);
      if (!PERIODOS_DATA_PAGAMENTO.some((p) => p.v === periodo)) {
        setPeriodo('mes');
        setCs('');
        setCe('');
      }
    }
  };

  // Marcar como pago rapidamente (abre detalhe pre-configurado)

  const handleToggleSelecionado = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const idsSelecionaveis = useMemo(() => {
    if (modoCorrigirDataLote) {
      return filtrados.filter((l) => isLancamentoPago(l)).map((l) => l.id);
    }
    return filtrados.filter((l) => !isLancamentoPago(l)).map((l) => l.id);
  }, [filtrados, modoCorrigirDataLote]);

  const todosSelecionados = idsSelecionaveis.length > 0
    && idsSelecionaveis.every((id) => selectedIds.includes(id));

  const handleSelecionarTodos = () => {
    setSelectedIds(todosSelecionados ? [] : idsSelecionaveis);
  };

  const lancamentosSelecionados = useMemo(() => {
    if (modoCorrigirDataLote) {
      return filtrados.filter((l) => selectedIds.includes(l.id) && isLancamentoPago(l));
    }
    return filtrados.filter((l) => selectedIds.includes(l.id) && !isLancamentoPago(l));
  }, [filtrados, selectedIds, modoCorrigirDataLote]);

  const sairModoLote = () => {
    setModoSelecaoLote(false);
    setModoCorrigirDataLote(false);
    setSelectedIds([]);
  };

  const entrarModoPagarLote = () => {
    if (modoSelecaoLote) {
      sairModoLote();
      return;
    }
    setModoCorrigirDataLote(false);
    setModoSelecaoLote(true);
    setSelectedIds([]);
  };

  const entrarModoCorrigirDataLote = () => {
    if (modoCorrigirDataLote) {
      sairModoLote();
      return;
    }
    setModoSelecaoLote(false);
    setModoCorrigirDataLote(true);
    setMostrarPagas(true);
    setSelectedIds([]);
  };

  const handleConfirmarPagamentoLote = async () => {
    const conta = contas.find((c) => c.id === contaLoteId);
    const idsSnapshot = [...selectedIds];
    const itensLote = filtrados.filter(
      (l) => idsSnapshot.includes(l.id) && !isLancamentoPago(l)
    );
    if (!conta || !dataPagamentoLote || itensLote.length === 0) return;

    setProcessingLote(true);
    setProgressoLote({ atual: 0, total: itensLote.length });
    try {
      const { erros, sucessos } = await processarEmLotes(
        itensLote,
        CONCILIACAO_LOTE_TAMANHO,
        async (lancamento) => {
          await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
            status: 'Pago',
            data_pagamento: dataPagamentoLote,
            status_conciliacao: 'Pendente',
            conta_financeira_id: conta.id,
            conta_financeira_nome: conta.nome,
          });
        },
        (atual, total) => setProgressoLote({ atual, total })
      );

      if (sucessos.length === 0) {
        throw new Error('Nenhum lançamento foi pago.');
      }

      const contaIdsAfetados = [
        ...new Set([
          conta.id,
          ...sucessos.map((l) => l.conta_financeira_id).filter(Boolean),
        ]),
      ];

      const snapshot = await load();
      await sincronizarSaldosContasFinanceiras(base44, {
        contas: snapshot?.cts ?? todasContas,
        lancamentos: snapshot?.ls ?? lancs,
        movimentos: snapshot?.movs ?? movimentos,
        contaIds: contaIdsAfetados,
      });

      const descricaoSucesso = erros.length > 0
        ? `${sucessos.length} de ${itensLote.length} lançamento(s) pago(s) — ${erros.length} falha(s)`
        : `${sucessos.length} lançamento(s) marcado(s) como pago(s).`;

      toast({
        title: erros.length > 0 ? 'Pagamento parcial' : (sucessos.length > 1 ? 'Pagamentos confirmados' : 'Pagamento confirmado'),
        description: descricaoSucesso,
        className: erros.length > 0 ? undefined : 'bg-muted text-foreground',
        variant: erros.length > 0 ? 'destructive' : undefined,
      });

      setShowPagamentoLote(false);
      sairModoLote();
      setContaLoteId('');
      setDataPagamentoLote(dataHoje());
      await load();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro no pagamento em lote',
        description: error?.message || 'Não foi possível concluir todos os lançamentos.',
        variant: 'destructive',
      });
    } finally {
      setProcessingLote(false);
      setProgressoLote({ atual: 0, total: 0 });
    }
  };

  const handleConfirmarCorrigirDataLote = async () => {
    const idsSnapshot = [...selectedIds];
    const itensLote = filtrados.filter(
      (l) => idsSnapshot.includes(l.id) && isLancamentoPago(l)
    );
    if (!dataPagamentoLote || itensLote.length === 0) return;

    setProcessingLote(true);
    setProgressoLote({ atual: 0, total: itensLote.length });
    try {
      const { erros, sucessos } = await processarEmLotes(
        itensLote,
        CONCILIACAO_LOTE_TAMANHO,
        async (lancamento) => {
          await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
            data_pagamento: dataPagamentoLote,
          });
        },
        (atual, total) => setProgressoLote({ atual, total })
      );

      if (sucessos.length === 0) {
        throw new Error('Nenhum lançamento foi atualizado.');
      }

      const descricaoSucesso = erros.length > 0
        ? `${sucessos.length} de ${itensLote.length} data(s) corrigida(s) — ${erros.length} falha(s)`
        : `${sucessos.length} data(s) de pagamento atualizada(s).`;

      toast({
        title: erros.length > 0 ? 'Correção parcial' : 'Datas corrigidas',
        description: descricaoSucesso,
        className: erros.length > 0 ? undefined : 'bg-muted text-foreground',
        variant: erros.length > 0 ? 'destructive' : undefined,
      });

      setShowCorrigirDataLote(false);
      sairModoLote();
      setDataPagamentoLote(dataHoje());
      await load();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro ao corrigir datas',
        description: error?.message || 'Não foi possível atualizar todos os lançamentos.',
        variant: 'destructive',
      });
    } finally {
      setProcessingLote(false);
      setProgressoLote({ atual: 0, total: 0 });
    }
  };

  const handleGerarRelatorio = async () => {
    setGerandoRelatorio(true);
    try {
      const filtrosDesc = [
        PERIODOS_CONTAS.find(p => p.v === periodo)?.l || periodo,
        tipoFiltro !== 'todos' ? tipoFiltro : null,
        search || null,
        cs && ce ? `${cs} a ${ce}` : null,
      ].filter(Boolean).join(' · ');

      const response = await base44.functions.invoke('gerarRelatorioContasAbertas', {
        lancamentos: filtrados,
        filtros_desc: filtrosDesc,
        kpis,
      });
      if (!response?.data) throw new Error('Resposta inválida');
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ContasAbertas_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
    setGerandoRelatorio(false);
  };

  const FAB_ITEMS = [
    { tipo: 'Receita', icon: ArrowDownLeft, label: 'A Receber', action: () => { setNovoTipo('Receita'); setShowNovo(true); setFabOpen(false); } },
    { tipo: 'Despesa', icon: ArrowUpRight,  label: 'A Pagar',   action: () => { setNovoTipo('Despesa'); setShowNovo(true); setFabOpen(false); } },
    { tipo: 'Importar', icon: Upload, label: 'Importar PDF', action: () => { setFabOpen(false); onOpenImportador?.(); } },
    { tipo: 'Relatorio', icon: FileText,    label: gerandoRelatorio ? 'Gerando...' : 'Relatório', action: () => { setFabOpen(false); handleGerarRelatorio(); } },
  ];

  return {
    kpis,
    filtrados,
    search,
    setSearch,
    filtersOpen,
    setFiltersOpen,
    periodo,
    setPeriodo,
    cs,
    ce,
    setCs,
    setCe,
    tipoFiltro,
    setTipoFiltro,
    mostrarPagas,
    setMostrarPagas,
    campoPeriodo,
    handleCampoPeriodo,
    modoSelecaoLote,
    modoCorrigirDataLote,
    entrarModoPagarLote,
    entrarModoCorrigirDataLote,
    sairModoLote,
    selectedIds,
    setSelectedIds,
    lancamentosSelecionados,
    loading,
    grupos,
    setDetalhe,
    handleToggleSelecionado,
    handleSelecionarTodos,
    todosSelecionados,
    idsSelecionaveis,
    fabOpen,
    setFabOpen,
    FAB_ITEMS,
    showNovo,
    setShowNovo,
    novoTipo,
    detalhe,
    editando,
    setEditando,
    contas,
    showPagamentoLote,
    setShowPagamentoLote,
    showCorrigirDataLote,
    setShowCorrigirDataLote,
    contaLoteId,
    setContaLoteId,
    dataPagamentoLote,
    setDataPagamentoLote,
    processingLote,
    progressoLote,
    handleConfirmarPagamentoLote,
    handleConfirmarCorrigirDataLote,
    load,
  };
}

function ContasAbertasInnerProvider({ onOpenImportador, shared, children }) {
  const value = useContasAbertasModel(onOpenImportador, shared);
  return (
    <ContasAbertasCtx.Provider value={value}>
      {children}
    </ContasAbertasCtx.Provider>
  );
}

/** Ativa dados só na aba Contas a pagar; reutiliza lançamentos do Fluxo quando disponíveis. */
export function ContasAbertasProvider({ active, onOpenImportador, shared, children }) {
  if (shared) {
    return (
      <ContasAbertasInnerProvider onOpenImportador={onOpenImportador} shared={shared}>
        {children}
      </ContasAbertasInnerProvider>
    );
  }
  if (!active) return <>{children}</>;
  return (
    <ContasAbertasInnerProvider onOpenImportador={onOpenImportador} shared={shared}>
      {children}
    </ContasAbertasInnerProvider>
  );
}

/** KPIs — dentro do card cinza (box amarelo). */
export function ContasAbertasKpis({ layout = 'card' }) {
  const m = useContext(ContasAbertasCtx);
  if (!m) return null;
  return <KpiAbertas kpis={m.kpis} layout={layout} />;
}

/** Busca + filtros recolhíveis — fora do card, como Fluxo de Caixa. */
export function ContasAbertasFiltros() {
  const m = useContext(ContasAbertasCtx);
  if (!m) return null;

  const {
    search,
    setSearch,
    filtersOpen,
    setFiltersOpen,
    periodo,
    setPeriodo,
    cs,
    ce,
    setCs,
    setCe,
    tipoFiltro,
    setTipoFiltro,
    mostrarPagas,
    setMostrarPagas,
    campoPeriodo,
    handleCampoPeriodo,
  } = m;

  return (
    <FiltrosContasAbertas
      search={search}
      onSearch={setSearch}
      filtersOpen={filtersOpen}
      onFiltersOpenChange={setFiltersOpen}
      periodo={periodo}
      onPeriodo={setPeriodo}
      cs={cs}
      ce={ce}
      onCs={setCs}
      onCe={setCe}
      tipoFiltro={tipoFiltro}
      onTipoFiltro={setTipoFiltro}
      mostrarPagas={mostrarPagas}
      onMostrarPagas={setMostrarPagas}
      campoPeriodo={campoPeriodo}
      onCampoPeriodo={handleCampoPeriodo}
    />
  );
}

/** Lista + FAB + diálogos — fora do card cinza, como ListaLancamentos no Fluxo. */
export function ContasAbertasListaPane() {
  const m = useContext(ContasAbertasCtx);
  if (!m) return null;

  const {
    loading,
    grupos,
    filtrados,
    setDetalhe,
    modoSelecaoLote,
    modoCorrigirDataLote,
    entrarModoPagarLote,
    entrarModoCorrigirDataLote,
    setSelectedIds,
    selectedIds,
    handleToggleSelecionado,
    handleSelecionarTodos,
    todosSelecionados,
    idsSelecionaveis,
    fabOpen,
    setFabOpen,
    FAB_ITEMS,
    showNovo,
    setShowNovo,
    novoTipo,
    detalhe,
    editando,
    setEditando,
    contas,
    showPagamentoLote,
    setShowPagamentoLote,
    showCorrigirDataLote,
    setShowCorrigirDataLote,
    contaLoteId,
    setContaLoteId,
    dataPagamentoLote,
    setDataPagamentoLote,
    lancamentosSelecionados,
    handleConfirmarPagamentoLote,
    handleConfirmarCorrigirDataLote,
    processingLote,
    progressoLote,
    load,
    periodo,
    setPeriodo,
    tipoFiltro,
    setTipoFiltro,
    mostrarPagas,
    setMostrarPagas,
    campoPeriodo,
    handleCampoPeriodo,
    cs,
    ce,
    setCs,
    setCe,
  } = m;

  const hasActiveFilters = periodo !== 'mes' || tipoFiltro !== 'todos' || mostrarPagas || campoPeriodo !== 'vencimento' || !!cs || !!ce;
  const periodoLabel = (campoPeriodo === 'pagamento' ? PERIODOS_DATA_PAGAMENTO : PERIODOS_CONTAS).find((p) => p.v === periodo)?.l || 'Período';
  const tipoLabel = tipoFiltro === 'Receita' ? 'A Receber' : tipoFiltro === 'Despesa' ? 'A Pagar' : tipoFiltro === 'compras' ? 'Compras' : null;

  return (
    <>
      <FinanceiroListaMeta
        total={filtrados.length}
        totalLabel={filtrados.length === 1 ? 'conta' : 'contas'}
        hasActiveFilters={hasActiveFilters}
        onLimparFiltros={() => {
          setPeriodo('mes');
          setTipoFiltro('todos');
          setMostrarPagas(false);
          handleCampoPeriodo('vencimento');
          setCs('');
          setCe('');
        }}
        summaryChips={
          <>
            {campoPeriodo === 'pagamento' && (
              <FinanceiroSummaryChip>Pagamento</FinanceiroSummaryChip>
            )}
            {periodo !== 'mes' && <FinanceiroSummaryChip>{periodoLabel}</FinanceiroSummaryChip>}
            {tipoFiltro !== 'todos' && tipoLabel && <FinanceiroSummaryChip>{tipoLabel}</FinanceiroSummaryChip>}
            {mostrarPagas && (
              <FinanceiroSummaryChip className="text-green-700 dark:text-green-400">Pagas</FinanceiroSummaryChip>
            )}
          </>
        }
        extraActions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={entrarModoCorrigirDataLote}
              className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${modoCorrigirDataLote ? 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]' : 'bg-secondary/80 text-muted-foreground dark:bg-[#383e47]'}`}
            >
              {modoCorrigirDataLote ? 'Cancelar' : 'Corrigir data'}
            </button>
            <button
              type="button"
              onClick={entrarModoPagarLote}
              className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${modoSelecaoLote ? 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]' : 'bg-secondary/80 text-muted-foreground dark:bg-[#383e47]'}`}
            >
              {modoSelecaoLote ? 'Cancelar lote' : 'Pagar em lote'}
            </button>
          </div>
        }
      />

      {modoCorrigirDataLote && (
        <div className="min-w-0 overflow-hidden rounded-xl border border-border/40 bg-card/60 p-3 dark:border-white/10 dark:bg-[#26262e]/80">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Corrigir data de pagamento</p>
              <p className="truncate text-xs text-muted-foreground">
                {lancamentosSelecionados.length} de {idsSelecionaveis.length} pago(s) selecionado(s)
              </p>
              {idsSelecionaveis.length === 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Ative &quot;Mostrar pagas&quot; nos filtros ou ajuste o período para ver os lançamentos.
                </p>
              )}
              {lancamentosSelecionados.length > CONCILIACAO_LOTE_TAMANHO && (
                <p className="text-[10px] text-muted-foreground">
                  Serão processados em {Math.ceil(lancamentosSelecionados.length / CONCILIACAO_LOTE_TAMANHO)} lotes de {CONCILIACAO_LOTE_TAMANHO}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleSelecionarTodos}
                disabled={idsSelecionaveis.length === 0}
                className="h-9 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 disabled:opacity-40"
              >
                {todosSelecionados ? 'Limpar tudo' : 'Selecionar tudo'}
              </button>
              <button
                type="button"
                onClick={() => setShowCorrigirDataLote(true)}
                disabled={lancamentosSelecionados.length === 0}
                className="h-9 shrink-0 rounded-xl bg-[#4a5240] px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-[#a4ce33] dark:text-[#1f1d22]"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {modoSelecaoLote && (
        <div className="min-w-0 overflow-hidden rounded-xl border border-border/40 bg-card/60 p-3 dark:border-white/10 dark:bg-[#26262e]/80">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Pagamento em lote</p>
              <p className="truncate text-xs text-muted-foreground">
                {lancamentosSelecionados.length} de {idsSelecionaveis.length} item(ns) selecionado(s)
              </p>
              {lancamentosSelecionados.length > CONCILIACAO_LOTE_TAMANHO && (
                <p className="text-[10px] text-muted-foreground">
                  Serão processados em {Math.ceil(lancamentosSelecionados.length / CONCILIACAO_LOTE_TAMANHO)} lotes de {CONCILIACAO_LOTE_TAMANHO}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleSelecionarTodos}
                disabled={idsSelecionaveis.length === 0}
                className="h-9 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 disabled:opacity-40"
              >
                {todosSelecionados ? 'Limpar tudo' : 'Selecionar tudo'}
              </button>
              <button
                type="button"
                onClick={() => setShowPagamentoLote(true)}
                disabled={lancamentosSelecionados.length === 0}
                className="h-9 shrink-0 rounded-xl bg-[#4a5240] px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-[#a4ce33] dark:text-[#1f1d22]"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <ListaContasAbertas
        grupos={grupos}
        loading={loading}
        onRow={setDetalhe}
        emSelecao={modoSelecaoLote || modoCorrigirDataLote}
        selecionarPagos={modoCorrigirDataLote}
        agruparPorPagamento={campoPeriodo === 'pagamento'}
        selecionados={selectedIds}
        onToggleSelecionado={handleToggleSelecionado}
      />

      {fabOpen && <div className="fixed inset-0 z-[54] bg-muted/55 backdrop-blur-[2px]" onClick={() => setFabOpen(false)} />}
      <div className="fixed right-4 z-[55] flex flex-col items-end gap-2 p38-bottom-fab1 lg:right-6">
        {fabOpen && FAB_ITEMS.map(({ tipo, icon: Icon, label, action }) => (
          <button
            key={tipo}
            type="button"
            onClick={action}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg whitespace-nowrap transition-transform active:scale-95 dark:bg-primary dark:text-primary-foreground"
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFabOpen(o => !o)}
          className={`flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-xl transition-all active:scale-95 ${fabOpen ? 'rotate-45 bg-[#383e47]' : 'bg-[#4a5240] dark:bg-[#a4ce33]'}`}
        >
          <Plus className={`h-6 w-6 ${fabOpen ? 'text-white' : 'text-white dark:text-[#1f1d22]'}`} />
        </button>
      </div>

      <NovoLancamentoDialog
        open={showNovo}
        lancamentoExistente={editando}
        tipoInicial={novoTipo}
        origemContaPagar
        onClose={() => { setShowNovo(false); setEditando(null); }}
        onSaved={async () => { setEditando(null); await load(); }}
      />
      {detalhe && (
        <LancamentoDetalheDialog
          lancamento={detalhe}
          onClose={() => setDetalhe(null)}
          onEdit={(l) => {
            setDetalhe(null);
            setEditando(l);
            setShowNovo(true);
          }}
          onSaved={async () => {
            await load();
            setDetalhe(null);
          }}
        />
      )}
      <CorrigirDataLoteDialog
        open={showCorrigirDataLote}
        onOpenChange={setShowCorrigirDataLote}
        dataPagamento={dataPagamentoLote}
        setDataPagamento={setDataPagamentoLote}
        selecionados={lancamentosSelecionados}
        onConfirm={handleConfirmarCorrigirDataLote}
        loading={processingLote}
        progresso={progressoLote}
        tamanhoLote={CONCILIACAO_LOTE_TAMANHO}
      />
      <PagamentoLoteDialog
        open={showPagamentoLote}
        onOpenChange={setShowPagamentoLote}
        contas={contas}
        contaId={contaLoteId}
        setContaId={setContaLoteId}
        dataPagamento={dataPagamentoLote}
        setDataPagamento={setDataPagamentoLote}
        selecionados={lancamentosSelecionados}
        onConfirm={handleConfirmarPagamentoLote}
        loading={processingLote}
        progresso={progressoLote}
        tamanhoLote={CONCILIACAO_LOTE_TAMANHO}
      />
    </>
  );
}