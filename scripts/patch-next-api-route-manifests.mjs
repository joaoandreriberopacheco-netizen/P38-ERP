#!/usr/bin/env node
/**
 * Vercel CLI (59.x) falha no trace se App Route API não tiver
 * route_client-reference-manifest.js (Next só gera para rotas com client graph).
 */
import fs from 'node:fs';
import path from 'node:path';

const serverApp = path.join(process.cwd(), '.next/server/app');
if (!fs.existsSync(serverApp)) {
  console.warn('[patch-next-api-route-manifests] .next/server/app ausente — skip.');
  process.exit(0);
}

function appRouteKeyFromDir(relDir) {
  const segments = relDir.split('/').filter(Boolean);
  return `/${segments.join('/')}/route`;
}

function sourcePathFromDir(relDir) {
  return `/workspace/app/${relDir}/route.next`;
}

function writeStub(manifestPath, routeKey, sourcePath) {
  const manifest = {
    moduleLoading: { prefix: '/_next/' },
    ssrModuleMapping: {},
    edgeSSRModuleMapping: {},
    clientModules: {},
    entryCSSFiles: {
      '/workspace/': [],
      [sourcePath]: [],
    },
    rscModuleMapping: {},
    edgeRscModuleMapping: {},
  };
  const body = `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST[${JSON.stringify(routeKey)}]=${JSON.stringify(manifest)};`;
  fs.writeFileSync(manifestPath, body, 'utf8');
}

let patched = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    if (ent.name !== 'route.js') continue;

    const manifestPath = path.join(dir, 'route_client-reference-manifest.js');
    if (fs.existsSync(manifestPath)) continue;

    const relDir = path.relative(serverApp, dir).replace(/\\/g, '/');
    const routeKey = appRouteKeyFromDir(relDir);
    const sourcePath = sourcePathFromDir(relDir);
    writeStub(manifestPath, routeKey, sourcePath);
    patched += 1;
    console.log(`[patch-next-api-route-manifests] criado ${manifestPath} (${routeKey})`);
  }
}

walk(serverApp);
console.log(`[patch-next-api-route-manifests] ${patched} ficheiro(s).`);
