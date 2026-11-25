import { useState } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Files,
  List,
  Smartphone,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/utils';
import { P38_POPOVER } from '@/components/financeiro/fluxo/financeiroP38';
import { dataHoje } from '@/components/utils/dateUtils';
import { formatCompetenciaLabel, shiftCompetencia } from '@/lib/budgetCalculos';
import { toast } from 'sonner';
import {
  COMPRAS_RELATORIOS,
  VERSAO_FLUXO_ORGANICO_ENCOMENDA,
  gerarComprasRelatorioPdf,
  normalizarCompetenciaRelatorioMes,
} from '@/lib/comprasRelatorioPedidos';

const ICON_BTN =
  'relative flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-sm hover:shadow-md transition text-foreground/90';

const ICON_MAP = {
  spreadsheet: FileSpreadsheet,
  files: Files,
  list: List,
  smartphone: Smartphone,
};

function competenciaMesInicial() {
  return dataHoje().slice(0, 7);
}

export default function ComprasRelatoriosMenu({
  pedidos = [],
  grupos = [],
  filtrosDesc,
  kpis = {},
  className = '',
  produtosMap = {},
  groupBy = 'eta_transportadora',
  sortOrder = 'asc',
}) {
  const [gerando, setGerando] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [fluxoDialogOpen, setFluxoDialogOpen] = useState(false);
  const [fluxoCompetencia, setFluxoCompetencia] = useState(competenciaMesInicial);

  const gerarRelatorio = async (version, competencia) => {
    setGerando(version);
    toast.loading('Gerando relatório...', { id: 'gerando-relatorio-compras' });
    try {
      await gerarComprasRelatorioPdf({
        version,
        pedidos,
        grupos,
        filtrosDesc,
        kpis,
        produtosMap,
        groupBy,
        sortOrder,
        competencia,
        onProgress: (msg) => toast.loading(msg, { id: 'gerando-relatorio-compras' }),
      });
      toast.success('Relatório gerado com sucesso', { id: 'gerando-relatorio-compras' });
    } catch (error) {
      const msg = error?.message || String(error);
      toast.error('Erro ao gerar relatório', {
        id: 'gerando-relatorio-compras',
        description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
      });
      console.error(error);
    } finally {
      setGerando(null);
    }
  };

  const handleGerar = async (version) => {
    if (version === VERSAO_FLUXO_ORGANICO_ENCOMENDA) {
      setPopoverOpen(false);
      setFluxoCompetencia(competenciaMesInicial());
      setFluxoDialogOpen(true);
      return;
    }
    await gerarRelatorio(version);
  };

  const confirmarFluxoOrganico = async () => {
    const competencia = normalizarCompetenciaRelatorioMes(fluxoCompetencia);
    setFluxoDialogOpen(false);
    await gerarRelatorio(VERSAO_FLUXO_ORGANICO_ENCOMENDA, competencia);
  };

  const onFluxoMonthInput = (event) => {
    const next = event.target.value;
    if (next) setFluxoCompetencia(normalizarCompetenciaRelatorioMes(next));
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(ICON_BTN, gerando && 'opacity-80', className)}
            title="Relatórios PDF"
            aria-label="Relatórios PDF dos pedidos filtrados"
          >
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className={cn('w-72 p-2', P38_POPOVER)} align="end" sideOffset={6}>
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Relatórios (filtro atual)</p>
          <div className="max-h-[min(60vh,22rem)] overflow-y-auto">
            {COMPRAS_RELATORIOS.map(({ version, label, icon, title }) => {
              const Icon = ICON_MAP[icon] || FileSpreadsheet;
              const loading = gerando === version;
              return (
                <button
                  key={version}
                  type="button"
                  disabled={!!gerando}
                  title={title || label}
                  onClick={() => handleGerar(version)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm text-foreground hover:bg-muted/60 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="leading-snug">{label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={fluxoDialogOpen} onOpenChange={setFluxoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mês da análise</DialogTitle>
            <DialogDescription>
              Vendas e compras (aprovação financeira) entram pelo mês civil escolhido. Estoque final no PDF
              continua sendo o cadastro de hoje.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Mês anterior"
                disabled={!!gerando}
                onClick={() => setFluxoCompetencia((c) => shiftCompetencia(c, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="month"
                value={fluxoCompetencia}
                onChange={onFluxoMonthInput}
                disabled={!!gerando}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Competência mês e ano"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Próximo mês"
                disabled={!!gerando}
                onClick={() => setFluxoCompetencia((c) => shiftCompetencia(c, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {formatCompetenciaLabel(fluxoCompetencia)}
              {fluxoCompetencia === competenciaMesInicial() ? ' · mês corrente' : ''}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFluxoDialogOpen(false)} disabled={!!gerando}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmarFluxoOrganico} disabled={!!gerando}>
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
