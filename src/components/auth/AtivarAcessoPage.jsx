import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { bootstrapP38Admin, activateP38User, fetchP38AuthStatus } from '@/functions/p38Auth';
import { isValidP38Login, normalizeP38Login } from '@/lib/p38InternalAuth';
import { isSupabaseAuthEnabled } from '@/integrations/p38/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Primeira activação do sistema (admin) ou definição de senha por novos utilizadores.
 * Rotas: `/ativar-acesso` (activar conta) ou `/ativar-acesso?mode=bootstrap` (admin inicial).
 */
export default function AtivarAcessoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'bootstrap' ? 'bootstrap' : 'activate';

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(mode === 'bootstrap');

  useEffect(() => {
    if (!isSupabaseAuthEnabled()) return;

    if (mode !== 'bootstrap') {
      setCheckingStatus(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const status = await fetchP38AuthStatus();
        if (cancelled) return;
        if (!status?.needsBootstrap) {
          navigate('/login', { replace: true });
        }
      } catch {
        // Edge function pode ainda não estar deployada — deixa o admin tentar.
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedLogin = normalizeP38Login(login);
    if (!isValidP38Login(normalizedLogin)) {
      setError('Utilizador inválido (mín. 2 caracteres, sem espaços).');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'bootstrap') {
        await bootstrapP38Admin({ login: normalizedLogin, password });
      } else {
        await activateP38User({ login: normalizedLogin, password });
      }
      navigate('/login', {
        replace: true,
        state: {
          flash:
            mode === 'bootstrap'
              ? 'Sistema activado. Entre com o seu utilizador e senha.'
              : 'Acesso activado. Já pode entrar com a sua senha.',
        },
      });
    } catch (err) {
      setError(err?.message || 'Não foi possível activar o acesso.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        A verificar estado do sistema…
      </div>
    );
  }

  const isBootstrap = mode === 'bootstrap';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border/40 bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            {isBootstrap ? 'Activar sistema' : 'Activar acesso'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBootstrap
              ? 'Administrador: defina a senha inicial do P38. Use o mesmo utilizador (login) que está no cadastro admin.'
              : 'Defina a sua senha para começar a usar o P38. Peça o utilizário ao administrador se ainda não o tiver.'}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">Utilizador</label>
            <Input
              type="text"
              autoComplete="username"
              value={login}
              onChange={(ev) => setLogin(ev.target.value)}
              placeholder="Ex: joaoandreriberopacheco"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Use exactamente o utilizador que o administrador passou (sem @gmail.com).
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">Nova senha</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/90">Confirmar senha</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'A guardar…' : isBootstrap ? 'Activar sistema' : 'Activar acesso'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Já tem senha?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
