import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { DIZIMO_MODOS, labelModoDedutivel } from '@/lib/dizimoCalculos';
import DedutibilidadeBlocoToggle from '@/components/financeiro/dizimo/DedutibilidadeBlocoToggle';
import { P38StatusPill } from '@/components/ui/p38-mobile-line';

function resumoDedutibilidade(item) {
  const modo = item.config?.modo || DIZIMO_MODOS.TOTAL;
  if (modo === DIZIMO_MODOS.PARCIAL) {
    return `${item.config.percentual}% entra na base do dízimo`;
  }
  if (modo === DIZIMO_MODOS.NAO_DEDUTIVEL) {
    return 'Não entra no cálculo do lucro líquido operacional';
  }
  return '100% entra na base do dízimo';
}

export default function DizimoItemDedutibilidadeDrawer({ item, open, onOpenChange, onConfigChange }) {
  if (!item) return null;

  const modo = item.config?.modo || DIZIMO_MODOS.TOTAL;
  const pillTone =
    modo === DIZIMO_MODOS.NAO_DEDUTIVEL ? 'muted' : modo === DIZIMO_MODOS.PARCIAL ? 'info' : 'success';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border/40 pb-3 text-left">
          <DrawerTitle className="text-base font-semibold leading-snug pr-4">{item.nome}</DrawerTitle>
          <p className="text-sm text-muted-foreground tabular-nums mt-1">
            Planejado: {formatFinanceiroValor(item.valorBruto)}
          </p>
        </DrawerHeader>

        <div className="px-4 pb-8 pt-4 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Na base do dízimo</p>
              <p className="text-lg font-semibold tabular-nums mt-0.5">
                {formatFinanceiroValor(item.valorDedutivel)}
              </p>
            </div>
            <P38StatusPill tone={pillTone}>{labelModoDedutivel(modo)}</P38StatusPill>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dedutibilidade</p>
            <DedutibilidadeBlocoToggle
              value={item.config}
              onChange={onConfigChange}
              fullWidth
            />
            <p className="text-xs text-muted-foreground leading-relaxed">{resumoDedutibilidade(item)}</p>
          </div>

          {item.categoria ? (
            <p className="text-xs text-muted-foreground">
              Categoria: <span className="text-foreground/80">{item.categoria}</span>
            </p>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
