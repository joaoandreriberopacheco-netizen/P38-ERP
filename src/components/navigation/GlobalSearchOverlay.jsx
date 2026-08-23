import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import GlobalSearchBar from '@/components/navigation/GlobalSearchBar';
import { SHELL_Z } from '@/lib/quickAccessOverlay';
import { cn } from '@/lib/utils';
import { shouldSuppressGlobalSearchBackdropClose } from '@/lib/openGlobalSearch';

/**
 * Busca global (Ctrl+K / bottom nav) — portal no body para prevalecer sobre qualquer tela.
 * No mobile o overlay fica sempre montado (invisível quando fechado) para o input existir
 * no gesto do toque e o teclado nativo abrir de imediato.
 */
export default function GlobalSearchOverlay({
  open,
  onClose,
  isMobile,
  isDark,
  searchableItems,
  onNavigate,
}) {
  const handleBackdropClose = useCallback(() => {
    if (shouldSuppressGlobalSearchBackdropClose()) return;
    onClose?.();
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  if (!isMobile && !open) return null;

  const shellZ = SHELL_Z.search;

  if (isMobile) {
    return createPortal(
      <div
        className={cn(
          'fixed inset-0 font-din-1451 sidebar-shell:hidden',
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
            'relative z-[1] w-full px-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]',
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
      document.body
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
