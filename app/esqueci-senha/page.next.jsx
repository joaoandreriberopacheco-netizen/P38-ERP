'use client';

import { Suspense } from 'react';
import EsqueciSenhaPage from '@/components/auth/EsqueciSenhaPage';

export const dynamic = 'force-dynamic';

export default function EsqueciSenhaRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          A carregar…
        </div>
      }
    >
      <EsqueciSenhaPage />
    </Suspense>
  );
}
