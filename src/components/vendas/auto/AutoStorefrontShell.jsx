import { cn } from '@/lib/utils';
import { AUTO_SHELL_BG, AUTO_STOREFRONT_ROOT } from './autoAtendimentoUi';

/** Envólucro da vitrine — tipografia DIN + fundo branco editorial. */
export default function AutoStorefrontShell({ children, className }) {
  return (
    <div className={cn(AUTO_STOREFRONT_ROOT, AUTO_SHELL_BG, 'h-full min-h-0 flex flex-col', className)}>
      {children}
    </div>
  );
}
