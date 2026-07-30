import React from 'react';
import { cn } from '@/components/utils';
import { normalizeDataText } from '@/lib/normalizeDataText';

/**
 * Exibe texto da base de dados sempre em maiúsculas.
 * Use para nomes, descrições, categorias, centros — não para rótulos de UI.
 */
export function P38Data({ children, className, as: Tag = 'span', ...props }) {
  const content =
    typeof children === 'string' || typeof children === 'number'
      ? normalizeDataText(children)
      : children;

  return (
    <Tag className={cn('p38-data', className)} data-p38="data" {...props}>
      {content}
    </Tag>
  );
}
