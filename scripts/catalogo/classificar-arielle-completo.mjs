#!/usr/bin/env node
/**
 * Catálogo Arielle (Carmelo Fior) com preços derivados Formigres (−3%).
 *
 * npm run catalogo:classificar-arielle
 */
import fs from 'node:fs';
import path from 'node:path';
import { classificarFormigres, resumirClassificacoes } from '../lib/formigresClassificar.mjs';
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { loadSnapshotFromFile } from '../lib/carmeloFiorSnapshot.mjs';
import { resolvePrecoArielle, TABELA_ARIELLE_META } from '../lib/arielleTabelaPrecos.mjs';
import { resolveEmbalagemArielle } from '../lib/arielleEmbalagem.mjs';

const OUT_DIR = path.join(process.cwd(), 'docs', 'imports-local', 'arielle', 'classificacao');

function main() {
  const snapshot = loadSnapshotFromFile(readJson(snapshotPath('arielle')));
  if (!snapshot?.produtos?.length) {
    console.error('Snapshot Arielle ausente. Rode: npm run catalogo:snapshot-arielle');
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
    const { preco, faixa, motivo, preco_base: precoBase } = resolvePrecoArielle(p, classif);
    const emb = resolveEmbalagemArielle(p);
    if (faixa) faixaCount[faixa] = (faixaCount[faixa] || 0) + 1;
    else faixaCount.sem_preco = (faixaCount.sem_preco || 0) + 1;

    return {
      codigo_tintao: id,
      descricao: p.titulo || '',
      lista: 'arielle-completo',
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
      referencia: p.referencia || p.codigo || '',
      marca_nome: p.marca_nome || 'Arielle',
      preco_m2: preco,
      preco_base_formigres: precoBase ?? null,
      preco_faixa: faixa,
      preco_motivo: motivo || null,
      m2_por_caixa: emb.m2_por_caixa,
      caixas_por_palete: emb.caixas_por_palete,
      m2_por_palete: emb.m2_por_palete,
      peso_kg_caixa: emb.peso_kg_caixa,
      peso_kg_palete: emb.peso_kg_palete,
      unidade: '',
      total: null,
      pdf: '',
    };
  });

  const comPreco = rows.filter((r) => r.preco_m2 != null).length;
  const resumo = resumirClassificacoes(rows);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(OUT_DIR, `arielle-completo-${stamp}.json`);
  const resumoPath = path.join(OUT_DIR, `arielle-completo-${stamp}-resumo.json`);

  const payload = {
    geradoEm: new Date().toISOString(),
    modo: 'arielle-completo',
    fabricante: 'Arielle',
    grupo: 'Carmelo Fior',
    snapshot: snapshotPath('arielle'),
    snapshotCount: snapshot.count || rows.length,
    tabelaPrecos: TABELA_ARIELLE_META,
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
    tabela: TABELA_ARIELLE_META,
  }, null, 2));
}

main();
