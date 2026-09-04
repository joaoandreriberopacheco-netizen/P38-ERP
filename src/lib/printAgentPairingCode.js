/** Código de ligação agente ↔ P38 (6 dígitos, máscara 000-000). */

export function normalizePairingCode(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

export function formatPairingCode(value) {
  const digits = normalizePairingCode(value);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function isValidPairingCode(value) {
  return normalizePairingCode(value).length === 6;
}

/** Aplica máscara enquanto o utilizador digita. */
export function maskPairingCodeInput(raw) {
  return formatPairingCode(raw);
}
