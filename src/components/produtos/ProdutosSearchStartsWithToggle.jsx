import { Switch } from '@/components/ui/switch';
import { cn } from '@/components/utils';
import { PRODUTOS_TOGGLE_SHELL } from '@/lib/produtosP38Theme';

/** Toggle "Começa com" ao lado da busca do catálogo. */
export default function ProdutosSearchStartsWithToggle({ checked, onChange, className = '' }) {
  return (
    <label
      className={cn(PRODUTOS_TOGGLE_SHELL, className)}
      title={checked ? 'Busca pelo início do texto' : 'Busca em qualquer parte do texto'}
    >
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="scale-[0.72] data-[state=checked]:bg-[#f07a1a]/80 dark:data-[state=checked]:bg-[#a4ce33]"
      />
      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
        Começa com
      </span>
    </label>
  );
}
