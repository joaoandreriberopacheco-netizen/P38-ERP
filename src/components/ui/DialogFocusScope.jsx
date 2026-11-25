import * as React from 'react';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { cn } from '@/lib/utils';

/**
 * Focus trap para modais renderizados com createPortal (fora do Radix Dialog).
 */
export default function DialogFocusScope({
  className,
  children,
  trapped = true,
  onMountAutoFocus,
  onUnmountAutoFocus,
  ...props
}) {
  return (
    <FocusScope
      trapped={trapped}
      loop
      className={cn(className)}
      onMountAutoFocus={onMountAutoFocus}
      onUnmountAutoFocus={onUnmountAutoFocus}
      {...props}
    >
      {children}
    </FocusScope>
  );
}
