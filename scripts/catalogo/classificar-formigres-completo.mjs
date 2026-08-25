#!/usr/bin/env node
/**
 * Catálogo completo Formigres (snapshot) com preços Tintão onde existir cruzamento.
 *
 * npm run catalogo:classificar-formigres
 */
import fs from 'node:fs';
import path from 'node:path';
import { classificarFormigres, resumirClassificacoes } from '../lib/formigresClassificar.mjs';
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { loadSnapshotFromFile } from '../lib/formigresSnapshot.mjs';

const ROOT = process.cwd();
const TINTAO_CLASSIF_DIR = path.join(ROOT, 'docs', 'imports-local', 'tintao', 'classificacao');
const OUT_DIR = path.join(ROOT, 'docs', 'imports-local', 'formigres', 'classificacao');

function findLatestTintaoClassif() {
  if (!fs.existsSync(TINTAO_CLASSIF_DIR)) return null;
  const files = fs.readdirSync(TINTAO_CLASSIF_DIR)
    .filter((f) => /^tintao-formigres-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  return files[0] ? path.join(TINTAO_CLASSIF_DIR, files[0]) : null;
}

function buildTintaoPriceMap(tintaoJsonPath) {
  const map = new Map();
  if (!tintaoJsonPath) return map;
  const data = readJson(tintaoJsonPath);
  for (const row of data?.itens || []) {
    const id = String(row.formigres_id || '').trim();
    const preco = Number(row.preco_m2);
    if (id && Number.isFinite(preco) && preco > 0) map.set(id, preco);
  }
  return map;
}

function main() {
  const snapshot = loadSnapshotFromFile(readJson(snapshotPath('formigres')));
  if (!snapshot?.produtos?.length) {
    console.error('Snapshot Formigres ausente. Rode: npm run catalogo:snapshot-formigres');
    process.exit(1);
  }

  const tintaoPath = findLatestTintaoClassif();
  const priceMap = buildTintaoPriceMap(tintaoPath);

  const rows = snapshot.produtos.map((p) => {
    const classif = classificarFormigres({
      tipo: p.tipo,
      acabamento: p.acabamento,
      titulo: p.titulo,
    });
    const id = String(p.id);
    const preco = priceMap.get(id) ?? null;

    return {
      codigo_tintao: id,
      descricao: p.titulo || '',
      lista: 'formigres-completo',
      formato: p.formato || '',
      linha: classif.linha,
      subtipo: classif.subtipo,
      variante_lisa: classif.variante_lisa,
      rotulo: classif.rotulo,
      confianca: classif.confianca,
      motivo: classif.motivo,
      match_status: 'encontrado',
      match_score: 100,
      formigres_id: id,
      formigres_titulo: p.titulo || '',
      formigres_tipo: p.tipo || '',
      formigres_acabamento: p.acabamento || '',
      preco_m2: preco,
      preco_referencia_tintao: preco != null,
      m2_por_caixa: null,
      unidade: '',
      total: null,
      pdf: '',
    };
  });

  const comPreco = rows.filter((r) => r.preco_m2 != null).length;
  const resumo = resumirClassificacoes(rows);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(OUT_DIR, `formigres-completo-${stamp}.json`);
  const resumoPath = path.join(OUT_DIR, `formigres-completo-${stamp}-resumo.json`);

  const payload = {
    geradoEm: new Date().toISOString(),
    modo: 'formigres-completo',
    snapshot: snapshotPath('formigres'),
    snapshotCount: snapshot.count || rows.length,
    tintaoClassifFonte: tintaoPath,
    comPrecoReferenciaTintao: comPreco,
    itens: rows,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(resumoPath, `${JSON.stringify({ resumo, comPreco, total: rows.length }, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    total: rows.length,
    comPrecoReferenciaTintao: comPreco,
    semPreco: rows.length - comPreco,
    json: jsonPath,
    resumo: resumoPath,
    tintaoFonte: tintaoPath,
  }, null, 2));
}

main();
