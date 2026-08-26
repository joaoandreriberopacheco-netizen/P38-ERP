import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import usePullToRefresh, { usePullToRefreshScrollRoot } from '@/components/utils/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';

/**
 * Área de scroll com pull-to-refresh (mobile).
 * Aceita scrollRef externo para lógica que depende do contentor (ex.: cabeçalho fixo).
 * Conteúdo fica directo no scroll container — sem wrapper intermédio que quebra flex/overflow.
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
      {children}
    </div>
  );
}
