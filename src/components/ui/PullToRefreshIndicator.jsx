import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Indicador visual do gesto pull-to-refresh (mobile).
 */
export default function PullToRefreshIndicator({ pullDistance = 0, isRefreshing = false, className = '' }) {
  return (
    <div
      className={`md:hidden absolute left-0 right-0 flex items-center justify-center transition-all duration-150 z-20 pointer-events-none ${className}`}
      style={{ top: -40 + pullDistance, opacity: pullDistance > 20 || isRefreshing ? 1 : 0 }}
      aria-hidden={!isRefreshing && pullDistance <= 20}
    >
      <div className="flex items-center gap-2 bg-card shadow-sm rounded-full px-3 py-1.5 text-xs text-muted-foreground border border-border/40">
        <RefreshCw
          className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-500' : 'text-muted-foreground'}`}
        />
        <span>{isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}</span>
      </div>
    </div>
  );
}
