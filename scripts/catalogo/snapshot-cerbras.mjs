#!/usr/bin/env node
/**
 * Snapshot catálogo Cerbras → docs/imports-local/catalogo/revestimentos/cerbras/
 *
 * npm run catalogo:snapshot-cerbras
 * npm run catalogo:snapshot-cerbras -- --images   # inclui og:image (mais lento)
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
} from '../lib/cerbrasSnapshot.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const withImages = args.includes('--images');

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
    snapshot: 'cerbras/snapshot.json',
    count: meta.count,
    exportedAt: meta.exportedAt,
    withImages: meta.withImages,
    match: {
      roteamento: ['46x46', '33x46', '56x56', '57x57', '70x70'],
      nota: 'Formato 46×46 esquenta; imagens via --images no snapshot',
    },
  };

  return indice;
}

async function main() {
  process.stderr.write(`Cerbras: a ler sitemap${withImages ? ' + imagens' : ''}…\n`);
  const raw = await fetchAllProdutos({
    withImages,
    onProgress: (done, total) => process.stderr.write(`… imagens ${done}/${total}\n`),
  });
  const snapshot = buildSnapshot(raw);

  const meta = {
    fabricante: FABRICANTE.slug,
    exportedAt: snapshot.exportedAt,
    count: snapshot.count,
    source: snapshot.source,
    withImages,
    formatos: Object.keys(snapshot.por_formato).sort(),
    com_imagem: snapshot.produtos.filter((p) => p.imagem_url).length,
  };

  if (dryRun) {
    console.log(JSON.stringify({ meta, amostra: snapshot.produtos.slice(0, 3) }, null, 2));
    return;
  }

  ensureDir(fabricanteDir(FABRICANTE.slug));
  writeJson(snapshotPath(FABRICANTE.slug), snapshot);
  writeJson(metaPath(FABRICANTE.slug), meta);
  writeJson(indicePath(), upsertIndice(meta));

  console.log(JSON.stringify({
    ok: true,
    fabricante: FABRICANTE.nome,
    count: meta.count,
    com_imagem: meta.com_imagem,
    formatos: meta.formatos.length,
    snapshot: snapshotPath(FABRICANTE.slug),
    indice: indicePath(),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
