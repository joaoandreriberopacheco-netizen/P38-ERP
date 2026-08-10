import { P38_MAIN_PAGE, P38_PAGE_LOADERS } from '@/next/pageRegistry.generated';

/** Converte `/Produtos` ou `/` em nome de página P38. */
export function pageNameFromPath(href) {
  const raw = String(href || '').split('?')[0].split('#')[0];
  const segment = raw.replace(/^\//, '').split('/').filter(Boolean)[0];
  if (!segment) return P38_MAIN_PAGE;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Pré-carrega o chunk JS da página (import dinâmico). */
export function prefetchP38Page(pageName) {
  const loader = P38_PAGE_LOADERS[pageName];
  if (loader) void loader();
}

/** Pré-carrega rota Next + chunk da página P38. */
export function prefetchP38Route(href, router) {
  const path = String(href || '/');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  try {
    router?.prefetch?.(normalized === '' ? '/' : normalized);
  } catch {
    /* ignore */
  }
  prefetchP38Page(pageNameFromPath(normalized));
}
