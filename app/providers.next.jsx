'use client';

import '@/App.css';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { AuthProvider } from '@/lib/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Toaster } from '@/components/ui/sonner';
import DeferredMount from '@/lib/DeferredMount';
import { initP38Monitoring } from '@/lib/p38Monitoring';

const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/react').then((mod) => ({ default: mod.SpeedInsights })),
  { ssr: false },
);

function P38MonitoringBoot() {
  useEffect(() => {
    initP38Monitoring();
  }, []);
  return null;
}

export function Providers({ children }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        {children}
        <Toaster />
        <P38MonitoringBoot />
        <DeferredMount waitForIdle>
          <SpeedInsights />
        </DeferredMount>
      </QueryClientProvider>
    </AuthProvider>
  );
}
