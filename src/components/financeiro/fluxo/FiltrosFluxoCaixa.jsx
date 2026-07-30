import React, { useState } from 'react';
import {
  X, Wallet, BarChart3, Clock, ChevronDown,
  ChevronLeft, ChevronRight, Layers, RefreshCw
} from 'lucide-react';
import { dataHoje } from '@/components/utils/dateUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  format, isWithinInterval, subDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isSameDay, isBefore, eachDayOfInterval, getDay, addMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FinanceiroFiltrosShell from './FinanceiroFiltrosShell';
import FinanceiroCorteHistoricoFiltro from './FinanceiroCorteHistoricoFiltro';
import {
  P38_CHIP_ACTIVE,
  P38_CHIP_INACTIVE,
  P38_POPOVER,
} from './financeiroP38';

const P38_CAL_SELECTED =
  'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22] font-bold';
const P38_CAL_IN_RANGE =
  'bg-[#4a5240]/15 text-foreground/90 dark:bg-[#a4ce33]/15 dark:text-foreground';

export const PERIODO_LABELS = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semana: 'Semana',
  mes: 'Mês',
  tudo: 'Tudo',
  periodo: 'Período',
};

// ─── Mini Calendar ────────────────────────────────────────────────────────────
const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function MiniCal({ base, rangeStart, rangeEnd, hover, onDay, onHover, onPrev, onNext }) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const days = eachDayOfInterval({ start: first, end: endOfMonth(first) });
  const pad = (getDay(first) + 6) % 7;

  const inRange = (d) => {
    const end = rangeEnd || hover;
    if (!rangeStart || !end) return false;
    const [from, to] = isBefore(rangeStart, end) ? [rangeStart, end] : [end, rangeStart];
    return isWithinInterval(d, { start: from, end: to });
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        {onPrev
          ? <button type="button" onClick={onPrev} className="p-1 rounded-lg hover:bg-secondary/80 dark:hover:bg-[#383e47] text-muted-foreground"><ChevronLeft className="w-3.5 h-3.5" /></button>
          : <span className="w-6" />}
        <span className="text-[0.72rem] font-semibold text-foreground/90 capitalize">
          {format(first, 'MMMM yyyy', { locale: ptBR })}
        </span>
        {onNext
          ? <button type="button" onClick={onNext} className="p-1 rounded-lg hover:bg-secondary/80 dark:hover:bg-[#383e47] text-muted-foreground"><ChevronRight className="w-3.5 h-3.5" /></button>
          : <span className="w-6" />}
      </div>
      <div className="grid grid-cols-7 gap-px mb-0.5">
        {DIAS_SEMANA.map((d, i) => <div key={i} className="text-center text-[0.6rem] font-medium text-muted-foreground py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array(pad).fill(null).map((_, i) => <div key={'p' + i} />)}
        {days.map((d) => {
          const isS = rangeStart && isSameDay(d, rangeStart);
          const isE = rangeEnd && isSameDay(d, rangeEnd);
          const in_ = inRange(d);
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => onDay(d)}
              onMouseEnter={() => onHover(d)}
              className={`text-center text-[0.7rem] py-1 rounded-lg transition-colors
                ${isS || isE ? P38_CAL_SELECTED : ''}
                ${in_ && !isS && !isE ? P38_CAL_IN_RANGE : ''}
                ${!isS && !isE && !in_ ? 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]' : ''}
              `}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Período Picker ───────────────────────────────────────────────────────────
const CHIPS = [
  { v: 'hoje', l: 'Hoje' }, { v: 'ontem', l: 'Ontem' },
  { v: 'semana', l: 'Semana' }, { v: 'mes', l: 'Mês' },
  { v: 'tudo', l: 'Tudo' }, { v: 'periodo', l: 'Período' },
];

function PeriodoPicker({ periodo, onPeriodo, customStart, customEnd, onCustom, inline = false, calendarClassName }) {
  const [showCal, setShowCal] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hover, setHover] = useState(null);

  const hoje = new Date(`${dataHoje()}T12:00:00Z`);
  const baseLeft = addMonths(new Date(hoje.getFullYear(), hoje.getMonth(), 1), offset);
  const rs = customStart ? new Date(`${customStart}T12:00:00Z`) : null;
  const re = customEnd ? new Date(`${customEnd}T12:00:00Z`) : null;

  const handleDay = (d) => {
    if (!rs || (rs && re)) {
      onCustom('start', format(d, 'yyyy-MM-dd'));
      onCustom('end', '');
    } else {
      if (isBefore(d, rs)) { onCustom('end', format(rs, 'yyyy-MM-dd')); onCustom('start', format(d, 'yyyy-MM-dd')); }
      else onCustom('end', format(d, 'yyyy-MM-dd'));
      setHover(null);
    }
  };

  const rangeLabel = rs && re
    ? `${format(rs, 'dd/MM')} – ${format(re, 'dd/MM')}`
    : rs ? `${format(rs, 'dd/MM')} – ...` : 'Período';

  const chipLabel = (c) => c.v === 'periodo' ? rangeLabel : c.l;

  const renderChip = (c) => (
    <button
      type="button"
      key={c.v}
      onClick={() => { onPeriodo(c.v); if (c.v === 'periodo') setShowCal(s => !s); else setShowCal(false); }}
      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
        ${periodo === c.v ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
    >
      {chipLabel(c)}
      {c.v === 'periodo' && periodo === 'periodo' && (rs || re) && (
        <span onMouseDown={(e) => { e.stopPropagation(); onCustom('start', ''); onCustom('end', ''); onPeriodo('mes'); setShowCal(false); }}>
          <X className="w-3 h-3 ml-0.5" />
        </span>
      )}
    </button>
  );

  return (
    <div className="relative w-full">
      {inline ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
          {CHIPS.map(renderChip)}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">{CHIPS.slice(0, 2).map(renderChip)}</div>
          <div className="flex gap-1.5">{CHIPS.slice(2, 4).map(renderChip)}</div>
          <div className="flex gap-1.5">{CHIPS.slice(4).map(renderChip)}</div>
        </div>
      )}
      {showCal && periodo === 'periodo' && (
        <div className={`absolute left-0 mt-2 rounded-2xl p-3 ${P38_POPOVER} ${inline ? 'w-[min(320px,100%)]' : 'right-0'} ${calendarClassName || 'z-50'}`}>
          <MiniCal base={baseLeft} rangeStart={rs} rangeEnd={re} hover={hover} onDay={handleDay} onHover={setHover} onPrev={() => setOffset(o => o - 1)} onNext={() => setOffset(o => o + 1)} />
          {rs && re && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary/60 dark:bg-[#26262e] px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {format(rs, 'dd MMM yyyy', { locale: ptBR })} → {format(re, 'dd MMM yyyy', { locale: ptBR })}
              </span>
              <button type="button" onClick={() => setShowCal(false)} className={`text-xs font-semibold px-3 py-1 rounded-lg ${P38_CHIP_ACTIVE}`}>OK</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filtro Contas ────────────────────────────────────────────────────────────
function ContasFiltro({ contas, sel, onSel }) {
  const allIds = contas.map(c => c.id);
  const todasSel = contas.length > 0 && sel.length === contas.length;
  const toggle = (id) => sel.includes(id) ? onSel(sel.filter(c => c !== id)) : onSel([...sel, id]);
  const handleTodas = () => onSel(todasSel ? [] : allIds);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shadow-sm
          ${!todasSel ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>{todasSel ? 'Todas as contas' : `${sel.length} selecionada${sel.length > 1 ? 's' : ''}`}</span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={`w-64 p-2.5 ${P38_POPOVER}`} align="start">
        <div className="mb-2 px-2 pt-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Contas financeiras</p>
        </div>
        <button
          type="button"
          onClick={handleTodas}
          className={`w-full text-left px-3 py-2 rounded-2xl text-xs mb-1.5 transition-colors ${todasSel
            ? `${P38_CHIP_ACTIVE} font-medium`
            : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]'}`}
        >
          Todas as contas
        </button>
        <div className="space-y-1">
          {contas.map(c => (
            <label
              key={c.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${sel.includes(c.id)
                ? 'bg-secondary/80 dark:bg-[#383e47] shadow-sm'
                : 'hover:bg-secondary/60 dark:hover:bg-[#383e47]/60'}`}
            >
              <Checkbox checked={sel.includes(c.id)} onCheckedChange={() => toggle(c.id)} className="w-4 h-4" />
              <span className="w-2.5 h-2.5 rounded-full flex-none shadow-sm" style={{ background: c.cor || '#a4ce33' }} />
              <span className="text-xs truncate text-foreground/90">{c.nome}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Filtro Status ────────────────────────────────────────────────────────────
function StatusFiltro({ sel, onSel }) {
  const ALL = ['Em Aberto', 'Vencido', 'Pago', 'Cancelado'];
  const todasSel = sel.length === 0;
  const toggle = (t) => sel.includes(t) ? onSel(sel.filter(x => x !== t)) : onSel([...sel, t]);
  const label = sel.length === 0 ? 'Status' : sel.length === 1 ? sel[0] : `${sel.length} status`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
          ${!todasSel ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
        >
          <RefreshCw className="w-3 h-3" />
          {label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={`w-44 p-2 ${P38_POPOVER}`} align="start">
        <button type="button" onClick={() => onSel([])} className={`w-full text-left px-2 py-1.5 rounded text-xs mb-1 ${todasSel ? `${P38_CHIP_ACTIVE} font-medium` : 'hover:bg-secondary/80 dark:hover:bg-[#383e47]'} text-foreground/90`}>
          Todos
        </button>
        {ALL.map(t => (
          <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/80 dark:hover:bg-[#383e47] cursor-pointer">
            <Checkbox checked={sel.includes(t)} onCheckedChange={() => toggle(t)} className="w-3.5 h-3.5" />
            <span className="text-xs text-foreground/90">{t}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Filtro Tipo ──────────────────────────────────────────────────────────────
function TipoFiltro({ sel, onSel }) {
  const ALL = ['Receita', 'Despesa', 'Transferência'];
  const todasSel = sel.length === 0 || sel.length === ALL.length;
  const toggle = (t) => sel.includes(t) ? onSel(sel.filter(x => x !== t)) : onSel([...sel, t]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
          ${!todasSel ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
        >
          <BarChart3 className="w-3 h-3" />
          {todasSel ? 'Tipo' : sel.join(', ')}
          <ChevronDown className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={`w-44 p-2 ${P38_POPOVER}`} align="start">
        {ALL.map(t => (
          <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/80 dark:hover:bg-[#383e47] cursor-pointer">
            <Checkbox checked={sel.length === 0 || sel.includes(t)} onCheckedChange={() => toggle(t)} className="w-3.5 h-3.5" />
            <span className="text-xs text-foreground/90">{t}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function CmvFiltro({ cmvOnly, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!cmvOnly)}
      className={`flex-none flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${cmvOnly ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
    >
      <Layers className="w-3 h-3" /> CMV
    </button>
  );
}

function ConciliacaoLoteFiltro({ contas, onOpenConciliacao }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`flex-none flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${P38_CHIP_INACTIVE}`}>
          <Clock className="w-3 h-3" /> Conciliar em lote
        </button>
      </PopoverTrigger>
      <PopoverContent className={`w-56 p-2 ${P38_POPOVER}`} align="start">
        <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Escolha a conta</p>
        <button
          type="button"
          onClick={() => onOpenConciliacao?.(null)}
          className="w-full text-left px-2 py-2 rounded text-xs hover:bg-secondary/80 dark:hover:bg-[#383e47] text-foreground/90"
        >
          Todas as contas
        </button>
        {contas.map(c => (
          <button
            type="button"
            key={c.id}
            onClick={() => onOpenConciliacao?.(c)}
            className="w-full text-left px-2 py-2 rounded text-xs hover:bg-secondary/80 dark:hover:bg-[#383e47] text-foreground/90"
          >
            {c.nome}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Painel de filtros (compartilhado mobile drawer + desktop inline) ─────────
function FiltrosFluxoPainel({
  periodo, onPeriodo, customStart, customEnd, onCustom,
  contas, contasSel, onContasSel,
  tiposSel, onTiposSel,
  statusSel, onStatusSel,
  pendentes, onPendentes,
  cmvOnly, onCmvOnly,
  onOpenConciliacao,
  mostrarHistoricoAnterior, dataCorteHistorico, onMostrarHistoricoAnterior, onDataCorteHistorico,
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Período</p>
        <PeriodoPicker
          periodo={periodo}
          onPeriodo={onPeriodo}
          customStart={customStart}
          customEnd={customEnd}
          onCustom={onCustom}
          inline
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ContasFiltro contas={contas} sel={contasSel} onSel={onContasSel} />
        <TipoFiltro sel={tiposSel} onSel={onTiposSel} />
        <StatusFiltro sel={statusSel} onSel={onStatusSel} />
        <CmvFiltro cmvOnly={cmvOnly} onToggle={onCmvOnly} />
        <ConciliacaoLoteFiltro contas={contas} onOpenConciliacao={onOpenConciliacao} />
      </div>

      <FinanceiroCorteHistoricoFiltro
        mostrarHistoricoAnterior={mostrarHistoricoAnterior}
        dataCorte={dataCorteHistorico}
        onMostrarHistoricoAnterior={onMostrarHistoricoAnterior}
        onDataCorte={onDataCorteHistorico}
        contextoLista="lista"
      />
    </div>
  );
}

// ─── Export Principal ─────────────────────────────────────────────────────────
export { PeriodoPicker, ContasFiltro, TipoFiltro, StatusFiltro, CmvFiltro, ConciliacaoLoteFiltro };

export default function FiltrosFluxoCaixa({
  search, onSearch,
  periodo, onPeriodo, customStart, customEnd, onCustom,
  contas, contasSel, onContasSel,
  tiposSel, onTiposSel,
  statusSel, onStatusSel,
  pendentes, onPendentes,
  cmvOnly, onCmvOnly,
  onOpenConciliacao,
  conciliacaoPendente = 0,
  ordemLancamentos = 'desc',
  onOrdemLancamentosChange,
  mostrarHistoricoAnterior = false,
  dataCorteHistorico,
  onMostrarHistoricoAnterior,
  onDataCorteHistorico,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasPanelFilters =
    periodo !== 'mes' ||
    tiposSel.length > 0 ||
    statusSel.length > 0 ||
    cmvOnly ||
    mostrarHistoricoAnterior ||
    !!customStart ||
    !!customEnd ||
    (contas.length > 0 && contasSel.length > 0 && contasSel.length < contas.length);

  return (
    <FinanceiroFiltrosShell
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Buscar lançamento, categoria, tag… ou \\conta"
      filtersOpen={filtersOpen}
      onFiltersOpenChange={setFiltersOpen}
      hasActiveFilters={hasPanelFilters}
      conciliacaoPendente={conciliacaoPendente}
      pendentes={pendentes}
      onPendentesToggle={onPendentes}
      ordemLancamentos={ordemLancamentos}
      onOrdemLancamentosChange={onOrdemLancamentosChange}
    >
      <FiltrosFluxoPainel
        periodo={periodo}
        onPeriodo={onPeriodo}
        customStart={customStart}
        customEnd={customEnd}
        onCustom={onCustom}
        contas={contas}
        contasSel={contasSel}
        onContasSel={onContasSel}
        tiposSel={tiposSel}
        onTiposSel={onTiposSel}
        statusSel={statusSel}
        onStatusSel={onStatusSel}
        pendentes={pendentes}
        onPendentes={onPendentes}
        cmvOnly={cmvOnly}
        onCmvOnly={onCmvOnly}
        onOpenConciliacao={onOpenConciliacao}
        mostrarHistoricoAnterior={mostrarHistoricoAnterior}
        dataCorteHistorico={dataCorteHistorico}
        onMostrarHistoricoAnterior={onMostrarHistoricoAnterior}
        onDataCorteHistorico={onDataCorteHistorico}
      />
    </FinanceiroFiltrosShell>
  );
}
