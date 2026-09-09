import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Colapso do chrome superior (grid 0fr/1fr).
 * Esconde de imediato ao rolar para baixo; reaparece com animação suave.
 * Com `scrollEl`, compensa scrollTop quando a altura muda (evita “pulo” na lista).
 */
export function P38ScrollChromeCollapse({
  visible = true,
  enabled = true,
  scrollEl = null,
  children,
  className,
}) {
  const outerRef = useRef(null);
  const prevHeightRef = useRef(null);

  useLayoutEffect(() => {
    if (!enabled) {
      prevHeightRef.current = null;
    }
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled || !outerRef.current) return;

    const el = outerRef.current;
    const newHeight = el.getBoundingClientRect().height;
    const prev = prevHeightRef.current;

    if (scrollEl && prev != null && prev - newHeight > 1) {
      scrollEl.scrollTop += prev - newHeight;
    }

    prevHeightRef.current = newHeight;
  }, [visible, enabled, scrollEl, children]);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={outerRef}
      className={cn(
        'grid ease-out',
        visible
          ? 'grid-rows-[auto] transition-[grid-template-rows] duration-300'
          : 'grid-rows-[0fr] transition-[grid-template-rows] duration-0',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
