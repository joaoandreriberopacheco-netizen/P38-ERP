/**
 * Preços Ecuaceramica — site publica preço por CAIXA (USD).
 * Catálogo P38 exibe preço/m² = preço_caixa ÷ m²/caixa (embalagem oficial).
 */
import { resolveEmbalagemEcuaceramica } from './ecuaceramicaEmbalagem.mjs';

export const TABELA_ECUA_META = {
  id: 'ecuaceramica-site-caixa-para-m2',
  moeda: 'USD',
  unidadeSite: 'caixa',
  unidadeCatalogo: 'm2',
  nota: 'Preço/m² calculado a partir do preço por caixa do site ÷ m²/caixa (packing list oficial)',
  atualizadoEm: '2026-08-25',
};

/** Converte string PrestaShop "$ 44,16" → 44.16 */
export function parsePrecoCaixaUsd(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const s = String(raw).replace(/[^\d,.-]/g, '').trim();
  if (!s) return null;
  // Formato espanhol: 1.234,56 ou 44,16
  const normalized = s.includes(',') && s.includes('.')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.');
  const v = Number(normalized);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function resolvePrecoEcuaceramica(prod, classif) {
  const precoCaixa = parsePrecoCaixaUsd(prod?.preco_caixa ?? prod?.price_amount);
  const emb = resolveEmbalagemEcuaceramica(prod);
  const m2 = emb.m2_por_caixa;

  if (!precoCaixa) {
    return {
      preco: null,
      preco_caixa: null,
      faixa: null,
      motivo: prod?.preco_motivo_site || 'preco_caixa_indisponivel_no_site',
    };
  }
  if (!m2 || m2 <= 0) {
    return {
      preco: null,
      preco_caixa: precoCaixa,
      faixa: null,
      motivo: 'formato_sem_embalagem_oficial',
    };
  }

  const precoM2 = Math.round((precoCaixa / m2) * 100) / 100;
  const faixa = classif?.linha === 'polida'
    ? 'polida'
    : (classif?.linha === 'retificada' ? 'retificada' : 'bold');

  return {
    preco: precoM2,
    preco_caixa: precoCaixa,
    faixa,
    motivo: 'site_caixa_div_m2_oficial',
  };
}
