#!/usr/bin/env node
/**
 * Cruza listas Tintão (PDF) com snapshot Formigres e classifica linha/superfície.
 *
 * npm run catalogo:classificar-tintao
 * npm run catalogo:classificar-tintao -- --pdf-dir /path/to/uploads
 */
import fs from 'node:fs';
import path from 'node:path';
import { classificarFormigres, resumirClassificacoes } from '../lib/formigresClassificar.mjs';
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { findInSnapshot, loadSnapshotFromFile } from '../lib/formigresSnapshot.mjs';
import { parseTintaoPdfs } from '../lib/tintaoPdfParser.mjs';

const ROOT = process.cwd();
const DEFAULT_PDF_DIR = path.join(ROOT, 'docs', 'imports-local', 'tintao', 'pdfs');
const FALLBACK_UPLOADS = '/home/ubuntu/.cursor/projects/workspace/uploads';
const OUT_DIR = path.join(ROOT, 'docs', 'imports-local', 'tintao', 'classificacao');

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const pdfDir = argValue('--pdf-dir')
  || (fs.existsSync(DEFAULT_PDF_DIR) ? DEFAULT_PDF_DIR : FALLBACK_UPLOADS);

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const headers = [
    'codigo_tintao', 'descricao', 'lista', 'formato',
    'linha', 'subtipo', 'variante_lisa', 'rotulo', 'confianca',
    'match_status', 'match_score', 'formigres_id', 'formigres_titulo',
    'formigres_tipo', 'formigres_acabamento', 'preco_m2', 'm2_por_caixa', 'unidade', 'total', 'pdf',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function parseM2Caixa(unidade) {
  const m = String(unidade || '').match(/([\d,]+)\s*M2/i);
  return m ? Number(m[1].replace(',', '.')) : null;
}

function main() {
  const snapshot = loadSnapshotFromFile(readJson(snapshotPath('formigres')));
  if (!snapshot) {
    console.error('Snapshot Formigres ausente. Rode: npm run catalogo:snapshot-formigres');
    process.exit(1);
  }

  if (!fs.existsSync(pdfDir)) {
    console.error(`Diretório PDF não encontrado: ${pdfDir}`);
    process.exit(1);
  }

  const { listas, itens } = parseTintaoPdfs(pdfDir);
  if (!itens.length) {
    console.error(`Nenhum item encontrado em ${pdfDir}`);
    process.exit(1);
  }

  const rows = itens.map((item) => {
    const { parsed, match, score, reason } = findInSnapshot(snapshot, item.descricao, { minScore: 28 });

    const classif = classificarFormigres({
      tipo: match?.tipo,
      acabamento: match?.acabamento,
      titulo: match?.titulo,
      descricao: item.descricao,
      lista: item.lista_contexto,
    });

    return {
      codigo_tintao: item.codigo_tintao,
      descricao: item.descricao,
      lista: item.lista_nome,
      formato: parsed.formato || '',
      linha: classif.linha,
      subtipo: classif.subtipo,
      variante_lisa: classif.variante_lisa,
      rotulo: classif.rotulo,
      confianca: classif.confianca,
      motivo: classif.motivo,
      match_status: match ? 'encontrado' : reason,
      match_score: score,
      formigres_id: match?.id || '',
      formigres_titulo: match?.titulo || '',
      formigres_tipo: match?.tipo || '',
      formigres_acabamento: match?.acabamento || '',
      preco_m2: item.preco_m2,
      m2_por_caixa: parseM2Caixa(item.unidade),
      unidade: item.unidade || '',
      total: item.total,
      pdf: item.pdf,
    };
  });

  const resumo = resumirClassificacoes(rows);
  const semMatch = rows.filter((r) => r.match_status !== 'encontrado');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(OUT_DIR, `tintao-formigres-${stamp}.json`);
  const csvPath = path.join(OUT_DIR, `tintao-formigres-${stamp}.csv`);
  const resumoPath = path.join(OUT_DIR, `tintao-formigres-${stamp}-resumo.json`);

  const payload = {
    geradoEm: new Date().toISOString(),
    pdfDir,
    snapshot: snapshotPath('formigres'),
    snapshotCount: snapshot.count,
    listas,
    resumo,
    semMatch: semMatch.length,
    itens: rows,
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(csvPath, toCsv(rows));
  fs.writeFileSync(resumoPath, `${JSON.stringify({ ...resumo, semMatch: semMatch.length, listas }, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    itens: rows.length,
    listas: listas.length,
    pdfDir,
    resumo: resumo.porRotulo,
    detalhe: resumo.detalhe,
    semMatch: semMatch.length,
    csv: csvPath,
    json: jsonPath,
  }, null, 2));

  if (semMatch.length) {
    console.error('\nSem match no catálogo:');
    for (const r of semMatch) {
      console.error(`  - [${r.codigo_tintao}] ${r.descricao}`);
    }
  }
}

main();
