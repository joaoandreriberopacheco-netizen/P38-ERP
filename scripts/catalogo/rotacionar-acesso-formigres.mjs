#!/usr/bin/env node
/**
 * Gera novo caminho secreto do catálogo Formigres e actualiza vercel.json.
 * O link antigo (raiz ou slug anterior) deixa de abrir o catálogo após deploy.
 *
 * npm run catalogo:rotacionar-acesso-formigres
 */
import {
  applyAccessSlug,
  FORMIGRES_DEPLOY_DIR,
  generateAccessSlug,
  readAccessSlug,
} from '../lib/catalogoFormigresAcesso.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const custom = args.find((a) => !a.startsWith('-'));
const force = args.includes('--yes') || args.includes('-y');

const catalogHtml = `${FORMIGRES_DEPLOY_DIR}/catalogo.html`;
const legacyIndex = `${FORMIGRES_DEPLOY_DIR}/index.html`;

if (!fs.existsSync(catalogHtml) && fs.existsSync(legacyIndex)) {
  const stat = fs.statSync(legacyIndex);
  if (stat.size > 500_000) {
    fs.renameSync(legacyIndex, catalogHtml);
    console.error('Migração: index.html → catalogo.html');
  }
}

const previous = readAccessSlug();
const slug = custom?.trim() || generateAccessSlug();

if (previous && previous !== slug && !force) {
  console.error(
    `Já existe slug "${previous}". Para substituir, use: npm run catalogo:rotacionar-acesso-formigres -- --yes`,
  );
  process.exit(1);
}

const url = applyAccessSlug(slug);
console.log(JSON.stringify({ ok: true, slug, url, previousSlug: previous || null }, null, 2));
console.error('\nPartilhe só este link (após deploy na Vercel):\n' + url + '\n');
