/**
 * Embalagem Formigres (SP) por formato — m²/caixa, caixas/palete, peso (kg/caixa).
 * Base: ficha técnica NBR 13006 (formigres.com.br) + referências comerciais premium.
 * Arielle usa `arielleEmbalagem.mjs` (tabela própria Carmelo Fior / Polo SE).
 */
import { normFmt } from './formigresCatalog.mjs';

const FORMATO_ALIASES = { '87x87': '88x88' };

/** @type {Record<string, { m2PorCaixa: number, caixasPorPalete: number, pesoKgCaixa?: number }>} */
const EMBALAGEM_POR_FORMATO = {
  '45x45': { m2PorCaixa: 2.0, caixasPorPalete: 50, pesoKgCaixa: 28 },
  '32x45': { m2PorCaixa: 2.0, caixasPorPalete: 50, pesoKgCaixa: 26 },
  '50x50': { m2PorCaixa: 2.5, caixasPorPalete: 40, pesoKgCaixa: 32 },
  '60x60': { m2PorCaixa: 2.15, caixasPorPalete: 40, pesoKgCaixa: 35 },
  '34x60': { m2PorCaixa: 2.1, caixasPorPalete: 40, pesoKgCaixa: 34 },
  '20x60': { m2PorCaixa: 1.46, caixasPorPalete: 52, pesoKgCaixa: 24 },
  '33x59': { m2PorCaixa: 2.02, caixasPorPalete: 40, pesoKgCaixa: 34 },
  '61x61': { m2PorCaixa: 2.23, caixasPorPalete: 36, pesoKgCaixa: 38 },
  '66x66': { m2PorCaixa: 2.18, caixasPorPalete: 36, pesoKgCaixa: 41 },
  '88x88': { m2PorCaixa: 2.32, caixasPorPalete: 28, pesoKgCaixa: 45 },
  '81x81': { m2PorCaixa: 2.2, caixasPorPalete: 30, pesoKgCaixa: 42 },
  '60x120': { m2PorCaixa: 2.16, caixasPorPalete: 24, pesoKgCaixa: 41 },
  '20x120': { m2PorCaixa: 2.4, caixasPorPalete: 24, pesoKgCaixa: 43 },
  '32x66': { m2PorCaixa: 2.12, caixasPorPalete: 32, pesoKgCaixa: 38 },
  '43x88': { m2PorCaixa: 2.1, caixasPorPalete: 28, pesoKgCaixa: 40 },
  '40x81': { m2PorCaixa: 2.05, caixasPorPalete: 30, pesoKgCaixa: 38 },
};

const KG_POR_M2_FALLBACK = 19;

function normFormato(raw) {
  let fmt = normFmt(raw);
  if (FORMATO_ALIASES[fmt]) fmt = FORMATO_ALIASES[fmt];
  return fmt;
}

/**
 * @returns {{ m2_por_caixa: number, caixas_por_palete: number, peso_kg_caixa: number, m2_por_palete: number, peso_kg_palete: number, formato: string }}
 */
export function resolveEmbalagemFormigres(prod) {
  const fmt = normFormato(prod?.formato || prod?.titulo || '');
  const row = fmt ? EMBALAGEM_POR_FORMATO[fmt] : null;
  const m2PorCaixa = row?.m2PorCaixa ?? null;
  const caixasPorPalete = row?.caixasPorPalete ?? null;
  let pesoKgCaixa = row?.pesoKgCaixa ?? null;
  if (m2PorCaixa && !pesoKgCaixa) {
    pesoKgCaixa = Math.round(m2PorCaixa * KG_POR_M2_FALLBACK * 10) / 10;
  }
  const m2PorPalete = m2PorCaixa && caixasPorPalete
    ? Math.round(m2PorCaixa * caixasPorPalete * 100) / 100
    : null;
  const pesoKgPalete = pesoKgCaixa && caixasPorPalete
    ? Math.round(pesoKgCaixa * caixasPorPalete * 10) / 10
    : null;

  return {
    formato: fmt,
    m2_por_caixa: m2PorCaixa,
    caixas_por_palete: caixasPorPalete,
    peso_kg_caixa: pesoKgCaixa,
    m2_por_palete: m2PorPalete,
    peso_kg_palete: pesoKgPalete,
    embalagem_marca: 'formigres',
  };
}
