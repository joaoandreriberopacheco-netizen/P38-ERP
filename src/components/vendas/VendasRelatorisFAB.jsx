import React, { useState } from 'react';
import { Lightbulb, FileText, TrendingUp, DollarSign, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createPageUrl } from '@/components/utils';

const RELATORIOS = [
  { icon: TrendingUp, label: 'Performance', description: 'Análise de desempenho de vendas', page: 'RelatorioPerformance' },
  { icon: DollarSign, label: 'Margem', description: 'Margem de lucro por produto', page: 'RelatorioMargem' },
  { icon: FileText, label: 'Vendas', description: 'Relatório detalhado de vendas', page: 'Relatorios' },
];

export default function VendasRelatorisFAB() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[54] bg-black/20 backdrop-blur-[2px]"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed right-4 z-[55] flex flex-col-reverse items-end gap-2 p38-bottom-fab1 lg:bottom-6 lg:right-6">
        {/* FAB Principal */}
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
            isExpanded
              ? 'bg-muted text-foreground rotate-45 dark:bg-muted dark:text-foreground'
              : 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]'
          }`}
          title="Relatórios de Vendas"
        >
          {isExpanded ? <X className="w-6 h-6" /> : <Lightbulb className="w-6 h-6" />}
        </button>

        {/* Botão único para abrir dialog */}
        {isExpanded && (
          <button
            onClick={() => { setShowDialog(true); setIsExpanded(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium whitespace-nowrap active:scale-95 transition-all flex-shrink-0 bg-card dark:bg-muted text-foreground/90 hover:bg-muted dark:hover:bg-muted"
            style={{
              animation: `fadeSlideUp 0.18s ease both`,
              animationDelay: `0ms`,
            }}
            title="Ver relatórios"
          >
            <FileText className="w-5 h-5" />
            Relatórios
          </button>
        )}
      </div>

      {/* Dialog de Relatórios */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md bg-card border-0">
          <DialogHeader>
            <DialogTitle className="font-glacial text-foreground">Relatórios de Vendas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {RELATORIOS.map((rel, idx) => {
              const Icon = rel.icon;
              return (
                <a
                  key={idx}
                  href={createPageUrl(rel.page)}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = createPageUrl(rel.page);
                    setShowDialog(false);
                  }}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-muted dark:group-hover:bg-muted transition-colors">
                    <Icon className="w-5 h-5 text-foreground/90" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm">{rel.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{rel.description}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                </a>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}