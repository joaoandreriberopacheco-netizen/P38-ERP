/**
 * AGEFIN — consulta de contas recorrentes e compromissos (SuperAgefin).
 * Rota: /SuperAgefin | Menu: Financeiro → AGEFIN
 *
 * Visual: mesmo esquema do Planejamento financeiro (tokens financeiroP38,
 * DIN 1451, superfícies calmas, lista P38MobileLine — sem cards com sombra).
 * Componentes em src/components/superagefin/
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { base44 } from '@/api/base44Client';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  Printer,
  Wallet,
  CircleSlash,
  X,
  Calculator,
  Menu,
  Users,
  Package,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import SuperAgefinConsultaDrawer from '@/components/superagefin/SuperAgefinConsultaDrawer';
import SuperAgefinConsultaOrganizer from '@/components/superagefin/SuperAgefinConsultaOrganizer';
import { boundsMesCivil, dataHoje, formatarSoData } from '@/components/utils/dateUtils';
import {
  carregarFolhaParaRelatorioDia5,
  dataDia5DoMes,
} from '@/lib/superAgefinFolhaRelatorio';
import {
  carregarBudgetsAgrupadosParaRelatorio,
  carregarModelosFolhaParaSuperAgefin,
  contaSuperAgefinSomenteLeitura,
  listaJaTemFolhaPagamento,
  montarContaSinteticaFolhaDia5,
  montarContasSinteticasSociosSabado,
} from '@/lib/superAgefinCompromissos';
import { gerarDespesaMensalPdf } from '@/lib/superAgefinDespesaMensalPdf';
import {
  lancamentoEhContaPagar,
  lancamentoEhCmv,
  lancamentoEhFreteItinerario,
  lancamentoEhCompraMercadoriaPedido,
  lancamentoPago,
  lancamentoCancelado,
  lancamentoVencidoOuAtrasado,
  lancamentoEmDia,
  lancamentoCompraMercadoriaPedidoPagamentoAVista,
} from '@/lib/agefinConsultaFilters';
import { P38MobileLine, P38MobileLineList, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38PaletteClasses } from '@/lib/p38Palette';
import {
  P38_ACCENT,
  P38_CHIP_ACTIVE,
  P38_CHIP_INACTIVE,
  P38_FIELD_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from '@/components/financeiro/fluxo/FinanceiroListaMeta';
import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import {
  measureVirtualItem,
  P38_VIRTUAL_LIST_MAX_HEIGHT,
  P38_VIRTUAL_MIN_ROWS,
  P38_VIRTUAL_OVERSCAN,
} from '@/lib/p38VirtualList';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatCurrency(value) {
  return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatMonth(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function KpiCard({ label, value, tone = 'default' }) {
  const valueTone = {
    default: 'text-foreground',
    success: P38_ACCENT,
    danger: 'text-red-600 dark:text-red-400',
    muted: 'text-foreground/80',
  }[tone] || 'text-foreground';

  const iconTone = {
    default: 'text-[#4a5240]/70 dark:text-[#a4ce33]/80',
    success: 'text-[#4a5240] dark:text-[#a4ce33]',
    danger: 'text-red-600 dark:text-red-400',
    muted: 'text-muted-foreground',
  }[tone] || 'text-muted-foreground';

  const Icon = {
    default: Wallet,
    success: CheckCircle2,
    danger: CircleAlert,
    muted: CircleSlash,
  }[tone] || Wallet;

  return (
    <div className="min-w-0 rounded-xl border border-[#dce0d4]/80 bg-card px-2.5 py-2 shadow-sm dark:border-white/10 dark:bg-[#2d333b] md:px-3 md:py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[#5c6358] dark:text-muted-foreground">
          {label}
        </p>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', iconTone)} />
      </div>
      <p className={cn('mt-1 truncate text-sm font-semibold tabular-nums md:text-[15px]', valueTone)}>
        {value}
      </p>
    </div>
  );
}

function CmvQuickToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-[#4a5240] dark:bg-[#a4ce33]' : 'bg-secondary dark:bg-[#383e47]',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-card transform transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
        active ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
      )}
    >
      {children}
    </button>
  );
}

function grupoDomId(key) {
  return `agefin-grupo-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/** Remove prefixo «- » dos sócios para alinhar com as outras linhas. */
function descricaoContaExibicao(conta) {
  const raw = String(conta?.descricao || '').trim();
  const limpa = raw.replace(/^[-–—]\s+/, '').trim();
  return limpa || 'sem descrição';
}

