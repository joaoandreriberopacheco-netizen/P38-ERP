import { cn } from '@/components/utils';
import {
  P38_PAGE_KICKER,
  P38_PAGE_SUBTITLE,
  P38_PAGE_TITLE,
  P38_SECTION_TITLE,
  P38_SHELL_DESC,
  P38_SHELL_TITLE,
} from '@/lib/p38FormTypography';

const TITLE_BY_VARIANT = {
  shell: P38_SHELL_TITLE,
  page: P38_PAGE_TITLE,
  compact: cn(P38_SHELL_TITLE, 'text-base md:text-lg'),
};

const DESC_BY_VARIANT = {
  shell: P38_SHELL_DESC,
  page: P38_PAGE_SUBTITLE,
  compact: cn(P38_PAGE_SUBTITLE, 'text-xs'),
};

/**
 * Cabeçalho padrão de página — hierarquia título / descrição / acções.
 * @param {'shell'|'page'|'compact'} variant
 */
export function P38PageHeader({
  title,
  description,
  kicker,
  variant = 'shell',
  className,
  titleClassName,
  children,
}) {
  const titleClass = TITLE_BY_VARIANT[variant] ?? P38_SHELL_TITLE;
  const descClass = DESC_BY_VARIANT[variant] ?? P38_SHELL_DESC;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {kicker ? <p className={P38_PAGE_KICKER}>{kicker}</p> : null}
          {title ? (
            <h1 className={cn(titleClass, kicker && 'mt-0.5', 'truncate', titleClassName)}>
              {title}
            </h1>
          ) : null}
          {description ? (
            <p className={cn(descClass, (title || kicker) && 'mt-0.5')}>{description}</p>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

/** Título de secção ou cartão navegável (ex.: atalho na Central de Estoque). */
export function P38SectionHeader({ title, description, className, as: Tag = 'h2' }) {
  return (
    <div className={cn('min-w-0', className)}>
      <Tag className={P38_SECTION_TITLE}>{title}</Tag>
      {description ? <p className={cn(P38_SHELL_DESC, 'mt-0.5 text-xs')}>{description}</p> : null}
    </div>
  );
}
