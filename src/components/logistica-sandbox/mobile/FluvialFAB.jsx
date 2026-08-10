import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Calendar, Sliders, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

import { FLUVIAL_PERIOD_OPTIONS } from '@/components/logistica-sandbox/fluvialDataUtils';

export default function FluvialFAB({ 
  simulationDate,
  onSimulationDateChange,
  periodoFiltro = '30d',
  onPeriodoFiltroChange,
  embarqueLinkFilter = 'todos',
  onEmbarqueLinkFilterChange
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-sm transition-shadow hover:shadow-md dark:bg-muted dark:text-muted-foreground pdv-button-static p38-bottom-fab1"
      >
        <Sliders className="w-5 h-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-background border-t border-border/40">
          <SheetHeader>
            <SheetTitle className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">Filtros da Timeline</SheetTitle>
          </SheetHeader>
          <div className="pt-4 space-y-4">
            {/* Simulation Date */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2 uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Data
              </label>
              <Input
                type="date"
                value={simulationDate}
                onChange={(e) => {
                  onSimulationDateChange(e.target.value);
                  setOpen(false);
                }}
                className="text-xs bg-card border-border/40 text-foreground dark:text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2 uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Período (a partir de hoje)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {FLUVIAL_PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onPeriodoFiltroChange?.(option.id)}
                    className={`w-full text-left px-3 py-2.5 rounded text-xs font-medium transition-colors ${
                      periodoFiltro === option.id
                        ? 'bg-card text-foreground dark:text-foreground shadow-sm ring-1 ring-border/40 dark:ring-border/40'
                        : 'bg-muted text-foreground/90 dark:text-muted-foreground hover:bg-muted dark:hover:bg-primary/90'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2 uppercase tracking-wide flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" />
                Vínculo de Embarque
              </label>
              <div className="space-y-1.5">
                {[{ id: 'todos', label: 'Todas' }, { id: 'com_vinculo', label: 'Com vínculo' }, { id: 'sem_vinculo', label: 'Sem vínculo' }].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => onEmbarqueLinkFilterChange?.(mode.id)}
                    className={`w-full text-left px-3 py-2.5 rounded text-xs font-medium transition-colors ${
                      embarqueLinkFilter === mode.id
                        ? 'bg-card text-foreground dark:text-foreground shadow-sm ring-1 ring-border/40 dark:ring-border/40'
                        : 'bg-muted text-foreground/90 dark:text-muted-foreground hover:bg-muted dark:hover:bg-primary/90'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-border/40 pt-4">
              <button
                onClick={() => {
                  onSimulationDateChange(format(new Date(), 'yyyy-MM-dd'));
                  setOpen(false);
                }}
                className="w-full text-xs px-3 py-2.5 rounded bg-muted text-foreground/90 font-medium hover:bg-muted dark:hover:bg-primary/90 transition-colors"
              >
                Ir para Hoje
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}