#!/usr/bin/env node
/**
 * Vercel CLI (prebuilt) espera route_client-reference-manifest.js para cada App Route.
 * Com pageExtensions `route.next.js`, o Next gera só route.js — o trace falha com ENOENT.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appServer = path.join(root, '.next', 'server', 'app');

function walk(dir, visitFile) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visitFile);
    else visitFile(full, dir);
  }
}

function manifestKeyForRoute(routeDir) {
  const rel = path.relative(appServer, routeDir).replace(/\\/g, '/');
  return `/${rel}/route`;
}

function writeStub(routeDir) {
  const manifestPath = path.join(routeDir, 'route_client-reference-manifest.js');
  if (fs.existsSync(manifestPath)) return false;
  const key = manifestKeyForRoute(routeDir);
  const body = {
    moduleLoading: { prefix: '/_next/' },
    ssrModuleMapping: {},
    edgeSSRModuleMapping: {},
    clientModules: {},
    entryCSSFiles: {},
    rscModuleMapping: {},
    edgeRscModuleMapping: {},
  };
  const content = `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST[${JSON.stringify(key)}]=${JSON.stringify(body)};\n`;
  fs.writeFileSync(manifestPath, content);
  console.log(`[fix-route-manifest] stub ${path.relative(root, manifestPath)}`);
  return true;
}

let created = 0;
walk(appServer, (filePath, parentDir) => {
  if (path.basename(filePath) !== 'route.js') return;
  if (writeStub(parentDir)) created += 1;
});

if (created === 0) {
  console.log('[fix-route-manifest] nada a corrigir (ou .next/server/app ausente).');
}
