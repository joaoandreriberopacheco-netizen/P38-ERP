'use client';

import { Suspense } from 'react';
import AtivarAcessoPage from '@/components/auth/AtivarAcessoPage';

export const dynamic = 'force-dynamic';

export default function AtivarAcessoRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          A carregar…
        </div>
      }
    >
      <AtivarAcessoPage />
    </Suspense>
  );
}
