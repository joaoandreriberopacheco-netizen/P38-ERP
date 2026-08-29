import { useCallback, useEffect, useRef, useState } from 'react';

/** Esconder chrome após ~48px de scroll para baixo. */
const DEFAULT_HIDE_AFTER_Y = 48;
/** Ignorar micro-movimentos (touch jitter). */
const DEFAULT_MIN_DELTA = 6;

/**
 * Mostra/esconde chrome superior conforme direção do scroll num contentor interno.
 * Retorna callback ref — garante listener após mount do painel scrollável.
 *
 * @param {boolean} enabled
 * @param {{ hideAfterY?: number, minDelta?: number, revealAfterUpPx?: number }} [options]
 *   revealAfterUpPx — px acumulados para cima antes de reexibir (0 = qualquer scroll up).
 */
export function useScrollChromeVisibility(enabled = true, options = {}) {
  const hideAfterY = options.hideAfterY ?? DEFAULT_HIDE_AFTER_Y;
  const minDelta = options.minDelta ?? DEFAULT_MIN_DELTA;
  const revealAfterUpPx = options.revealAfterUpPx ?? 0;

  const [visible, setVisible] = useState(true);
  const [scrollEl, setScrollEl] = useState(null);
  const lastYRef = useRef(0);
  const accumulatedUpRef = useRef(0);

  const scrollRef = useCallback((node) => {
    setScrollEl(node);
  }, []);

  useEffect(() => {
    setVisible(true);
    lastYRef.current = 0;
    accumulatedUpRef.current = 0;
  }, [enabled, hideAfterY, revealAfterUpPx]);

  useEffect(() => {
    if (!enabled || !scrollEl) return undefined;

    const onScroll = () => {
      const y = scrollEl.scrollTop;
      const delta = y - lastYRef.current;
      if (Math.abs(delta) < minDelta) return;

      if (y <= hideAfterY) {
        setVisible(true);
        accumulatedUpRef.current = 0;
      } else if (delta > 0) {
        setVisible(false);
        accumulatedUpRef.current = 0;
      } else if (revealAfterUpPx <= 0) {
        setVisible(true);
      } else {
        accumulatedUpRef.current += Math.abs(delta);
        if (accumulatedUpRef.current >= revealAfterUpPx) {
          setVisible(true);
          accumulatedUpRef.current = 0;
        }
      }

      lastYRef.current = y;
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [enabled, scrollEl, hideAfterY, minDelta, revealAfterUpPx]);

  return { chromeVisible: visible, scrollRef, scrollEl };
}
