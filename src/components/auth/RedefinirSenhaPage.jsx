import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import P38Logo from '@/components/brand/P38Logo';

const authFieldClass =
  'rounded-none border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-100';

const authButtonClass =
  'rounded-none bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200';

/**
 * Conclusão do reset de senha (link do email Supabase → sessão recovery → nova senha).
 */
export default function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setError('Supabase não configurado neste ambiente.');
          setChecking(false);
        }
        return;
      }

      const markReady = () => {
        if (!cancelled) {
          setSessionReady(true);
          setChecking(false);
        }
      };

      try {
        if (window.location.search.includes('code=')) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) throw exchangeError;
          markReady();
          return;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (sessionData?.session) {
          markReady();
          return;
        }

        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || session) {
            markReady();
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();

        window.setTimeout(() => {
          if (!cancelled) setChecking(false);
        }, 2500);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Link inválido ou expirado. Peça um novo em Esqueci a senha.');
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase não configurado.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      navigate('/login', {
        replace: true,
        state: { flash: 'Senha atualizada. Entre com a nova senha.' },
      });
    } catch (err) {
      setError(err?.message || 'Não foi possível guardar a nova senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
        <div className="mb-8">
          <P38Logo surface="auth.mobile" className="mx-auto" />
        </div>

        <div className="w-full max-w-md space-y-6">
          <header className="space-y-2 text-center">
            <h1 className="font-glacial text-2xl font-semibold tracking-tight">Nova senha</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Defina a sua nova senha de acesso ao P38.
            </p>
          </header>

          {checking ? (
            <p className="text-center text-sm text-neutral-500">A validar o link…</p>
          ) : null}

          {error ? (
            <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" role="alert">
              {error}
            </p>
          ) : null}

          {!checking && !sessionReady && !error ? (
            <div className="space-y-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
              <p>Link inválido ou expirado.</p>
              <Link to="/esqueci-senha" className="font-medium text-neutral-900 underline dark:text-neutral-100">
                Pedir novo link
              </Link>
            </div>
          ) : null}

          {sessionReady ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-400">
                  Nova senha
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  className={`h-11 ${authFieldClass}`}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-400">
                  Confirmar senha
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(ev) => setConfirmPassword(ev.target.value)}
                  className={`h-11 ${authFieldClass}`}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className={`h-11 w-full ${authButtonClass}`} disabled={submitting}>
                {submitting ? 'A guardar…' : 'Guardar nova senha'}
              </Button>
            </form>
          ) : null}

          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            <Link to="/login" className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100">
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
