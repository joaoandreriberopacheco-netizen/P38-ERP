import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Calendar, Sliders } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import FluvialFiltersSheetContent from '@/components/logistica-sandbox/FluvialFiltersSheetContent';

export default function FluvialFAB({
  viewMode,
  onViewModeChange,
  simulationDate,
  onSimulationDateChange,
  periodoFiltro = '30d',
  onPeriodoFiltroChange,
  embarqueLinkFilter = 'todos',
  onEmbarqueLinkFilterChange,
  totalViagens = 0,
  totalCarregadas = 0,
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-sm transition-shadow hover:shadow-md dark:bg-muted dark:text-muted-foreground pdv-button-static p38-bottom-fab1"
        aria-label="Filtros da timeline"
      >
        <Sliders className="w-5 h-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-background border-t border-border/40 max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">Filtros da timeline</SheetTitle>
          </SheetHeader>
          <div className="pt-4 space-y-4">
            <FluvialFiltersSheetContent
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              periodoFiltro={periodoFiltro}
              onPeriodoFiltroChange={onPeriodoFiltroChange}
              embarqueLinkFilter={embarqueLinkFilter}
              onEmbarqueLinkFilterChange={onEmbarqueLinkFilterChange}
              totalViagens={totalViagens}
              totalCarregadas={totalCarregadas}
            />

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
