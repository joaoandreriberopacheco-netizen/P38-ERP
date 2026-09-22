#!/usr/bin/env node
/** Excel + PDF catálogo completo. npm run export:catalogo-completo */
import { spawnSync } from 'node:child_process';

for (const script of ['export-catalogo-completo-xlsx.mjs', 'export-pdf-catalogo-completo.mjs']) {
  const run = spawnSync('node', [`scripts/${script}`], { stdio: 'inherit' });
  if ((run.status ?? 1) !== 0) process.exit(run.status ?? 1);
}
