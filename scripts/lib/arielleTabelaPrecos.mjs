/**
 * Preços Arielle — base Formigres com desconto leve (~3%).
 */
import { resolvePrecoFormigres, TABELA_FORMIGRES_META } from './formigresTabelaPrecos.mjs';
import { normFmt } from './formigresCatalog.mjs';

/** Formato Carmel Fior → formato tabela Formigres mais próximo. */
const FORMATO_PRECO_ALIASES = {
  '83x83': '88x88',
  '84x84': '88x88',
  '67x67': '66x66',
  '68x68': '66x66',
  '54x54': '50x50',
  '57x57': '50x50',
  '37x59': '33x59',
  '36x58': '33x59',
  '38x75': '34x60',
  '37x74': '34x60',
  '62x62': '61x61',
  '75x75': '66x66',
  '74x74': '66x66',
  '90x90': '88x88',
  '80x80': '88x88',
  '56x100': '60x120',
  '41x90': '34x60',
  '31x60': '34x60',
  '31x31': '32x45',
  '32x57': '32x45',
  '32x60': '34x60',
  '20x60': '34x60',
};

/** ~3% abaixo da tabela Formigres (um pouquinho mais barato). */
export const ARIELLE_DESCONTO_FATOR = 0.97;

export const TABELA_ARIELLE_META = {
  tipo: 'arielle-formigres-derivado',
  base: TABELA_FORMIGRES_META.tipo,
  descontoFator: ARIELLE_DESCONTO_FATOR,
  formatoAliases: FORMATO_PRECO_ALIASES,
};

function normFormato(raw) {
  let fmt = normFmt(raw);
  if (FORMATO_PRECO_ALIASES[fmt]) fmt = FORMATO_PRECO_ALIASES[fmt];
  return fmt;
}

function roundPreco(v) {
  return Math.round(v * 100) / 100;
}

/**
 * @returns {{ preco: number|null, faixa: string|null, motivo?: string, preco_base?: number|null }}
 */
export function resolvePrecoArielle(prod, classif) {
  const fmtOrig = normFmt(prod?.formato || prod?.titulo || '');
  const fmt = normFormato(fmtOrig);
  const prodPreco = { ...prod, formato: fmt };

  const attempts = [
    { prod: prodPreco, classif, tag: 'directo' },
  ];

  if (fmtOrig === '37x59') {
    attempts.push({
      prod: { ...prodPreco, formato: '33x59', tipo: 'RETIFICADO' },
      classif: { ...classif, linha: 'retificada' },
      tag: '37x59->33x59-rt',
    });
    attempts.push({
      prod: { ...prodPreco, formato: '34x60', tipo: 'BOLD' },
      classif: { ...classif, linha: 'bold' },
      tag: '37x59->34x60',
    });
  }
  if (fmtOrig === '68x68') {
    attempts.push({
      prod: { ...prodPreco, formato: '66x66', acabamento: 'MATE', tipo: 'BOLD' },
      classif: { ...classif, linha: 'bold', subtipo: 'lisa', variante_lisa: 'mate' },
      tag: '68x68->66x66-mate',
    });
    attempts.push({
      prod: { ...prodPreco, formato: '61x61', tipo: 'BOLD' },
      classif: { ...classif, linha: 'bold' },
      tag: '68x68->61x61',
    });
  }
  if (fmtOrig === '67x67') {
    attempts.push({
      prod: { ...prodPreco, formato: '66x66', acabamento: 'MATE', tipo: 'BOLD' },
      classif: { ...classif, linha: 'bold', subtipo: 'lisa', variante_lisa: 'mate' },
      tag: '67x67->66x66-mate',
    });
    attempts.push({
      prod: { ...prodPreco, formato: '60x60', tipo: 'RETIFICADO' },
      classif: { ...classif, linha: 'retificada' },
      tag: '67x67->60x60-rt',
    });
  }

  for (const attempt of attempts) {
    const base = resolvePrecoFormigres(attempt.prod, attempt.classif);
    if (base.preco == null) continue;
    const preco = roundPreco(base.preco * ARIELLE_DESCONTO_FATOR);
    return {
      preco,
      preco_base: base.preco,
      faixa: base.faixa ? `arielle-${base.faixa}` : null,
      motivo: attempt.tag === 'directo'
        ? (fmtOrig !== fmt ? `alias-${fmtOrig}->${fmt}` : 'formigres-97pct')
        : `${attempt.tag};formigres-97pct`,
    };
  }

  return { preco: null, faixa: null, preco_base: null, motivo: 'fora-tabela' };
}
