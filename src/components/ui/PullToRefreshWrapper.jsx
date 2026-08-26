import React from 'react';
import usePullToRefresh, { usePullToRefreshScrollRoot } from '@/components/utils/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';

/**
 * Wrap a scrollable list with pull-to-refresh on mobile.
 * Usage: <PullToRefreshWrapper onRefresh={loadData}> ... </PullToRefreshWrapper>
 */
export default function PullToRefreshWrapper({ onRefresh, children, className = '' }) {
  const { scrollRoot, bindScrollRoot } = usePullToRefreshScrollRoot();
  const { isRefreshing, pullDistance } = usePullToRefresh(onRefresh, { scrollRoot });

  return (
    <div ref={bindScrollRoot} className={`relative overflow-auto ${className}`}>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.2s ease' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
