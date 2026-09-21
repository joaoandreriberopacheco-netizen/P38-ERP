/** Cupom térmico do orçamento — papel 72mm com margem interna de 1cm em cada lado. */
export const ORCAMENTO_CUPOM_FORMATO = '72mm';

export const ORCAMENTO_CUPOM_PAPEL_MM = 72;
export const ORCAMENTO_CUPOM_MARGEM_MM = 10;
export const ORCAMENTO_CUPOM_LARGURA_UTIL_MM =
  ORCAMENTO_CUPOM_PAPEL_MM - 2 * ORCAMENTO_CUPOM_MARGEM_MM;

export const ORCAMENTO_CUPOM_LABEL = 'Cupom 72mm';

/** Aceita legado `80mm` gravado em sessões anteriores. */
export function isOrcamentoFormatoCupom(formato) {
  return formato === ORCAMENTO_CUPOM_FORMATO || formato === '80mm';
}

export function normalizeOrcamentoFormatoCupom(formato) {
  return formato === 'a4' ? 'a4' : ORCAMENTO_CUPOM_FORMATO;
}

export function orcamentoCupomLarguraPreviewPx() {
  return Math.round(ORCAMENTO_CUPOM_PAPEL_MM * 3.7795);
}

export function orcamentoCupomPageSizeCss() {
  return `${ORCAMENTO_CUPOM_PAPEL_MM}mm auto`;
}

/** Estilo base do container `#cupom-print` (orçamento térmico). */
export function orcamentoCupomContainerStyle(extra = {}) {
  return {
    width: `${ORCAMENTO_CUPOM_PAPEL_MM}mm`,
    boxSizing: 'border-box',
    padding: `4mm ${ORCAMENTO_CUPOM_MARGEM_MM}mm`,
    background: '#fff',
    ...extra,
  };
}
