import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format, addMonths, subMonths, parse, isValid, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

export default function CalendarPopup({ dateRange, setDateRange, onClose, isModal = false }) {
   const [month, setMonth] = useState(dateRange?.from || new Date());
   const [manualFrom, setManualFrom] = useState(dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : '');
   const [manualTo, setManualTo] = useState(dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : '');


   useEffect(() => {
     setManualFrom(dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : '');
     setManualTo(dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : '');
     if (dateRange?.from) setMonth(dateRange.from);
   }, [dateRange?.from, dateRange?.to]);

   const handlePrevious = () => setMonth((current) => subMonths(current, 1));
   const handleNext = () => setMonth((current) => addMonths(current, 1));

  const formatManualDate = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const parseManualDate = (value) => {
    if (!value || value.length !== 10) return null;
    const parsed = parse(value, 'dd/MM/yyyy', new Date());
    return isValid(parsed) && format(parsed, 'dd/MM/yyyy') === value ? parsed : null;
  };

  const commitManualRange = (fromText, toText) => {
    const parsedFrom = parseManualDate(fromText);
    const parsedTo = parseManualDate(toText);
    if (!parsedFrom && !parsedTo) return;

    const nextFrom = parsedFrom || dateRange?.from;
    const nextTo = parsedTo || dateRange?.to;
    if (nextFrom && nextTo && isAfter(nextFrom, nextTo)) {
      setDateRange({ from: nextTo, to: nextFrom });
      setMonth(nextTo);
      return;
    }
    setDateRange({ from: nextFrom, to: nextTo });
    if (nextFrom) setMonth(nextFrom);
  };

  const handleManualFromChange = (event) => {
    const next = formatManualDate(event.target.value);
    setManualFrom(next);
    commitManualRange(next, manualTo);
  };

  const handleManualToChange = (event) => {
    const next = formatManualDate(event.target.value);
    setManualTo(next);
    commitManualRange(manualFrom, next);
  };

  const handleSelectRange = (range) => {
    setDateRange({ from: range?.from, to: range?.to });
    if (range?.from) setMonth(range.from);
  };

  const visibleMonths = [month, addMonths(month, 1)];
  
  return (
    <div className={`${isModal ? 'w-full max-w-[760px] mx-auto' : 'absolute top-full left-0 mt-1 w-[min(760px,calc(100vw-2rem))]'} rounded-[28px] bg-card shadow-xl z-50 border border-border/40 overflow-hidden`}>
      <style>{`
        .rdp { margin: 0; --rdp-cell-size: 34px; --rdp-accent-color: #1f2937; --rdp-background-color: #dcfce7; }
        .rdp-caption, .rdp-nav { display: none !important; }
        .rdp-months { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: start; }
        .rdp-month { margin: 0; width: 100%; }
        .rdp-table { width: 100%; border-collapse: collapse; }
        .rdp-head_cell { color: #6b7280; font-size: 11px; font-weight: 600; padding: 0 0 10px; text-transform: uppercase; }
        .rdp-cell { padding: 0; }
        .rdp-day { width: 34px; height: 34px; font-size: 12px; border-radius: 10px; cursor: pointer; }
        .rdp-day_selected { background-color: #1f2937; color: white; font-weight: 700; }
        .rdp-day_range_middle { background-color: #dcfce7; color: #1f2937; border-radius: 0; }
        .rdp-day_range_start { border-radius: 10px 0 0 10px; }
        .rdp-day_range_end { border-radius: 0 10px 10px 0; }
        .rdp-day_disabled { color: #d1d5db; }
        .dark .rdp { --rdp-accent-color: #f8fafc; --rdp-background-color: #134e4a; }
        .dark .rdp-head_cell { color: #9ca3af; }
        .dark .rdp-day_selected { background-color: #f8fafc; color: #111827; }
        .dark .rdp-day_range_middle { background-color: #134e4a; color: #f8fafc; }
        @media (max-width: 767px) {
          .rdp { --rdp-cell-size: 34px; }
          .rdp-day { width: 34px; height: 34px; font-size: 12px; }
        }
      `}</style>

      <div className="space-y-4 p-4 md:p-5">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[640px] space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {visibleMonths.map((visibleMonth, index) => (
                <div key={visibleMonth.toISOString()} className="flex items-center justify-between">
                  {index === 0 ? (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="p-2 hover:bg-muted rounded-xl transition"
                      aria-label="Mês anterior"
                    >
                      <ChevronLeft className="w-5 h-5 text-foreground/90" />
                    </button>
                  ) : (
                    <span className="w-9" />
                  )}
                  <p className="text-base font-semibold text-foreground capitalize tracking-tight">
                    {format(visibleMonth, 'MMMM yyyy', { locale: ptBR })}
                  </p>
                  {index === visibleMonths.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="p-2 hover:bg-muted rounded-xl transition"
                      aria-label="Próximo mês"
                    >
                      <ChevronRight className="w-5 h-5 text-foreground/90" />
                    </button>
                  ) : (
                    <span className="w-9" />
                  )}
                </div>
              ))}
            </div>
            <DayPicker
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={handleSelectRange}
              month={month}
              numberOfMonths={2}
              locale={ptBR}
              showOutsideDays={false}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-background/40 border border-border/40 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Data inicial
              </span>
              <input
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={manualFrom}
                onChange={handleManualFromChange}
                onBlur={() => commitManualRange(manualFrom, manualTo)}
                className="w-full h-11 rounded-xl border border-border/40 bg-card px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border/10 dark:focus:ring-white/20"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Data final
              </span>
              <input
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={manualTo}
                onChange={handleManualToChange}
                onBlur={() => commitManualRange(manualFrom, manualTo)}
                className="w-full h-11 rounded-xl border border-border/40 bg-card px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-border/10 dark:focus:ring-white/20"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Digite manualmente ou selecione no calendário.
          </p>
        </div>

        <div className="border-t border-border/40 pt-3 text-center text-xs text-muted-foreground">
          {dateRange.from ? (
            <p className="font-medium">{format(dateRange.from, 'dd/MM/yyyy')}{dateRange.to ? ` até ${format(dateRange.to, 'dd/MM/yyyy')}` : ''}</p>
          ) : (
            <p>Selecione o período</p>
          )}
        </div>

        <button
          onClick={onClose}
          disabled={!dateRange.from || !dateRange.to}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${
            dateRange.from && dateRange.to
              ? 'bg-card text-card-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {dateRange.from && dateRange.to ? 'Pronto' : 'Selecione intervalo'}
        </button>
      </div>
    </div>
  );
}