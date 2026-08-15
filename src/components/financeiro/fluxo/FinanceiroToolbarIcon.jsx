import React from 'react';
import { PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const FINANCEIRO_TOOLBAR_ICON_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p38-field-surface border-0 transition-opacity hover:opacity-90';

function iconButtonClass(active, className) {
  return cn(
    FINANCEIRO_TOOLBAR_ICON_CLASS,
    active && 'ring-1 ring-[#4a5240] dark:ring-[#a4ce33]',
    className,
  );
}

/** Ícone 32×32 com rótulo no hover (desktop) e aria-label (mobile/leitor). */
export function FinanceiroToolbarIcon({
  label,
  active = false,
  className,
  children,
  ...buttonProps
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={iconButtonClass(active, className)}
          aria-label={label}
          {...buttonProps}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[14rem] text-center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Gatilho popover compacto — ícone + tooltip; painel abre no clique/toque. */
export function FinanceiroPopoverToolbarIcon({
  label,
  active = false,
  className,
  children,
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={iconButtonClass(active, className)}
            aria-label={label}
          >
            {children}
          </button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[14rem] text-center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
