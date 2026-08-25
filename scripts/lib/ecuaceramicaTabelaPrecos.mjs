/**
 * Preços demonstrativos Ecuaceramica (portfolio P38) — não são preços reais da fábrica.
 */
import { normFmt } from './formigresCatalog.mjs';

export const TABELA_ECUA_META = {
  id: 'ecuaceramica-demo-portfolio',
  moeda: 'BRL',
  nota: 'Valores ilustrativos para demonstração comercial P38 — não vinculam Ecuaceramica',
  atualizadoEm: '2026-08-25',
};

/** Preço m² demo por formato (R$). */
const PRECO_POR_FORMATO = {
  '15x60': 74.9,
  '60x60': 89.9,
  '60x120': 109.9,
  '30x60': 79.9,
  '30x120': 99.9,
  '20x120': 119.9,
  '80x80': 129.9,
  '75x75': 119.9,
  '45x45': 69.9,
};

const PRECO_POR_LINHA = {
  polida: 18,
  retificada: 8,
  bold: 0,
};

export function resolvePrecoEcuaceramica(prod, classif) {
  const fmt = normFmt(prod?.formato || '');
  const base = fmt ? PRECO_POR_FORMATO[fmt] : null;
  if (base == null) {
    return { preco: null, faixa: null, motivo: 'formato_sem_tabela_demo' };
  }
  const extra = PRECO_POR_LINHA[classif?.linha] ?? 0;
  const preco = Math.round((base + extra) * 100) / 100;
  const faixa = classif?.linha === 'polida' ? 'polida' : (classif?.linha === 'retificada' ? 'retificada' : 'bold');
  return { preco, faixa, motivo: 'tabela_demo_portfolio' };
}
