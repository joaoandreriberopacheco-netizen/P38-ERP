import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import GlobalSearchBar from '@/components/navigation/GlobalSearchBar';
import { SHELL_Z } from '@/lib/quickAccessOverlay';
import { cn } from '@/lib/utils';
import { shouldSuppressGlobalSearchBackdropClose } from '@/lib/openGlobalSearch';
import { getP38PortalRoot } from '@/lib/p38PortalRoot';
import { useForceLandscape } from '@/hooks/useForceLandscape';

/**
 * Busca global (Ctrl+K / bottom nav).
 * No mobile o overlay fica montado no stage de paisagem (ou body) para alinhar com o ecrã rotacionado.
 */
export default function GlobalSearchOverlay({
  open,
  onClose,
  isMobile,
  isDark,
  searchableItems,
  onNavigate,
}) {
  const forceLandscape = useForceLandscape();
  const handleBackdropClose = useCallback(() => {
    if (shouldSuppressGlobalSearchBackdropClose()) return;
    onClose?.();
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  if (!isMobile && !open) return null;

  const portalRoot = getP38PortalRoot();
  if (!portalRoot) return null;

  const shellZ = SHELL_Z.search;

  if (isMobile) {
    return createPortal(
      <div
        className={cn(
          'p38-portal-overlay font-din-1451 sidebar-shell:hidden',
          !open && 'pointer-events-none'
        )}
        style={{ zIndex: shellZ }}
        onClick={open ? handleBackdropClose : undefined}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Busca de funcionalidades"
      >
        {open ? (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
        ) : null}
        <div
          className={cn(
            'relative z-[1] w-full px-3',
            forceLandscape ? 'pt-3' : 'pt-[calc(0.75rem+env(safe-area-inset-top,0px))]',
            !open && 'pointer-events-none opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GlobalSearchBar
            isDark={isDark}
            searchableItems={searchableItems}
            active={open}
            autoFocus={false}
            showClose
            atTop
            onClose={onClose}
            onNavigate={onNavigate}
          />
        </div>
      </div>,
      portalRoot
    );
  }

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/25 backdrop-blur-[1px]"
        style={{ zIndex: shellZ }}
        aria-label="Fechar busca"
        onClick={handleBackdropClose}
      />
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-3 font-din-1451 pointer-events-none"
        style={{ zIndex: shellZ }}
      >
        <div className="pointer-events-auto">
          <GlobalSearchBar
            isDark={isDark}
            searchableItems={searchableItems}
            active={open}
            autoFocus
            showClose
            onClose={onClose}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </>,
    document.body
  );
}
