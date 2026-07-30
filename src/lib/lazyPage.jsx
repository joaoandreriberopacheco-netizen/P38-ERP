import React, { lazy, Suspense } from 'react';

const CHUNK_RELOAD_KEY = 'p38-chunk-reload';
const CHUNK_RELOAD_COUNT_KEY = 'p38-chunk-reload-count';
const CHUNK_RELOAD_WINDOW_KEY = 'p38-chunk-reload-window';
const MAX_CHUNK_RELOADS = 3;
const CHUNK_RELOAD_WINDOW_MS = 60_000;
const IMPORT_RETRY_ATTEMPTS = 3;
const IMPORT_RETRY_BASE_MS = 250;

/** Erros típicos de chunk/HMR desatualizado (Vite + preview Base44). */
export function isChunkLoadError(error) {
  const msg = error?.message || String(error || '');
  return (
    msg.includes('Failed to fetch dynamically imported module')
    || msg.includes('Importing a module script failed')
    || msg.includes('error loading dynamically imported module')
    || msg.includes('Failed to load module script')
    || msg.includes('dynamically imported module')
    || msg.includes('Loading chunk')
    || msg.includes('ChunkLoadError')
  );
}

export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    sessionStorage.removeItem(CHUNK_RELOAD_COUNT_KEY);
    sessionStorage.removeItem(CHUNK_RELOAD_WINDOW_KEY);
  } catch {
    /* ignore */
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Evita que o modal "Problemas encontrados" do preview Base44 apareça por HMR. */
export function suppressChunkErrorPropagation(event) {
  const reason = event?.reason ?? event?.error ?? event;
  if (!isChunkLoadError(reason)) return false;
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  return true;
}

/** Recarrega a página até N vezes por janela quando um chunk falha (cache/HMR). */
export function reloadOnceOnChunkError() {
  try {
    const now = Date.now();
    const windowStart = Number(sessionStorage.getItem(CHUNK_RELOAD_WINDOW_KEY) || 0);
    let count = Number(sessionStorage.getItem(CHUNK_RELOAD_COUNT_KEY) || 0);

    if (!windowStart || now - windowStart > CHUNK_RELOAD_WINDOW_MS) {
      sessionStorage.setItem(CHUNK_RELOAD_WINDOW_KEY, String(now));
      count = 0;
    }

    if (count >= MAX_CHUNK_RELOADS) return false;

    sessionStorage.setItem(CHUNK_RELOAD_COUNT_KEY, String(count + 1));
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  } catch {
    /* ignore */
  }
  window.location.reload();
  return true;
}

async function importWithChunkRetry(importFn) {
  let lastError;
  for (let attempt = 0; attempt < IMPORT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const mod = await importFn();
      clearChunkReloadFlag();
      return mod;
    } catch (error) {
      lastError = error;
      if (!isChunkLoadError(error) || attempt === IMPORT_RETRY_ATTEMPTS - 1) {
        throw error;
      }
      await sleep(IMPORT_RETRY_BASE_MS * (attempt + 1));
    }
  }
  throw lastError;
}

/** Envolve import dinâmico com retry via reload automático. */
export function wrapDynamicImport(importFn) {
  return async () => {
    try {
      return await importWithChunkRetry(importFn);
    } catch (error) {
      if (isChunkLoadError(error) && reloadOnceOnChunkError()) {
        return new Promise(() => {});
      }
      throw error;
    }
  };
}

/** Intercepta erros globais de chunk antes do handler do preview Base44. */
export function installChunkErrorHandlers() {
  if (typeof window === 'undefined') return;

  const onUnhandledRejection = (event) => {
    if (!suppressChunkErrorPropagation(event)) return;
    reloadOnceOnChunkError();
  };

  const onWindowError = (event) => {
    if (!suppressChunkErrorPropagation(event)) return;
    reloadOnceOnChunkError();
  };

  window.addEventListener('unhandledrejection', onUnhandledRejection, true);
  window.addEventListener('error', onWindowError, true);
}

export function lazyPage(importFn) {
  return lazy(wrapDynamicImport(importFn));
}

export function PageLoadFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      A carregar…
    </div>
  );
}

export function ChunkLoadErrorScreen({ onRetry }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-base font-medium text-foreground">Não foi possível carregar esta página</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Isso costuma acontecer após uma atualização no preview. Recarregue para buscar a versão mais recente.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-2xl bg-[#4a5240] px-5 py-2.5 text-sm font-semibold text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]"
      >
        Recarregar página
      </button>
    </div>
  );
}

export class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && reloadOnceOnChunkError()) {
      return;
    }
    console.error('[ChunkErrorBoundary]', error);
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (isChunkLoadError(error)) {
        return (
          <ChunkLoadErrorScreen
            onRetry={() => {
              clearChunkReloadFlag();
              window.location.reload();
            }}
          />
        );
      }
      throw error;
    }
    return this.props.children;
  }
}

export function withPageSuspense(LazyComponent) {
  function SuspendedPage(props) {
    return (
      <Suspense fallback={<PageLoadFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }
  SuspendedPage.displayName = `Suspended(${LazyComponent.displayName || LazyComponent.name || 'Page'})`;
  return SuspendedPage;
}
