#!/usr/bin/env node
/**
 * Catálogo Ecuaceramica (portfolio P38) com preços demonstrativos.
 *
 * npm run catalogo:classificar-ecuaceramica
 */
import fs from 'node:fs';
import path from 'node:path';
import { classificarEcuaceramica, resumirClassificacoes } from '../lib/ecuaceramicaClassificar.mjs';
import { normalizePeiEcuaceramica } from '../lib/ecuaceramicaPei.mjs';
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { loadSnapshotFromFile } from '../lib/ecuaceramicaSnapshot.mjs';
import { resolvePrecoEcuaceramica, TABELA_ECUA_META } from '../lib/ecuaceramicaTabelaPrecos.mjs';
import { resolveEmbalagemEcuaceramica, EMBALAGEM_ECUA_META } from '../lib/ecuaceramicaEmbalagem.mjs';

const OUT_DIR = path.join(process.cwd(), 'docs', 'imports-local', 'ecuaceramica', 'classificacao');

function main() {
  const snapshot = loadSnapshotFromFile(readJson(snapshotPath('ecuaceramica')));
  if (!snapshot?.produtos?.length) {
    console.error('Snapshot Ecuaceramica ausente. Rode: npm run catalogo:snapshot-ecuaceramica');
    process.exit(1);
  }

  const faixaCount = {};
  const rows = snapshot.produtos.map((p) => {
    const classif = classificarEcuaceramica(p);
    const peiInfo = normalizePeiEcuaceramica(p.pei);
    const id = String(p.id);
    const { preco, preco_caixa, faixa, motivo, moeda: moedaPreco } = resolvePrecoEcuaceramica(p, classif);
    const emb = resolveEmbalagemEcuaceramica(p);
    if (faixa) faixaCount[faixa] = (faixaCount[faixa] || 0) + 1;
    else faixaCount.sem_preco = (faixaCount.sem_preco || 0) + 1;

    return {
      codigo_tintao: id,
      descricao: p.titulo || '',
      lista: 'ecuaceramica-completo',
      formato: p.formato || '',
      linha: classif.linha,
      subtipo: classif.subtipo,
      variante_lisa: classif.variante_lisa,
      rotulo: classif.rotulo,
      acabamento_label: classif.acabamento_label,
      confianca: classif.confianca,
      motivo: classif.motivo,
      match_status: 'encontrado',
      match_score: 100,
      formigres_id: id,
      formigres_titulo: p.titulo || '',
      formigres_tipo: p.tipo || '',
      formigres_acabamento: p.acabamento || '',
      marca_nome: 'Ecuaceramica',
      referencia: p.referencia || '',
      pei: peiInfo.pei,
      pei_label: peiInfo.pei_label,
      pei_raw: peiInfo.pei_raw,
      pei_fonte: peiInfo.pei_fonte,
      preco_caixa: preco_caixa ?? p.preco_caixa ?? null,
      preco_m2: preco,
      preco_faixa: faixa,
      preco_motivo: motivo || null,
      moeda: moedaPreco || p.moeda || 'BRL',
      pecas_por_caixa: emb.pecas_por_caixa,
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
  const jsonPath = path.join(OUT_DIR, `ecuaceramica-completo-${stamp}.json`);
  const resumoPath = path.join(OUT_DIR, `ecuaceramica-completo-${stamp}-resumo.json`);

  const payload = {
    geradoEm: new Date().toISOString(),
    modo: 'ecuaceramica-completo',
    portfolio: true,
    snapshot: snapshotPath('ecuaceramica'),
    snapshotCount: snapshot.count || rows.length,
    tabelaPrecos: TABELA_ECUA_META,
    embalagem: EMBALAGEM_ECUA_META,
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
    tabela: TABELA_ECUA_META,
  }, null, 2));
}

main();
