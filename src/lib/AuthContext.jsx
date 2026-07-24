import * as React from 'react';
import { base44, p38 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { isSupabaseAuthEnabled } from '@/integrations/p38/providers';
import { fetchP38AuthStatus } from '@/functions/p38Auth';

const AuthContext = React.createContext();

const SUPABASE_PUBLIC_SETTINGS_STUB = Object.freeze({
  id: 'p38-supabase',
  public_settings: {
    auth_required: false,
    provider: 'supabase'
  }
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = React.useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = React.useState(true);
  const [authError, setAuthError] = React.useState(null);
  const [appPublicSettings, setAppPublicSettings] = React.useState(null); // Contains only { id, public_settings }
  const [p38NeedsBootstrap, setP38NeedsBootstrap] = React.useState(false);
  const [mustActivateAccess, setMustActivateAccess] = React.useState(false);

  React.useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      if (p38?.bypassBase44 || p38?.providerName === p38?.providers?.SUPABASE) {
        setAppPublicSettings(SUPABASE_PUBLIC_SETTINGS_STUB);
        setIsLoadingPublicSettings(false);
        if (isSupabaseAuthEnabled()) {
          await checkP38BootstrapStatus();
        }
        await checkUserAuth();
        return;
      }

      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      try {
        const headers = { 'X-App-Id': appParams.appId };
        if (appParams.token) headers['Authorization'] = `Bearer ${appParams.token}`;
        const res = await fetch(`${appParams.serverUrl}/api/apps/public/prod/public-settings/by-id/${appParams.appId}`, { headers });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const err = new Error(data?.message || 'Failed');
          err.status = res.status;
          err.data = data;
          throw err;
        }
        const publicSettings = await res.json();
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkP38BootstrapStatus = async () => {
    try {
      const status = await fetchP38AuthStatus();
      setP38NeedsBootstrap(Boolean(status?.needsBootstrap));
    } catch (err) {
      console.warn('[AuthContext] p38-auth status indisponível:', err?.message || err);
      setP38NeedsBootstrap(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await p38.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);

      const mustActivate =
        currentUser?.raw?.user_metadata?.must_activate === true &&
        currentUser?.raw?.user_metadata?.password_set !== true;
      setMustActivateAccess(mustActivate);

      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setMustActivateAccess(false);

      const needsSupabaseSession =
        isSupabaseAuthEnabled() &&
        (p38?.providerName === p38?.providers?.SUPABASE || p38?.bypassBase44);

      if (!needsSupabaseSession) {
        return;
      }

      if (typeof window !== 'undefined' && window.location.pathname === '/login') {
        return;
      }

      if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
        return;
      }

      if (typeof window !== 'undefined' && window.location.pathname === '/ativar-acesso') {
        return;
      }

      setAuthError({
        type: 'auth_required',
        message: 'Authentication required'
      });
    }
  };

  const navigateToLogin = React.useCallback(() => {
    try {
      base44.auth.redirectToLogin(window.location.href);
    } catch (err) {
      console.warn('redirectToLogin falhou; tentando fallback /login.', err);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  const logout = React.useCallback((shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setMustActivateAccess(false);

    try {
      if (shouldRedirect) {
        base44.auth.logout(window.location.href);
      } else {
        base44.auth.logout();
      }
    } catch (err) {
      console.warn('logout falhou; limpando estado local apenas.', err);
      if (shouldRedirect && typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }, []);

  const contextValue = React.useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      p38NeedsBootstrap,
      mustActivateAccess,
      logout,
      navigateToLogin,
      checkAppState,
    }),
    [
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      p38NeedsBootstrap,
      mustActivateAccess,
      logout,
      navigateToLogin,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};