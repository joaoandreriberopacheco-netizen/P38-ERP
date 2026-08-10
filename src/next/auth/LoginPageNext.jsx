'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getSupabaseBrowserClient, waitForSupabaseSession } from '@/lib/supabaseBrowserClient';
import { isSupabaseAuthEnabled, isGoogleLoginEnabled } from '@/integrations/p38/providers';
import { safeAppReturnPath } from '@/lib/supabaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import P38Logo from '@/components/brand/P38Logo';

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

const authFieldClass =
  'rounded-none border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-100';

const authButtonClass =
  'rounded-none bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200';

const authOutlineButtonClass =
  'rounded-none border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900';

/**
 * Login P38 para o app Next (paralelo ao Vite).
 * Reutiliza auth Supabase e componentes visuais do Vite.
 */
export default function LoginPageNext() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAppState, isAuthenticated, isLoadingAuth } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const safeReturnPath = () => safeAppReturnPath(searchParams.get('returnUrl'));

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.replace(safeReturnPath());
    }
  }, [isAuthenticated, isLoadingAuth, router, searchParams]);

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
      router.replace(safeReturnPath());
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
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside
          className="flex flex-col items-center justify-center border-b border-neutral-200 bg-neutral-50 px-6 py-12 dark:border-neutral-800 dark:bg-neutral-900 md:w-1/2 md:border-b-0 md:border-r md:py-0"
          aria-hidden="true"
        >
          <div className="md:hidden">
            <P38Logo surface="auth.mobile" className="mx-auto" />
          </div>
          <div className="hidden md:flex md:items-center md:justify-center md:px-12">
            <P38Logo surface="auth.desktop" className="max-w-[min(420px,80%)]" />
          </div>
        </aside>

        <main className="flex flex-1 items-center justify-center px-6 py-10 md:w-1/2 md:px-12 md:py-16">
          <div className="w-full max-w-md space-y-8">
            <header className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                Acesso ao sistema
              </p>
              <h1 className="font-glacial text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                Entrar
              </h1>
              <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {googleEnabled
                  ? 'Use a sua conta Google ou utilizador e senha.'
                  : 'Utilizador e senha definidos pelo administrador.'}
              </p>
            </header>

            {error ? (
              <p
                className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {googleEnabled ? (
              <div className="space-y-6">
                <Button
                  type="button"
                  variant="outline"
                  className={`h-11 w-full gap-2 ${authOutlineButtonClass}`}
                  disabled={busy}
                  onClick={handleGoogleLogin}
                >
                  <GoogleIcon className="h-4 w-4 shrink-0" />
                  {googleLoading ? 'A redirecionar…' : 'Continuar com Google'}
                </Button>

                <div className="flex items-center gap-3">
                  <Separator className="flex-1 bg-neutral-200 dark:bg-neutral-800" />
                  <span className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">
                    ou
                  </span>
                  <Separator className="flex-1 bg-neutral-200 dark:bg-neutral-800" />
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="login-username"
                  className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-400"
                >
                  Utilizador
                </label>
                <Input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={login}
                  onChange={(ev) => setLogin(ev.target.value)}
                  placeholder="Ex: joao, admin…"
                  className={`h-11 ${authFieldClass}`}
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="login-password"
                  className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-400"
                >
                  Senha
                </label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  className={`h-11 ${authFieldClass}`}
                  required
                />
              </div>
              <Button type="submit" className={`h-11 w-full ${authButtonClass}`} disabled={busy}>
                {submitting ? 'A entrar…' : 'Entrar'}
              </Button>
            </form>

            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
              Primeira vez ou senha nova?{' '}
              <Link
                href="/ativar-acesso"
                className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
              >
                Activar acesso
              </Link>
            </p>

            <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 pt-2">
              <a href="/landing.html" className="hover:underline underline-offset-4">
                Sobre o P38
              </a>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
