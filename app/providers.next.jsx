'use client';

import '@/App.css';
import dynamic from 'next/dynamic';
import { AuthProvider } from '@/lib/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/sonner';
import DeferredMount from '@/lib/DeferredMount';

const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/react').then((mod) => ({ default: mod.SpeedInsights })),
  { ssr: false },
);

export function Providers({ children }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        {children}
        <Toaster />
        <DeferredMount waitForIdle>
          <SpeedInsights />
        </DeferredMount>
      </QueryClientProvider>
    </AuthProvider>
  );
}
