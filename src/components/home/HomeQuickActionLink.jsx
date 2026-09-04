import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { prefetchP38Page } from '@/next/prefetchP38Route';

export default function HomeQuickActionLink({ action }) {
  const Icon = action.icon;
  const href = createPageUrl(action.page);

  return (
    <Link
      to={href}
      onPointerEnter={() => prefetchP38Page(action.page)}
      onTouchStart={() => prefetchP38Page(action.page)}
      className="bg-card rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-sm border border-border/40 hover:shadow-md transition-all active:scale-95 touch-manipulation"
      style={{ minHeight: '100px' }}
    >
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shadow-sm">
        <Icon className="w-6 h-6 text-foreground/80" strokeWidth={2} />
      </div>
      <span className="text-xs font-medium text-foreground text-center leading-tight">
        {action.label}
      </span>
    </Link>
  );
}

export function HomeSalesSummaryLazy() {
  const Lazy = React.lazy(() => import('@/components/home/HomeSalesSummary'));
  return (
    <Suspense
      fallback={
        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border/40 animate-pulse h-[148px]" />
      }
    >
      <Lazy />
    </Suspense>
  );
}

export function HomeAlertsPanelLazy(props) {
  const Lazy = React.lazy(() => import('@/components/home/HomeAlertsPanel'));
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
