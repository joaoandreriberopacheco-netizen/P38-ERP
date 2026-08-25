#!/usr/bin/env node
/**
 * Snapshot catálogo Ecuaceramica (Equador) → docs/imports-local/catalogo/revestimentos/ecuaceramica/
 *
 * npm run catalogo:snapshot-ecuaceramica
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
} from '../lib/ecuaceramicaSnapshot.mjs';

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
    pais: FABRICANTE.pais,
    snapshot: 'ecuaceramica/snapshot.json',
    count: meta.count,
    exportedAt: meta.exportedAt,
    portfolio: true,
    nota: FABRICANTE.nota,
    match: {
      roteamento: meta.formatos,
      nota: 'Portfolio white-label P38 — porcelanato público ecuaceramica.com',
    },
  };

  return indice;
}

async function main() {
  process.stderr.write('Ecuaceramica (Equador): a buscar catálogo porcelanato…\n');
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
    portfolio: true,
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
    formatos: meta.formatos,
    snapshot: snapshotPath(FABRICANTE.slug),
    indice: indicePath(),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
