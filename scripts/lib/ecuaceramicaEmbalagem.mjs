/**
 * Embalagem estimada Ecuaceramica — valores demonstrativos por formato (portfolio).
 */
import { normFmt } from './formigresCatalog.mjs';

/** @type {Record<string, { m2PorCaixa: number, caixasPorPalete: number, pesoKgCaixa?: number }>} */
const EMBALAGEM_POR_FORMATO = {
  '15x60': { m2PorCaixa: 0.9, caixasPorPalete: 48, pesoKgCaixa: 22 },
  '60x60': { m2PorCaixa: 1.44, caixasPorPalete: 40, pesoKgCaixa: 32 },
  '60x120': { m2PorCaixa: 2.16, caixasPorPalete: 24, pesoKgCaixa: 40 },
  '30x60': { m2PorCaixa: 1.08, caixasPorPalete: 48, pesoKgCaixa: 24 },
  '30x120': { m2PorCaixa: 2.16, caixasPorPalete: 24, pesoKgCaixa: 38 },
  '20x120': { m2PorCaixa: 2.4, caixasPorPalete: 24, pesoKgCaixa: 42 },
  '80x80': { m2PorCaixa: 1.92, caixasPorPalete: 30, pesoKgCaixa: 38 },
  '75x75': { m2PorCaixa: 1.69, caixasPorPalete: 32, pesoKgCaixa: 36 },
  '45x45': { m2PorCaixa: 2.0, caixasPorPalete: 50, pesoKgCaixa: 28 },
};

const KG_POR_M2_FALLBACK = 19;

export function resolveEmbalagemEcuaceramica(prod) {
  const fmt = normFmt(prod?.formato || '');
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
    embalagem_marca: 'ecuaceramica',
    embalagem_fonte: 'estimativa_portfolio',
  };
}
