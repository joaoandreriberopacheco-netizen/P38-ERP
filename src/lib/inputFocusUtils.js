/** Seleciona todo o texto ao focar — inputs numéricos pré-preenchidos (PDV, caixa). */
export function selectAllOnFocus(e) {
  const el = e?.target;
  if (el && typeof el.select === 'function') el.select();
}

/** Foca elemento e seleciona todo o conteúdo (ex.: após abrir dialog de pagamento). */
export function focusAndSelect(el) {
  if (!el) return;
  el.focus();
  if (typeof el.select === 'function') el.select();
}
