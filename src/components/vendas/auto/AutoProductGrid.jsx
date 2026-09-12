import { useMemo } from 'react';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { useViewport } from '@/hooks/use-breakpoint';
import AutoProductCard from './AutoProductCard';
import { chunkForGrid } from './autoAtendimentoUi';

function gridColumnsForViewport(breakpoint) {
  if (breakpoint === 'phone') return 2;
  if (breakpoint === 'tablet') return 3;
  return 4;
}

/** Altura estimada de uma linha de cartões (aspect-square + texto). */
function estimateRowHeight(breakpoint) {
  if (breakpoint === 'phone') return 268;
  if (breakpoint === 'tablet') return 248;
  return 228;
}

export default function AutoProductGrid({ products, onSelect, emptyFallback }) {
  const { breakpoint } = useViewport();
  const columns = gridColumnsForViewport(breakpoint);
  const rows = useMemo(() => chunkForGrid(products, columns), [products, columns]);
  const rowEstimate = estimateRowHeight(breakpoint);

  return (
    <VirtualizedList
      items={rows}
      estimateSize={rowEstimate}
      overscan={3}
      getItemKey={(row, index) => row?.[0]?.id ?? `row-${index}`}
      className="flex-1 min-h-0"
      emptyFallback={emptyFallback}
      renderItem={(rowProducts) => (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-3">
          {rowProducts.map((product) => (
            <AutoProductCard key={product.id} product={product} onClick={onSelect} />
          ))}
        </div>
      )}
    />
  );
}
