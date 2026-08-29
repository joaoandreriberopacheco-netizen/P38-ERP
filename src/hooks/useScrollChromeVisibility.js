import { useEffect, useRef, useState } from 'react';

/** Esconder chrome após ~48px de scroll para baixo. */
const HIDE_AFTER_Y = 48;
/** Ignorar micro-movimentos (touch jitter). */
const MIN_DELTA = 6;

/**
 * Mostra/esconde chrome superior conforme direção do scroll num contentor interno.
 * Scroll para baixo → esconde; scroll para cima ou perto do topo → mostra.
 */
export function useScrollChromeVisibility(scrollRef, enabled = true) {
  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);

  useEffect(() => {
    setVisible(true);
    lastYRef.current = 0;
  }, [enabled]);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!enabled || !el) return undefined;

    const onScroll = () => {
      const y = el.scrollTop;
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

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [enabled, scrollRef]);

  return visible;
}
