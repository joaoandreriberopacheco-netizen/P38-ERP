import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import usePullToRefresh, { usePullToRefreshScrollRoot } from '@/components/utils/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';

/**
 * Área de scroll com pull-to-refresh (mobile).
 * Aceita scrollRef externo para lógica que depende do contentor (ex.: cabeçalho fixo).
 */
export default function PullToRefreshScrollArea({
  onRefresh,
  children,
  className,
  style,
  scrollRef,
  ...rest
}) {
  const { scrollRoot, bindScrollRoot } = usePullToRefreshScrollRoot();
  const enabled = typeof onRefresh === 'function';
  const { isRefreshing, pullDistance } = usePullToRefresh(onRefresh, {
    scrollRoot: enabled ? scrollRoot : null,
  });

  const setScrollRef = useCallback(
    (node) => {
      if (scrollRef) scrollRef.current = node;
      if (enabled) bindScrollRoot(node);
    },
    [scrollRef, bindScrollRoot, enabled],
  );

  return (
    <div
      ref={enabled || scrollRef ? setScrollRef : undefined}
      className={cn('relative', className)}
      style={style}
      {...rest}
    >
      {enabled ? (
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      ) : null}
      <div
        style={
          enabled && pullDistance > 0
            ? {
                transform: `translateY(${pullDistance}px)`,
                transition: 'transform 0.2s ease',
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
