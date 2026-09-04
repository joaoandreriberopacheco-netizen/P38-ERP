'use client';

import React, { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { NavigationTransitionProvider } from '@/lib/NavigationTransitionContext';
import { PageLoadFallback } from '@/lib/lazyPage';
import DeferredMount from '@/lib/DeferredMount';
import NavigationProgressBar from '@/next/NavigationProgressBar';
import { pageNameFromPath } from '@/next/prefetchP38Route';

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
 * Shell autenticado persistente — Layout não remonta entre cliques no menu/Home.
 */
export default function P38AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const currentPageName = pageNameFromPath(pathname);

  const {
    isLoadingAuth,
    isLoadingPublicSettings,
    isAuthenticated,
    authError,
    p38NeedsBootstrap,
    mustActivateAccess,
  } = useAuth();

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

  return (
    <NavigationTransitionProvider>
      <NavigationProgressBar />
      <NavigationTracker />
      <Suspense fallback={<PageLoadFallback />}>
        <Layout currentPageName={currentPageName}>{children}</Layout>
      </Suspense>
      <DeferredMount waitForIdle>
        <GlobalQuickAccessLaunchers />
      </DeferredMount>
    </NavigationTransitionProvider>
  );
}
