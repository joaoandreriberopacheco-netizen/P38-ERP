import { useEffect } from 'react';

/**
 * Marca #root como inert enquanto um overlay em document.body está aberto,
 * impedindo Tab/foco/clique na sidebar e no conteúdo atrás do modal.
 */
export function useInertAppBackground(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const root = document.getElementById('root');
    if (!root) return undefined;
    const hadInert = root.inert;
    root.inert = true;
    return () => {
      root.inert = hadInert;
    };
  }, [active]);
}
