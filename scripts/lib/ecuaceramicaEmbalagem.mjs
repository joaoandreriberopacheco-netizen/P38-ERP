/**
 * Embalagem Ecuaceramica — tabela oficial "Información de embalaje" (site fábrica).
 * Porcelanato + cerâmica + formatos especiais (portfolio usa sobretudo porcelanato).
 */
import { normFmt } from './formigresCatalog.mjs';

/** @type {Record<string, {
 *   pecasPorCaixa: number,
 *   m2PorCaixa: number,
 *   pesoKgCaixa: number,
 *   caixasPorPalete: number,
 *   m2PorPalete: number,
 *   pesoKgPalete: number,
 *   linha?: string,
 * }>} */
const EMBALAGEM_OFICIAL = {
  // — Cerámica —
  '20x60': { linha: 'ceramica', pecasPorCaixa: 13, m2PorCaixa: 1.58, pesoKgCaixa: 27.3, caixasPorPalete: 64, m2PorPalete: 101.12, pesoKgPalete: 1782 },
  '30x60': { linha: 'ceramica', pecasPorCaixa: 9, m2PorCaixa: 1.64, pesoKgCaixa: 27.9, caixasPorPalete: 48, m2PorPalete: 78.72, pesoKgPalete: 1374 },
  '30x60-rect': { linha: 'ceramica', pecasPorCaixa: 9, m2PorCaixa: 1.6, pesoKgCaixa: 27.9, caixasPorPalete: 48, m2PorPalete: 76.8, pesoKgPalete: 1374 },
  '31x31': { linha: 'ceramica', pecasPorCaixa: 20, m2PorCaixa: 2, pesoKgCaixa: 25.78, caixasPorPalete: 72, m2PorPalete: 144, pesoKgPalete: 1891 },
  '40x40': { linha: 'ceramica', pecasPorCaixa: 12, m2PorCaixa: 2, pesoKgCaixa: 31, caixasPorPalete: 48, m2PorPalete: 96, pesoKgPalete: 1523 },
  '50x50': { linha: 'ceramica', pecasPorCaixa: 6, m2PorCaixa: 1.5, pesoKgCaixa: 29.2, caixasPorPalete: 64, m2PorPalete: 96, pesoKgPalete: 1904 },
  '62x62': { linha: 'ceramica', pecasPorCaixa: 5, m2PorCaixa: 1.92, pesoKgCaixa: 38, caixasPorPalete: 32, m2PorPalete: 61.44, pesoKgPalete: 1250 },
  // — Formatos especiales —
  '7.5x25': { linha: 'especial', pecasPorCaixa: 54, m2PorCaixa: 1.04, pesoKgCaixa: 15, caixasPorPalete: 48, m2PorPalete: 49.92, pesoKgPalete: 755 },
  '7.5x30': { linha: 'especial', pecasPorCaixa: 44, m2PorCaixa: 1.02, pesoKgCaixa: 15, caixasPorPalete: 48, m2PorPalete: 48.96, pesoKgPalete: 755 },
  '12.7x40': { linha: 'especial', pecasPorCaixa: 20, m2PorCaixa: 1.05, pesoKgCaixa: 15, caixasPorPalete: 60, m2PorPalete: 63, pesoKgPalete: 935 },
  // — Porcelanato (catálogo portfolio) —
  '15x60': { linha: 'porcelanato', pecasPorCaixa: 12, m2PorCaixa: 1.06, pesoKgCaixa: 20, caixasPorPalete: 64, m2PorPalete: 67.84, pesoKgPalete: 1315 },
  '30x60': { linha: 'porcelanato', pecasPorCaixa: 8, m2PorCaixa: 1.44, pesoKgCaixa: 30, caixasPorPalete: 48, m2PorPalete: 69.12, pesoKgPalete: 1475 },
  '60x60': { linha: 'porcelanato', pecasPorCaixa: 5, m2PorCaixa: 1.8, pesoKgCaixa: 35, caixasPorPalete: 32, m2PorPalete: 57.6, pesoKgPalete: 1160 },
  '20x120': { linha: 'porcelanato', pecasPorCaixa: 7, m2PorCaixa: 1.65, pesoKgCaixa: 36.2, caixasPorPalete: 45, m2PorPalete: 74.25, pesoKgPalete: 1665 },
  '30x120': { linha: 'porcelanato', pecasPorCaixa: 5, m2PorCaixa: 1.79, pesoKgCaixa: 40, caixasPorPalete: 36, m2PorPalete: 64.44, pesoKgPalete: 1475 },
  '60x120': { linha: 'porcelanato', pecasPorCaixa: 2, m2PorCaixa: 1.44, pesoKgCaixa: 32, caixasPorPalete: 40, m2PorPalete: 57.6, pesoKgPalete: 1299 },
};

export const EMBALAGEM_ECUA_META = {
  fonte: 'ecuaceramica_informacion_embalaje',
  nota: 'Información de embalaje — site Ecuaceramica (Equador)',
  atualizadoEm: '2026-08-25',
};

export function resolveEmbalagemEcuaceramica(prod) {
  const fmt = normFmt(prod?.formato || '');
  const row = fmt ? EMBALAGEM_OFICIAL[fmt] : null;

  return {
    formato: fmt,
    pecas_por_caixa: row?.pecasPorCaixa ?? null,
    m2_por_caixa: row?.m2PorCaixa ?? null,
    caixas_por_palete: row?.caixasPorPalete ?? null,
    peso_kg_caixa: row?.pesoKgCaixa ?? null,
    m2_por_palete: row?.m2PorPalete ?? null,
    peso_kg_palete: row?.pesoKgPalete ?? null,
    embalagem_marca: 'ecuaceramica',
    embalagem_fonte: row ? EMBALAGEM_ECUA_META.fonte : null,
    embalagem_linha: row?.linha ?? null,
  };
}
