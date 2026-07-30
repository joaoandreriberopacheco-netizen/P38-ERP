export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import AuthCallbackNext from '@/next/auth/AuthCallbackNext';

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          A concluir login…
        </div>
      }
    >
      <AuthCallbackNext />
    </Suspense>
  );
}
