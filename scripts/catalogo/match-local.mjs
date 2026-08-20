#!/usr/bin/env node
/**
 * Match offline contra catálogo local (Formigres primeiro).
 *
 * npm run catalogo:match -- "PISO 45X45 A ALLURE BR HD 45 (2) PEI 4"
 */
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { findInSnapshot, loadSnapshotFromFile } from '../lib/formigresSnapshot.mjs';
import { routeFabricante } from '../lib/esquentaItens.mjs';
import { normFmtFromDesc } from '../lib/esquentaItens.mjs';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Uso: npm run catalogo:match -- "PISO 45X45 A ALLURE BR HD 45"');
  process.exit(1);
}

const formato = normFmtFromDesc(query);
const fabricante = routeFabricante(query, formato);

if (fabricante !== 'Formigres') {
  console.log(JSON.stringify({
    descricao: query,
    formato,
    fabricante_esperado: fabricante,
    status: 'fora_formigres',
    nota: fabricante
      ? `Roteamento indica ${fabricante} — catálogo local ainda não disponível`
      : 'Formato fora do esquema ou fabricante não mapeado',
  }, null, 2));
  process.exit(0);
}

const snapshot = loadSnapshotFromFile(readJson(snapshotPath('formigres')));
if (!snapshot) {
  console.error('Snapshot Formigres não encontrado. Rode: npm run catalogo:snapshot-formigres');
  process.exit(1);
}

const { parsed, match, score, reason, pool } = findInSnapshot(snapshot, query);
console.log(JSON.stringify({
  descricao: query,
  fabricante: 'Formigres',
  termo_busca: parsed.busca,
  formato,
  pool,
  match: match ? {
    id: match.id,
    titulo: match.titulo,
    formato: match.formato,
    acabamento: match.acabamento,
    imagem_url: match.imagem_url,
    produto_url: match.produto_url,
  } : null,
  score,
  status: match ? 'encontrado' : reason,
}, null, 2));
