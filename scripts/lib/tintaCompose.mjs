import sharp from 'sharp';

export const TINTA_CANVAS = 800;

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Compõe lata oficial centrada sobre fundo na cor (ou neutro).
 * @param {Buffer} productBuf — PNG da lata
 * @param {string} hex — cor de fundo
 * @param {{ canvas?: number }} opts
 */
export async function composeTintaImage(productBuf, hex, opts = {}) {
  const canvas = opts.canvas || TINTA_CANVAS;
  const productH = Math.round(canvas * 0.72);
  const productPng = await sharp(productBuf)
    .resize({ height: productH, fit: 'inside' })
    .png()
    .toBuffer();
  const meta = await sharp(productPng).metadata();
  const left = Math.round((canvas - meta.width) / 2);
  const top = Math.round((canvas - meta.height) / 2);
  const bg = await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 3,
      background: hexToRgb(hex),
    },
  }).png().toBuffer();

  return sharp(bg)
    .composite([{ input: productPng, left, top }])
    .png()
    .toBuffer();
}
