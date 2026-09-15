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
import { installPortraitOrientationLock } from '@/lib/portraitOrientationLock';
import { shouldRegisterServiceWorker } from '@/lib/pwaServiceWorkerEnv';

const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/react').then((mod) => ({ default: mod.SpeedInsights })),
  { ssr: false },
);

const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((mod) => ({ default: mod.Analytics })),
  { ssr: false },
);

function P38MonitoringBoot() {
  useEffect(() => {
    initP38Monitoring();
  }, []);
  return null;
}

function P38OrientationBoot() {
  useEffect(() => installPortraitOrientationLock(), []);
  return null;
}

function P38ServiceWorkerBoot() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!shouldRegisterServiceWorker()) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      }).catch(() => {});
    }
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
        <P38OrientationBoot />
        <P38ServiceWorkerBoot />
        <DeferredMount waitForIdle>
          <Analytics />
          <SpeedInsights />
        </DeferredMount>
      </QueryClientProvider>
    </AuthProvider>
  );
}
