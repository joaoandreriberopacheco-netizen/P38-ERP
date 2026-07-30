'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { NavigationTransitionProvider } from '@/lib/NavigationTransitionContext';
import { ChunkErrorBoundary, PageLoadFallback } from '@/lib/lazyPage';
import PageNotFound from '@/lib/PageNotFound';
import DeferredMount from '@/lib/DeferredMount';
import { P38_PAGE_LOADERS } from '@/next/pageRegistry.generated';

const Layout = dynamic(() => import('@/Layout'), {
  ssr: false,
  loading: () => <PageLoadFallback />,
});

const NavigationTracker = dynamic(() => import('@/lib/NavigationTracker'), {
  ssr: false,
});

const GlobalQuickAccessLaunchers = dynamic(
  () => import('@/components/global/GlobalQuickAccessLaunchers'),
  { ssr: false },
);

/**
 * Renderiza uma página Vite (`src/pages/*.jsx`) dentro do Layout P38 no Next.
 */
export default function P38NextRoutePage({ pageName }) {
  const router = useRouter();
  const {
    isLoadingAuth,
    isLoadingPublicSettings,
    isAuthenticated,
    authError,
    p38NeedsBootstrap,
    mustActivateAccess,
  } = useAuth();

  const loader = P38_PAGE_LOADERS[pageName];

  const PageComponent = useMemo(() => {
    if (!loader) return null;
    return dynamic(loader, {
      ssr: false,
      loading: () => <PageLoadFallback />,
    });
  }, [loader, pageName]);

  useEffect(() => {
    if (isLoadingPublicSettings || isLoadingAuth) {
      void import('@/Layout');
    }
  }, [isLoadingAuth, isLoadingPublicSettings]);

  useEffect(() => {
    if (isLoadingPublicSettings || isLoadingAuth) return;

    if (authError?.type === 'auth_required' && !isAuthenticated) {
      const returnPath =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/';
      const loginTo =
        returnPath && returnPath !== '/'
          ? `/login?returnUrl=${encodeURIComponent(returnPath)}`
          : '/login';
      router.replace(loginTo);
      return;
    }

    if (p38NeedsBootstrap) {
      router.replace('/ativar-acesso?mode=bootstrap');
      return;
    }

    if (mustActivateAccess) {
      router.replace('/ativar-acesso');
    }
  }, [
    authError,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    mustActivateAccess,
    p38NeedsBootstrap,
    router,
  ]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        A carregar…
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (authError?.type === 'auth_required' && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        A redirecionar para login…
      </div>
    );
  }

  if (!PageComponent) {
    return (
      <Layout currentPageName={pageName}>
        <PageNotFound />
      </Layout>
    );
  }

  const ResolvedPage = PageComponent;

  return (
    <NavigationTransitionProvider>
      <NavigationTracker />
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoadFallback />}>
          <Layout currentPageName={pageName}>
            <ResolvedPage />
          </Layout>
        </Suspense>
      </ChunkErrorBoundary>
      <DeferredMount waitForIdle>
        <GlobalQuickAccessLaunchers />
      </DeferredMount>
    </NavigationTransitionProvider>
  );
}
