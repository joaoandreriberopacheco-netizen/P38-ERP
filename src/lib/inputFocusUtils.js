/** Seleciona todo o texto ao focar — inputs numéricos pré-preenchidos (PDV, caixa). */
export function selectAllOnFocus(e) {
  const el = e?.target;
  if (el && typeof el.select === 'function') el.select();
}

/** Foca elemento e seleciona todo o conteúdo (ex.: após abrir dialog de pagamento). */
export function focusAndSelect(el) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.focus();
    if (typeof el.select === 'function') el.select();
    requestAnimationFrame(() => {
      if (document.activeElement === el && typeof el.select === 'function') {
        el.select();
      }
    });
  });
}

/**
 * Primeiro clique: foca e seleciona tudo (evita cursor no meio do valor mascarado).
 */
export function selectAllOnMouseDown(e) {
  const el = e?.target;
  if (!el || document.activeElement === el) return;
  e.preventDefault();
  focusAndSelect(el);
}

function inputHasSelection(el) {
  return el.selectionStart != null && el.selectionStart !== el.selectionEnd;
}

/**
 * Keydown para máscara centavos (pt-BR). Com texto selecionado, o dígito substitui — não acrescenta.
 */
export function handleCentavosMaskKeyDown(e, { setInput, setValor, formatDisplay }) {
  const el = e.target;
  const tecla = e.key;
  const hasSelection = inputHasSelection(el);

  const applyFromDigits = (digitsRaw) => {
    const digits = String(digitsRaw ?? '').replace(/\D/g, '') || '0';
    const valor = parseInt(digits, 10) / 100;
    const display = formatDisplay(valor);
    setInput(display);
    setValor(valor);
  };

  if (tecla === 'Backspace' || tecla === 'Delete') {
    e.preventDefault();
    if (hasSelection) {
      applyFromDigits('0');
      return true;
    }
    if (tecla === 'Backspace') {
      const numeros = el.value.replace(/\D/g, '').slice(0, -1) || '0';
      applyFromDigits(numeros);
    }
    return true;
  }

  if (/^\d$/.test(tecla)) {
    e.preventDefault();
    const numeros = hasSelection ? tecla : `${el.value.replace(/\D/g, '')}${tecla}`;
    applyFromDigits(numeros);
    return true;
  }

  return false;
}
