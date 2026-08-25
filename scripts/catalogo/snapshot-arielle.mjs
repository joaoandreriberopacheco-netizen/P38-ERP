#!/usr/bin/env node
/**
 * Snapshot catálogo Arielle (Carmelo Fior) → docs/imports-local/catalogo/revestimentos/arielle/
 *
 * npm run catalogo:snapshot-arielle
 */
import {
  ensureDir,
  fabricanteDir,
  indicePath,
  metaPath,
  readJson,
  snapshotPath,
  writeJson,
} from '../lib/catalogoPaths.mjs';
import {
  FABRICANTE,
  buildSnapshot,
  fetchAllProdutos,
} from '../lib/carmeloFiorSnapshot.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function upsertIndice(meta) {
  const indice = readJson(indicePath(), {
    categoria: 'revestimentos',
    updatedAt: null,
    fabricantes: {},
  });

  indice.updatedAt = new Date().toISOString();
  indice.fabricantes[FABRICANTE.slug] = {
    nome: FABRICANTE.nome,
    grupo: FABRICANTE.grupo,
    site: FABRICANTE.site,
    categoria: FABRICANTE.categoria,
    snapshot: 'arielle/snapshot.json',
    count: meta.count,
    exportedAt: meta.exportedAt,
    match: {
      roteamento: ['37x59', '45x45', '50x50', '60x60', '66x66', '68x68', '84x84'],
      nota: 'Marca Arielle — Carmelo Fior · Polo SE (Nossa Senhora do Socorro/SE)',
    },
  };

  return indice;
}

async function main() {
  process.stderr.write('Arielle (Carmelo Fior): a buscar catálogo…\n');
  let done = 0;
  const raw = await fetchAllProdutos({
    onProgress: (n, total) => {
      if (n !== done) {
        done = n;
        process.stderr.write(`  ${n}/${total}\r`);
      }
    },
  });
  process.stderr.write('\n');
  const snapshot = buildSnapshot(raw);

  const meta = {
    fabricante: FABRICANTE.slug,
    exportedAt: snapshot.exportedAt,
    count: snapshot.count,
    source: snapshot.source,
    formatos: Object.keys(snapshot.por_formato).sort(),
    grupo: FABRICANTE.grupo,
  };

  if (dryRun) {
    console.log(JSON.stringify({ meta, amostra: snapshot.produtos.slice(0, 3) }, null, 2));
    return;
  }

  const dir = fabricanteDir(FABRICANTE.slug);
  ensureDir(dir);

  writeJson(snapshotPath(FABRICANTE.slug), snapshot);
  writeJson(metaPath(FABRICANTE.slug), meta);
  writeJson(indicePath(), upsertIndice(meta));

  console.log(JSON.stringify({
    ok: true,
    fabricante: FABRICANTE.nome,
    grupo: FABRICANTE.grupo,
    count: meta.count,
    formatos: meta.formatos.length,
    snapshot: snapshotPath(FABRICANTE.slug),
    indice: indicePath(),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
