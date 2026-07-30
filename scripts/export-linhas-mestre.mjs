#!/usr/bin/env node
/**
 * Excel LINHAS mestre (enxuto) — agrupamento por chave comum (h2 SOLDÁVEL, etc.).
 * npm run export:linhas-mestre
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import {
  LINHAS_MESTRE,
  inferirLinhaCodigo,
  inferirChaveAgrupamento,
  findLinhaMeta,
  norm,
} from './lib/inferirLinha.mjs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-linhas-mestre-aprovacao.xlsx');

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
}

const TIPO_HELP = {
  solo: 'Lista — pouca grelha',
  mix: 'Grelha A × B',
  portfolio: 'Variantes (modelos, cores…)',
};

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows: produtos } = await client.query(`
    select id, nome, categoria_nome,
           campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3
    from produto where ativo = true
  `);
  await client.end();

  const counts = new Map(LINHAS_MESTRE.map((l) => [l.codigo, 0]));
  const soldavelH1 = new Map();

  for (const p of produtos) {
    const cod = inferirLinhaCodigo(p);
    counts.set(cod, (counts.get(cod) || 0) + 1);
    if (cod === 'SOLDAVEL') {
      const k = norm(p.campo_hierarquico_1);
      soldavelH1.set(k, (soldavelH1.get(k) || 0) + 1);
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const leiame = wb.addWorksheet('LEIA-ME');
  [
    ['P38 — LINHAS mestre (versão enxuta)'],
    [''],
    ['Ideia: condensar linhas por CHAVE COMUM — não cada h1 vira linha.'],
    ['Ex.: JOELHO + h2 SOLDÁVEL e LUVA + h2 SOLDÁVEL → mesma LINHA SOLDÁVEL.'],
    [''],
    ['Preencha STATUS (SIM / NÃO / AJUSTAR) na aba LINHAS mestre.'],
    ['Eixos A/B vazios — você define manualmente depois.'],
    [''],
    ['Fluxo: aprovar LINHAS → SQL → IA atribui linha → massa → eixos manual.'],
    [''],
    [`${LINHAS_MESTRE.length} linhas propostas · ${produtos.length} SKUs · ${new Date().toLocaleString('pt-BR')}`],
  ].forEach((line, i) => {
    leiame.getCell(i + 1, 1).value = line[0];
    if (i === 0) leiame.getCell(i + 1, 1).font = { bold: true, size: 12 };
  });
  leiame.getColumn(1).width = 90;

  const ws = wb.addWorksheet('LINHAS mestre', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Ordem', key: 'ordem', width: 8 },
    { header: 'Código', key: 'codigo', width: 16 },
    { header: 'Nome da LINHA', key: 'nome', width: 32 },
    { header: 'Tipo', key: 'tipo', width: 11 },
    { header: 'Chave de agrupamento', key: 'chave', width: 38 },
    { header: 'Rótulo eixo A', key: 'eixo_a', width: 18 },
    { header: 'Rótulo eixo B', key: 'eixo_b', width: 18 },
    { header: 'Notas', key: 'notas', width: 32 },
    { header: 'Qtd SKUs', key: 'skus', width: 10 },
    { header: 'STATUS', key: 'status', width: 10 },
    { header: 'OBSERVAÇÕES', key: 'obs', width: 24 },
  ];
  styleHeader(ws.getRow(1));

  for (const l of LINHAS_MESTRE) {
    ws.addRow({
      ordem: l.ordem,
      codigo: l.codigo,
      nome: l.nome,
      tipo: l.tipo,
      chave: l.chave,
      eixo_a: '',
      eixo_b: '',
      notas: [l.notas, TIPO_HELP[l.tipo]].filter(Boolean).join(' · '),
      skus: counts.get(l.codigo) || 0,
      status: '',
      obs: '',
    });
  }
  ws.autoFilter = { from: 'A1', to: `K${LINHAS_MESTRE.length + 1}` };

  const wsSold = wb.addWorksheet('Exemplo SOLDÁVEL', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsSold.columns = [
    { header: 'h1 (peça no cadastro)', key: 'h1', width: 22 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'LINHA', key: 'linha', width: 14 },
    { header: 'Nota', key: 'nota', width: 48 },
  ];
  styleHeader(wsSold.getRow(1));
  [...soldavelH1.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([h1k, n]) => {
      wsSold.addRow({
        h1: h1k || '(vazio)',
        skus: n,
        linha: 'SOLDÁVEL',
        nota: 'Mesma LINHA — peça vira produto de compra depois, não linha separada',
      });
    });

  const h1map = new Map();
  for (const p of produtos) {
    const cod = inferirLinhaCodigo(p);
    const meta = findLinhaMeta(cod);
    const key = `${norm(p.campo_hierarquico_1)}||${norm(p.campo_hierarquico_2)}`;
    const cur = h1map.get(key) || {
      h1: p.campo_hierarquico_1 || '',
      h2: p.campo_hierarquico_2 || '',
      linha_codigo: cod,
      linha_nome: meta.nome,
      tipo: meta.tipo,
      chave: inferirChaveAgrupamento(p),
      skus: 0,
      exemplo: p.nome,
    };
    cur.skus += 1;
    h1map.set(key, cur);
  }

  const wsMapa = wb.addWorksheet('Mapa h1+h2→LINHA', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsMapa.columns = [
    { header: 'h1', key: 'h1', width: 26 },
    { header: 'h2', key: 'h2', width: 16 },
    { header: 'LINHA', key: 'linha_nome', width: 28 },
    { header: 'Código', key: 'linha_codigo', width: 14 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Chave vista', key: 'chave', width: 36 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'Exemplo', key: 'exemplo', width: 40 },
  ];
  styleHeader(wsMapa.getRow(1));
  [...h1map.values()]
    .sort((a, b) => b.skus - a.skus)
    .forEach((r) => wsMapa.addRow(r));

  const amostra = produtos
    .map((p) => {
      const meta = findLinhaMeta(inferirLinhaCodigo(p));
      return {
        linha_nome: meta.nome,
        tipo: meta.tipo,
        nome: p.nome,
        h1: p.campo_hierarquico_1,
        h2: p.campo_hierarquico_2,
        categoria: p.categoria_nome || '',
      };
    })
    .sort((a, b) => a.linha_nome.localeCompare(b.linha_nome, 'pt-BR'));

  const wsA = wb.addWorksheet('Amostra SKUs', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsA.columns = [
    { header: 'LINHA proposta', key: 'linha_nome', width: 28 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Nome SKU', key: 'nome', width: 44 },
    { header: 'h1', key: 'h1', width: 20 },
    { header: 'h2', key: 'h2', width: 14 },
    { header: 'Categoria', key: 'categoria', width: 24 },
  ];
  styleHeader(wsA.getRow(1));
  amostra.slice(0, 500).forEach((r) => wsA.addRow(r));
  if (amostra.length > 500) {
    wsA.addRow({ linha_nome: `… +${amostra.length - 500} SKUs (ver Mapa h1+h2→LINHA)` });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-linhas-mestre-aprovacao.xlsx');
  } catch { /* ok */ }

  console.log(`[export-linhas-mestre] ${LINHAS_MESTRE.length} linhas → ${OUT}`);
  console.log(
    'SKUs por linha:',
    [...counts.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}:${n}`)
      .join(', '),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
