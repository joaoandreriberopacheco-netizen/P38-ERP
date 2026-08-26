/** Rolo térmico 80mm — margens laterais ~10mm cada (área útil ~60mm). */
export const CUPOM_PAPEL_MM = 80;
export const CUPOM_MARGEM_LATERAL_MM = 10;
export const CUPOM_LARGURA_IMPRESSAO_MM = CUPOM_PAPEL_MM - 2 * CUPOM_MARGEM_LATERAL_MM;
export const CUPOM_LARGURA_IMPRESSAO_CSS = `${CUPOM_LARGURA_IMPRESSAO_MM}mm`;
export const CUPOM_PAPEL_CSS = `${CUPOM_PAPEL_MM}mm`;

/** Cupom térmico — Barlow Light (300) em todo o cupom. */
export const CUPOM_FONT_WEIGHT = 300;
export const CUPOM_FONT = "'Barlow', sans-serif";
export const CUPOM_FONT_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@300&display=swap';
