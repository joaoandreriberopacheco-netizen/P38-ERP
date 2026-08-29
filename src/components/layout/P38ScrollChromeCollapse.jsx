import { cn } from '@/lib/utils';

/** Animação suave de colapso do chrome superior (grid 0fr/1fr). */
export function P38ScrollChromeCollapse({
  visible = true,
  enabled = true,
  children,
  className,
}) {
  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        visible ? 'grid-rows-[auto]' : 'grid-rows-[0fr]',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
