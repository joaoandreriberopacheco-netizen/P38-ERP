import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { cn } from '@/components/utils';
import {
  CATALOG_SOMENTE_POSITIVOS_QUANTIDADE,
  isSomentePositivosFilter,
} from '@/lib/filterProdutos';
import { PRODUTOS_FILTER_OPEN, PRODUTOS_ICON_BTN } from '@/lib/produtosP38Theme';

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
        'h-10 w-10 flex-shrink-0 rounded-xl',
        PRODUTOS_ICON_BTN,
        active && PRODUTOS_FILTER_OPEN,
        active && 'text-[#a8942e] dark:text-[#a4ce33]',
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
