import { cn } from '@/lib/utils';
import { AUTO_PAGE_CANVAS, AUTO_STOREFRONT_ROOT } from './autoAtendimentoUi';

/** Envólucro da vitrine — tipografia DIN + canvas studio premium. */
export default function AutoStorefrontShell({ children, className }) {
  return (
    <div className={cn(AUTO_STOREFRONT_ROOT, AUTO_PAGE_CANVAS, 'h-full min-h-0 flex flex-col', className)}>
      {children}
    </div>
  );
}
