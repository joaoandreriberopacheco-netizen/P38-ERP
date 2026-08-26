import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * usePullToRefresh - attaches pull-to-refresh gesture to a scrollable element.
 * @param {Function} onRefresh - async function called when refresh is triggered
 * @param {Object} options
 * @param {number} options.threshold - px to pull before triggering (default 80)
 * @param {HTMLElement|null} options.scrollRoot - scroll container (use ref callback + state in parent)
 * @returns {{ isRefreshing, pullDistance }}
 */
export default function usePullToRefresh(onRefresh, { threshold = 80, scrollRoot = null } = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!scrollRoot) return undefined;

    const onTouchStart = (e) => {
      if (scrollRoot.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e) => {
      if (!pulling.current || isRefreshingRef.current) return;
      const dist = Math.max(0, e.touches[0].clientY - startY.current);
      const clamped = Math.min(dist * 0.5, threshold * 1.2);
      pullDistanceRef.current = clamped;
      setPullDistance(clamped);
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistanceRef.current >= threshold) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        try {
          await onRefreshRef.current?.();
        } finally {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    };

    scrollRoot.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollRoot.addEventListener('touchmove', onTouchMove, { passive: true });
    scrollRoot.addEventListener('touchend', onTouchEnd);
    scrollRoot.addEventListener('touchcancel', onTouchEnd);

    return () => {
      scrollRoot.removeEventListener('touchstart', onTouchStart);
      scrollRoot.removeEventListener('touchmove', onTouchMove);
      scrollRoot.removeEventListener('touchend', onTouchEnd);
      scrollRoot.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scrollRoot, threshold]);

  return { isRefreshing, pullDistance };
}

/** Helper: state + setter para ligar o scroll container ao hook. */
export function usePullToRefreshScrollRoot() {
  const [scrollRoot, setScrollRoot] = useState(null);
  const bindScrollRoot = useCallback((node) => {
    setScrollRoot(node || null);
  }, []);
  return { scrollRoot, bindScrollRoot };
}
