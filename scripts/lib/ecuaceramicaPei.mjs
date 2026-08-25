/**
 * PEI (Porcelain Enamel Institute) — normalização a partir do site Ecuaceramica.
 * Campo origem: feature "Alto Tráfico" (ex.: "PEI 4", "PEI 3", "Si").
 */

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

function parsePeiToken(token) {
  const t = String(token || '').trim().toUpperCase();
  if (t in ROMAN) return ROMAN[t];
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null;
}

/** @returns {{ pei: number|null, pei_label: string|null, pei_raw: string, pei_fonte: string }} */
export function normalizePeiEcuaceramica(raw = '') {
  const pei_raw = String(raw || '').trim();
  if (!pei_raw) {
    return { pei: null, pei_label: null, pei_raw: '', pei_fonte: 'ausente' };
  }

  const m = pei_raw.match(/PEI\s*([0-5]|I{1,3}|IV|V)/i);
  if (m) {
    const pei = parsePeiToken(m[1]);
    if (pei != null) {
      return { pei, pei_label: `PEI ${pei}`, pei_raw, pei_fonte: 'site_explicito' };
    }
  }

  if (/^si$/i.test(pei_raw)) {
    return {
      pei: null,
      pei_label: 'Si',
      pei_raw,
      pei_fonte: 'site_alto_trafico',
    };
  }

  const lone = parsePeiToken(pei_raw);
  if (lone != null) {
    return { pei: lone, pei_label: `PEI ${lone}`, pei_raw, pei_fonte: 'site_numero' };
  }

  return { pei: null, pei_label: pei_raw, pei_raw, pei_fonte: 'site_texto' };
}

export const PEI_LEGENDA = {
  0: 'Decorativo — não recomendado para piso',
  1: 'Tráfego muito leve (pés descalços / solas macias)',
  2: 'Residencial leve (ex.: WC, quartos internos)',
  3: 'Residencial médio (calçado normal, pouco abrasivo)',
  4: 'Residencial/comercial médio-alto (salas, cozinhas, escritórios)',
  5: 'Comercial intenso (shoppings, hotéis, aeroportos)',
};

export function peiLegenda(pei) {
  if (pei == null) return '';
  return PEI_LEGENDA[pei] || '';
}
