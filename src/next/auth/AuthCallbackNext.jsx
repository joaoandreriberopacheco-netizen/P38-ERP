'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { safeAppReturnPath } from '@/lib/supabaseAuth';
import { Button } from '@/components/ui/button';

/** Callback OAuth Supabase (Google) no app Next. */
export default function AuthCallbackNext() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAppState } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) setError('Supabase não configurado neste ambiente.');
        return;
      }

      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (exchangeError) throw exchangeError;

        await checkAppState();
        if (cancelled) return;

        const returnUrl = safeAppReturnPath(searchParams.get('returnUrl'));
        router.replace(returnUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Não foi possível concluir o login com Google.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkAppState, router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button type="button" variant="outline" onClick={() => router.replace('/login')}>
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      A concluir login…
    </div>
  );
}
