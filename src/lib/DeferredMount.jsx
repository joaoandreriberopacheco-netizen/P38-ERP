import { useEffect, useState } from 'react';

/**
 * Monta filhos após o primeiro paint (ou idle) — útil para atalhos globais e analytics.
 */
export default function DeferredMount({ children, delayMs = 0, waitForIdle = true }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (waitForIdle && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, waitForIdle]);

  return ready ? children : null;
}
