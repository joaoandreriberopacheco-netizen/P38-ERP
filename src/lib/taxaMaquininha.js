import { roundToTwoDecimals } from '@/lib/financialUtils';

/** Tarifa PIX (% sobre o valor da venda). */
export const TAXA_PIX_PERCENTUAL = 0.2;

/** Acréscimo mensal padrão em vendas parceladas (recebimento na hora PagSeguro). */
export const TAXA_MENSAL_PARCELAMENTO_PADRAO = 1.7;

export function getTaxaMensalParFaixa(faixas, parcelas) {
  if (!faixas?.length) return TAXA_MENSAL_PARCELAMENTO_PADRAO;
  for (const f of faixas) {
    if (parcelas >= f.min_parcelas && parcelas <= f.max_parcelas) {
      return f.taxa_mensal_percentual ?? TAXA_MENSAL_PARCELAMENTO_PADRAO;
    }
  }
  return 0;
}

/** Taxa acumulada do vendedor: (parcelas − 1) × taxa mensal da faixa. */
export function getTaxaAcumuladaMensal(faixas, parcelas) {
  if (parcelas <= 1) return 0;
  return (parcelas - 1) * getTaxaMensalParFaixa(faixas, parcelas);
}

function getBaseIntermediacaoParcelado(bandeiraCfg, parcelas) {
  if (parcelas <= 6 && bandeiraCfg.taxa_credito_2_6x != null) {
    return bandeiraCfg.taxa_credito_2_6x;
  }
  if (parcelas >= 7 && bandeiraCfg.taxa_credito_7_12x != null) {
    return bandeiraCfg.taxa_credito_7_12x;
  }
  return bandeiraCfg.taxa_intermediacao_parcelado || 0;
}

/**
 * Calcula tarifas da maquininha.
 * - Débito: taxa_debito
 * - Crédito 1x: taxa_credito_1x
 * - Crédito parcelado: base por faixa (2–6x / 7–12x) + acréscimo mensal
 */
export function calcularTaxaCartao(bandeiraCfg, modalidade, parcelas = 1) {
  if (!bandeiraCfg) {
    return { taxa_intermediacao: 0, taxa_parcelamento: 0, taxa_total: 0 };
  }

  const mod = (modalidade || '').toLowerCase();
  const n = Math.max(1, parseInt(parcelas, 10) || 1);

  if (mod === 'débito' || mod === 'debito') {
    const taxa = bandeiraCfg.taxa_debito || 0;
    return { taxa_intermediacao: taxa, taxa_parcelamento: 0, taxa_total: taxa };
  }

  if (mod.includes('vista') || n === 1) {
    const taxa = bandeiraCfg.taxa_credito_1x || 0;
    return { taxa_intermediacao: taxa, taxa_parcelamento: 0, taxa_total: taxa };
  }

  const taxa_intermediacao = getBaseIntermediacaoParcelado(bandeiraCfg, n);
  const taxa_parcelamento = getTaxaAcumuladaMensal(bandeiraCfg.faixas_parcelamento, n);
  const taxa_total = taxa_intermediacao + taxa_parcelamento;

  return { taxa_intermediacao, taxa_parcelamento, taxa_total };
}

export function calcularTaxaFromMaquininha(maquininha, bandeira, modalidade, parcelas = 1) {
  const cfg = (maquininha?.bandeiras || []).find((b) => b.bandeira === bandeira);
  return calcularTaxaCartao(cfg, modalidade, parcelas);
}

export function calcularValorTarifa(valorBruto, taxaTotalPercent) {
  const bruto = parseFloat(valorBruto) || 0;
  const taxa = parseFloat(taxaTotalPercent) || 0;
  return roundToTwoDecimals(bruto * taxa / 100);
}

export function calcularValorLiquidoAposTarifa(valorBruto, taxaTotalPercent) {
  const bruto = parseFloat(valorBruto) || 0;
  return roundToTwoDecimals(bruto - calcularValorTarifa(bruto, taxaTotalPercent));
}

/** Bandeira padrão com tarifas recebimento na hora (Visa/Master). */
export function bandeiraTarifasPadrao(nome) {
  return {
    bandeira: nome,
    taxa_debito: 1.14,
    taxa_credito_1x: 3.09,
    taxa_credito_2_6x: 2.25,
    taxa_credito_7_12x: 2.2,
    taxa_intermediacao_parcelado: 2.25,
    faixas_parcelamento: [
      { min_parcelas: 2, max_parcelas: 6, taxa_mensal_percentual: TAXA_MENSAL_PARCELAMENTO_PADRAO },
      { min_parcelas: 7, max_parcelas: 12, taxa_mensal_percentual: TAXA_MENSAL_PARCELAMENTO_PADRAO },
    ],
  };
}
