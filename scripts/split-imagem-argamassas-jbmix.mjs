#!/usr/bin/env node
/**
 * Recorta a imagem composta JBMIX 15kg em 3 PNGs (AC-III, AC-II, AC-I).
 * Requer: python3 + Pillow.
 *
 * npm run split:imagem-argamassas-jbmix -- <caminho-imagem-composta.png>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'assets', 'argamassas-jbmix');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Uso: npm run split:imagem-argamassas-jbmix -- <imagem-composta.png>');
  process.exit(1);
}

const py = `
from PIL import Image
src = r'''${src.replace(/'/g, "\\'")}'''
out_dir = r'''${OUT_DIR}'''
im = Image.open(src).convert('RGBA')
w, h = im.size

def trim(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

labels = ['ac3-15kg', 'ac2-15kg', 'ac1-15kg']
third = w / 3
for i, slug in enumerate(labels):
    x0 = int(i * third + (w * 0.01 if i > 0 else 0))
    x1 = int((i + 1) * third - (w * 0.01 if i < 2 else 0))
    crop = trim(im.crop((x0, 0, x1, h)))
    bg = Image.new('RGBA', crop.size, (255, 255, 255, 255))
    bg.paste(crop, mask=crop.split()[3])
    bg.convert('RGB').save(f'{out_dir}/{slug}.png', optimize=True)
    print(slug, bg.size)
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const result = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status || 1);
}
console.log(result.stdout);
console.log('[split] Gravado em', OUT_DIR);
