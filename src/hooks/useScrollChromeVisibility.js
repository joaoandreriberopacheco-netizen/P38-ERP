import { useCallback, useEffect, useRef, useState } from 'react';

/** Esconder chrome após ~56px de scroll para baixo. */
const DEFAULT_HIDE_AFTER_Y = 56;
/** Zona “topo” — reexibir chrome ao chegar aqui. */
const DEFAULT_REVEAL_NEAR_TOP_Y = 24;
/** Ignorar micro-movimentos (touch jitter). */
const DEFAULT_MIN_DELTA = 10;
/** Margem no fim/início do scroll — evita “turbulência” ao chegar ao fundo. */
const SCROLL_EDGE_PX = 12;
/** Scroll up acumulado (~1 ecrã) para reexibir no modo long-up. */
const DEFAULT_REVEAL_AFTER_UP_PX = 420;

/** Preset para listas mobile (Embarques, Financeiro, Vendas). */
export const MOBILE_LIST_CHROME_OPTIONS = {
  revealMode: 'long-up',
  revealAfterUpPx: 88,
  minDelta: 14,
  hideCooldownMs: 200,
};

/**
 * Mostra/esconde chrome superior conforme direção do scroll num contentor interno.
 *
 * Modos (melhores práticas leitura mobile):
 * - `top-only` — só reaparece ao chegar ao topo da lista
 * - `long-up` — topo OU scroll acumulado para cima (ver revealAfterUpPx)
 * - `immediate-up` — qualquer scroll para cima (pode piscar com jitter do dedo)
 *
 * @param {boolean} enabled
 * @param {{
 *   revealMode?: 'top-only' | 'long-up' | 'immediate-up',
 *   hideAfterY?: number,
 *   revealNearTopY?: number,
 *   minDelta?: number,
 *   revealAfterUpPx?: number,
 *   hideCooldownMs?: number,
 * }} [options]
 */
export function useScrollChromeVisibility(enabled = true, options = {}) {
  const revealMode = options.revealMode ?? 'long-up';
  const hideAfterY = options.hideAfterY ?? DEFAULT_HIDE_AFTER_Y;
  const revealNearTopY = options.revealNearTopY ?? DEFAULT_REVEAL_NEAR_TOP_Y;
  const minDelta = options.minDelta ?? DEFAULT_MIN_DELTA;
  const revealAfterUpPx = options.revealAfterUpPx ?? DEFAULT_REVEAL_AFTER_UP_PX;
  const hideCooldownMs = options.hideCooldownMs ?? 0;

  const [visible, setVisible] = useState(true);
  const [scrollEl, setScrollEl] = useState(null);
  const lastYRef = useRef(0);
  const accumulatedUpRef = useRef(0);
  const lastHideAtRef = useRef(0);

  const scrollRef = useCallback((node) => {
    setScrollEl(node);
  }, []);

  useEffect(() => {
    setVisible(true);
    lastYRef.current = 0;
    accumulatedUpRef.current = 0;
    lastHideAtRef.current = 0;
  }, [enabled, hideAfterY, revealNearTopY, revealMode, revealAfterUpPx, hideCooldownMs]);

  useEffect(() => {
    if (!enabled || !scrollEl) return undefined;

    const onScroll = () => {
      const y = scrollEl.scrollTop;
      const maxY = scrollEl.scrollHeight - scrollEl.clientHeight;
      const delta = y - lastYRef.current;
      const atBottom = maxY > 0 && y >= maxY - SCROLL_EDGE_PX;
      const atTop = y <= revealNearTopY;

      // Topo/fundo primeiro — mesmo com micro-movimento (evita header preso ao chegar no início)
      if (atTop) {
        setVisible(true);
        accumulatedUpRef.current = 0;
        lastYRef.current = y;
        return;
      }

      if (Math.abs(delta) < minDelta) return;

      if (atBottom && delta > 0) {
        lastYRef.current = y;
        return;
      }

      if (delta > 0 && y > hideAfterY) {
        setVisible(false);
        lastHideAtRef.current = Date.now();
        accumulatedUpRef.current = 0;
      } else if (delta < 0 && revealMode !== 'top-only') {
        const inHideCooldown =
          hideCooldownMs > 0 && Date.now() - lastHideAtRef.current < hideCooldownMs;
        if (inHideCooldown) {
          lastYRef.current = y;
          return;
        }

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
  }, [
    enabled,
    scrollEl,
    hideAfterY,
    revealNearTopY,
    minDelta,
    revealMode,
    revealAfterUpPx,
    hideCooldownMs,
  ]);

  return { chromeVisible: visible, scrollRef, scrollEl };
}
