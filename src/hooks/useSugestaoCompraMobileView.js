import { useCallback, useMemo, useState } from 'react';
import { useIsPhone, useViewport } from '@/hooks/use-breakpoint';

/**
 * Modo mobile da sugestão de compra (sempre retrato no telemóvel).
 * Paisagem global está bloqueada no PWA — não auto-alterna para tabela.
 */
export function useSugestaoCompraMobileView() {
  const { width, height } = useViewport();
  const isPhone = useIsPhone();
  const [manualMode, setManualMode] = useState(null);

  const isLandscape = width > height;

  const autoMode = useMemo(() => 'cards', []);

  const viewMode = manualMode ?? autoMode;

  const showRotateHint = false;

  const setViewMode = useCallback((mode) => {
    setManualMode(mode === 'auto' ? null : mode);
  }, []);

  const resetToAuto = useCallback(() => setManualMode(null), []);

  return {
    isPhone,
    isLandscape,
    viewMode,
    autoMode,
    showRotateHint,
    setViewMode,
    resetToAuto,
    isManual: manualMode != null,
  };
}
