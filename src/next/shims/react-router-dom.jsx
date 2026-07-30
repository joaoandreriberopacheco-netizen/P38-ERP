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
import { useNavigationTransition } from '@/lib/NavigationTransitionContext';
import { prefetchP38Route } from '@/next/prefetchP38Route';

export const BrowserRouter = ({ children }) => children;
export const Routes = ({ children }) => children;
export const Route = () => null;
export const Outlet = ({ children }) => children ?? null;

function resolveHref(to, href) {
  const target = to ?? href ?? '/';
  if (typeof target === 'object' && target?.pathname) {
    return `${target.pathname || ''}${target.search || ''}${target.hash || ''}` || '/';
  }
  return String(target);
}

export const Link = forwardRef(function RouterLink(
  { to, href, replace, children, className, onPointerEnter, onPointerDown, onTouchStart, onClick, ...props },
  ref
) {
  const router = useRouter();
  const { beginNavigation, pendingHref } = useNavigationTransition();
  const dest = resolveHref(to, href);
  const isPending = pendingHref === dest;

  const prefetch = useCallback(() => {
    prefetchP38Route(dest, router);
  }, [dest, router]);

  const handlePointerEnter = (event) => {
    prefetch();
    onPointerEnter?.(event);
  };

  const handleTouchStart = (event) => {
    prefetch();
    beginNavigation(dest);
    onTouchStart?.(event);
  };

  const handlePointerDown = (event) => {
    if (event.button === 0) beginNavigation(dest);
    onPointerDown?.(event);
  };

  const handleClick = (event) => {
    beginNavigation(dest);
    onClick?.(event);
  };

  return (
    <NextLink
      href={dest}
      replace={replace}
      className={`${className || ''}${isPending ? ' p38-nav-pending' : ''}`.trim()}
      ref={ref}
      prefetch
      onPointerEnter={handlePointerEnter}
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      {...props}
    >
      {children}
    </NextLink>
  );
});

export function useNavigate() {
  const router = useRouter();
  const { beginNavigation } = useNavigationTransition();

  return useCallback(
    (to, options = {}) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else router.forward?.();
        return;
      }
      const dest = typeof to === 'string' ? to : `${to?.pathname || '/'}${to?.search || ''}${to?.hash || ''}`;
      beginNavigation(dest);
      if (options?.replace) router.replace(dest);
      else router.push(dest);
    },
    [beginNavigation, router]
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
  const { beginNavigation } = useNavigationTransition();

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
      beginNavigation(url);
      if (navigateOptions.replace) router.replace(url);
      else router.push(url);
    },
    [beginNavigation, pathname, router, searchParams]
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
  const { beginNavigation } = useNavigationTransition();

  useEffect(() => {
    if (!to) return;
    beginNavigation(to);
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router, beginNavigation]);
  return null;
}
