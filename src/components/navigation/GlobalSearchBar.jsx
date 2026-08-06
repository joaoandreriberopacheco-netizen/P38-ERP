import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import { createPageUrl } from '@/components/utils';
import { getP38ShellColors } from '@/lib/p38ShellColors';
import { cn } from '@/components/utils';
import { createUppercaseInputChangeHandler } from '@/lib/uppercaseInputHandlers';
import { SHELL_SEARCH_DROPDOWN_CLASS } from '@/lib/quickAccessOverlay';
import {
  allowProgrammaticFocusBriefly,
  focusField,
} from '@/lib/focusPolicy';
import { SEARCH_INPUT_PROPS } from '@/lib/searchInputProps';
import { registerGlobalSearchInput, shouldSuppressGlobalSearchBackdropClose } from '@/lib/openGlobalSearch';
import { searchTextIncludes } from '@/lib/normalizeSearchText';

function filterSearchItems(items, query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];
  return items.filter(
    (item) =>
      searchTextIncludes(item.name, trimmed) ||
      (item.parent && searchTextIncludes(item.parent, trimmed))
  );
}

export default function GlobalSearchBar({
  searchableItems = [],
  isDark,
  expanded = true,
  className = '',
  placeholder = 'Buscar…',
  autoFocus = false,
  active = true,
  showClose = false,
  atTop = false,
  showShortcutHint = false,
  shortcutLabel = '',
  collapsedTitle,
  onClose,
  onNavigate,
  onCollapsedActivate,
}) {
  const c = getP38ShellColors(isDark);
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => filterSearchItems(searchableItems, query), [searchableItems, query]);
  const showDropdown = focused && query.trim().length > 0;
  const resultsMaxHeight = atTop ? 'min(70vh, 28rem)' : 'min(50vh, 280px)';

  useEffect(() => {
    if (!autoFocus) return undefined;
    allowProgrammaticFocusBriefly();
    focusField(inputRef.current, { preventScroll: true });
    return undefined;
  }, [autoFocus]);

  useEffect(() => {
    if (active) return undefined;
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
    return undefined;
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;

    const handlePointerDown = (event) => {
      if (shouldSuppressGlobalSearchBackdropClose()) return;
      if (!rootRef.current?.contains(event.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [active]);

  const handleSelect = () => {
    setQuery('');
    setFocused(false);
    onNavigate?.();
    onClose?.();
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => onCollapsedActivate?.()}
        className={cn('w-full flex items-center justify-center rounded-xl transition-colors', className)}
        style={{ padding: '10px' }}
        title={collapsedTitle || placeholder}
        aria-label={collapsedTitle || placeholder}
      >
        <Search size={18} style={{ color: c.iconColor }} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <div
        className="flex items-center gap-2 px-3 h-11 rounded-2xl w-full border border-transparent focus-within:ring-1 focus-within:ring-border/60"
        style={{ background: c.searchBg }}
      >
        <Search className="w-4 h-4 flex-none" style={{ color: c.iconColor }} />
        <input
          ref={(el) => {
            inputRef.current = el;
            registerGlobalSearchInput(el);
          }}
          type="search"
          inputMode="search"
          data-p38-skip-select-on-focus="true"
          {...SEARCH_INPUT_PROPS}
          placeholder={placeholder}
          value={query}
          className="p38-data-uppercase flex-1 bg-transparent text-sm outline-none min-w-0 font-din-1451"
          style={{ color: c.text }}
          onFocus={() => setFocused(true)}
          onChange={createUppercaseInputChangeHandler((e) => {
            setQuery(e.target.value);
            setFocused(true);
          })}
        />
        {showClose && (query || focused) ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFocused(false);
              onClose?.();
            }}
            className="flex-none rounded-md p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Fechar busca"
          >
            <X className="w-4 h-4" style={{ color: c.iconColor }} />
          </button>
        ) : showShortcutHint && shortcutLabel && !query && !focused ? (
          <kbd
            className="hidden desktop-layout:inline-flex flex-none items-center rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground"
            aria-hidden="true"
          >
            {shortcutLabel}
          </kbd>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          className={cn(
            'absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-xl border border-border/40 dark:border-white/10 shadow-lg font-din-1451',
            SHELL_SEARCH_DROPDOWN_CLASS
          )}
          style={{ background: c.cardBg, maxHeight: resultsMaxHeight }}
        >
          <div className="overflow-y-auto overscroll-contain p-1" style={{ maxHeight: resultsMaxHeight }}>
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm" style={{ color: c.textMuted }}>
                Nenhuma funcionalidade encontrada para &quot;{query.trim()}&quot;
              </div>
            ) : (
              results.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={`${item.page}-${item.name}-${idx}`}
                    to={createPageUrl(item.page)}
                    onClick={handleSelect}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    <div
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-md"
                      style={{ background: c.btnBg, color: c.iconColor }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium" style={{ color: c.text }}>
                        {item.name}
                      </div>
                      {item.parent ? (
                        <div className="flex items-center gap-1 text-xs" style={{ color: c.textMuted }}>
                          <span className="truncate">{item.parent}</span>
                          <ChevronRight className="h-3 w-3 flex-none" />
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
