/**
 * Contraste P38 — fórmula WCAG 2.x (luminância relativa + razão de contraste).
 *
 * Uso:
 *   pickForeground('#5c7e44')           → '#ffffff' (texto legível sobre oliva)
 *   contrastRatio('#fafafa', '#161a14') → ~16
 *   meetsContrast('#ffffff', '#fafafa') → false (problema clássico modo claro)
 */

const HEX_RE = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

/** @param {number} channel 0–255 */
function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** @param {string} hex #RRGGBB */
export function hexToRgb(hex) {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

/** Luminância relativa WCAG — 0 (preto) a 1 (branco). */
export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste entre duas cores — mínimo 1, ideal ≥ 4.5 (AA texto normal). */
export function contrastRatio(foregroundHex, backgroundHex) {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Escolhe texto claro ou escuro sobre um fundo, garantindo contraste mínimo.
 * @param {string} backgroundHex
 * @param {{ light?: string, dark?: string, minRatio?: number }} [opts]
 */
export function pickForeground(backgroundHex, opts = {}) {
  const light = opts.light ?? '#ffffff';
  const dark = opts.dark ?? '#1f1d22';
  const minRatio = opts.minRatio ?? 4.5;
  const ratioLight = contrastRatio(light, backgroundHex);
  const ratioDark = contrastRatio(dark, backgroundHex);
  if (ratioLight >= minRatio && ratioLight >= ratioDark) return light;
  if (ratioDark >= minRatio) return dark;
  return ratioLight >= ratioDark ? light : dark;
}

/** @param {string} fg @param {string} bg @param {number} [minRatio=4.5] */
export function meetsContrast(fg, bg, minRatio = 4.5) {
  return contrastRatio(fg, bg) >= minRatio;
}

/**
 * Par fundo+texto para botões P38 — garante borda visível no modo claro.
 * @param {'olive'|'lime'|'citrus'|'muted'} tone
 * @param {boolean} isDark
 */
export function p38ButtonPair(tone, isDark) {
  const pairs = {
    olive: isDark
      ? { bg: '#a4ce33', fg: '#1f1d22', border: '#8fb82a' }
      : { bg: '#5c7e44', fg: '#fafafa', border: '#4a6a36' },
    lime: isDark
      ? { bg: '#a4ce33', fg: '#1f1d22', border: '#8fb82a' }
      : { bg: '#7ba05b', fg: '#ffffff', border: '#5c7e44' },
    citrus: isDark
      ? { bg: '#f07a1a', fg: '#1f1d22', border: '#d96a10' }
      : { bg: '#f07a1a', fg: '#1f1d22', border: '#c45e0e' },
    muted: isDark
      ? { bg: '#26262e', fg: '#fafafa', border: 'rgba(255,255,255,0.12)' }
      : { bg: '#e6ebdc', fg: '#161a14', border: '#c5ceb8' },
  };
  return pairs[tone] ?? pairs.olive;
}
