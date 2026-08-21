import React from 'react';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';

const ACCENT_BORDER = {
  default: 'border-l-transparent',
  aprovado: p38Accent.aprovado.border,
  success: p38Accent.success.border,
  warning: p38Accent.warning.border,
  info: p38Accent.info.border,
  danger: p38Accent.danger.border,
  muted: p38Accent.muted.border,
  none: 'border-l-transparent',
};

/** Ponto de status semântico (verde, amarelo, ciano, vermelho). */
export function P38StatusDot({ tone = 'success', className }) {
  const dotClass =
    tone === 'aprovado'
      ? p38Accent.aprovado.dot
      : tone === 'warning'
      ? p38Accent.warning.dot
      : tone === 'info'
        ? p38Accent.info.dot
        : tone === 'danger'
          ? p38Accent.danger.dot
          : tone === 'muted'
            ? p38Accent.muted.dot
            : p38Accent.success.dot;

  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', dotClass, className)} aria-hidden />;
}

/** Linha compacta para listas mobile — inspirada no Relatório de Margem. */
const COMFORTABLE_LINE = 'py-4 tablet-portrait:py-5 min-h-[68px] tablet-portrait:min-h-[74px]';
const COMFORTABLE_TITLE =
  'font-din-1451 font-light text-base sm:text-lg tablet-portrait:text-xl uppercase tracking-wide text-foreground leading-relaxed line-clamp-2 break-words';
const COMFORTABLE_SUBTITLE =
  'text-xs sm:text-sm tablet-portrait:text-base font-light text-muted-foreground line-clamp-2 break-words mt-1 font-din-1451';
const COMFORTABLE_META =
  'text-sm tablet-portrait:text-base normal-case tracking-normal text-muted-foreground font-light font-din-1451';
const COMFORTABLE_VALUE =
  'font-light text-base sm:text-lg tablet-portrait:text-xl text-foreground text-right tabular-nums font-din-1451 whitespace-nowrap';

export function P38MobileLine({
  as: Component = 'div',
  onClick,
  title,
  subtitle,
  meta,
  value,
  valueSub,
  trailing,
  accent = 'default',
  thinAccent = false,
  comfortable = false,
  striped = false,
  className,
  children,
  ...props
}) {
  const rowClass = cn(
    thinAccent ? p38Table.mobileLineThin : p38Table.mobileLine,
    comfortable && COMFORTABLE_LINE,
    ACCENT_BORDER[accent] ?? ACCENT_BORDER.default,
    striped && 'bg-secondary/15 dark:bg-secondary/20',
    onClick && p38Table.mobileLineInteractive,
    className
  );

  if (children) {
    return (
      <Component className={rowClass} onClick={onClick} {...props}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      className={cn(rowClass, 'flex items-center gap-2.5', onClick && (comfortable ? 'min-h-[68px] tablet-portrait:min-h-[74px]' : 'min-h-[56px]'))}
      onClick={onClick}
      {...props}
    >
      <div className="flex-1 min-w-0">
        {title ? (
          <div className={comfortable ? COMFORTABLE_TITLE : p38Table.mobileLineTitle}>
            {typeof title === 'string' ? title.toUpperCase() : title}
          </div>
        ) : null}
        {subtitle ? (
          <div className={comfortable ? COMFORTABLE_SUBTITLE : p38Table.mobileLineSubtitle}>{subtitle}</div>
        ) : null}
        {meta ? (
          <div className={cn(
            'flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 min-w-0',
            comfortable ? COMFORTABLE_META : p38Table.mobileLineMetaInline,
          )}>
            {meta}
          </div>
        ) : null}
      </div>
      {(value || valueSub || trailing) && (
        <div className="flex items-center gap-1.5 shrink-0 max-w-[44%] sm:max-w-[42%]">
          <div className="flex flex-col items-end gap-0.5 min-w-0 max-w-full overflow-hidden">
            {value ? <div className={comfortable ? COMFORTABLE_VALUE : p38Table.mobileLineValue}>{value}</div> : null}
            {valueSub ? <div className={cn(p38Table.mobileLineValueSub, 'truncate max-w-full')}>{valueSub}</div> : null}
          </div>
          {trailing}
        </div>
      )}
    </Component>
  );
}

/** Contentor de lista P38 (sem cards com margem). `allViewports` mantém linhas em tablet/desktop. */
export const P38MobileLineList = React.forwardRef(function P38MobileLineList(
  { className, allViewports = false, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(allViewports ? p38Table.lineListShell : p38Table.mobileListShell, className)}
      {...props}
    >
      {children}
    </div>
  );
});
P38MobileLineList.displayName = 'P38MobileLineList';



