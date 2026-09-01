import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { DIZIMO_MODOS, labelModoDedutivel } from '@/lib/dizimoCalculos';

const OPCOES = [
  DIZIMO_MODOS.TOTAL,
  DIZIMO_MODOS.PARCIAL,
  DIZIMO_MODOS.NAO_DEDUTIVEL,
];

export default function DedutibilidadeBlocoToggle({ value, onChange, className }) {
  const modo = value?.modo || DIZIMO_MODOS.TOTAL;
  const percentual = value?.percentual ?? 50;

  const setModo = (nextModo) => {
    onChange?.({
      modo: nextModo,
      percentual: nextModo === DIZIMO_MODOS.PARCIAL ? (percentual || 50) : 100,
    });
  };

  const setPercentual = (next) => {
    const n = Math.min(100, Math.max(0, Number(next) || 0));
    onChange?.({ modo: DIZIMO_MODOS.PARCIAL, percentual: n });
  };

  return (
    <div className={cn('flex flex-col gap-2 sm:items-end', className)}>
      <div className={cn('inline-flex rounded-xl p-1', P38_FIELD_SURFACE)}>
        {OPCOES.map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => setModo(opcao)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap',
              modo === opcao
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {labelModoDedutivel(opcao)}
          </button>
        ))}
      </div>

      {modo === DIZIMO_MODOS.PARCIAL ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Deduzir</span>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={percentual}
            onChange={(e) => setPercentual(e.target.value)}
            className="h-8 w-16 text-center tabular-nums rounded-lg"
          />
          <span>% do bloco</span>
        </div>
      ) : null}
    </div>
  );
}
