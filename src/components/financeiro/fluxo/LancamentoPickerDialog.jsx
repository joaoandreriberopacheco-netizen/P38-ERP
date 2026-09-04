import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

/** Camadas do stack de diálogos do formulário de lançamento. */
export const Z_LANCAMENTO = {
  backdrop: 59,
  form: 60,
  pickerOverlay: 68,
  picker: 70,
  confirmOverlay: 72,
  confirm: 72,
};

/** Classes Tailwind para diálogos/drawers acima do formulário (z 59–60). */
export function lancamentoStackClasses(level = 1) {
  if (level >= 3) {
    return { overlay: 'z-[76] bg-black/70', content: 'z-[78]' };
  }
  if (level >= 2) {
    return { overlay: 'z-[72] bg-black/70', content: 'z-[72]' };
  }
  if (level >= 1) {
    return { overlay: 'z-[68] bg-black/70', content: 'z-[70]' };
  }
  return { overlay: undefined, content: undefined };
}

const sheetBodyClass = 'flex min-h-0 flex-1 flex-col overflow-hidden';

const drawerSheetClass =
  'z-[70] mt-0 flex h-[min(85dvh,640px)] max-h-[85dvh] flex-col gap-0 rounded-t-[28px] border-0 bg-background p-0 shadow-2xl ' +
  '[&>:first-child]:hidden';

const dialogSheetClass =
  'z-[70] flex max-h-[85dvh] w-full max-w-md flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl';

function SheetChrome({ title, children, bodyClassName }) {
  return (
    <>
      <div className="shrink-0 border-b border-border/30 px-5 pb-3 pt-5">
        <p className="text-lg font-semibold leading-tight text-foreground">{title}</p>
      </div>
      <div className={cn(sheetBodyClass, 'px-5 pb-5 pt-3', bodyClassName)}>
        {children}
      </div>
    </>
  );
}

/**
 * Picker do formulário de lançamento.
 * Mobile: bottom sheet fixo (Vaul, sem reposicionar com teclado).
 * Desktop: dialog centrado.
 */
export default function LancamentoPickerDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
  bodyClassName,
}) {
  const isMobile = useCompactShell();

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        repositionInputs={false}
        shouldScaleBackground={false}
      >
        <DrawerContent
          overlayClassName="z-[68] bg-black/70"
          className={cn(drawerSheetClass, className)}
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <SheetChrome title={title} bodyClassName={bodyClassName}>
            {children}
          </SheetChrome>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[68] bg-black/70"
        className={cn(dialogSheetClass, className)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <SheetChrome title={title} bodyClassName={bodyClassName}>
          {children}
        </SheetChrome>
      </DialogContent>
    </Dialog>
  );
}

/** Sheet/dialog compacto — data, confirmação, etc. */
export function LancamentoFormSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  elevated = false,
}) {
  const isMobile = useCompactShell();
  const overlayZ = elevated ? 'z-[72]' : 'z-[68]';
  const contentZ = elevated ? 'z-[72]' : 'z-[70]';

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        repositionInputs={false}
        shouldScaleBackground={false}
      >
        <DrawerContent
          overlayClassName={cn(overlayZ, 'bg-black/70')}
          className={cn(
            drawerSheetClass,
            'h-auto max-h-[min(70dvh,420px)]',
            contentZ,
            className,
          )}
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 pb-5 pt-5">
            {title && (
              <p className="mb-4 text-lg font-semibold leading-tight text-foreground">{title}</p>
            )}
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={cn(overlayZ, 'bg-black/70')}
        className={cn('max-w-sm rounded-2xl', contentZ, className)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use LancamentoFormSheet */
export function lancamentoStackDialogClass(extra = '') {
  return cn('z-[72] sm:max-w-sm', extra);
}

/** @deprecated Use LancamentoFormSheet */
export const lancamentoStackOverlayClass = 'z-[72] bg-black/70';
