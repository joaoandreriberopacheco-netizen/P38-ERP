import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LancamentoModalStackContext = createContext(null);

/** Conta modais/drawers abertos dentro do formulário de lançamento (data, pickers, confirmação). */
export function LancamentoModalStackProvider({ children }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((c) => c + 1);
    return () => setCount((c) => Math.max(0, c - 1));
  }, []);
  const value = useMemo(() => ({ register, count }), [register, count]);
  return (
    <LancamentoModalStackContext.Provider value={value}>
      {children}
    </LancamentoModalStackContext.Provider>
  );
}

export function useLancamentoModalStackDepth() {
  const ctx = useContext(LancamentoModalStackContext);
  return ctx?.count ?? 0;
}

export function useRegisterLancamentoModalOpen(open) {
  const ctx = useContext(LancamentoModalStackContext);
  useEffect(() => {
    if (!open || !ctx?.register) return undefined;
    return ctx.register();
  }, [open, ctx]);
}

/** Radix Dialog: foca o primeiro campo interativo ao abrir (sem voltar ao modal de baixo). */
export function focusPrimeiroCampoModal(event) {
  event.preventDefault();
  const root = event.currentTarget;
  requestAnimationFrame(() => {
    if (!(root instanceof HTMLElement)) return;
    const candidato =
      root.querySelector('input:not([type="hidden"]):not([disabled])')
      || root.querySelector('button:not([disabled])')
      || root.querySelector('[tabindex="0"]');
    candidato?.focus();
  });
}
