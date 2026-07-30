'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import P38Logo from '@/components/brand/P38Logo';
import { Button } from '@/components/ui/button';

/**
 * Home inicial do app Next (prédio novo).
 * Enquanto as rotas migram, mostra shell autenticado e liga ao Vite em produção.
 */
export default function HomeNext() {
  const router = useRouter();
  const { user, isLoadingAuth, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoadingAuth, router]);

  if (isLoadingAuth || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        A carregar…
      </div>
    );
  }

  const displayName = user?.full_name || user?.email || user?.login || 'Utilizador';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <P38Logo surface="header" className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => logout?.()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#a4ce33]/30 bg-[#4a5240]/10 p-6 dark:border-[#a4ce33]/20 dark:bg-[#1f1d22]">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              P38 Next — pré-visualização
            </p>
            <h1 className="mt-2 font-glacial text-2xl font-semibold md:text-3xl">
              Olá, {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Este é o novo prédio em Next.js, a ser construído em paralelo ao Vite. A produção
              continua no deploy actual até ao corte. As páginas vão migrar para aqui rota a rota.
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-border p-5">
              <h2 className="font-semibold">Próximas rotas</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Layout completo (menu lateral / bottom nav)</li>
                <li>PDV Caixa e Vendedor</li>
                <li>Produtos e Compras</li>
                <li>Financeiro</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-border p-5">
              <h2 className="font-semibold">Desenvolvimento</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Vite (produção): <code className="text-foreground">npm run dev</code>
                <br />
                Next (paralelo): <code className="text-foreground">npm run dev:next</code>
              </p>
              <p className="mt-4 text-sm">
                <Link href="/login" className="text-[#4a5240] underline-offset-4 hover:underline dark:text-[#a4ce33]">
                  Testar login novamente
                </Link>
              </p>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
