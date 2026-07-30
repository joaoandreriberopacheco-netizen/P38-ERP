'use client';

/**
 * Shim react-router-dom → Next.js App Router.
 * Permite reutilizar componentes Vite sem reescrever navegação página a página.
 */
import React, { forwardRef, useCallback, useEffect, useMemo } from 'react';
import NextLink from 'next/link';
import {
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';

export const BrowserRouter = ({ children }) => children;
export const Routes = ({ children }) => children;
export const Route = () => null;
export const Outlet = ({ children }) => children ?? null;

export const Link = forwardRef(function RouterLink(
  { to, href, replace, children, className, ...props },
  ref
) {
  const target = to ?? href ?? '/';
  if (typeof target === 'object' && target?.pathname) {
    const dest = `${target.pathname || ''}${target.search || ''}${target.hash || ''}` || '/';
    return (
      <NextLink href={dest} replace={replace} className={className} ref={ref} {...props}>
        {children}
      </NextLink>
    );
  }
  return (
    <NextLink href={String(target)} replace={replace} className={className} ref={ref} {...props}>
      {children}
    </NextLink>
  );
});

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to, options = {}) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else router.forward?.();
        return;
      }
      const dest = typeof to === 'string' ? to : `${to?.pathname || '/'}${to?.search || ''}${to?.hash || ''}`;
      if (options?.replace) router.replace(dest);
      else router.push(dest);
    },
    [router]
  );
}

export function useLocation() {
  const pathname = usePathname() || '/';
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : '';
  return useMemo(
    () => ({
      pathname,
      search,
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      state: null,
      key: pathname,
    }),
    [pathname, search]
  );
}

export function useSearchParams() {
  const searchParams = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname() || '/';

  const setSearchParams = useCallback(
    (nextInit, navigateOptions = {}) => {
      const current = new URLSearchParams(searchParams?.toString() || '');
      const next =
        typeof nextInit === 'function'
          ? nextInit(current)
          : nextInit instanceof URLSearchParams
            ? nextInit
            : new URLSearchParams(nextInit || {});
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (navigateOptions.replace) router.replace(url);
      else router.push(url);
    },
    [pathname, router, searchParams]
  );

  return [searchParams, setSearchParams];
}

export function useParams() {
  const pathname = usePathname() || '/';
  const segment = pathname.replace(/^\//, '').split('/')[0];
  return segment ? { pageName: segment } : {};
}

export function Navigate({ to, replace = false }) {
  const router = useRouter();
  useEffect(() => {
    if (!to) return;
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}
