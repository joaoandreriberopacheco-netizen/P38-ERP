import { useCallback, useEffect, useRef, useState } from 'react';

/** Esconder chrome após ~48px de scroll para baixo. */
const HIDE_AFTER_Y = 48;
/** Ignorar micro-movimentos (touch jitter). */
const MIN_DELTA = 6;

/**
 * Mostra/esconde chrome superior conforme direção do scroll num contentor interno.
 * Retorna callback ref — garante listener após mount do painel scrollável.
 */
export function useScrollChromeVisibility(enabled = true) {
  const [visible, setVisible] = useState(true);
  const [scrollEl, setScrollEl] = useState(null);
  const lastYRef = useRef(0);

  const scrollRef = useCallback((node) => {
    setScrollEl(node);
  }, []);

  useEffect(() => {
    setVisible(true);
    lastYRef.current = 0;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !scrollEl) return undefined;

    const onScroll = () => {
      const y = scrollEl.scrollTop;
      const delta = y - lastYRef.current;
      if (Math.abs(delta) < MIN_DELTA) return;

      if (y <= HIDE_AFTER_Y) {
        setVisible(true);
      } else if (delta > 0) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      lastYRef.current = y;
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [enabled, scrollEl]);

  return { chromeVisible: visible, scrollRef, scrollEl };
}
