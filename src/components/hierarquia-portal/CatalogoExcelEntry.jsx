import React from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';

/** TreeGrid ligada ao Excel / portal_catalog com drill-down por camada. */
export default function CatalogoExcelEntry({ className, variant = 'outline', size = 'sm' }) {
  const isIcon = size === 'icon';

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        !isIcon && 'gap-1.5 border-dashed border-emerald-500/50 text-emerald-800 dark:text-emerald-200/90',
        className,
      )}
      asChild
    >
      <Link
        to={createPageUrl('CatalogoExcel')}
        title="Catálogo Excel — árvore completa do manifest com drill-down"
        aria-label="Catálogo Excel"
      >
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!isIcon && (
          <>
            <span className="hidden sm:inline">Excel drill-down</span>
            <span className="sm:hidden">Excel</span>
          </>
        )}
      </Link>
    </Button>
  );
}
