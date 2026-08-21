/** Nível visual "todos" no seletor de profundidade da árvore (catálogo / margem). */
import { PRODUTOS_LEVEL_ACTIVE } from '@/lib/produtosP38Theme';
import { cn } from '@/components/utils';

export const TREE_GRID_EXPAND_ALL_LEVEL = 99;

export function LevelControl({ level, onChange }) {
  const levels = [
    { value: 1, label: '1', title: 'Mostrar apenas famílias principais' },
    { value: 2, label: '2', title: 'Expandir até o 2º nível' },
    { value: 3, label: '3', title: 'Expandir até o 3º nível' },
    { value: 4, label: '4', title: 'Expandir até o 4º nível' },
    { value: TREE_GRID_EXPAND_ALL_LEVEL, label: 'todos', title: 'Expandir todos os níveis' },
  ];

  return (
    <div className="flex items-center gap-1 select-none">
      <span className="text-[10px] text-muted-foreground mr-1">nível</span>
      {levels.map(({ value, label, title }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          title={title}
          className={cn(
            'min-w-[24px] h-6 px-1.5 rounded text-[10px] font-semibold transition-colors',
            level === value
              ? PRODUTOS_LEVEL_ACTIVE
              : 'bg-muted text-muted-foreground hover:bg-muted/80 dark:hover:bg-primary/90',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
