/**
 * Preços demo Ecuaceramica (portfolio P38) — R$/m² por formato (~R$ 40).
 * Se o site publicar preço/caixa (USD), converte para m²; senão usa tabela demo BRL.
 */
import { normFmt } from './formigresCatalog.mjs';
import { resolveEmbalagemEcuaceramica } from './ecuaceramicaEmbalagem.mjs';

export const TABELA_ECUA_META = {
  id: 'ecuaceramica-demo-brl-m2',
  moeda: 'BRL',
  unidadeCatalogo: 'm2',
  nota: 'Valores demonstrativos portfolio P38 (~R$ 40/m² por formato) — não vinculam Ecuaceramica',
  atualizadoEm: '2026-08-25',
};

/** Referência demo ~R$ 40/m² — variação leve por formato. */
const PRECO_DEMO_M2_POR_FORMATO = {
  '15x60': 38.9,
  '30x60': 39.5,
  '60x60': 40.0,
  '60x120': 41.5,
  '20x120': 42.0,
  '30x120': 41.0,
};

const PRECO_DEMO_AJUSTE_LINHA = {
  polida: 2.5,
  retificada: 1.0,
  bold: 0,
};

/** Converte string PrestaShop "$ 44,16" → 44.16 */
export function parsePrecoCaixaSite(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const s = String(raw).replace(/[^\d,.-]/g, '').trim();
  if (!s) return null;
  const normalized = s.includes(',') && s.includes('.')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.');
  const v = Number(normalized);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function faixaFromClassif(classif) {
  if (classif?.linha === 'polida') return 'polida';
  if (classif?.linha === 'retificada') return 'retificada';
  return 'bold';
}

export function resolvePrecoEcuaceramica(prod, classif) {
  const emb = resolveEmbalagemEcuaceramica(prod);
  const m2 = emb.m2_por_caixa;
  const precoCaixaSite = parsePrecoCaixaSite(prod?.preco_caixa ?? prod?.price_amount);
  const faixa = faixaFromClassif(classif);

  if (precoCaixaSite && m2 > 0) {
    const precoM2 = Math.round((precoCaixaSite / m2) * 100) / 100;
    return {
      preco: precoM2,
      preco_caixa: Math.round(precoCaixaSite * 100) / 100,
      faixa,
      motivo: 'site_caixa_div_m2_oficial',
      moeda: 'USD',
    };
  }

  const fmt = normFmt(prod?.formato || '');
  const base = fmt ? PRECO_DEMO_M2_POR_FORMATO[fmt] : null;
  if (base == null) {
    return {
      preco: null,
      preco_caixa: null,
      faixa: null,
      motivo: 'formato_sem_tabela_demo',
      moeda: 'BRL',
    };
  }

  const extra = PRECO_DEMO_AJUSTE_LINHA[classif?.linha] ?? 0;
  const precoM2 = Math.round((base + extra) * 100) / 100;
  const precoCaixa = m2 > 0 ? Math.round(precoM2 * m2 * 100) / 100 : null;

  return {
    preco: precoM2,
    preco_caixa: precoCaixa,
    faixa,
    motivo: 'demo_brl_por_formato',
    moeda: 'BRL',
  };
}
