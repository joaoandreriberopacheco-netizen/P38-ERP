#!/usr/bin/env node
/**
 * Baixa o logotipo oficial Arielle (Carmelo Fior) e gera scripts/catalogo/assets/arielle-logo.webp
 *
 * Fonte: https://www.carmelofior.com.br/download-logos
 * npm run catalogo:fetch-arielle-logo
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'scripts', 'catalogo', 'assets');
const PNG_PATH = path.join(OUT_DIR, 'arielle-logo-oficial.png');
const WEBP_PATH = path.join(OUT_DIR, 'arielle-logo.webp');

/** Metadados embutidos na página download-logos (Logo/index público no HTML). */
const ARIELLE_LOGO = {
  title: 'Arielle',
  logo_png: 'Logo ARIELLE colorida.png',
  sourcePage: 'https://www.carmelofior.com.br/download-logos',
};

const LOGO_BASE = 'https://www.carmelofior.com.br/public/images/logo';

async function main() {
  const url = `${LOGO_BASE}/${encodeURIComponent(ARIELLE_LOGO.logo_png)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'P38-ERP-catalogo/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Download falhou (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(PNG_PATH, buf);

  const metaIn = await sharp(PNG_PATH).metadata();
  await sharp(PNG_PATH)
    .trim()
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(WEBP_PATH);
  const metaOut = await sharp(WEBP_PATH).metadata();

  console.log(JSON.stringify({
    ok: true,
    source: ARIELLE_LOGO.sourcePage,
    url,
    png: PNG_PATH,
    webp: WEBP_PATH,
    sizeIn: `${metaIn.width}x${metaIn.height}`,
    sizeOut: `${metaOut.width}x${metaOut.height}`,
    pngKb: Math.round(buf.length / 1024),
    webpKb: Math.round(fs.statSync(WEBP_PATH).size / 1024),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
