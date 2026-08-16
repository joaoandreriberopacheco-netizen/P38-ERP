import { useMemo } from 'react';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import AutoProductCard from './AutoProductCard';
import { chunkForGrid } from './autoAtendimentoUi';

const COLS_BY_BREAKPOINT = 4;

export default function AutoProductGrid({ products, onSelect, emptyFallback }) {
  const rows = useMemo(() => chunkForGrid(products, COLS_BY_BREAKPOINT), [products]);

  return (
    <VirtualizedList
      items={rows}
      estimateSize={196}
      overscan={4}
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
