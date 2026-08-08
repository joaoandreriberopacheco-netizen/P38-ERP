#!/usr/bin/env node
/**
 * Excel: tabela LINHAS mestre para aprovação (antes de SQL).
 * Inclui proposta de tipo + contagem de SKUs por regra automática.
 *
 * Uso: npm run export:linhas-mestre
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { norm } from './lib/planLinhaCompraAnalise.mjs';
import { inferirLinhaCodigo, findLinhaMeta, LINHAS_MESTRE } from './lib/inferirLinha.mjs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-linhas-mestre-aprovacao.xlsx');

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
}

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
  const h1map = new Map();
  for (const p of produtos) {
    const cod = inferirLinhaCodigo(p);
    counts.set(cod, (counts.get(cod) || 0) + 1);
    const key = `${norm(p.campo_hierarquico_1)}||${norm(p.campo_hierarquico_2)}`;
    const cur = h1map.get(key) || {
      h1: p.campo_hierarquico_1 || '',
      h2: p.campo_hierarquico_2 || '',
      linha_codigo: cod,
      skus: 0,
      exemplo: p.nome,
    };
    cur.skus += 1;
    h1map.set(key, cur);
  }

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const leiame = wb.addWorksheet('LEIA-ME');
  [
    ['P38 — LINHAS mestre (aprovação antes da base de dados)'],
    [''],
    ['1. Edite a aba LINHAS mestre: coluna STATUS (SIM / NÃO / AJUSTAR) e OBSERVAÇÕES.'],
    ['2. tipo = solo | mix | portfolio — template de comportamento (não engessa o SKU).'],
    ['3. Eixos A/B ficam vazios — você preenche manualmente depois.'],
    ['4. Qtd SKUs (proposta) = contagem automática por regras (não é IA ainda).'],
    ['5. Abas Mapa h1→LINHA e Amostra SKUs ajudam a validar.'],
    [''],
    ['Fluxo acordado: aprovar LINHAS → SQL → IA atribui linha+tipo → massa → eixos manual.'],
    [`Gerado: ${new Date().toLocaleString('pt-BR')} · ${produtos.length} SKUs ativos`],
  ].forEach((line, i) => {
    leiame.getCell(i + 1, 1).value = line[0];
    if (i === 0) leiame.getCell(i + 1, 1).font = { bold: true, size: 12 };
  });
  leiame.getColumn(1).width = 95;

  const ws = wb.addWorksheet('LINHAS mestre', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Ordem', key: 'ordem', width: 8 },
    { header: 'Código', key: 'codigo', width: 18 },
    { header: 'Nome da LINHA', key: 'nome', width: 28 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Rótulo eixo A (depois)', key: 'eixo_a', width: 22 },
    { header: 'Rótulo eixo B (depois)', key: 'eixo_b', width: 22 },
    { header: 'Notas', key: 'notas', width: 36 },
    { header: 'Qtd SKUs (proposta)', key: 'skus', width: 16 },
    { header: 'STATUS', key: 'status', width: 12 },
    { header: 'OBSERVAÇÕES João', key: 'obs', width: 28 },
  ];
  styleHeader(ws.getRow(1));

  const tipoHelp = {
    solo: 'Lista simples — pouca ou nenhuma grelha',
    mix: 'Grelha A × B',
    portfolio: 'Família com variantes (modelos, cores…)',
  };

  for (const l of LINHAS_MESTRE) {
    ws.addRow({
      ordem: l.ordem,
      codigo: l.codigo,
      nome: l.nome,
      tipo: l.tipo,
      eixo_a: '',
      eixo_b: '',
      notas: l.notas ? `${l.notas} | ${tipoHelp[l.tipo]}` : tipoHelp[l.tipo],
      skus: counts.get(l.codigo) || 0,
      status: '',
      obs: '',
    });
  }
  ws.autoFilter = { from: 'A1', to: `J${LINHAS_MESTRE.length + 1}` };

  const mapa = [...h1map.values()]
    .sort((a, b) => b.skus - a.skus || a.h1.localeCompare(b.h1, 'pt-BR'))
    .map((r) => {
      const linha = LINHAS_MESTRE.find((l) => l.codigo === r.linha_codigo);
      return {
        h1: r.h1,
        h2: r.h2,
        linha_codigo: r.linha_codigo,
        linha_nome: linha?.nome || r.linha_codigo,
        tipo: linha?.tipo || '',
        skus: r.skus,
        exemplo_sku: r.exemplo,
      };
    });

  const wsMapa = wb.addWorksheet('Mapa h1→LINHA', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsMapa.columns = [
    { header: 'h1 cadastro', key: 'h1', width: 28 },
    { header: 'h2 cadastro', key: 'h2', width: 18 },
    { header: 'Cód. LINHA proposta', key: 'linha_codigo', width: 18 },
    { header: 'Nome LINHA', key: 'linha_nome', width: 24 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'Exemplo SKU', key: 'exemplo_sku', width: 42 },
  ];
  styleHeader(wsMapa.getRow(1));
  mapa.forEach((r) => wsMapa.addRow(r));

  const amostra = produtos
    .map((p) => {
      const cod = inferirLinhaCodigo(p);
      const linha = LINHAS_MESTRE.find((l) => l.codigo === cod);
      return {
        linha_nome: linha?.nome || cod,
        tipo: linha?.tipo || '',
        nome: p.nome,
        h1: p.campo_hierarquico_1,
        h2: p.campo_hierarquico_2,
        categoria: p.categoria_nome || '',
      };
    })
    .sort((a, b) => a.linha_nome.localeCompare(b.linha_nome, 'pt-BR'));

  const wsA = wb.addWorksheet('Amostra SKUs', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsA.columns = [
    { header: 'LINHA proposta', key: 'linha_nome', width: 24 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Nome SKU', key: 'nome', width: 44 },
    { header: 'h1', key: 'h1', width: 20 },
    { header: 'h2', key: 'h2', width: 14 },
    { header: 'Categoria', key: 'categoria', width: 24 },
  ];
  styleHeader(wsA.getRow(1));
  amostra.slice(0, 500).forEach((r) => wsA.addRow(r));
  if (amostra.length > 500) {
    wsA.addRow({ linha_nome: `… +${amostra.length - 500} SKUs (ver Mapa h1→LINHA)` });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-linhas-mestre-aprovacao.xlsx');
  } catch { /* ok */ }

  console.log(`[export-linhas-mestre] ${LINHAS_MESTRE.length} linhas → ${OUT}`);
  console.log('Contagem:', [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
