#!/usr/bin/env node
/**
 * Catálogo completo Formigres (snapshot) com tabela de preços Formigres.
 *
 * npm run catalogo:classificar-formigres
 */
import fs from 'node:fs';
import path from 'node:path';
import { classificarFormigres, resumirClassificacoes } from '../lib/formigresClassificar.mjs';
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { loadSnapshotFromFile } from '../lib/formigresSnapshot.mjs';
import { resolvePrecoFormigres, TABELA_FORMIGRES_META } from '../lib/formigresTabelaPrecos.mjs';

const OUT_DIR = path.join(process.cwd(), 'docs', 'imports-local', 'formigres', 'classificacao');

function main() {
  const snapshot = loadSnapshotFromFile(readJson(snapshotPath('formigres')));
  if (!snapshot?.produtos?.length) {
    console.error('Snapshot Formigres ausente. Rode: npm run catalogo:snapshot-formigres');
    process.exit(1);
  }

  const faixaCount = {};
  const rows = snapshot.produtos.map((p) => {
    const classif = classificarFormigres({
      tipo: p.tipo,
      acabamento: p.acabamento,
      titulo: p.titulo,
    });
    const id = String(p.id);
    const { preco, faixa, motivo } = resolvePrecoFormigres(p, classif);
    if (faixa) faixaCount[faixa] = (faixaCount[faixa] || 0) + 1;
    else faixaCount.sem_preco = (faixaCount.sem_preco || 0) + 1;

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
      preco_faixa: faixa,
      preco_motivo: motivo || null,
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
    tabelaPrecos: TABELA_FORMIGRES_META,
    comPreco,
    faixaCount,
    itens: rows,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(resumoPath, `${JSON.stringify({ resumo, comPreco, faixaCount, total: rows.length }, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    total: rows.length,
    comPreco,
    semPreco: rows.length - comPreco,
    faixaCount,
    json: jsonPath,
    resumo: resumoPath,
    tabela: TABELA_FORMIGRES_META,
  }, null, 2));
}

main();