/** Origem da conta para ícone Lucide na lista (só descrição + origem). */
function origemContaAgefin(conta) {
  if (lancamentoEhCmv(conta) || lancamentoEhCompraMercadoriaPedido(conta)) {
    return { key: 'cmv', label: 'CMV', Icon: Package };
  }
  const tags = Array.isArray(conta?.tags)
    ? conta.tags.map((t) => String(t).toLowerCase())
    : [];
  if (
    conta?._superagefin_folha ||
    conta?._superagefin_socio ||
    tags.includes('folha_socio') ||
    tags.includes('folha_previsao') ||
    tags.includes('folha') ||
    /folha\s+de\s+pagamento/i.test(String(conta?.descricao || ''))
  ) {
    return { key: 'pessoas', label: 'Pessoas', Icon: Users };
  }
  if (
    tags.includes('agefin_previsao') ||
    tags.includes('recorrente') ||
    tags.includes('lf_gerado_auto') ||
    conta?.is_recorrente === true
  ) {
    return { key: 'planejamento', label: 'Planejamento', Icon: CalendarClock };
  }
  return null;
}

const GRUPO_META_LABEL = {
  vencimento: 'Vencimento',
  favorecido: 'Favorecido',
  status: 'Status',
  categoria: 'Categoria',
};

/** Tint do ícone de origem — parcimónia (referência Carbon Balance / P38). */
const ORIGEM_ICON_TINT = {
  pessoas: 'bg-[#4a5240]/12 text-[#4a5240] dark:bg-[#a4ce33]/15 dark:text-[#a4ce33]',
  cmv: 'bg-[#e8b824]/20 text-[#c4890a] dark:bg-[#e8b824]/12 dark:text-[#e8b824]',
  planejamento: 'bg-[#5c6b4a]/15 text-[#4a5240] dark:bg-[#a4ce33]/10 dark:text-[#c5e06a]',
};

