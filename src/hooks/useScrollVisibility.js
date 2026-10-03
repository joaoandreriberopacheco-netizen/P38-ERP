import { useEffect, useRef, useState } from 'react';

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

function isVerticallyScrollable(element) {
  if (!(element instanceof Element)) return false;
  if (element.scrollHeight <= element.clientHeight + 1) return false;
  const { overflowY } = getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
}

function shouldIgnoreScrollTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('[data-vaul-drawer], [role="dialog"], [data-radix-popper-content-wrapper]')
  );
}

function isExtratoHistoricoScroll(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-p38-extrato-scroll]'));
}

/**
 * Igual a `useBottomNavScrollVisibility`, mas sem `useLocation` / `useSearchParams`.
 * Para overlays montados condicionalmente no Next.js (ex.: formulário de produto).
 * Reinicia quando `enabled` muda (ex.: ao entrar na aba histórico).
 */
export function useScrollVisibility(enabled = true) {
  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);
  const scrollTargetRef = useRef(null);

  useEffect(() => {
    setVisible(true);
    lastYRef.current = 0;
    scrollTargetRef.current = null;
  }, [enabled]);

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

      if (shouldIgnoreScrollTarget(target)) {
        return;
      }

      if (!isDocument && !isVerticallyScrollable(target)) {
        return;
      }

      const y = getScrollTop(target);
      const nestedExtrato = !isDocument && isExtratoHistoricoScroll(target);

      if (scrollTargetRef.current !== target) {
        scrollTargetRef.current = target;
        lastYRef.current = y;
        return;
      }

      const delta = y - lastYRef.current;
      if (Math.abs(delta) < MIN_DELTA) return;

      if (nestedExtrato) {
        // Extrato do produto: evita expandir no scroll-up a meio da lista (causa tremelique).
        if (y <= 8) {
          setVisible(true);
        } else if (delta > 0 && y > HIDE_AFTER_Y) {
          setVisible(false);
        }
      } else if (y <= HIDE_AFTER_Y) {
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
