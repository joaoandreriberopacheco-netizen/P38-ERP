#!/usr/bin/env node
/**
 * Baixa logo Ecuaceramica para assets locais.
 * npm run catalogo:fetch-ecuaceramica-logo
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'scripts', 'catalogo', 'assets', 'ecuaceramica-logo.jpg');
const URL = 'https://ecuaceramica.com/img/ecuaceramica-logo-1599789363.jpg';

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Logo ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log(JSON.stringify({ ok: true, out: OUT, bytes: buf.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
