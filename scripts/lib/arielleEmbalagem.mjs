/**
 * Embalagem Arielle (Carmelo Fior / Polo SE) — tabela própria por formato.
 * Fonte: Catálogo Arielle 2023 (embalagem nacional) + ficha HD 84×84.
 * Não reutiliza Formigres.
 */
import { normFmt } from './formigresCatalog.mjs';

/** Tamanho nominal → tamanho comercial na ficha de embalagem. */
const FORMATO_ALIASES = {
  '36x58': '37x59',
  '83x83': '84x84',
};

/**
 * @type {Record<string, { m2PorCaixa: number, caixasPorPalete: number, pesoKgCaixa: number, pesoKgPalete?: number, pecasPorCaixa?: number, fonte?: string }>}
 */
const ARIELLE_EMBALAGEM_POR_FORMATO = {
  // Catálogo Arielle 2023 — linha retificada/bold (tabela nacional)
  '37x59': {
    m2PorCaixa: 2.43,
    pecasPorCaixa: 11,
    caixasPorPalete: 48,
    pesoKgCaixa: 32.0,
    pesoKgPalete: 1556,
    fonte: 'catalogo-arielle-2023',
  },
  '54x54': {
    m2PorCaixa: 2.62,
    pecasPorCaixa: 9,
    caixasPorPalete: 64,
    pesoKgCaixa: 33.0,
    pesoKgPalete: 2132,
    fonte: 'catalogo-arielle-2023',
  },
  '68x68': {
    m2PorCaixa: 2.79,
    pecasPorCaixa: 6,
    caixasPorPalete: 30,
    pesoKgCaixa: 38.0,
    pesoKgPalete: 1161,
    fonte: 'catalogo-arielle-2023',
  },
  '67x67': {
    m2PorCaixa: 2.71,
    pecasPorCaixa: 6,
    caixasPorPalete: 30,
    pesoKgCaixa: 36.9,
    pesoKgPalete: 1126,
    fonte: 'catalogo-arielle-2023',
  },
  // Linha HD grande formato — ficha comercial (ex. Cintra Plus 84×84 RT)
  '84x84': {
    m2PorCaixa: 2.81,
    pecasPorCaixa: 4,
    caixasPorPalete: 24,
    pesoKgCaixa: 44.8,
    pesoKgPalete: 1075,
    fonte: 'ficha-arielle-hd-84x84',
  },
};

function normFormato(raw) {
  let fmt = normFmt(raw);
  if (FORMATO_ALIASES[fmt]) fmt = FORMATO_ALIASES[fmt];
  return fmt;
}

/**
 * @returns {{ m2_por_caixa: number|null, caixas_por_palete: number|null, peso_kg_caixa: number|null, m2_por_palete: number|null, peso_kg_palete: number|null, formato: string, embalagem_marca: 'arielle', embalagem_fonte?: string }}
 */
export function resolveEmbalagemArielle(prod) {
  const fmtOrig = normFmt(prod?.formato || prod?.titulo || '');
  const fmt = normFormato(prod?.formato || prod?.titulo || '');
  const row = fmt ? ARIELLE_EMBALAGEM_POR_FORMATO[fmt] : null;

  const m2PorCaixa = row?.m2PorCaixa ?? null;
  const caixasPorPalete = row?.caixasPorPalete ?? null;
  const pesoKgCaixa = row?.pesoKgCaixa ?? null;

  let m2PorPalete = m2PorCaixa && caixasPorPalete
    ? Math.round(m2PorCaixa * caixasPorPalete * 100) / 100
    : null;
  let pesoKgPalete = row?.pesoKgPalete ?? null;
  if (!pesoKgPalete && pesoKgCaixa && caixasPorPalete) {
    pesoKgPalete = Math.round(pesoKgCaixa * caixasPorPalete * 10) / 10;
  }

  return {
    formato: fmtOrig || fmt,
    formato_embalagem: fmt,
    m2_por_caixa: m2PorCaixa,
    caixas_por_palete: caixasPorPalete,
    peso_kg_caixa: pesoKgCaixa,
    m2_por_palete: m2PorPalete,
    peso_kg_palete: pesoKgPalete,
    embalagem_marca: 'arielle',
    embalagem_fonte: row?.fonte || null,
  };
}

export { ARIELLE_EMBALAGEM_POR_FORMATO, FORMATO_ALIASES as ARIELLE_EMBALAGEM_ALIASES };
