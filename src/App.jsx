import React, { Suspense } from 'react'
import './App.css'
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { FLARE_AND_INSPECTION_UI_ENABLED } from '@/config/devToolsFlags';
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { NavigationTransitionProvider } from '@/lib/NavigationTransitionContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ModoFlareProvider from '@/features/modo-flare/ModoFlareProvider';
import CatalogOverlay from '@/features/catalog-overlay/CatalogOverlay';
import LoginPage from '@/components/auth/LoginPage';
import AuthCallbackPage from '@/components/auth/AuthCallbackPage';
import AtivarAcessoPage from '@/components/auth/AtivarAcessoPage';
import GlobalQuickAccessLaunchers from '@/components/global/GlobalQuickAccessLaunchers';
import { PageLoadFallback, ChunkErrorBoundary } from '@/lib/lazyPage';

const { Pages, Layout, mainPage } = pagesConfig;
const MainPage = Pages[mainPage] ?? Pages.Home;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AUTH_PUBLIC_PATHS = new Set(['/login', '/auth/callback', '/ativar-acesso']);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, p38NeedsBootstrap, mustActivateAccess } = useAuth();
  const location = useLocation();

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

  if (
    authError?.type === 'auth_required' &&
    !AUTH_PUBLIC_PATHS.has(location.pathname)
  ) {
    const returnPath = `${location.pathname}${location.search}`;
    const loginTo =
      returnPath && returnPath !== '/'
        ? `/login?returnUrl=${encodeURIComponent(returnPath)}`
        : '/login';
    return <Navigate to={loginTo} replace />;
  }

  if (p38NeedsBootstrap && location.pathname !== '/ativar-acesso') {
    return <Navigate to="/ativar-acesso?mode=bootstrap" replace />;
  }

  if (mustActivateAccess && location.pathname !== '/ativar-acesso') {
    return <Navigate to="/ativar-acesso" replace />;
  }

  return (
    <>
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoadFallback />}>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/ativar-acesso" element={<AtivarAcessoPage />} />
          <Route
            path="/"
            element={
              <LayoutWrapper currentPageName={mainPage}>
                {MainPage ? <MainPage /> : null}
              </LayoutWrapper>
            }
          />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
        </Suspense>
      </ChunkErrorBoundary>
      <GlobalQuickAccessLaunchers />
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <NavigationTransitionProvider>
          <Router>
            {FLARE_AND_INSPECTION_UI_ENABLED ? (
              <ModoFlareProvider>
                <NavigationTracker />
                <AuthenticatedApp />
                <CatalogOverlay />
              </ModoFlareProvider>
            ) : (
              <>
                <NavigationTracker />
                <AuthenticatedApp />
              </>
            )}
          </Router>
          <Toaster />
          {FLARE_AND_INSPECTION_UI_ENABLED ? <VisualEditAgent /> : null}
        </NavigationTransitionProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