/** Resumo do grupo — cartão branco + barra oliva (modo claro mais vivo). */
function AgefinGrupoCabecalho({ grupo, groupBy = 'vencimento' }) {
  const qtd = grupo.contas?.length || 0;
  const total = (grupo.contas || []).reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  const labelQtd = qtd === 1 ? '1 conta' : `${qtd} contas`;
  const metaLabel = GRUPO_META_LABEL[groupBy] || 'Grupo';

  return (
    <div className="p38-panel shadow-sm">
      <div className="p38-panel__accent-bar" aria-hidden />
      <div className="flex min-w-0 items-center justify-between gap-3 p38-panel__body py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#5c6358] dark:text-muted-foreground">
            {metaLabel}
          </p>
          <p className="truncate text-sm font-semibold uppercase tracking-wide text-[#2a2f28] dark:text-foreground">
            {grupo.label}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#5c6358] dark:text-muted-foreground">
            {labelQtd}
          </p>
          <p
            className={cn(
              'text-sm font-semibold tabular-nums',
              total > 0 ? 'text-red-600 dark:text-red-400' : P38_ACCENT,
            )}
          >
            {formatCurrency(total)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContaLinhaP38({ conta, onOpen, modoSelecao, selecionado, onToggleSelecao, striped }) {
  const todayKey = dataHoje();
  const isPaid = lancamentoPago(conta);
  const isOverdue = lancamentoVencidoOuAtrasado(conta, todayKey);
  const tone = isPaid ? 'success' : isOverdue ? 'danger' : 'muted';
  const origem = origemContaAgefin(conta);
  const OrigemIcon = origem?.Icon;
  const titulo = descricaoContaExibicao(conta);
  const iconTint =
    (origem && ORIGEM_ICON_TINT[origem.key]) ||
    'bg-[#f0f2ec] text-[#5c6358] dark:bg-[#383e47]/50 dark:text-muted-foreground';

  return (
    <P38MobileLine
      as="button"
      type="button"
      thinAccent
      striped={striped}
      accent={modoSelecao && selecionado ? 'success' : p38AccentKeyFromTone(tone)}
      onClick={() => (modoSelecao ? onToggleSelecao?.(conta) : onOpen())}
      className="w-full text-left"
    >
      <div className="flex w-full min-w-0 items-center gap-2.5">
        {/* Coluna fixa do ícone — tint por origem; descrições alinhadas */}
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            iconTint,
          )}
          aria-label={origem?.label || undefined}
          title={origem?.label || undefined}
        >
          {OrigemIcon ? <OrigemIcon className="h-4 w-4" strokeWidth={2.25} /> : null}
        </span>
        <div className={cn('min-w-0 flex-1 text-[#2a2f28] dark:text-foreground', p38Table.mobileLineTitle)}>
          {titulo.toUpperCase()}
        </div>
        <div
          className={cn(
            'shrink-0',
            p38Table.mobileLineValue,
            isPaid ? P38_ACCENT : isOverdue ? 'text-red-600 dark:text-red-400' : 'text-[#2a2f28] dark:text-foreground',
          )}
        >
          {formatCurrency(conta.valor)}
        </div>
      </div>
    </P38MobileLine>
  );
}

function SuperAgefinGruposVirtualList({
  grupos,
  groupBy = 'vencimento',
  modoSelecao,
  selecionadosIds,
  toggleSelecaoConta,
  abrirConta,
}) {
  const flatRows = useMemo(() => {
    const rows = [];
    grupos.forEach((grupo) => {
      rows.push({ kind: 'header', key: `h-${grupo.key}`, grupo });
      grupo.contas.forEach((conta, index) => {
        rows.push({ kind: 'conta', key: conta.id, conta, index, grupoKey: grupo.key });
      });
    });
    return rows;
  }, [grupos]);

  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (flatRows[index]?.kind === 'header' ? 64 : 56),
    getItemKey: (index) => flatRows[index]?.key ?? index,
    measureElement: measureVirtualItem,
    overscan: P38_VIRTUAL_OVERSCAN,
  });
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="mx-auto w-full max-w-3xl overflow-y-auto md:max-w-4xl"
      style={{ maxHeight: P38_VIRTUAL_LIST_MAX_HEIGHT }}
    >
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualItems.map((virtualRow) => {
          const row = flatRows[virtualRow.index];
          if (!row) return null;

          if (row.kind === 'header') {
            const { grupo } = row;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                id={grupoDomId(grupo.key)}
                className="absolute left-0 top-0 w-full scroll-mt-24 px-0.5 pt-3 first:pt-0"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <AgefinGrupoCabecalho grupo={grupo} groupBy={groupBy} />
              </div>
            );
          }

          const { conta, index } = row;
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full px-0.5 py-0.5"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <ContaLinhaP38
                conta={conta}
                striped={index % 2 === 1}
                modoSelecao={modoSelecao}
                selecionado={selecionadosIds.includes(conta.id)}
                onToggleSelecao={toggleSelecaoConta}
                onOpen={() => abrirConta(conta)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default function SuperAgefin() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [contas, setContas] = useState([]);
  const [modelosFolha, setModelosFolha] = useState([]);
  /** Conta sintética «Folha de pagamento» no dia 05 do mês civil */
  const [contaFolhaDia5, setContaFolhaDia5] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConta, setSelectedConta] = useState(null);
  const [pagamentoFilter, setPagamentoFilter] = useState('todos');
  const [prazoFilter, setPrazoFilter] = useState('todos');
  const [cmvFilter, setCmvFilter] = useState('todos');
  /** Interruptor rápido: ocultar linhas CMV da lista sem abrir filtros */
  const [mostrarCmvRapido, setMostrarCmvRapido] = useState(true);
  const [freteFilter, setFreteFilter] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupBy, setGroupBy] = useState('vencimento');
  const [sortOrder, setSortOrder] = useState('asc');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionadosIds, setSelecionadosIds] = useState([]);
  const debounceRef = useRef(null);
  const scrollMesAplicadoRef = useRef('');

  const abrirConta = useCallback((conta) => {
    if (contaSuperAgefinSomenteLeitura(conta)) {
      toast.message('Compromisso previsto', {
        description: conta?._superagefin_folha
          ? 'Folha de pagamento (vencimento dia 05). Figura na consulta e no relatório; edição pela Folha.'
          : conta?._superagefin_socio
            ? 'Sócio (pagamento semanal aos sábados). Figura na consulta e no relatório; edição pela Folha.'
            : 'Compromisso sintético da SUPERAGEFIN — só para consulta/impressão.',
      });
      return;
    }
    setSelectedConta(conta);
  }, []);

  const loadContas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.LancamentoFinanceiro.list('-data_vencimento', 5000);
      setContas(
        (data || []).filter((item) => {
          if (lancamentoCancelado(item)) return false;
          if (lancamentoCompraMercadoriaPedidoPagamentoAVista(item)) return false;
          return (
            lancamentoEhContaPagar(item) ||
            (item?.tipo === 'Despesa' && item?.referencia_tipo === 'EventosLogisticos')
          );
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContas();
  }, [loadContas]);

  useEffect(() => {
    let cancelled = false;
    carregarModelosFolhaParaSuperAgefin().then((modelos) => {
      if (!cancelled) setModelosFolha(modelos || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const dataPagamento = dataDia5DoMes(currentMonth);
    setContaFolhaDia5(null);
    carregarFolhaParaRelatorioDia5(dataPagamento)
      .then((folha) => {
        if (cancelled) return;
        setContaFolhaDia5(montarContaSinteticaFolhaDia5(folha));
      })
      .catch((err) => {
        console.error('SUPERAGEFIN: falha ao carregar folha dia 05 para a consulta', err);
        if (!cancelled) setContaFolhaDia5(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentMonth]);

  useEffect(() => {
    const unsub = base44.entities.LancamentoFinanceiro.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadContas(), 450);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (typeof unsub === 'function') unsub();
    };
  }, [loadContas]);

  const hasActiveFilters =
    pagamentoFilter !== 'todos' ||
    prazoFilter !== 'todos' ||
    cmvFilter !== 'todos' ||
    freteFilter !== 'todos' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const contasSociosSabado = useMemo(
    () => montarContasSinteticasSociosSabado(currentMonth, modelosFolha),
    [currentMonth, modelosFolha],
  );

  const monthData = useMemo(() => {
    const { start, end } = boundsMesCivil(currentMonth.getFullYear(), currentMonth.getMonth());
    const reais = contas.filter((conta) => {
      if (!conta?.data_vencimento) return false;
      const vencimento = `${conta.data_vencimento}`.slice(0, 10);
      return vencimento >= start && vencimento <= end;
    });
    // Folha dia 05: entra na consulta como os sócios aos sábados (sem duplicar se já houver LF).
    const folha =
      contaFolhaDia5 && !listaJaTemFolhaPagamento(reais) ? [contaFolhaDia5] : [];
    return [...reais, ...contasSociosSabado, ...folha].sort(
      (a, b) =>
        new Date(`${a.data_vencimento}T12:00:00-05:00`) - new Date(`${b.data_vencimento}T12:00:00-05:00`),
    );
  }, [contas, currentMonth, contasSociosSabado, contaFolhaDia5]);

  const filteredData = useMemo(() => {
    const todayKey = dataHoje();
    const list = monthData.filter((conta) => {
      if (pagamentoFilter === 'pagos' && !lancamentoPago(conta)) return false;
      if (pagamentoFilter === 'nao_pagos' && (lancamentoPago(conta) || lancamentoCancelado(conta))) return false;

      if (prazoFilter === 'vencidas' && !lancamentoVencidoOuAtrasado(conta, todayKey)) return false;
      if (prazoFilter === 'em_dia' && !lancamentoEmDia(conta, todayKey)) return false;

      if (cmvFilter === 'cmv' && !lancamentoEhCmv(conta)) return false;
      if (cmvFilter === 'normal' && lancamentoEhCmv(conta)) return false;
      if (!mostrarCmvRapido && lancamentoEhCmv(conta)) return false;

      if (freteFilter === 'fretes' && !lancamentoEhFreteItinerario(conta)) return false;
      if (freteFilter === 'sem_fretes' && lancamentoEhFreteItinerario(conta)) return false;

      const matchesFrom = !dateFrom || conta.data_vencimento >= dateFrom;
      const matchesTo = !dateTo || conta.data_vencimento <= dateTo;
      return matchesFrom && matchesTo;
    });
    return list;
  }, [monthData, pagamentoFilter, prazoFilter, cmvFilter, freteFilter, dateFrom, dateTo, mostrarCmvRapido]);

  const contasOrdenadas = useMemo(() => {
    const list = [...filteredData];
    list.sort((a, b) => {
      const da = (a.data_vencimento || '').slice(0, 10);
      const db = (b.data_vencimento || '').slice(0, 10);
      const c = da.localeCompare(db);
      if (c !== 0) return sortOrder === 'asc' ? c : -c;
      return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' });
    });
    return list;
  }, [filteredData, sortOrder]);

  const grupos = useMemo(() => {
    const todayKey = dataHoje();
    const bucketStatus = (conta) => {
      if (lancamentoPago(conta)) return { key: 'pago', label: 'Pagos', order: 0 };
      if (lancamentoVencidoOuAtrasado(conta, todayKey)) return { key: 'vencido', label: 'Vencidos', order: 1 };
      return { key: 'aberto', label: 'Em aberto', order: 2 };
    };

    const metaFor = (conta) => {
      if (groupBy === 'vencimento') {
        const d = (conta.data_vencimento || '').slice(0, 10) || 'sem-data';
        const label =
          d === 'sem-data' ? 'Sem data' : d === todayKey ? 'Hoje' : formatarSoData(d);
        return { key: `v:${d}`, label, orderValue: d === 'sem-data' ? '9999-12-31' : d };
      }
      if (groupBy === 'favorecido') {
        const nome = (conta.terceiro_nome || '').trim() || 'Sem favorecido';
        return { key: `f:${nome}`, label: nome, orderValue: nome.toLowerCase() };
      }
      if (groupBy === 'categoria') {
        const cat = (conta.categoria || '').trim() || 'Sem categoria';
        return { key: `c:${cat}`, label: cat, orderValue: cat.toLowerCase() };
      }
      const b = bucketStatus(conta);
      return { key: `s:${b.key}`, label: b.label, orderValue: String(b.order) };
    };

    const map = {};
    contasOrdenadas.forEach((conta) => {
      const m = metaFor(conta);
      if (!map[m.key]) map[m.key] = { key: m.key, label: m.label, orderValue: m.orderValue, contas: [] };
      map[m.key].contas.push(conta);
    });

    const compareGroups = (a, b) => {
      if (groupBy === 'status') {
        const ia = Number(a.orderValue);
        const ib = Number(b.orderValue);
        return sortOrder === 'asc' ? ia - ib : ib - ia;
      }
      const cmp = String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR', { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    };

    return Object.values(map)
      .sort(compareGroups)
      .map((g) => ({
        ...g,
        contas: [...g.contas].sort((a, b) => {
          const da = (a.data_vencimento || '').slice(0, 10);
          const db = (b.data_vencimento || '').slice(0, 10);
          const cmp = da.localeCompare(db);
          if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
          return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' });
        }),
      }));
  }, [contasOrdenadas, groupBy, sortOrder]);

  const anchorGrupoKey = useMemo(() => {
    const tk = dataHoje();
    for (const g of grupos) {
      if (g.contas.some((c) => (c.data_vencimento || '').slice(0, 10) === tk)) return g.key;
    }
    if (groupBy === 'vencimento') {
      const hoje = new Date(`${tk}T12:00:00`);
      for (const g of grupos) {
        const d = String(g.orderValue || '').slice(0, 10);
        if (d && d !== '9999-12-31' && !Number.isNaN(new Date(`${d}T12:00:00`).getTime()) && new Date(`${d}T12:00:00`) >= hoje) {
          return g.key;
        }
      }
    }
    return grupos[0]?.key || null;
  }, [grupos, groupBy]);

  useEffect(() => {
    scrollMesAplicadoRef.current = '';
  }, [currentMonth]);

  useLayoutEffect(() => {
    if (loading || modoSelecao) return;
    const mk = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
    if (scrollMesAplicadoRef.current === mk) return;
    const id = anchorGrupoKey ? grupoDomId(anchorGrupoKey) : null;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    scrollMesAplicadoRef.current = mk;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [loading, currentMonth, anchorGrupoKey, modoSelecao]);

  useEffect(() => {
    if (!modoSelecao) setSelecionadosIds([]);
  }, [modoSelecao]);

  const toggleSelecaoConta = useCallback((conta) => {
    if (!conta?.id) return;
    setSelecionadosIds((prev) => (prev.includes(conta.id) ? prev.filter((x) => x !== conta.id) : [...prev, conta.id]));
  }, []);

  const somaSelecionados = useMemo(() => {
    let s = 0;
    for (const c of contasOrdenadas) {
      if (selecionadosIds.includes(c.id)) s += Number(c.valor) || 0;
    }
    return s;
  }, [contasOrdenadas, selecionadosIds]);

  const kpis = useMemo(() => {
    const paid = filteredData.filter((c) => lancamentoPago(c));
    const unpaid = filteredData.filter((c) => !lancamentoPago(c) && !lancamentoCancelado(c));
    const overdue = unpaid.filter((c) => lancamentoVencidoOuAtrasado(c));
    return {
      totalValue: filteredData.reduce((sum, c) => sum + (c.valor || 0), 0),
      paidValue: paid.reduce((sum, c) => sum + (c.valor || 0), 0),
      unpaidValue: unpaid.reduce((sum, c) => sum + (c.valor || 0), 0),
      overdueValue: overdue.reduce((sum, c) => sum + (c.valor || 0), 0),
    };
  }, [filteredData]);

  const filtrosAtivosResumo = useMemo(() => {
    const filtros = [];
    if (pagamentoFilter !== 'todos') filtros.push(`Pagamento: ${pagamentoFilter}`);
    if (prazoFilter !== 'todos') filtros.push(`Prazo: ${prazoFilter}`);
    if (cmvFilter !== 'todos') filtros.push(`Tipo: ${cmvFilter}`);
    if (freteFilter !== 'todos') filtros.push(`Frete: ${freteFilter}`);
    if (!mostrarCmvRapido) filtros.push('CMV na lista: oculto');
    if (dateFrom || dateTo) filtros.push(`Período: ${dateFrom || '...'} até ${dateTo || '...'}`);
    return filtros;
  }, [pagamentoFilter, prazoFilter, cmvFilter, freteFilter, mostrarCmvRapido, dateFrom, dateTo]);

  const contasParaImpressao = useMemo(() => {
    if (!modoSelecao) return contasOrdenadas;
    return contasOrdenadas.filter((conta) => selecionadosIds.includes(conta.id));
  }, [modoSelecao, contasOrdenadas, selecionadosIds]);

  const totalParaImpressao = useMemo(
    () => contasParaImpressao.reduce((sum, conta) => sum + (Number(conta.valor) || 0), 0),
    [contasParaImpressao]
  );

  const gruposParaImpressao = useMemo(() => {
    const map = {};
    contasParaImpressao.forEach((conta) => {
      const data = (conta.data_vencimento || '').slice(0, 10) || 'sem-data';
      if (!map[data]) {
        map[data] = {
          key: data,
          label: data === 'sem-data' ? 'Sem vencimento' : formatarSoData(data),
          orderValue: data === 'sem-data' ? '9999-12-31' : data,
          contas: [],
        };
      }
      map[data].contas.push(conta);
    });

    return Object.values(map).sort((a, b) => {
      const cmp = String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR', { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [contasParaImpressao, sortOrder]);

  const limparFiltros = () => {
    setPagamentoFilter('todos');
    setPrazoFilter('todos');
    setCmvFilter('todos');
    setFreteFilter('todos');
    setDateFrom('');
    setDateTo('');
  };

  const imprimirRelatorio = async () => {
    if (modoSelecao && selecionadosIds.length === 0) {
      window.alert('Selecione ao menos uma conta no modo Somar para imprimir o relatório.');
      return;
    }

    if (contasParaImpressao.length === 0) {
      window.alert('Não há contas para imprimir com os filtros atuais.');
      return;
    }

    /** Dia 05: total da folha como conta + grelha analógica no PDF */
    const dataPagamentoFolha = dataDia5DoMes(currentMonth);
    let folhaRelatorio = null;
    let folhaContaSintetica = null;
    let folhaTotalConta = 0;
    try {
      folhaRelatorio = await carregarFolhaParaRelatorioDia5(dataPagamentoFolha);
      folhaContaSintetica = montarContaSinteticaFolhaDia5(folhaRelatorio);
      folhaTotalConta = Number(folhaContaSintetica?.valor) || 0;
    } catch (err) {
      console.error('SUPERAGEFIN: falha ao carregar folha para o relatório', err);
    }

    let budgetsAgrupados = null;
    try {
      budgetsAgrupados = await carregarBudgetsAgrupadosParaRelatorio(currentMonth);
      if (!budgetsAgrupados?.grupos?.length) budgetsAgrupados = null;
    } catch (err) {
      console.error('SUPERAGEFIN: falha ao carregar budgets para o relatório', err);
    }

    const gruposComFolha = (() => {
      const cloned = gruposParaImpressao.map((g) => ({ ...g, contas: [...g.contas] }));
      if (!folhaContaSintetica) return cloned;

      const idx = cloned.findIndex((g) => g.key === dataPagamentoFolha);
      if (idx >= 0) {
          const jaTem = listaJaTemFolhaPagamento(cloned[idx].contas);
        if (!jaTem) cloned[idx].contas = [folhaContaSintetica, ...cloned[idx].contas];
        return cloned;
      }

      const novoGrupo = {
        key: dataPagamentoFolha,
        label: formatarSoData(dataPagamentoFolha),
        orderValue: dataPagamentoFolha,
        contas: [folhaContaSintetica],
      };
      const withNew = [...cloned, novoGrupo];
      return withNew.sort((a, b) => {
        const cmp = String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR', { sensitivity: 'base' });
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    })();

    const totalImpressoComFolha = totalParaImpressao + (folhaContaSintetica ? folhaTotalConta : 0);

    try {
      await gerarDespesaMensalPdf({
        currentMonth,
        totalImpresso: totalImpressoComFolha,
        grupos: gruposComFolha,
        dataPagamentoFolha,
        folha: folhaRelatorio,
        budgetsAgrupados,
      });
    } catch (err) {
      console.error('SUPERAGEFIN: falha ao gerar PDF Despesa Mensal', err);
      window.alert('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  const summaryChips = [];
  if (kpis.overdueValue > 0) {
    summaryChips.push(
      <FinanceiroSummaryChip key="venc" className="text-red-800 dark:text-red-300">
        {formatCurrency(kpis.overdueValue)} vencido
      </FinanceiroSummaryChip>,
    );
  }
  if (kpis.paidValue > 0) {
    summaryChips.push(
      <FinanceiroSummaryChip key="pago" className="text-emerald-800 dark:text-emerald-300">
        {formatCurrency(kpis.paidValue)} pago
      </FinanceiroSummaryChip>,
    );
  }

  return (
    <div
      className={cn(
        'w-full min-w-0 overflow-x-hidden font-din-1451 bg-background px-3 py-3 sm:p-4 lg:p-6',
        modoSelecao ? 'pb-36' : 'pb-[var(--p38-scroll-pad-below-nav)] md:pb-6',
      )}
    >
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="truncate text-lg font-medium text-foreground sm:text-xl">Agefin</h1>
              <P38HelpPopover label="Ajuda: Agefin" side="bottom" align="start">
                <p className="font-medium text-foreground">Consulta do que já é real</p>
                <p className="mt-2 text-muted-foreground">
                  Aqui entram contas a pagar do mês civil — incluindo fretes, CMV e compromissos
                  previstos da SUPERAGEFIN.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Para criar ou editar séries recorrentes, use o{' '}
                  <strong className="text-foreground">Planejamento financeiro</strong>.
                </p>
              </P38HelpPopover>
            </div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
              Contas reais do mês · filtrar · somar · PDF
            </p>
          </div>
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('relative h-10 w-10 shrink-0 rounded-xl', P38_FIELD_SURFACE)}
              >
                <Menu className="h-4 w-4 text-muted-foreground" />
                {hasActiveFilters && (
                  <span
                    className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#4a5240] ring-2 ring-background dark:bg-[#a4ce33]"
                    aria-hidden
                  />
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="rounded-t-2xl border-0 bg-card px-4 pb-6 font-din-1451">
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle className="text-foreground">Menu Agefin</DrawerTitle>
                <DrawerDescription className="text-sm text-muted-foreground">
                  Organize, some, imprima e ajuste filtros.
                </DrawerDescription>
              </DrawerHeader>
              <div className="max-h-[65vh] space-y-5 overflow-y-auto px-0">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ações rápidas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setModoSelecao((v) => !v)}
                      className={cn(
                        'h-10 gap-1.5 rounded-xl px-3 text-xs font-medium',
                        modoSelecao ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
                      )}
                    >
                      <Calculator className="h-4 w-4" />
                      {modoSelecao ? 'Somando' : 'Somar'}
                    </Button>
                    <Button
                      onClick={imprimirRelatorio}
                      variant="ghost"
                      size="sm"
                      className={cn('h-10 rounded-xl px-3 text-xs', P38_CHIP_INACTIVE)}
                    >
                      <Printer className="mr-1.5 h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Organização
                  </p>
                  <SuperAgefinConsultaOrganizer
                    groupBy={groupBy}
                    sortOrder={sortOrder}
                    onGroupByChange={setGroupBy}
                    onSortOrderToggle={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                  />
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3 py-2.5',
                    P38_FIELD_SURFACE,
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">CMV na lista</p>
                    <p className="text-[11px] text-muted-foreground">
                      Desligue para ocultar sem abrir filtros
                    </p>
                  </div>
                  <CmvQuickToggle checked={mostrarCmvRapido} onChange={setMostrarCmvRapido} />
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Pagamento
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={pagamentoFilter === 'todos'} onClick={() => setPagamentoFilter('todos')}>
                      Todos
                    </FilterChip>
                    <FilterChip active={pagamentoFilter === 'pagos'} onClick={() => setPagamentoFilter('pagos')}>
                      Pagos
                    </FilterChip>
                    <FilterChip
                      active={pagamentoFilter === 'nao_pagos'}
                      onClick={() => setPagamentoFilter('nao_pagos')}
                    >
                      Não pagos
                    </FilterChip>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Prazo (vencimento)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={prazoFilter === 'todos'} onClick={() => setPrazoFilter('todos')}>
                      Todos
                    </FilterChip>
                    <FilterChip active={prazoFilter === 'vencidas'} onClick={() => setPrazoFilter('vencidas')}>
                      Vencidas
                    </FilterChip>
                    <FilterChip active={prazoFilter === 'em_dia'} onClick={() => setPrazoFilter('em_dia')}>
                      Em dia
                    </FilterChip>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Tipo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={cmvFilter === 'todos'} onClick={() => setCmvFilter('todos')}>
                      Todos
                    </FilterChip>
                    <FilterChip active={cmvFilter === 'cmv'} onClick={() => setCmvFilter('cmv')}>
                      CMV
                    </FilterChip>
                    <FilterChip active={cmvFilter === 'normal'} onClick={() => setCmvFilter('normal')}>
                      Normal
                    </FilterChip>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Itinerário / fretes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={freteFilter === 'todos'} onClick={() => setFreteFilter('todos')}>
                      Todos
                    </FilterChip>
                    <FilterChip active={freteFilter === 'fretes'} onClick={() => setFreteFilter('fretes')}>
                      Fretes
                    </FilterChip>
                    <FilterChip
                      active={freteFilter === 'sem_fretes'}
                      onClick={() => setFreteFilter('sem_fretes')}
                    >
                      Sem fretes
                    </FilterChip>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Fretes: lançamentos com referência ao evento logístico (aba Fretes do Itinerário
                    Fluvial) ou tags frete / conta_frete.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">Data inicial (opcional)</p>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className={cn('h-11 rounded-xl border-0', P38_FIELD_SURFACE)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">Data final (opcional)</p>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className={cn('h-11 rounded-xl border-0', P38_FIELD_SURFACE)}
                    />
                  </div>
                </div>
              </div>
              <DrawerFooter className="px-0 pb-0 pt-5">
                <Button
                  variant="ghost"
                  onClick={limparFiltros}
                  className={cn('h-11 w-full rounded-xl', P38_CHIP_INACTIVE)}
                >
                  Limpar filtros
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>

        <div
          className={cn(
            'space-y-2.5 rounded-2xl border border-[#dce0d4]/90 bg-card p-3 shadow-sm sm:space-y-3 sm:p-3.5',
            'dark:border-white/10 dark:bg-[#2d333b]',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 items-center rounded-xl bg-[#f0f2ec] px-0.5 dark:bg-[#26262e]',
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-[#4a5240] dark:text-[#a4ce33]"
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
              }
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 px-1 py-2 text-center">
              <p className="truncate text-sm font-semibold uppercase tracking-wide text-[#2a2f28] dark:text-foreground sm:text-base">
                {formatMonth(currentMonth)}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-[#5c6358] dark:text-muted-foreground">
                Período civil · {monthData.length} conta{monthData.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-[#4a5240] dark:text-[#a4ce33]"
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
              }
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 border-t border-[#dce0d4]/80 pt-2.5 dark:border-white/10 sm:pt-3">
            <div className="relative overflow-hidden rounded-xl bg-[#f7f8f5] px-3 py-3 dark:bg-[#383e47]/40 sm:px-4 sm:py-3.5">
              <div
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#4a5240] dark:bg-[#a4ce33]"
                aria-hidden
              />
              <div className="pl-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#5c6358] dark:text-muted-foreground sm:text-[11px]">
                  Total no filtro
                </p>
                <p
                  className={cn(
                    'mt-1 font-semibold tabular-nums leading-none tracking-tight',
                    'text-[clamp(1.375rem,5.5vw,1.875rem)]',
                    kpis.totalValue > 0 ? 'text-red-600 dark:text-red-400' : P38_ACCENT,
                  )}
                >
                  {kpis.totalValue > 0 ? `−${formatCurrency(kpis.totalValue)}` : formatCurrency(0)}
                </p>
                {kpis.paidValue > 0 && kpis.totalValue > 0 ? (
                  <p className={cn('mt-1.5 text-[11px] font-medium', p38PaletteClasses.accent)}>
                    {Math.round((kpis.paidValue / kpis.totalValue) * 100)}% pago
                  </p>
                ) : null}
              </div>
            </div>
            <FinanceiroListaMeta
              total={contasOrdenadas.length}
              totalLabel={contasOrdenadas.length === 1 ? 'conta' : 'contas'}
              hasActiveFilters={hasActiveFilters}
              onLimparFiltros={limparFiltros}
              summaryChips={summaryChips}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {pagamentoFilter !== 'todos' && (
              <FinanceiroSummaryChip>Pag.: {pagamentoFilter}</FinanceiroSummaryChip>
            )}
            {prazoFilter !== 'todos' && (
              <FinanceiroSummaryChip>Prazo: {prazoFilter}</FinanceiroSummaryChip>
            )}
            {cmvFilter !== 'todos' && (
              <FinanceiroSummaryChip>Tipo: {cmvFilter}</FinanceiroSummaryChip>
            )}
            {freteFilter !== 'todos' && (
              <FinanceiroSummaryChip>Frete: {freteFilter}</FinanceiroSummaryChip>
            )}
            {(dateFrom || dateTo) && (
              <FinanceiroSummaryChip>
                <span className="inline-flex items-center gap-1">
                  {dateFrom || '…'} → {dateTo || '…'}
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="rounded-full p-0.5 hover:text-foreground"
                    aria-label="Limpar datas"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </FinanceiroSummaryChip>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 md:gap-2">
          <KpiCard label="Total (filtro)" value={formatCurrency(kpis.totalValue)} tone="danger" />
          <KpiCard label="Pago" value={formatCurrency(kpis.paidValue)} tone="success" />
          <KpiCard label="Não pago" value={formatCurrency(kpis.unpaidValue)} tone="muted" />
          <KpiCard label="Vencido" value={formatCurrency(kpis.overdueValue)} tone="danger" />
        </div>

        <FinanceiroListaEstado
          loading={loading}
          vazio={!loading && contasOrdenadas.length === 0}
          vazioMensagem="Nenhuma conta a pagar encontrada para esse mês e filtros."
        >
          {grupos.reduce((acc, g) => acc + g.contas.length, 0) >= P38_VIRTUAL_MIN_ROWS ? (
            <SuperAgefinGruposVirtualList
              grupos={grupos}
              groupBy={groupBy}
              modoSelecao={modoSelecao}
              selecionadosIds={selecionadosIds}
              toggleSelecaoConta={toggleSelecaoConta}
              abrirConta={abrirConta}
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-4 md:max-w-4xl">
              {grupos.map((grupo) => (
                <section
                  key={grupo.key}
                  id={grupoDomId(grupo.key)}
                  className="scroll-mt-24 space-y-2"
                >
                  <AgefinGrupoCabecalho grupo={grupo} groupBy={groupBy} />
                  {/* allViewports: sem desktop-layout:hidden — Agefin usa linhas em todos os ecrãs */}
                  <P38MobileLineList allViewports className="rounded-lg">
                    {grupo.contas.map((conta, index) => (
                      <ContaLinhaP38
                        key={conta.id}
                        conta={conta}
                        striped={index % 2 === 1}
                        modoSelecao={modoSelecao}
                        selecionado={selecionadosIds.includes(conta.id)}
                        onToggleSelecao={toggleSelecaoConta}
                        onOpen={() => abrirConta(conta)}
                      />
                    ))}
                  </P38MobileLineList>
                </section>
              ))}
            </div>
          )}
        </FinanceiroListaEstado>
      </div>

      {modoSelecao && (
        <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Seleção para pagar
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {selecionadosIds.length} conta{selecionadosIds.length !== 1 ? 's' : ''} ·{' '}
                {formatCurrency(somaSelecionados)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 flex-1 rounded-xl sm:flex-none"
                onClick={() => setSelecionadosIds([])}
              >
                Limpar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-11 flex-1 rounded-xl sm:flex-none"
                onClick={() => setModoSelecao(false)}
              >
                Pronto
              </Button>
            </div>
          </div>
        </div>
      )}

      <SuperAgefinConsultaDrawer
        open={Boolean(selectedConta)}
        onClose={() => setSelectedConta(null)}
        conta={selectedConta}
        onSaved={(updated) => {
          setSelectedConta(updated);
          loadContas();
        }}
      />
    </div>
  );
}
