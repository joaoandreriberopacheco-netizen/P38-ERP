import { useState } from 'react';
import { Package, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/components/utils';
import { PRODUTOS_ICON_BTN } from '@/lib/produtosP38Theme';

/**
 * Estoque virtual: soma pedidos em trânsito como se já tivessem chegado.
 * Protetor de gatilho — ativar exige confirmação rápida; desligar é imediato.
 */
export default function ProdutosEstoqueVirtualToggle({ filters, setFilters }) {
  const active = filters.estoqueVirtual === true;
  const [guardOpen, setGuardOpen] = useState(false);

  const desativar = () => {
    setGuardOpen(false);
    setFilters((prev) => ({ ...prev, estoqueVirtual: false }));
  };

  const ativar = () => {
    setGuardOpen(false);
    setFilters((prev) => ({ ...prev, estoqueVirtual: true }));
  };

  if (active) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-10 w-10 flex-shrink-0 rounded-xl',
          PRODUTOS_ICON_BTN,
          'text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/40 dark:ring-sky-400/40',
        )}
        onClick={desativar}
        title="Estoque virtual ligado — clique para voltar ao estoque físico"
        aria-pressed
        aria-label="Desativar estoque virtual"
      >
        <Package className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Popover open={guardOpen} onOpenChange={setGuardOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-10 w-10 flex-shrink-0 rounded-xl relative overflow-hidden', PRODUTOS_ICON_BTN)}
          title="Estoque virtual — incluir pedidos em trânsito"
          aria-label="Ativar estoque virtual"
        >
          <Package className="w-4 h-4 text-muted-foreground" />
          <span
            className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-card/90 py-0.5"
            aria-hidden
          >
            <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Estoque virtual</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Soma pedidos aprovados e em trânsito ao estoque, ponto futuro e filtros numéricos.
            Não é estoque físico — use para planejar compras, não para vender.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 flex-1 rounded-lg text-xs bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-500 dark:text-slate-950"
            onClick={ativar}
          >
            Ativar vista virtual
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg text-xs"
            onClick={() => setGuardOpen(false)}
          >
            Cancelar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
