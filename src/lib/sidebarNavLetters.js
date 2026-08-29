import { isTypingTarget } from '@/lib/globalSearchShortcut';

/** Letra de atalho (A–Z) para o índice visível no menu. */
export function indexToNavLetter(index) {
  if (index < 0 || index > 25) return null;
  return String.fromCharCode(65 + index);
}

/** Índice 0-based a partir de uma tecla a–z / A–Z. */
export function letterKeyToIndex(key) {
  if (!key || key.length !== 1) return -1;
  const code = key.toLowerCase().charCodeAt(0) - 97;
  return code >= 0 && code <= 25 ? code : -1;
}

export { isTypingTarget };
