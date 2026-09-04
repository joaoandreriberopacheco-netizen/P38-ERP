import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestP38PasswordReset } from '@/functions/p38Auth';
import { isValidP38Login, normalizeP38Login } from '@/lib/p38InternalAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import P38Logo from '@/components/brand/P38Logo';

const authFieldClass =
  'rounded-none border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-100';

const authButtonClass =
  'rounded-none bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200';

/**
 * Pedido de redefinição de senha — envia link para o email cadastrado em `public.usuario`.
 */
export default function EsqueciSenhaPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const normalizedLogin = normalizeP38Login(login);
    if (!isValidP38Login(normalizedLogin)) {
      setError('Utilizador inválido (mín. 2 caracteres, sem espaços).');
      return;
    }

    setSubmitting(true);
    try {
      const data = await requestP38PasswordReset({
        login: normalizedLogin,
        app_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err?.message || 'Não foi possível processar o pedido.');
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
            <h1 className="font-glacial text-2xl font-semibold tracking-tight">Esqueci a senha</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Informe o seu <strong>utilizador</strong> (ex.: joaoandreriberopacheco). Enviaremos um link para o
              email cadastrado no sistema.
            </p>
          </header>

          {error ? (
            <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" role="alert">
              {error}
            </p>
          ) : null}

          {result ? (
            <div
              className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 space-y-2"
              role="status"
            >
              <p>{result.message}</p>
              {result.sent && result.email_masked ? (
                <p className="text-xs opacity-90">Verifique também a pasta de spam.</p>
              ) : null}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="reset-login" className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-400">
                  Utilizador
                </label>
                <Input
                  id="reset-login"
                  type="text"
                  autoComplete="username"
                  value={login}
                  onChange={(ev) => setLogin(ev.target.value)}
                  placeholder="Ex: joaoandreriberopacheco"
                  className={`h-11 ${authFieldClass}`}
                  required
                />
              </div>
              <Button type="submit" className={`h-11 w-full ${authButtonClass}`} disabled={submitting}>
                {submitting ? 'A enviar…' : 'Enviar link por email'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            <Link to="/login" className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100">
              Voltar ao login
            </Link>
            {' · '}
            <Link to="/ativar-acesso" className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100">
              Activar acesso
            </Link>
          </p>

          {result ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Ir para o login
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
