'use client';

import { Suspense } from 'react';
import RedefinirSenhaPage from '@/components/auth/RedefinirSenhaPage';

export const dynamic = 'force-dynamic';

export default function RedefinirSenhaRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          A carregar…
        </div>
      }
    >
      <RedefinirSenhaPage />
    </Suspense>
  );
}
