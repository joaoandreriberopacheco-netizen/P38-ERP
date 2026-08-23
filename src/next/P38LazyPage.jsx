'use client';

import React, { Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ChunkErrorBoundary, PageLoadFallback } from '@/lib/lazyPage';
import PageNotFound from '@/lib/PageNotFound';
import { P38_PAGE_LOADERS } from '@/next/pageRegistry.generated';

/**
 * Só o conteúdo da página — o shell (Layout, auth) vive em P38AppShell.
 */
export default function P38LazyPage({ pageName }) {
  const loader = P38_PAGE_LOADERS[pageName];

  const PageComponent = useMemo(() => {
    if (!loader) return null;
    return dynamic(loader, {
      ssr: false,
      loading: () => <PageLoadFallback />,
    });
  }, [loader, pageName]);

  if (!PageComponent) {
    return <PageNotFound />;
  }

  const ResolvedPage = PageComponent;

  return (
    <ChunkErrorBoundary>
      <div data-pulse-sensor={`${pageName}.shell`} className="w-full min-w-0">
        <Suspense fallback={<PageLoadFallback />}>
          <ResolvedPage />
        </Suspense>
      </div>
    </ChunkErrorBoundary>
  );
}
