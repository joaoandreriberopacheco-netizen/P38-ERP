/**
 * Caminho secreto do catálogo Formigres (deploy Vercel estático).
 * O slug vive em vercel.json (rewrites) e access-slug.json (gerador HTML).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
export const FORMIGRES_DEPLOY_DIR = path.join(ROOT, 'deploy', 'catalogo-formigres');
const SLUG_FILE = path.join(FORMIGRES_DEPLOY_DIR, 'access-slug.json');
const VERCEL_JSON = path.join(FORMIGRES_DEPLOY_DIR, 'vercel.json');
/** @returns {string} */
function formigresSiteOrigin() {
  const raw = process.env.CATALOGO_FORMIGRES_PUBLIC_URL || 'https://p38-fg-catalogo-2be33ba9.vercel.app/';
  try {
    return new URL(raw).origin;
  } catch {
    return 'https://p38-fg-catalogo-2be33ba9.vercel.app';
  }
}

/** @returns {string} */
export function generateAccessSlug() {
  return `fg-${crypto.randomBytes(12).toString('hex')}`;
}

/** @returns {{ slug: string, rotatedAt?: string } | null} */
export function readAccessSlugFile() {
  if (!fs.existsSync(SLUG_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(SLUG_FILE, 'utf8'));
    const slug = String(data.slug || '').trim();
    if (!slug) return null;
    return { slug, rotatedAt: data.rotatedAt };
  } catch {
    return null;
  }
}

/** @returns {string | null} */
export function readAccessSlug() {
  return readAccessSlugFile()?.slug ?? null;
}

/** @param {string} slug */
export function buildPublicUrl(slug) {
  const origin = formigresSiteOrigin();
  if (!slug) return `${origin}/`;
  return `${origin}/${slug}/`;
}

/**
 * Grava slug + rewrites Vercel. Devolve URL completa para partilhar.
 * @param {string} slug
 */
export function applyAccessSlug(slug) {
  const clean = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!clean || !/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error('Slug inválido (use letras, números, _ e -).');
  }

  const vercel = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'));
  vercel.rewrites = [
    { source: `/${clean}`, destination: '/catalogo.html' },
    { source: `/${clean}/`, destination: '/catalogo.html' },
  ];
  fs.writeFileSync(VERCEL_JSON, `${JSON.stringify(vercel, null, 2)}\n`);

  const rotatedAt = new Date().toISOString();
  fs.writeFileSync(SLUG_FILE, `${JSON.stringify({ slug: clean, rotatedAt }, null, 2)}\n`);

  return buildPublicUrl(clean);
}
