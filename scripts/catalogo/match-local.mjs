#!/usr/bin/env node
/**
 * Match offline contra catálogo local (Formigres + Cerbras).
 *
 * npm run catalogo:match -- "PISO 46X46 A AURORA BEGE (1.005101) (2"
 */
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { findInSnapshot as findCerbras, loadSnapshotFromFile as loadCerbras } from '../lib/cerbrasSnapshot.mjs';
import { findInSnapshot as findFormigres, loadSnapshotFromFile as loadFormigres } from '../lib/formigresSnapshot.mjs';
import { routeFabricante, normFmtFromDesc } from '../lib/esquentaItens.mjs';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Uso: npm run catalogo:match -- "PISO 45X45 A ALLURE..."');
  process.exit(1);
}

const formato = normFmtFromDesc(query);
const fabricante = routeFabricante(query, formato);

const FABRICANTES_LOCAL = {
  Formigres: {
    slug: 'formigres',
    snapshotCmd: 'npm run catalogo:snapshot-formigres',
    find: findFormigres,
    load: loadFormigres,
    minScore: 30,
  },
  Cerbras: {
    slug: 'cerbras',
    snapshotCmd: 'npm run catalogo:snapshot-cerbras',
    find: findCerbras,
    load: loadCerbras,
    minScore: 28,
  },
};

const cfg = FABRICANTES_LOCAL[fabricante];
if (!cfg) {
  console.log(JSON.stringify({
    descricao: query,
    formato,
    fabricante_esperado: fabricante,
    status: 'catalogo_pendente',
    nota: fabricante
      ? `${fabricante} — catálogo local ainda não disponível`
      : 'Formato fora do esquema ou fabricante não mapeado',
  }, null, 2));
  process.exit(0);
}

const snapshot = cfg.load(readJson(snapshotPath(cfg.slug)));
if (!snapshot) {
  console.error(`Snapshot ${fabricante} não encontrado. Rode: ${cfg.snapshotCmd}`);
  process.exit(1);
}

const { parsed, match, score, reason, pool } = cfg.find(snapshot, query, { minScore: cfg.minScore });

console.log(JSON.stringify({
  descricao: query,
  fabricante,
  termo_busca: parsed.busca,
  formato,
  pool,
  match: match ? {
    id: match.id,
    titulo: match.titulo,
    formato: match.formato,
    acabamento: match.acabamento,
    imagem_url: match.imagem_url || '',
    produto_url: match.produto_url,
  } : null,
  score,
  status: match ? 'encontrado' : reason,
}, null, 2));
