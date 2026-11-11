import { useEffect, useState } from 'react';

/** Colapsa hero do extrato mobile após scroll (protótipo BB / v8). */
export function useFluxoExtratoScrollCollapse(scrollEl, threshold = 20) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!scrollEl) {
      setCollapsed(false);
      return undefined;
    }
    const apply = () => {
      setCollapsed(scrollEl.scrollTop > threshold);
    };
    scrollEl.addEventListener('scroll', apply, { passive: true });
    apply();
    return () => scrollEl.removeEventListener('scroll', apply);
  }, [scrollEl, threshold]);

  return collapsed;
}