/** Mapeia tipo de notificação/UI (success, warning, info, error) para tom P38. */
export function p38TypeTone(type) {
  if (type === 'warning') return 'warning';
  if (type === 'info') return 'info';
  if (type === 'error' || type === 'danger') return 'danger';
  if (type === 'muted') return 'muted';
  return 'success';
}

/** Mapeia texto de status para tom semântico P38. */
export function p38StatusTone(status) {
  if (!status) return 'muted';
  const s = String(status).toLowerCase();
  if (s === 'aprovado') return 'aprovado';
  if (s.includes('cancel') || s.includes('discrep') || s.includes('inutil') || s.includes('rejeit')) return 'danger';
  if (s.includes('pend') || s.includes('aguard') || s.includes('rascunho') || s.includes('parcial')) return 'warning';
  if (s.includes('enviad') || s.includes('transit') || s.includes('cota')) return 'info';
  return 'success';
}

export function p38AccentKeyFromTone(tone) {
  if (tone === 'aprovado') return 'aprovado';
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'info') return 'info';
  if (tone === 'muted') return 'muted';
  return 'success';
}

export function p38StatusTextClass(tone) {
  if (tone === 'aprovado') return p38Accent.aprovado.text;
  if (tone === 'danger') return p38Accent.danger.text;
  if (tone === 'warning') return p38Accent.warning.text;
  if (tone === 'info') return p38Accent.info.text;
  return p38Accent.success.text;
}

/** Ponto + texto colorido para status em linhas/tabelas. */
export function P38StatusLabel({ tone = 'success', children, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <P38StatusDot tone={tone} />
      <span className={p38StatusTextClass(tone)}>{children}</span>
    </span>
  );
}

const PILL_TONE_CLASS = {
  aprovado: 'bg-lime-100 text-lime-800 ring-1 ring-lime-400/45 font-semibold dark:bg-lime-900/30 dark:text-[#a4ce33] dark:ring-lime-500/25',
  success: 'bg-[#4a5240]/10 text-[#4a5240] dark:bg-[#a4ce33]/12 dark:text-[#a4ce33]/85',
  warning: 'bg-[#D96F55]/12 text-[#9c4228] dark:bg-[#D96F55]/15 dark:text-[#D96F55]',
  danger: 'bg-red-500/10 text-red-700 dark:bg-red-950/30 dark:text-red-500',
  info: 'bg-[#4ECDC4]/12 text-[#1a7a73] dark:bg-[#4ECDC4]/15 dark:text-[#4ECDC4]',
  muted: 'bg-muted/80 text-muted-foreground',
};

/** Chip com fundo suave — mesmo padrão de “Despachado” em pedidos de compra. */
export function P38StatusPill({ tone = 'success', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-normal whitespace-nowrap',
        PILL_TONE_CLASS[tone] ?? PILL_TONE_CLASS.success,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Chip métrico horizontal (Receita, Lucro, etc.) — scroll horizontal opcional. */
export function P38MobileMetric({ label, value, tone = 'default', className }) {
  const valueClass =
    tone === 'success'
      ? cn('font-semibold', p38Accent.success.text)
      : tone === 'info'
        ? cn('font-semibold', p38Accent.info.text)
        : tone === 'danger'
          ? cn('font-semibold', p38Accent.danger.text)
          : tone === 'muted'
            ? 'text-muted-foreground'
            : 'text-foreground font-medium';

  return (
    <div className={cn('flex-shrink-0 min-w-[4.25rem] max-w-[5.75rem]', className)}>
      <p className={cn(p38Table.mobileMicroLabel, 'truncate')}>{label}</p>
      <p className={cn('text-[11px] tabular-nums mt-0.5 truncate', valueClass)}>{value}</p>
    </div>
  );
}
