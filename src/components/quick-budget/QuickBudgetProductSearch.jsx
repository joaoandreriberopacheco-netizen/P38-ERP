import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';
import { Input } from '@/components/ui/input';
import { P38_SEARCH } from '@/components/financeiro/fluxo/financeiroP38';
import { cn } from '@/lib/utils';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { formatEstoqueDisponivelLabel } from '@/lib/productUnits';
import { PrecoVendaTabelaLinhas } from './quickBudgetUtils';
import { shouldSuppressProductRowActivation } from '@/lib/produtoGaleriaGuard';

export default function QuickBudgetProductSearch({
  inputRef,
  query,
  onQueryChange,
  produtos,
  tabelaPreco,
  onAddProduct,
  onSubmitFirstResult,
  /** Lista ocupa o espaço disponível (PDV / orçamento FAB / tabela). */
  expanded = true,
  className,
}) {
  const resultados = useMemo(() => {
    if (!query?.trim()) return [];
    return filterAndSortProducts(produtos, query);
  }, [produtos, query]);

  const shouldShowResults = query?.trim().length > 0;

  const handleSelectProduct = (produto) => {
    if (shouldSuppressProductRowActivation()) return;
    onAddProduct(produto);
  };

  const thumbSize = expanded ? 'md' : 'xs';
  const rowPadding = expanded ? 'px-4 py-4' : 'px-4 py-3';

  return (
    <div className={cn(expanded ? 'flex flex-col flex-1 min-h-0 h-full' : 'space-y-3', className)}>
      <div className="relative flex-shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          variant="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && resultados[0]) {
              e.preventDefault();
              onSubmitFirstResult?.(resultados[0]);
            }
          }}
          placeholder="Nome ou código (espaço ou ; para combinar termos)..."
          className={cn('h-14 md:h-12 pl-11 pr-4 rounded-2xl text-base md:text-sm', P38_SEARCH)}
        />
      </div>

      {shouldShowResults && (
        <div
          className={cn(
            'mt-3 rounded-2xl bg-card dark:bg-background shadow-lg border border-border/40 dark:border-border/40 overflow-hidden flex flex-col',
            expanded ? 'flex-1 min-h-0' : 'max-h-[min(40vh,20rem)]',
          )}
        >
          {resultados.length > 0 && (
            <div className="flex-shrink-0 px-4 py-3 border-b border-border/40 dark:border-border/40 bg-card dark:bg-background">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {resultados.length} resultado{resultados.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className={cn('overflow-y-auto', expanded ? 'flex-1 min-h-0' : 'max-h-[min(40vh,20rem)]')}>
            {resultados.map((produto) => (
              <div
                key={produto.id}
                className={cn(
                  'w-full flex items-start gap-4 border-b border-border/30 dark:border-border/40 last:border-b-0',
                  rowPadding,
                )}
              >
                <ProdutoThumb
                  produto={produto}
                  tabelaPreco={tabelaPreco}
                  size={thumbSize}
                  roundedClassName="rounded-xl"
                  asDiv
                />
                <button
                  type="button"
                  onClick={() => handleSelectProduct(produto)}
                  className="flex-1 min-w-0 text-left hover:bg-muted/40 dark:hover:bg-muted/60 transition-colors rounded-xl -my-1 py-1 px-1"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-medium text-foreground break-words leading-snug',
                        expanded ? 'text-base' : 'text-sm',
                      )}>
                        {produto.nome}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Estoque: {formatEstoqueDisponivelLabel(produto)}</span>
                        {produto.codigo_interno && (
                          <span className="font-mono text-[10px] tracking-wide text-muted-foreground/80">
                            #{produto.codigo_interno}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 self-center">
                      <PrecoVendaTabelaLinhas
                        produto={produto}
                        tabelaPreco={tabelaPreco}
                        variant="quickBudget"
                        finalClassName={cn(
                          'font-bold text-foreground tabular-nums',
                          expanded ? 'text-base' : 'text-sm',
                        )}
                        labelBottom={false}
                      />
                    </div>
                  </div>
                </button>
              </div>
            ))}

            {resultados.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
