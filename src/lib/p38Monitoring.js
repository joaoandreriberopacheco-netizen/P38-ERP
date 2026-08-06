/**
 * Monitorização opcional — só activa com NEXT_PUBLIC_SENTRY_DSN.
 * Fase 2 profissionalização: ver docs/SENTRY_SETUP.md
 */
import { p38PublicEnv } from '@/lib/p38PublicEnv';

let initialized = false;

export function initP38Monitoring() {
  if (initialized || typeof window === 'undefined') return;
  const dsn = p38PublicEnv('NEXT_PUBLIC_SENTRY_DSN') || p38PublicEnv('VITE_SENTRY_DSN');
  if (!dsn) return;

  initialized = true;
  const environment =
    p38PublicEnv('NEXT_PUBLIC_P38_ENV') || p38PublicEnv('VITE_P38_ENV') || 'production';

  import('@sentry/browser')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment,
        tracesSampleRate: 0.1,
        beforeSend(event) {
          if (event.request?.headers?.Authorization) {
            delete event.request.headers.Authorization;
          }
          return event;
        },
      });
    })
    .catch((err) => {
      console.warn('[P38] Sentry não carregou (DSN definido mas pacote indisponível).', err);
      initialized = false;
    });
}

export function captureP38Exception(error, context = {}) {
  if (typeof window === 'undefined') return;
  import('@sentry/browser')
    .then((Sentry) => {
      Sentry.captureException(error, { extra: context });
    })
    .catch(() => {});
}
