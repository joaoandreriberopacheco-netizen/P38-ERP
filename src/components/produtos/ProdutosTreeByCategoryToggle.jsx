import { Switch } from '@/components/ui/switch';
import { cn } from '@/components/utils';
import { PRODUTOS_TOGGLE_SHELL } from '@/lib/produtosP38Theme';

/** Agrupa a Tree Grid (e o PDF de estoque) por categoria de cadastro. */
export default function ProdutosTreeByCategoryToggle({ checked, onChange, className = '' }) {
  return (
    <label
      className={cn(PRODUTOS_TOGGLE_SHELL, className)}
      title={checked ? 'Agrupado por categoria de cadastro' : 'Agrupado pela hierarquia do nome do produto'}
    >
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="scale-[0.72] data-[state=checked]:bg-[#e8b824]/80 dark:data-[state=checked]:bg-[#a4ce33]"
      />
      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
        Por categoria
      </span>
    </label>
  );
}
