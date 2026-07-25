import React from 'react';
import { CalendarDays, Clock, Filter, Layers, RefreshCw, Wallet } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PeriodoPicker } from './fluxo/FiltrosFluxoCaixa';

function FilterChip({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${active ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-card dark:bg-muted text-muted-foreground shadow-sm'}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function MultiSelectPopover({ icon: Icon, label, options, selected, onToggle, onClear, allLabel = 'Todos', inDialog = false }) {
  const active = selected.length > 0;

  return (
    <Popover modal={inDialog}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${active ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-card dark:bg-muted text-muted-foreground shadow-sm'}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {active ? `${selected.length} selecionado(s)` : label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={`w-56 rounded-3xl border-0 bg-card p-2 shadow-xl dark:bg-card ${inDialog ? 'z-[80]' : ''}`}
        align="start"
      >
        <button type="button" onClick={onClear} className="w-full text-left px-3 py-2 rounded-2xl text-xs text-foreground/90 hover:bg-muted/40 dark:hover:bg-card">
          {allLabel}
        </button>
        <div className="space-y-1 mt-1">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer hover:bg-muted/40 dark:hover:bg-card">
              <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => onToggle(option.value)} className="w-4 h-4" />
              <span className="text-xs text-foreground/90">{option.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PrintDialogFilters({
  periodo,
  setPeriodo,
  customStart,
  customEnd,
  setCustomStart,
  setCustomEnd,
  contas,
  contasSel,
  setContasSel,
  tiposSel = [],
  setTiposSel = () => {},
  statusSel = [],
  setStatusSel = () => {},
  pendentes = false,
  setPendentes = () => {},
  cmvOnly = false,
  setCmvOnly = () => {},
  showAdvancedFilters = true,
  showContasFilter = true,
  inDialog = false,
}) {
  const toggleItem = (value, selected, setter) => {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const contaOptions = contas.map((conta) => ({ value: conta.id, label: conta.nome }));
  const tipoOptions = [
    { value: 'Receita', label: 'Receita' },
    { value: 'Despesa', label: 'Despesa' },
    { value: 'Transferência', label: 'Transferência' },
  ];
  const statusOptions = [
    { value: 'Em Aberto', label: 'Em Aberto' },
    { value: 'Vencido', label: 'Vencido' },
    { value: 'Pago', label: 'Pago' },
    { value: 'Cancelado', label: 'Cancelado' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-muted/40 dark:bg-muted/60 p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <CalendarDays className="w-4 h-4" />
          <span className="text-[11px] uppercase tracking-wide">Período</span>
        </div>
        <PeriodoPicker
          periodo={periodo}
          onPeriodo={setPeriodo}
          customStart={customStart}
          customEnd={customEnd}
          onCustom={(key, value) => key === 'start' ? setCustomStart(value) : setCustomEnd(value)}
          calendarClassName={inDialog ? 'z-[80]' : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {showContasFilter && (
          <MultiSelectPopover
            icon={Wallet}
            label="Contas"
            options={contaOptions}
            selected={contasSel}
            onToggle={(value) => toggleItem(value, contasSel, setContasSel)}
            onClear={() => setContasSel([])}
            allLabel="Todas as contas"
            inDialog={inDialog}
          />
        )}
        {showAdvancedFilters && (
          <>
            <MultiSelectPopover
              icon={Filter}
              label="Tipo"
              options={tipoOptions}
              selected={tiposSel}
              onToggle={(value) => toggleItem(value, tiposSel, setTiposSel)}
              onClear={() => setTiposSel([])}
              allLabel="Todos os tipos"
              inDialog={inDialog}
            />
            <MultiSelectPopover
              icon={RefreshCw}
              label="Status"
              options={statusOptions}
              selected={statusSel}
              onToggle={(value) => toggleItem(value, statusSel, setStatusSel)}
              onClear={() => setStatusSel([])}
              allLabel="Todos os status"
              inDialog={inDialog}
            />
            <FilterChip active={pendentes} icon={Clock} label="Pendentes" onClick={() => setPendentes(!pendentes)} />
            <FilterChip active={cmvOnly} icon={Layers} label="CMV" onClick={() => setCmvOnly(!cmvOnly)} />
          </>
        )}
      </div>
    </div>
  );
}