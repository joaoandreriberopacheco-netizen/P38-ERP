import { useState } from 'react';
import { Printer, FileSpreadsheet, Files, List, Smartphone, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/components/utils';
import { P38_POPOVER } from '@/components/financeiro/fluxo/financeiroP38';
import { toast } from 'sonner';
import { COMPRAS_RELATORIOS, gerarComprasRelatorioPdf } from '@/lib/comprasRelatorioPedidos';

const ICON_BTN =
  'relative flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-sm hover:shadow-md transition text-foreground/90';

const ICON_MAP = {
  spreadsheet: FileSpreadsheet,
  files: Files,
  list: List,
  smartphone: Smartphone,
};

export default function ComprasRelatoriosMenu({
  pedidos = [],
  grupos = [],
  filtrosDesc,
  kpis = {},
  className = '',
}) {
  const [gerando, setGerando] = useState(null);

  const handleGerar = async (version) => {
    setGerando(version);
    toast.loading('Gerando relatório...', { id: 'gerando-relatorio-compras' });
    try {
      await gerarComprasRelatorioPdf({
        version,
        pedidos,
        grupos,
        filtrosDesc,
        kpis,
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

  return (
    <Popover>
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
  );
}
