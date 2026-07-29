/**
 * SUPERAGEFIN — cópia isolada da AgefinConsulta para experimentar alterações
 * sem afetar a AGEFIN em produção (/AgefinConsulta).
 * Rota: /SuperAgefin | Menu: Financeiro → SUPERAGEFIN
 *
 * Componentes próprios em src/components/superagefin/
 * (Agefin original permanece em src/pages/AgefinConsulta.jsx).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, CircleAlert, Printer, Paperclip, Wallet, CircleSlash, X, Layers, Anchor, Check, Calculator, Copy, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import SuperAgefinConsultaDrawer from '@/components/superagefin/SuperAgefinConsultaDrawer';
import SuperAgefinConsultaOrganizer from '@/components/superagefin/SuperAgefinConsultaOrganizer';
import { boundsMesCivil, dataHoje, formatarSoData } from '@/components/utils/dateUtils';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import {
  carregarFolhaParaRelatorioDia5,
  dataDia5DoMes,
  montarHtmlSecaoFolhaAnaloga,
} from '@/lib/superAgefinFolhaRelatorio';
import {
  carregarBudgetsAgrupadosParaRelatorio,
  carregarModelosFolhaParaSuperAgefin,
  contaSuperAgefinSomenteLeitura,
  montarContasSinteticasSociosSabado,
  montarHtmlSecaoBudgetsAnaloga,
} from '@/lib/superAgefinCompromissos';
import {
  lancamentoEhContaPagar,
  lancamentoEhCmv,
  lancamentoEhFreteItinerario,
  lancamentoPago,
  lancamentoCancelado,
  lancamentoVencidoOuAtrasado,
  lancamentoEmDia,
  lancamentoCompraMercadoriaPedidoPagamentoAVista,
} from '@/lib/agefinConsultaFilters';
import { brandSurface } from '@/lib/brandSurfaces';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { p38Mobile } from '@/lib/p38MobileSurfaces';
import {
  measureVirtualItem,
  P38_VIRTUAL_LIST_MAX_HEIGHT,
  P38_VIRTUAL_MIN_ROWS,
  P38_VIRTUAL_OVERSCAN,
} from '@/lib/p38VirtualList';
import { toast } from 'sonner';

function formatCurrency(value) {
  return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatMonth(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function KpiCard({ label, value, tone = 'default' }) {
  const toneMap = {
    default: `${brandSurface.card} text-foreground`,
    danger: `${brandSurface.card} text-foreground`,
    success: `${brandSurface.card} text-foreground`,
    muted: `${brandSurface.card} text-foreground`,
  };

  const labelToneMap = {
    default: 'text-muted-foreground dark:text-muted-foreground',
    success: 'text-emerald-700/80 dark:text-emerald-300/90',
    danger: 'text-red-700/80 dark:text-red-300/90',
    muted: 'text-muted-foreground dark:text-muted-foreground',
  };

  const iconToneMap = {
    default: 'text-muted-foreground dark:text-muted-foreground',
    success: 'text-emerald-700/80 dark:text-emerald-300/90',
    danger: 'text-red-700/80 dark:text-red-300/90',
    muted: 'text-muted-foreground dark:text-muted-foreground',
  };

  const Icon = {
    default: Wallet,
    success: CheckCircle2,
    danger: CircleAlert,
    muted: CircleSlash,
  }[tone] || Wallet;

  return (
    <div className={`min-w-0 rounded-[18px] px-2.5 py-2 shadow-sm md:rounded-[20px] md:px-3 md:py-2.5 ${toneMap[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[10px] uppercase tracking-[0.16em] truncate ${labelToneMap[tone]}`}>{label}</p>
        <Icon className={`w-3.5 h-3.5 shrink-0 ${iconToneMap[tone]}`} />
      </div>
      <p className="mt-0.5 text-sm md:text-[15px] font-semibold font-glacial truncate">{value}</p>
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
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? 'bg-background dark:bg-card' : 'bg-muted dark:bg-muted'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-card shadow transform transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function FilterChip({ active, onClick, children, tone = 'default' }) {
  const activeStyles = {
    default: 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground',
    success: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
    danger: 'bg-red-600 text-white dark:bg-red-500 dark:text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-2xl text-xs font-medium shadow-sm transition-all whitespace-nowrap ${
        active
          ? activeStyles[tone]
          : 'bg-muted text-muted-foreground dark:bg-muted dark:text-foreground/90'
      }`}
    >
      {children}
    </button>
  );
}

function grupoDomId(key) {
  return `agefin-grupo-${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function ContaCard({ conta, onOpen, modoSelecao, selecionado, onToggleSelecao, avisoMesmoGrupoDuplicado }) {
  const todayKey = dataHoje();
  const isPaid = lancamentoPago(conta);
  const isOverdue = lancamentoVencidoOuAtrasado(conta, todayKey);
  const hasBoleto = conta.forma_pagamento_tipo === 'Boleto' || conta.forma_pagamento === 'Boleto';
  const iconClass = isPaid
    ? 'w-4 h-4 text-emerald-600 shrink-0'
    : isOverdue
      ? 'w-4 h-4 text-pink-500 shrink-0'
      : hasBoleto
        ? 'w-4 h-4 text-lime-500 shrink-0'
        : 'w-4 h-4 text-muted-foreground shrink-0';
  const ehCmv = lancamentoEhCmv(conta);
  const ehFrete = lancamentoEhFreteItinerario(conta);

  return (
    <button
      type="button"
      onClick={() => {
        if (modoSelecao) onToggleSelecao?.(conta);
        else onOpen();
      }}
      className={`relative w-full text-left rounded-2xl p-0.5 shadow-sm transition-all hover:shadow-md md:rounded-[28px] md:p-1 ${brandSurface.card}`}
    >
      {modoSelecao && selecionado && (
        <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-emerald-500/10 dark:bg-emerald-500/15 md:rounded-[24px]" />
      )}
      <div className={`rounded-[20px] px-3 py-2.5 md:rounded-[24px] md:px-4 md:py-3.5 ${brandSurface.cardInset}`}>
        <div className="flex items-start justify-between gap-2 md:gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5 md:mb-2 md:gap-2">
              {modoSelecao && (
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border/40 ${
                    selecionado ? 'border-emerald-500 bg-emerald-500 text-white' : 'bg-card'
                  }`}
                >
                  {selecionado ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
              )}
              {isPaid ? <CheckCircle2 className={iconClass} /> : isOverdue ? <CircleAlert className={iconClass} /> : <Wallet className={iconClass} />}
              <p className="line-clamp-2 text-[14px] font-semibold text-foreground md:text-[15px]">{conta.descricao}</p>
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground dark:text-muted-foreground md:h-4 md:w-4" />
              {ehFrete && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                  <Anchor className="h-3 w-3" /> Frete
                </span>
              )}
              {ehCmv && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                  <Layers className="h-3 w-3" /> CMV
                </span>
              )}
              {avisoMesmoGrupoDuplicado && (
                <span
                  title="Mesma série e mesma descrição neste vencimento. Se são obrigações distintas, confira o vínculo no detalhe."
                  className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  <Copy className="h-3 w-3" /> Duplicado?
                </span>
              )}
            </div>
            <p className="line-clamp-1 text-[11px] text-muted-foreground dark:text-muted-foreground md:text-xs">
              {conta.terceiro_nome || 'Sem favorecido'} · {conta.categoria || 'Sem categoria'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground dark:text-muted-foreground md:mt-3 md:gap-2 md:text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 shadow-sm dark:bg-background/80 dark:ring-1 dark:ring-border">
                <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5" /> {formatarSoData(conta.data_vencimento)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 shadow-sm md:px-2.5 md:py-1 ${
                  isPaid
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : isOverdue
                      ? 'bg-pink-50 text-pink-800 dark:bg-red-950/35 dark:text-red-200'
                      : hasBoleto
                        ? 'bg-lime-50 text-lime-800 dark:bg-lime-950/30 dark:text-lime-200'
                        : 'bg-card text-muted-foreground dark:bg-background/80 dark:text-muted-foreground dark:ring-1 dark:ring-border'
                }`}
              >
                {isPaid ? 'Pago' : isOverdue ? 'Vencido' : hasBoleto ? 'Atualizado' : 'Pendente'}
              </span>
            </div>
          </div>
          <div className="shrink-0 pl-1 text-right md:pl-2">
            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground md:text-xs">Valor</p>
            <p className="text-base font-semibold text-foreground md:text-lg">{formatCurrency(conta.valor)}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function ContaLinhaP38({ conta, onOpen, modoSelecao, selecionado, onToggleSelecao, avisoMesmoGrupoDuplicado, striped }) {
  const todayKey = dataHoje();
  const isPaid = lancamentoPago(conta);
  const isOverdue = lancamentoVencidoOuAtrasado(conta, todayKey);
  const hasBoleto = conta.forma_pagamento_tipo === 'Boleto' || conta.forma_pagamento === 'Boleto';
  const ehCmv = lancamentoEhCmv(conta);
  const ehFrete = lancamentoEhFreteItinerario(conta);
  const tone = isPaid ? 'success' : isOverdue ? 'danger' : hasBoleto ? 'info' : 'warning';
  const statusLabel = isPaid ? 'Pago' : isOverdue ? 'Vencido' : hasBoleto ? 'Boleto' : 'Pendente';

  return (
    <P38MobileLine
      thinAccent
      striped={striped}
      accent={modoSelecao && selecionado ? 'success' : p38AccentKeyFromTone(tone)}
      onClick={() => (modoSelecao ? onToggleSelecao?.(conta) : onOpen())}
      title={conta.descricao}
      subtitle={`${conta.terceiro_nome || 'Sem favorecido'} · ${conta.categoria || 'Sem categoria'}`}
      meta={
        <>
          <P38StatusLabel tone={tone}>{statusLabel}</P38StatusLabel>
          <span>{formatarSoData(conta.data_vencimento)}</span>
          {ehFrete ? <span>Frete</span> : null}
          {ehCmv ? <span>CMV</span> : null}
          {avisoMesmoGrupoDuplicado ? <span>Duplicado?</span> : null}
          {modoSelecao ? (
            <span className={selecionado ? p38Accent.success.text : 'text-muted-foreground'}>
              {selecionado ? 'Selecionado' : 'Toque para selecionar'}
            </span>
          ) : null}
        </>
      }
      value={formatCurrency(conta.valor)}
      trailing={<Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
    />
  );
}

function SuperAgefinGruposVirtualList({
  grupos,
  modoSelecao,
  selecionadosIds,
  toggleSelecaoConta,
  abrirConta,
  idsComAvisoDuplicadoGrupo,
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
    estimateSize: (index) => (flatRows[index]?.kind === 'header' ? 44 : 88),
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
                className="absolute left-0 top-0 w-full scroll-mt-24 px-0.5 pt-4 first:pt-0"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground">
                    {grupo.label}
                  </h2>
                  <span className="text-[11px] text-muted-foreground">
                    {grupo.contas.length} · {formatCurrency(grupo.contas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0))}
                  </span>
                </div>
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
              <div className="block desktop-layout:hidden">
                <ContaLinhaP38
                  conta={conta}
                  striped={index % 2 === 1}
                  modoSelecao={modoSelecao}
                  selecionado={selecionadosIds.includes(conta.id)}
                  onToggleSelecao={toggleSelecaoConta}
                  onOpen={() => abrirConta(conta)}
                  avisoMesmoGrupoDuplicado={idsComAvisoDuplicadoGrupo.has(conta.id)}
                />
              </div>
              <div className="hidden desktop-layout:block">
                <ContaCard
                  conta={conta}
                  striped={index % 2 === 1}
                  modoSelecao={modoSelecao}
                  selecionado={selecionadosIds.includes(conta.id)}
                  onToggleSelecao={toggleSelecaoConta}
                  onOpen={() => abrirConta(conta)}
                  avisoMesmoGrupoDuplicado={idsComAvisoDuplicadoGrupo.has(conta.id)}
                />
              </div>
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
        description: conta?._superagefin_socio
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
    return [...reais, ...contasSociosSabado].sort(
      (a, b) =>
        new Date(`${a.data_vencimento}T12:00:00-05:00`) - new Date(`${b.data_vencimento}T12:00:00-05:00`),
    );
  }, [contas, currentMonth, contasSociosSabado]);

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

  const idsComAvisoDuplicadoGrupo = useMemo(() => {
    const counts = new Map();
    for (const c of contasOrdenadas) {
      if (!lancamentoEhContaPagar(c) || !c.grupo_lancamento_id) continue;
      const k = `${(c.data_vencimento || '').slice(0, 10)}|${(c.descricao || '').trim().toLowerCase()}|${c.grupo_lancamento_id}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const ids = new Set();
    for (const c of contasOrdenadas) {
      const k = `${(c.data_vencimento || '').slice(0, 10)}|${(c.descricao || '').trim().toLowerCase()}|${c.grupo_lancamento_id}`;
      if (lancamentoEhContaPagar(c) && c.grupo_lancamento_id && (counts.get(k) || 0) > 1) {
        ids.add(c.id);
      }
    }
    return ids;
  }, [contasOrdenadas]);

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

    /** Relatório impresso: mais uma ampliação de +15% sobre o tamanho já escalonado (≈ 1,15 × 1,15 na base em px) */
    const scalePrint = 1.15 * 1.15;
    const spx = (n) => `${Math.round(n * scalePrint * 100) / 100}px`;
    /** Grupos pequenos: evita partir a tabela no meio. Com muitas contas (ou folha no dia 5),
     *  NÃO usar avoid no grupo inteiro — senão o browser empurra tudo e deixa vazios grandes. */
    const maxContasQuebraEvitadaNoGrupo = 6;

    /** Dia 05 do mês em ecrã: total da folha como conta + grelha analógica (anotações à mão) */
    const dataPagamentoFolha = dataDia5DoMes(currentMonth);
    let folhaRelatorio = null;
    let folhaContaSintetica = null;
    let folhaSecaoHtml = '';
    let folhaTotalConta = 0;
    try {
      folhaRelatorio = await carregarFolhaParaRelatorioDia5(dataPagamentoFolha);
      const montado = montarHtmlSecaoFolhaAnaloga({
        folha: folhaRelatorio,
        spx,
        escapeHtml,
        formatCurrency,
        labelData: formatarSoData(dataPagamentoFolha),
      });
      folhaContaSintetica = montado.contaSintetica;
      folhaSecaoHtml = montado.secaoHtml;
      folhaTotalConta = montado.totalConta || 0;
    } catch (err) {
      console.error('SUPERAGEFIN: falha ao carregar folha para o relatório', err);
    }

    /** Budgets por centro de custo — secção analógica após contas obrigatórias */
    let budgetsSecaoHtml = '';
    try {
      const budgetsAgrupados = await carregarBudgetsAgrupadosParaRelatorio(currentMonth);
      budgetsSecaoHtml = montarHtmlSecaoBudgetsAnaloga({
        budgetsAgrupados,
        spx,
        escapeHtml,
        formatCurrency,
      });
    } catch (err) {
      console.error('SUPERAGEFIN: falha ao carregar budgets para o relatório', err);
    }

    const gruposComFolha = (() => {
      const cloned = gruposParaImpressao.map((g) => ({ ...g, contas: [...g.contas] }));
      if (!folhaContaSintetica) return cloned;

      const idx = cloned.findIndex((g) => g.key === dataPagamentoFolha);
      if (idx >= 0) {
        const jaTem = cloned[idx].contas.some((c) => c?._superagefin_folha || /folha\s+de\s+pagamento/i.test(String(c.descricao || '')));
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

    const quantidadeImpressa = contasParaImpressao.length + (folhaContaSintetica ? 1 : 0);
    const totalImpressoComFolha = totalParaImpressao + (folhaContaSintetica ? folhaTotalConta : 0);

    const filtrosHtml = filtrosAtivosResumo.length > 0
      ? `<div style="margin:${spx(14)} 0 ${spx(14)}"><p style="margin:0 0 6px;font-size:${spx(12)};font-weight:600;color:#000">Filtros ativos</p><div style="display:flex;flex-wrap:wrap;gap:6px">${filtrosAtivosResumo.map((filtro) => `<span style="display:inline-block;padding:4px 9px;border-radius:999px;background:#f8fafc;color:#000;font-size:${spx(12)};line-height:1.3;border:1px solid #e2e8f0">${escapeHtml(filtro)}</span>`).join('')}</div></div>`
      : '';

    const cabecalhoColunasHtml = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin:8px 0 10px"><colgroup><col style="width:72px" /><col style="width:auto" /><col style="width:120px" /></colgroup><thead><tr><th style="text-align:left;font-size:${spx(12)};line-height:1.25;font-weight:700;color:#000;padding:0 4px 6px 4px;border-bottom:1px solid #cbd5e1">Status</th><th style="text-align:left;font-size:${spx(12)};line-height:1.25;font-weight:700;color:#000;padding:0 4px 6px 2px;border-bottom:1px solid #cbd5e1">Conta</th><th style="text-align:right;font-size:${spx(12)};line-height:1.25;font-weight:700;color:#000;padding:0 4px 6px 4px;border-bottom:1px solid #cbd5e1">Valor</th></tr></thead></table>`;

    const gruposHtml = gruposComFolha.map((grupo) => {
      const subtotal = grupo.contas.reduce((acc, conta) => acc + (Number(conta.valor) || 0), 0);
      const linhas = grupo.contas.map((conta) => {
        const pago = lancamentoPago(conta);
        const vencido = lancamentoVencidoOuAtrasado(conta);
        const statusLabel = pago ? 'Pago' : vencido ? 'Vencido' : '';
        const statusColor = pago ? '#556b2f' : '#8b2f2f';
        const hasBoleto = conta.forma_pagamento_tipo === 'Boleto' || conta.forma_pagamento === 'Boleto';
        const isAutomatica = conta.is_recorrente === true || conta.natureza === 'Recorrente';

        const statusIconSvg = pago
          ? `<svg width="${spx(12)}" height="${spx(12)}" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
          : `<svg width="${spx(12)}" height="${spx(12)}" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

        const metaIconSvg = isAutomatica
          ? `<svg width="${spx(13)}" height="${spx(13)}" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
          : hasBoleto
            ? `<svg width="${spx(13)}" height="${spx(13)}" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`
            : '';

        return `<tr>
          <td style="vertical-align:middle;padding:14px 4px;border-bottom:1px solid #dde5ef">
            ${statusLabel ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 5px;border-radius:999px;border:1px solid #d8e1ec;background:#f8fafc;color:${statusColor};font-size:${spx(10)};line-height:1.15;font-weight:700;white-space:nowrap">${statusIconSvg}<span>${statusLabel}</span></span>` : ''}
          </td>
          <td style="vertical-align:middle;padding:14px 4px 14px 2px;border-bottom:1px solid #e6ebf2">
            <div style="display:flex;align-items:center;gap:4px;min-width:0">
              ${metaIconSvg ? `<span style="display:inline-flex;align-items:center;justify-content:center;flex:none">${metaIconSvg}</span>` : ''}
              <span style="font-size:${spx(13)};line-height:1.3;font-weight:400;color:#000;letter-spacing:0.01em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(conta.descricao || '-')}</span>
            </div>
          </td>
          <td style="vertical-align:middle;padding:14px 4px;border-bottom:1px solid #e6ebf2;text-align:right;font-size:${spx(13)};line-height:1.3;font-weight:400;color:#000">${escapeHtml(formatCurrency(conta.valor))}</td>
        </tr>`;
      }).join('');

      // Dia 5 traz a grelha da folha a seguir: nunca “grudar” o grupo inteiro numa página.
      const temFolhaAseguir = grupo.key === dataPagamentoFolha && Boolean(folhaSecaoHtml);
      const evitarQuebraGrupo =
        !temFolhaAseguir && grupo.contas.length <= maxContasQuebraEvitadaNoGrupo;
      const bloqueioQuebra = evitarQuebraGrupo ? 'break-inside:avoid;page-break-inside:avoid;' : 'break-inside:auto;page-break-inside:auto;';

      /** Cabeçalho da data; recuo do conteúdo sob a data = 1/3 do padding anterior (8px → ~2.7px) */
      const recuoAposData = Math.max(1, Math.round((8 / 3) * 10) / 10);
      const secaoGrupo = `<section style="margin-top:12px;border-radius:10px;overflow:visible;background:#f2f4f7;${bloqueioQuebra}"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 6px;background:#edf0f4"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:${spx(13)};line-height:1.25;font-weight:700;color:#000">${escapeHtml(grupo.label)}</span><span style="font-size:${spx(13)};line-height:1.25;font-weight:400;color:#000">${escapeHtml(formatCurrency(subtotal))}</span></div><div style="text-align:right"><span style="font-size:${spx(13)};line-height:1.25;color:#000">${grupo.contas.length} conta${grupo.contas.length !== 1 ? 's' : ''}</span></div></div><div style="padding:${recuoAposData}px ${recuoAposData}px"><table style="width:100%;border-collapse:collapse;table-layout:fixed;background:#ffffff"><colgroup><col style="width:72px" /><col style="width:auto" /><col style="width:120px" /></colgroup><tbody>${linhas}</tbody></table></div></section>`;
      if (temFolhaAseguir) {
        return `${secaoGrupo}${folhaSecaoHtml}`;
      }
      return secaoGrupo;
    }).join('');

    /** Guia de escrita: linhas próximas no topo, espaçamento aumenta e some — sem “caixa” fechada */
    let guiaY = 8;
    const linhasGuiaSvg = [];
    for (let i = 0; i < 48; i++) {
      const fade = Math.max(0, 1 - (i / 38) ** 1.12);
      if (fade < 0.012) break;
      linhasGuiaSvg.push(
        `<line x1="0" y1="${guiaY}" x2="1000" y2="${guiaY}" stroke="#cbd5e1" stroke-width="1" opacity="${fade.toFixed(3)}"/>`
      );
      guiaY += 8 + i * 1.35;
      if (guiaY > 320) break;
    }
    const guiaAltura = Math.ceil(guiaY + 16);
    const guiaSvgHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${guiaAltura}" viewBox="0 0 1000 ${guiaAltura}" preserveAspectRatio="none" aria-hidden="true" style="display:block">${linhasGuiaSvg.join('')}</svg>`;

    const rodapeAnotacoesHtml = `<section style="margin-top:${spx(14)};padding:0;break-inside:auto;page-break-inside:auto">
      <div style="display:inline-flex;align-items:center;gap:6px;color:#000;break-after:avoid;page-break-after:avoid">
        <svg width="${spx(14)}" height="${spx(14)}" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6a2 2 0 0 1 2-2h7l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>
        <span style="font-size:${spx(13)};line-height:1.2;font-weight:700">Anotações &gt;</span>
      </div>
      <p style="margin:4px 0 0;font-size:${spx(12)};line-height:1.25;color:#334155">escreva abaixo</p>
      <div aria-hidden="true" style="margin-top:${spx(10)};width:100%">${guiaSvgHtml}</div>
    </section>`;

    const notaFolhaHtml = folhaContaSintetica
      ? `<p style="margin:2px 0 0;color:#000;font-size:${spx(12)};line-height:1.2">Inclui Folha de pagamento no dia ${escapeHtml(formatarSoData(dataPagamentoFolha))} (total + grelha para anotações à mão)</p>`
      : '';
    const notaSociosHtml = contasSociosSabado.length
      ? `<p style="margin:2px 0 0;color:#000;font-size:${spx(12)};line-height:1.2">Inclui sócios nos sábados (${contasSociosSabado.length} compromisso${contasSociosSabado.length !== 1 ? 's' : ''})</p>`
      : '';
    const notaBudgetsHtml = budgetsSecaoHtml
      ? `<p style="margin:2px 0 0;color:#000;font-size:${spx(12)};line-height:1.2">Inclui secção Budgets por centro de custo (anotações à mão)</p>`
      : '';

    /** A4: margens laterais ~½ da vertical; conteúdo a 100% da página útil */
    const padVert = spx(18);
    const padLat = spx(9);
    const html = `<html><head><meta charset="UTF-8" /><title>SUPERAGEFIN ${escapeHtml(formatMonth(currentMonth))}</title><style>
@page { size: A4 portrait; margin: 6mm 4mm; }
html, body { margin: 0; padding: 0; }
body { box-sizing: border-box; }
* { box-sizing: border-box; }
/* Preferir preencher a página: só artigos/linhas de cards evitam quebra no meio */
tr { break-inside: avoid; page-break-inside: avoid; }
</style></head><body style="font-family:'Noto Sans','NotoSans',Arial,sans-serif;padding:${padVert} ${padLat};color:#000;font-size:${spx(12)};line-height:1.3"><div style="width:100%;max-width:100%"><div style="background:#f8fafc;border:1px solid #d5dde8;border-radius:8px;padding:8px 6px;margin-bottom:8px"><h2 style="margin:0 0 2px;font-size:${spx(18)};line-height:1.1;color:#000">SUPERAGEFIN - ${escapeHtml(formatMonth(currentMonth))}</h2><p style="margin:0 0 2px;color:#000;font-size:${spx(12)};line-height:1.2">Contas filtradas da consulta financeira</p><p style="margin:0 0 2px;color:#000;font-size:${spx(12)};line-height:1.2">Quantidade: ${quantidadeImpressa} conta${quantidadeImpressa !== 1 ? 's' : ''}</p><p style="margin:0;color:#000;font-size:${spx(12)};line-height:1.2">Total impresso: <span style="font-weight:400;color:#000">${escapeHtml(formatCurrency(totalImpressoComFolha))}</span></p>${notaFolhaHtml}${notaSociosHtml}${notaBudgetsHtml}${modoSelecao ? `<p style="margin:2px 0 0;color:#000;font-size:${spx(12)};line-height:1.2">Modo Somar: apenas contas selecionadas</p>` : ''}</div>${filtrosHtml}${cabecalhoColunasHtml}${gruposHtml}${budgetsSecaoHtml}${rodapeAnotacoesHtml}</div></body></html>`;
    try {
      await openPrintWindowOrShareHtml(html, `superagefin-${currentMonth.getTime()}.html`, `SUPERAGEFIN ${formatMonth(currentMonth)}`);
    } catch {
      /* popup bloqueado no desktop */
    }
  };

  return (
    <div className={`min-h-screen p-2.5 md:p-4 ${modoSelecao ? 'pb-36' : 'pb-20'} ${brandSurface.pageScreen}`}>
      <div className="mx-auto max-w-5xl space-y-2 md:space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em]">Laboratório SUPERAGEFIN</p>
            <h1 className="mt-0.5 text-xl leading-none md:text-2xl font-semibold text-foreground font-glacial">SUPERAGEFIN</h1>
          </div>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl bg-muted">
                <Menu className="w-4 h-4 text-muted-foreground" />
                {hasActiveFilters && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 ring-2 ring-white dark:ring-border/40" aria-hidden />
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="border-0 rounded-t-[32px] bg-card px-4 pb-6">
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle className="font-glacial text-foreground">Menu SUPERAGEFIN</DrawerTitle>
                <DrawerDescription className="text-sm text-muted-foreground">
                  Organize, some, imprima e ajuste filtros.
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-5 px-0 max-h-[65vh] overflow-y-auto">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Ações rápidas</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setModoSelecao((v) => !v)}
                      className={`h-10 gap-1.5 rounded-2xl px-3 text-xs font-medium ${modoSelecao ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' : 'bg-muted text-foreground/90'}`}
                    >
                      <Calculator className="h-4 w-4" />
                      {modoSelecao ? 'Somando' : 'Somar'}
                    </Button>
                    <Button onClick={imprimirRelatorio} variant="ghost" size="sm" className="h-10 rounded-2xl px-3 text-xs bg-muted">
                      <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" />
                      Imprimir
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Organização</p>
                  <SuperAgefinConsultaOrganizer
                    groupBy={groupBy}
                    sortOrder={sortOrder}
                    onGroupByChange={setGroupBy}
                    onSortOrderToggle={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">CMV na lista</p>
                    <p className="text-[11px] text-muted-foreground">Desligue para ocultar sem abrir filtros</p>
                  </div>
                  <CmvQuickToggle checked={mostrarCmvRapido} onChange={setMostrarCmvRapido} />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Pagamento</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={pagamentoFilter === 'todos'} onClick={() => setPagamentoFilter('todos')}>Todos</FilterChip>
                    <FilterChip active={pagamentoFilter === 'pagos'} onClick={() => setPagamentoFilter('pagos')} tone="success">Pagos</FilterChip>
                    <FilterChip active={pagamentoFilter === 'nao_pagos'} onClick={() => setPagamentoFilter('nao_pagos')}>Não pagos</FilterChip>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Prazo (vencimento)</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={prazoFilter === 'todos'} onClick={() => setPrazoFilter('todos')}>Todos</FilterChip>
                    <FilterChip active={prazoFilter === 'vencidas'} onClick={() => setPrazoFilter('vencidas')} tone="danger">Vencidas</FilterChip>
                    <FilterChip active={prazoFilter === 'em_dia'} onClick={() => setPrazoFilter('em_dia')} tone="success">Em dia</FilterChip>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Tipo</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={cmvFilter === 'todos'} onClick={() => setCmvFilter('todos')}>Todos</FilterChip>
                    <FilterChip active={cmvFilter === 'cmv'} onClick={() => setCmvFilter('cmv')}>CMV</FilterChip>
                    <FilterChip active={cmvFilter === 'normal'} onClick={() => setCmvFilter('normal')}>Normal</FilterChip>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Itinerário / fretes</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={freteFilter === 'todos'} onClick={() => setFreteFilter('todos')}>Todos</FilterChip>
                    <FilterChip active={freteFilter === 'fretes'} onClick={() => setFreteFilter('fretes')}>Fretes</FilterChip>
                    <FilterChip active={freteFilter === 'sem_fretes'} onClick={() => setFreteFilter('sem_fretes')}>Sem fretes</FilterChip>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    Fretes: lançamentos com referência ao evento logístico (aba Fretes do Itinerário Fluvial) ou tags frete / conta_frete.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Data inicial (opcional)</p>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-2xl border-0 bg-muted h-12" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Data final (opcional)</p>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-2xl border-0 bg-muted h-12" />
                  </div>
                </div>
              </div>
              <DrawerFooter className="px-0 pb-0 pt-5">
                <Button variant="ghost" onClick={limparFiltros} className="w-full rounded-2xl h-12 bg-muted">
                  Limpar filtros
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 md:h-9 md:w-9">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center min-w-0">
            <p className="text-sm font-semibold text-foreground capitalize">{formatMonth(currentMonth)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Período civil · {monthData.length} conta{monthData.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 md:h-9 md:w-9">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {hasActiveFilters && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-1">Filtros ativos</span>
            {pagamentoFilter !== 'todos' && <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-blue-800 dark:text-blue-200">Pag.: {pagamentoFilter}</span>}
            {prazoFilter !== 'todos' && <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-blue-800 dark:text-blue-200">Prazo: {prazoFilter}</span>}
            {cmvFilter !== 'todos' && <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-blue-800 dark:text-blue-200">Tipo: {cmvFilter}</span>}
            {freteFilter !== 'todos' && <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-blue-800 dark:text-blue-200">Frete: {freteFilter}</span>}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                {dateFrom || '…'} → {dateTo || '…'}
                <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-0.5 rounded-full hover:bg-muted dark:hover:bg-primary/90" aria-label="Limpar datas">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 md:gap-2">
          <KpiCard label="Total (filtro)" value={formatCurrency(kpis.totalValue)} />
          <KpiCard label="Pago" value={formatCurrency(kpis.paidValue)} tone="success" />
          <KpiCard label="Não pago" value={formatCurrency(kpis.unpaidValue)} tone="muted" />
          <KpiCard label="Vencido" value={formatCurrency(kpis.overdueValue)} tone="danger" />
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16"><div className="w-8 h-8 border-4 border-border/40 border-t-primary dark:border-border/40 dark:border-t-foreground rounded-full animate-spin" /></div>
        ) : contasOrdenadas.length === 0 ? (
          <div className={`rounded-[24px] p-10 text-center md:rounded-[28px] md:p-12 ${brandSurface.textMuted} ${brandSurface.card}`}>
            Nenhuma conta a pagar encontrada para esse mês e filtros.
          </div>
        ) : grupos.reduce((acc, g) => acc + g.contas.length, 0) >= P38_VIRTUAL_MIN_ROWS ? (
          <SuperAgefinGruposVirtualList
            grupos={grupos}
            modoSelecao={modoSelecao}
            selecionadosIds={selecionadosIds}
            toggleSelecaoConta={toggleSelecaoConta}
            abrirConta={abrirConta}
            idsComAvisoDuplicadoGrupo={idsComAvisoDuplicadoGrupo}
          />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6 md:max-w-4xl">
            {grupos.map((grupo) => (
              <section key={grupo.key} id={grupoDomId(grupo.key)} className="scroll-mt-24 space-y-2 md:space-y-3">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:text-muted-foreground">{grupo.label}</h2>
                  <span className="text-[11px] text-muted-foreground">
                    {grupo.contas.length} · {formatCurrency(grupo.contas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0))}
                  </span>
                </div>
                <P38MobileLineList className="block desktop-layout:hidden rounded-lg">
                  {grupo.contas.map((conta, index) => (
                    <ContaLinhaP38
                      key={conta.id}
                      conta={conta}
                      striped={index % 2 === 1}
                      modoSelecao={modoSelecao}
                      selecionado={selecionadosIds.includes(conta.id)}
                      onToggleSelecao={toggleSelecaoConta}
                      onOpen={() => abrirConta(conta)}
                      avisoMesmoGrupoDuplicado={idsComAvisoDuplicadoGrupo.has(conta.id)}
                    />
                  ))}
                </P38MobileLineList>
                <div className="hidden desktop-layout:block space-y-2">
                  {grupo.contas.map((conta, index) => (
                    <ContaCard
                      key={conta.id}
                      conta={conta}
                      striped={index % 2 === 1}
                      modoSelecao={modoSelecao}
                      selecionado={selecionadosIds.includes(conta.id)}
                      onToggleSelecao={toggleSelecaoConta}
                      onOpen={() => abrirConta(conta)}
                      avisoMesmoGrupoDuplicado={idsComAvisoDuplicadoGrupo.has(conta.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {modoSelecao && (
        <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-border/40 bg-card/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-border/40 dark:bg-muted/95 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Seleção para pagar</p>
              <p className="text-lg font-semibold text-foreground">
                {selecionadosIds.length} conta{selecionadosIds.length !== 1 ? 's' : ''} · {formatCurrency(somaSelecionados)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-11 flex-1 rounded-2xl sm:flex-none" onClick={() => setSelecionadosIds([])}>
                Limpar
              </Button>
              <Button type="button" size="sm" className="h-11 flex-1 rounded-2xl sm:flex-none" onClick={() => setModoSelecao(false)}>
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
