import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Esconder o menu após ~60–80px de scroll para baixo. */
const HIDE_AFTER_Y = 72;
/** Ignorar micro-movimentos (touch jitter). */
const MIN_DELTA = 6;

function getWindowScrollY() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function getScrollTop(target) {
  if (
    target === document ||
    target === document.documentElement ||
    target === document.body
  ) {
    return getWindowScrollY();
  }
  if (target instanceof Element) {
    return target.scrollTop;
  }
  return 0;
}

/** Margem para ignorar jitter no fim/início do scroll interno. */
const SCROLL_EDGE_PX = 12;

function isAtScrollBottom(element) {
  if (!(element instanceof Element)) return false;
  const max = element.scrollHeight - element.clientHeight;
  return max > 0 && element.scrollTop >= max - SCROLL_EDGE_PX;
}

function isVerticallyScrollable(element) {
  if (!(element instanceof Element)) return false;
  if (element.scrollHeight <= element.clientHeight + 1) return false;
  const { overflowY } = getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
}

/**
 * Esconde o bottom nav ao descer (após HIDE_AFTER_Y) e mostra ao primeiro scroll para cima.
 * Sincroniza `data-p38-bottom-nav-hidden` no <html> para FABs e padding via CSS vars.
 */
export function useBottomNavScrollVisibility(enabled = true) {
  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);
  const scrollTargetRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    setVisible(true);
    lastYRef.current = 0;
    scrollTargetRef.current = null;
  }, [location.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (!enabled || visible) {
      root.removeAttribute('data-p38-bottom-nav-hidden');
      return undefined;
    }
    root.setAttribute('data-p38-bottom-nav-hidden', '');
    return () => root.removeAttribute('data-p38-bottom-nav-hidden');
  }, [visible, enabled]);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return undefined;
    }

    const onScroll = (event) => {
      const target = event.target;
      const isDocument =
        target === document ||
        target === document.documentElement ||
        target === document.body;

      if (!isDocument && !isVerticallyScrollable(target)) {
        return;
      }

      const y = getScrollTop(target);

      if (scrollTargetRef.current !== target) {
        scrollTargetRef.current = target;
        lastYRef.current = y;
        return;
      }

      const delta = y - lastYRef.current;
      if (Math.abs(delta) < MIN_DELTA) return;

      if (!isDocument && target instanceof Element) {
        if (isAtScrollBottom(target) && delta > 0) {
          lastYRef.current = y;
          return;
        }
      }

      if (y <= HIDE_AFTER_Y) {
        setVisible(true);
      } else if (delta > 0) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      lastYRef.current = y;
    };

    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [enabled]);

  return visible;
}
