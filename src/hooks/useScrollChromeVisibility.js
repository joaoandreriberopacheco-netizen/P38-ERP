import { useCallback, useEffect, useRef, useState } from 'react';

/** Esconder chrome após ~56px de scroll para baixo. */
const DEFAULT_HIDE_AFTER_Y = 56;
/** Zona “topo” — reexibir chrome ao chegar aqui. */
const DEFAULT_REVEAL_NEAR_TOP_Y = 24;
/** Ignorar micro-movimentos (touch jitter). */
const DEFAULT_MIN_DELTA = 10;
/** Scroll up acumulado (~1 ecrã) para reexibir no modo long-up. */
const DEFAULT_REVEAL_AFTER_UP_PX = 420;

/**
 * Mostra/esconde chrome superior conforme direção do scroll num contentor interno.
 *
 * Modos (melhores práticas leitura mobile):
 * - `top-only` — só reaparece ao chegar ao topo (menos invasivo; padrão Embarques)
 * - `long-up` — topo OU ~420px acumulados para cima
 * - `immediate-up` — qualquer scroll para cima (legado)
 *
 * @param {boolean} enabled
 * @param {{
 *   revealMode?: 'top-only' | 'long-up' | 'immediate-up',
 *   hideAfterY?: number,
 *   revealNearTopY?: number,
 *   minDelta?: number,
 *   revealAfterUpPx?: number,
 * }} [options]
 */
export function useScrollChromeVisibility(enabled = true, options = {}) {
  const revealMode = options.revealMode ?? 'long-up';
  const hideAfterY = options.hideAfterY ?? DEFAULT_HIDE_AFTER_Y;
  const revealNearTopY = options.revealNearTopY ?? DEFAULT_REVEAL_NEAR_TOP_Y;
  const minDelta = options.minDelta ?? DEFAULT_MIN_DELTA;
  const revealAfterUpPx = options.revealAfterUpPx ?? DEFAULT_REVEAL_AFTER_UP_PX;

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
  }, [enabled, hideAfterY, revealNearTopY, revealMode, revealAfterUpPx]);

  useEffect(() => {
    if (!enabled || !scrollEl) return undefined;

    const onScroll = () => {
      const y = scrollEl.scrollTop;
      const delta = y - lastYRef.current;
      if (Math.abs(delta) < minDelta) return;

      if (y <= revealNearTopY) {
        setVisible(true);
        accumulatedUpRef.current = 0;
      } else if (delta > 0 && y > hideAfterY) {
        setVisible(false);
        accumulatedUpRef.current = 0;
      } else if (delta < 0 && revealMode !== 'top-only') {
        if (revealMode === 'immediate-up') {
          setVisible(true);
        } else {
          accumulatedUpRef.current += Math.abs(delta);
          if (accumulatedUpRef.current >= revealAfterUpPx) {
            setVisible(true);
            accumulatedUpRef.current = 0;
          }
        }
      }

      lastYRef.current = y;
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [enabled, scrollEl, hideAfterY, revealNearTopY, minDelta, revealMode, revealAfterUpPx]);

  return { chromeVisible: visible, scrollRef, scrollEl };
}
