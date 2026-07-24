import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getSupabaseBrowserClient, waitForSupabaseSession } from '@/lib/supabaseBrowserClient';
import { isSupabaseAuthEnabled, isGoogleLoginEnabled } from '@/integrations/p38/providers';
import { safeAppReturnPath } from '@/lib/supabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * Login local (Supabase) quando `VITE_P38_USE_SUPABASE_AUTH=true`.
 * Rota explícita `/login` — não entra em `pages.config.js` para não duplicar URLs.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { checkAppState, isAuthenticated, isLoadingAuth } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(location.state?.flash || '');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const safeReturnPath = () => safeAppReturnPath(searchParams.get('returnUrl'));

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      navigate(safeReturnPath(), { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, navigate, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await base44.auth.login({ login: login.trim(), password });
      if (isSupabaseAuthEnabled()) {
        const supabase = getSupabaseBrowserClient();
        const session = await waitForSupabaseSession(supabase);
        if (!session) {
          throw new Error('Sessão não ficou disponível após o login. Tente novamente.');
        }
      }
      await checkAppState();
      navigate(safeReturnPath(), { replace: true });
    } catch (err) {
      setError(err?.message || 'Falha ao iniciar sessão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      if (typeof base44.auth.loginWithGoogle !== 'function') {
        throw new Error('Login com Google não está disponível nesta versão.');
      }
      await base44.auth.loginWithGoogle(safeReturnPath());
    } catch (err) {
      setError(err?.message || 'Não foi possível iniciar login com Google.');
      setGoogleLoading(false);
    }
  };

  const busy = submitting || googleLoading;
  const googleEnabled = isGoogleLoginEnabled();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border/40 dark:border-border/40 bg-card dark:bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground dark:text-foreground">Entrar</h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            {googleEnabled
              ? 'Use a sua conta Google ou utilizador e senha.'
              : 'Utilizador e senha definidos pelo administrador.'}
          </p>
        </div>

        {flash ? (
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {flash}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {googleEnabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={busy}
              onClick={handleGoogleLogin}
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              {googleLoading ? 'A redirecionar…' : 'Continuar com Google'}
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">ou</span>
              <Separator className="flex-1" />
            </div>
          </>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground">Utilizador</label>
            <Input
              type="text"
              autoComplete="username"
              value={login}
              onChange={(ev) => setLogin(ev.target.value)}
              placeholder="Ex: joao, admin…"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground">Senha</label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {submitting ? 'A entrar…' : 'Entrar'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Primeira vez ou senha nova?{' '}
          <Link to="/ativar-acesso" className="text-primary hover:underline">
            Activar acesso
          </Link>
        </p>
      </div>
    </div>
  );
}
