#!/usr/bin/env node
/**
 * Snapshot catálogo Formigres → docs/imports-local/catalogo/revestimentos/formigres/
 *
 * npm run catalogo:snapshot-formigres
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
} from '../lib/formigresSnapshot.mjs';

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
    site: FABRICANTE.site,
    categoria: FABRICANTE.categoria,
    snapshot: 'formigres/snapshot.json',
    count: meta.count,
    exportedAt: meta.exportedAt,
    match: {
      roteamento: ['45x45', '50x50', '60x60', '61x61', '66x66', '81x81', '88x88'],
      nota: 'PD-xxxxx e DESIGN ESM → Incefra (não Formigres)',
    },
  };

  return indice;
}

async function main() {
  process.stderr.write('Formigres: a buscar catálogo completo…\n');
  const raw = await fetchAllProdutos();
  const snapshot = buildSnapshot(raw);

  const meta = {
    fabricante: FABRICANTE.slug,
    exportedAt: snapshot.exportedAt,
    count: snapshot.count,
    source: snapshot.source,
    formatos: Object.keys(snapshot.por_formato).sort(),
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
