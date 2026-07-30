import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { cn } from '@/components/utils';
import {
  CATALOG_SOMENTE_POSITIVOS_QUANTIDADE,
  isSomentePositivosFilter,
} from '@/lib/filterProdutos';

/** Atalho entre a busca e o painel de filtros: alterna todos vs. estoque positivo (> 0). */
export default function ProdutosSomentePositivosToggle({ filters, setFilters }) {
  const active = isSomentePositivosFilter(filters);

  const toggle = () => {
    if (active) {
      setFilters((prev) => ({
        ...prev,
        quantidadeOperador: 'all',
        quantidadeValor: '',
        quantidadeValorAte: '',
      }));
      return;
    }
    setFilters((prev) => ({
      ...prev,
      ...CATALOG_SOMENTE_POSITIVOS_QUANTIDADE,
    }));
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-10 w-10 flex-shrink-0 rounded-xl bg-muted',
        active && 'text-[#4a5240] dark:text-[#a4ce33] ring-2 ring-[#4a5240]/40 dark:ring-[#a4ce33]/40',
      )}
      onClick={toggle}
      title={
        active
          ? 'Somente com estoque positivo — clique para ver todos'
          : 'Somente produtos com estoque positivo'
      }
      aria-pressed={active}
      aria-label={
        active
          ? 'Filtro ativo: somente estoque positivo'
          : 'Ativar filtro: somente estoque positivo'
      }
    >
      <Globe
        className={cn('w-4 h-4', active ? 'text-current' : 'text-muted-foreground')}
      />
    </Button>
  );
}
