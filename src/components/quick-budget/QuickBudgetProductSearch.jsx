import React, { useMemo } from 'react';
import { Search } from 'lucide-react';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';
import { Input } from '@/components/ui/input';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { formatEstoqueDisponivelLabel } from '@/lib/productUnits';
import { PrecoVendaTabelaLinhas } from './quickBudgetUtils';

export default function QuickBudgetProductSearch({ inputRef, query, onQueryChange, produtos, tabelaPreco, onAddProduct, onSubmitFirstResult }) {
  const resultados = useMemo(() => {
    if (!query?.trim()) return [];
    return filterAndSortProducts(produtos, query);
  }, [produtos, query]);

  const shouldShowResults = query?.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="relative">
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
          className="h-14 md:h-12 pl-11 pr-4 border-0 bg-muted/50 rounded-2xl shadow-sm text-base md:text-sm"
        />
      </div>

      {shouldShowResults && (
        <div className="space-y-2 max-h-[min(40vh,20rem)] overflow-y-auto pr-1 pb-1">
          {resultados.map((produto) => (
            <button
              key={produto.id}
              type="button"
              onClick={() => onAddProduct(produto)}
              className="w-full rounded-2xl bg-card shadow-sm px-4 py-3 text-left hover:bg-muted/40 dark:hover:bg-muted transition-colors"
            >
              <div className="flex items-start gap-3">
                <ProdutoThumb produto={produto} size="xs" roundedClassName="rounded-2xl" asDiv />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground break-words">{produto.nome}</p>
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
                    finalClassName="text-sm font-bold text-foreground tabular-nums"
                    labelBottom={false}
                  />
                </div>
              </div>
            </button>
          ))}

          {resultados.length === 0 && (
            <div className="rounded-2xl bg-card shadow-sm px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}