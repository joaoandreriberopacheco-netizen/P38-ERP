import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sliders, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FluvialFiltersSheetContent from '@/components/logistica-sandbox/FluvialFiltersSheetContent';

export default function FluvialActionFab({
  onScrollToToday,
  viewMode,
  onViewModeChange,
  periodoFiltro = '30d',
  onPeriodoFiltroChange,
  embarqueLinkFilter = 'todos',
  onEmbarqueLinkFilterChange,
  totalViagens = 0,
  totalCarregadas = 0,
}) {
  const [open, setOpen] = useState(false);

  const handleScrollToToday = () => {
    onScrollToToday();
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-card text-foreground/90 shadow-lg transition-shadow hover:shadow-xl dark:bg-muted dark:text-muted-foreground p38-bottom-fab1"
        aria-label="Filtros da timeline"
      >
        <Sliders className="w-5 h-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm font-semibold">Filtros da timeline</SheetTitle>
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

            <Button
              onClick={handleScrollToToday}
              variant="outline"
              className="w-full justify-start gap-3 h-12 rounded-2xl"
            >
              <Calendar className="w-5 h-5" />
              <span>Ir para Hoje</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
