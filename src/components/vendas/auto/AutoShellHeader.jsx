import { cn } from '@/lib/utils';
import { AUTO_HEADER_CLASS, AUTO_HEADER_ACCENT_BAR } from './autoAtendimentoUi';

/** Header partilhado do auto-atendimento — branco, carvão, linha cítrica. */
export default function AutoShellHeader({ children, className }) {
  return (
    <header className={cn(AUTO_HEADER_CLASS, className)}>
      <span className={AUTO_HEADER_ACCENT_BAR} aria-hidden="true" />
      {children}
    </header>
  );
}
