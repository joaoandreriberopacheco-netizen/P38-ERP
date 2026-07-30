export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import LoginPageNext from '@/next/auth/LoginPageNext';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          A carregar…
        </div>
      }
    >
      <LoginPageNext />
    </Suspense>
  );
}
