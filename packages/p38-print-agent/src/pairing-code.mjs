import { randomInt } from 'crypto';

/** Código numérico de 6 dígitos (sem formatação). */
export function generateAgentPairingCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** "123456" | "123-456" → "123456" */
export function normalizePairingCode(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

/** "123456" → "123-456" */
export function formatPairingCode(value) {
  const digits = normalizePairingCode(value);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function isValidPairingCode(value) {
  return normalizePairingCode(value).length === 6;
}
