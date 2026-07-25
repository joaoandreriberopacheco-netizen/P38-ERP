import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, isBefore, isAfter, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { dataHoje } from '@/components/utils/dateUtils';

const PERIODOS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Ontem', value: 'ontem' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mês', value: 'mes' },
  { label: 'Tudo', value: 'tudo' },
];

// ─── Mini Calendar ──────────────────────────────────────────────────────────
function MiniCalendar({ month, year, rangeStart, rangeEnd, hoverDate, onDayClick, onDayHover, onPrev, onNext, showPrev, showNext }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = endOfMonth(firstDay);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startDow = (getDay(firstDay) + 6) % 7; // Monday=0
  const blanks = Array(startDow).fill(null);
  const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const isInRange = (d) => {
    const end = rangeEnd || hoverDate;
    if (!rangeStart || !end) return false;
    const from = isBefore(rangeStart, end) ? rangeStart : end;
    const to = isBefore(rangeStart, end) ? end : rangeStart;
    return isWithinInterval(d, { start: from, end: to });
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        {showPrev
          ? <button onClick={onPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }} className="hover:bg-muted"><ChevronLeft style={{ width: 14, height: 14 }} className="text-muted-foreground" /></button>
          : <span style={{ width: 22 }} />
        }
        <span style={{ fontSize: '0.78rem', fontWeight: 600 }} className="text-foreground/90">
          {format(firstDay, 'MMMM yyyy', { locale: ptBR })}
        </span>
        {showNext
          ? <button onClick={onNext} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }} className="hover:bg-muted"><ChevronRight style={{ width: 14, height: 14 }} className="text-muted-foreground" /></button>
          : <span style={{ width: 22 }} />
        }
      </div>
      {/* Dias semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 600, padding: '2px 0' }} className="text-muted-foreground">{d}</div>)}
      </div>
      {/* Dias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {blanks.map((_, i) => <div key={'b' + i} />)}
        {days.map(d => {
          const isStart = rangeStart && isSameDay(d, rangeStart);
          const isEnd = rangeEnd && isSameDay(d, rangeEnd);
          const inRange = isInRange(d);
          const isHov = hoverDate && isSameDay(d, hoverDate);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
              style={{
                textAlign: 'center', fontSize: '0.72rem', padding: '5px 2px', borderRadius: isStart || isEnd ? 8 : inRange ? 0 : 6,
                border: 'none', cursor: 'pointer', fontWeight: isStart || isEnd ? 700 : 400,
                background: isStart || isEnd ? '#1f2937' : inRange || isHov ? '#e5e7eb' : 'transparent',
                color: isStart || isEnd ? '#fff' : '#374151',
                transition: 'background 0.1s',
              }}
              className={!isStart && !isEnd ? 'dark:text-foreground dark:hover:bg-primary/90' : 'dark:bg-muted dark:text-foreground'}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── PeriodoPicker ──────────────────────────────────────────────────────────
export default function PeriodoPicker({ periodo, onPeriodo, customStart, customEnd, onCustom }) {
  const [showCal, setShowCal] = useState(false);
  const [calOffset, setCalOffset] = useState(0); // offset em meses a partir do mês atual
  const [hoverDate, setHoverDate] = useState(null);
  const scrollRef = useRef(null);

  const today = new Date(`${dataHoje()}T12:00:00Z`);
  const leftMonth = addMonths(startOfMonth(today), calOffset);
  const rightMonth = addMonths(leftMonth, 1);

  const rangeStart = customStart ? new Date(`${customStart}T12:00:00Z`) : null;
  const rangeEnd = customEnd ? new Date(`${customEnd}T12:00:00Z`) : null;

  const handleDayClick = (d) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      // Começa nova seleção
      onCustom('start', format(d, 'yyyy-MM-dd'));
      onCustom('end', '');
    } else {
      // Define fim
      if (isBefore(d, rangeStart)) {
        onCustom('end', format(rangeStart, 'yyyy-MM-dd'));
        onCustom('start', format(d, 'yyyy-MM-dd'));
      } else {
        onCustom('end', format(d, 'yyyy-MM-dd'));
      }
      setHoverDate(null);
    }
  };

  const formatRange = () => {
    if (rangeStart && rangeEnd) return `${format(rangeStart, 'dd/MM')} – ${format(rangeEnd, 'dd/MM')}`;
    if (rangeStart) return `${format(rangeStart, 'dd/MM')} – ...`;
    return 'Período';
  };

  const isPeriodoAtivo = periodo === 'periodo';

  return (
    <div style={{ width: '100%', minWidth: 0, position: 'relative' }}>
      {/* Carrossel com setas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Seta Esquerda */}
        <button
          onClick={() => scrollRef.current && (scrollRef.current.scrollLeft -= 100)}
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
          className="text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>

        {/* Chips scrolláveis */}
        <div
          ref={scrollRef}
          style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', flex: 1, scrollBehavior: 'smooth', padding: '2px 0' }}
        >
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => { onPeriodo(p.value); setShowCal(false); }}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
              className={periodo === p.value && !isPeriodoAtivo ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground dark:text-foreground/90'}
            >
              {p.label}
            </button>
          ))}

          {/* Chip Período personalizado */}
          <button
            onClick={() => { onPeriodo('periodo'); setShowCal(s => !s); }}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
            className={isPeriodoAtivo ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground dark:text-foreground/90'}
          >
            {isPeriodoAtivo ? formatRange() : 'Período'}
            {isPeriodoAtivo && (rangeStart || rangeEnd) && (
              <span
                onClick={(e) => { e.stopPropagation(); onCustom('start', ''); onCustom('end', ''); onPeriodo('mes'); setShowCal(false); }}
                style={{ display: 'flex', alignItems: 'center', marginLeft: 2 }}
              >
                <X style={{ width: 11, height: 11 }} />
              </span>
            )}
          </button>
        </div>

        {/* Seta Direita */}
        <button
          onClick={() => scrollRef.current && (scrollRef.current.scrollLeft += 100)}
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
          className="text-muted-foreground hover:bg-muted"
        >
          <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Calendário duplo dropdown */}
      {showCal && isPeriodoAtivo && (
        <div
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 8, borderRadius: 16, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', boxSizing: 'border-box' }}
          className="bg-card"
          onMouseLeave={() => setHoverDate(null)}
        >
          {/* Navegação meses */}
          <div style={{ display: 'flex', gap: 16, minWidth: 0 }}>
            <MiniCalendar
              month={leftMonth.getMonth()} year={leftMonth.getFullYear()}
              rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate}
              onDayClick={handleDayClick} onDayHover={setHoverDate}
              onPrev={() => setCalOffset(o => o - 1)}
              showPrev={true} showNext={false}
            />
            <div style={{ width: 1, background: '#f3f4f6', flexShrink: 0 }} className="dark:bg-muted" />
            <MiniCalendar
              month={rightMonth.getMonth()} year={rightMonth.getFullYear()}
              rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate}
              onDayClick={handleDayClick} onDayHover={setHoverDate}
              onNext={() => setCalOffset(o => o + 1)}
              showPrev={false} showNext={true}
            />
          </div>
          {/* Resumo seleção */}
          {(rangeStart || rangeEnd) && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="bg-muted/40 dark:bg-muted">
              <span style={{ fontSize: '0.75rem' }} className="text-muted-foreground">
                {rangeStart && rangeEnd ? `${format(rangeStart, 'dd MMM yyyy', { locale: ptBR })} → ${format(rangeEnd, 'dd MMM yyyy', { locale: ptBR })}` : rangeStart ? `De ${format(rangeStart, 'dd MMM', { locale: ptBR })}... selecione o fim` : ''}
              </span>
              {rangeStart && rangeEnd && (
                <button onClick={() => setShowCal(false)} style={{ fontSize: '0.75rem', fontWeight: 600, background: '#1f2937', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>OK</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}