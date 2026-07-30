/**
 * GlacialTabs — componente de abas padrão do sistema VarejoSync.
 * Estilo: pill container (fundo cinza), aba ativa = branco com sombra sutil.
 * Mobile-first: só ícones em telas pequenas, texto visível no md+.
 */
import React from 'react';
import { cn } from '@/components/utils';

export function GlacialTabsList({ children, className, scrollable = false }) {
  return (
    <div
      className={cn(
        'flex items-center bg-muted rounded-xl p-1 gap-0.5',
        scrollable && 'overflow-x-auto no-scrollbar',
        className
      )}
      style={scrollable ? { WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}
    >
      {children}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
export function GlacialTabsTrigger({ value, activeValue, onSelect, icon: Icon, label, className }) {
  const isActive = value === activeValue;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0 min-h-[36px]',
        isActive
          ? 'bg-card dark:bg-muted text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground',
        className
      )}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      {label && <span className={Icon ? 'hidden md:inline' : ''}>{label}</span>}
    </button>
  );
}

/**
 * Versão underline — para abas secundárias dentro de uma aba principal.
 */
export function GlacialSubTabsList({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-center border-b border-border/40 gap-0 overflow-x-auto no-scrollbar',
        className
      )}
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {children}
    </div>
  );
}

export function GlacialSubTabsTrigger({ value, activeValue, onSelect, icon: Icon, label, className }) {
  const isActive = value === activeValue;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap flex-shrink-0 min-h-[40px]',
        isActive
          ? 'border-border/40 dark:border-border/40 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground',
        className
      )}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      {label && <span className={Icon ? 'hidden md:inline' : ''}>{label}</span>}
    </button>
  );
}