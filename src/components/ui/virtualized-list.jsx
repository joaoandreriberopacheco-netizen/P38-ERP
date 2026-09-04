import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/components/utils';

const DEFAULT_OVERSCAN = 8;

export function VirtualizedList({
  items,
  estimateSize = 120,
  getItemKey,
  renderItem,
  className,
  contentClassName,
  itemClassName,
  overscan = DEFAULT_OVERSCAN,
  emptyFallback = null,
}) {
  const parentRef = useRef(null);
  const safeItems = Array.isArray(items) ? items : [];
  const virtualizer = useVirtualizer({
    count: safeItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (index) => getItemKey?.(safeItems[index], index) ?? safeItems[index]?.id ?? index,
    overscan,
    measureElement:
      typeof window !== 'undefined'
        ? (element) => element?.getBoundingClientRect().height ?? estimateSize
        : undefined,
  });

  if (safeItems.length === 0) {
    return (
      <div ref={parentRef} className={cn('overflow-y-auto', className)}>
        {emptyFallback}
      </div>
    );
  }

  return (
    <div ref={parentRef} className={cn('overflow-y-auto', className)}>
      <div
        className={cn('relative w-full', contentClassName)}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = safeItems[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={cn('absolute left-0 top-0 w-full', itemClassName)}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
