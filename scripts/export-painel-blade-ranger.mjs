#!/usr/bin/env node
/**
 * Simulação Excel do painel Blade Ranger (análise preditiva por LINHA).
 * npm run export:painel-ranger
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { LINHAS_MESTRE } from './lib/inferirLinha.mjs';
import { buildLinhaTree } from './lib/bladeRangerPanel.mjs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-painel-blade-ranger-simulacao.xlsx');

const LUZ_FILL = {
  VERMELHA: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } },
  AMARELA: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } },
  VERDE: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } },
  CINZA: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9CA3AF' } },
};

const LUZ_FONT = {
  VERMELHA: { bold: true, color: { argb: 'FFFFFFFF' } },
  AMARELA: { bold: true, color: { argb: 'FF1F2937' } },
  VERDE: { bold: true, color: { argb: 'FFFFFFFF' } },
  CINZA: { color: { argb: 'FFFFFFFF' } },
};

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
}

function paintLuz(cell, luz) {
  if (!luz || !LUZ_FILL[luz]) return;
  cell.fill = LUZ_FILL[luz];
  cell.font = LUZ_FONT[luz] || {};
}

function addTreeSheet(wb, name, rows, { freeze = true } = {}) {
  const ws = wb.addWorksheet(name, freeze ? { views: [{ state: 'frozen', ySplit: 1 }] } : {});
  ws.columns = [
    { header: 'Luz', key: 'luz', width: 11 },
    { header: 'Nível', key: 'nivel', width: 14 },
    { header: 'Árvore (retrato)', key: 'tree', width: 42 },
    { header: 'LINHA', key: 'linha_nome', width: 28 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Produto compra', key: 'produto_compra', width: 22 },
    { header: 'SKU', key: 'sku_nome', width: 38 },
    { header: 'h1', key: 'h1', width: 16 },
    { header: 'h2', key: 'h2', width: 14 },
    { header: 'h3', key: 'h3', width: 14 },
    { header: 'Estoque', key: 'estoque', width: 10 },
    { header: 'Média 30d', key: 'media30', width: 10 },
    { header: 'Ponto futuro', key: 'ponto_futuro', width: 12 },
    { header: 'Est. mín', key: 'est_min', width: 9 },
    { header: 'Sugestão compra', key: 'sugestao', width: 12 },
    { header: 'Un', key: 'unidade', width: 6 },
    { header: 'Ação Ranger', key: 'acao', width: 22 },
    { header: 'Detalhe luz', key: 'luz_label', width: 22 },
  ];
  styleHeader(ws.getRow(1));

  for (const r of rows) {
    const row = ws.addRow({
      luz: r.luz,
      nivel: r.nivel,
      tree: r.tree,
      linha_nome: r.linha_nome,
      tipo: r.tipo,
      produto_compra: r.produto_compra,
      sku_nome: r.sku_nome,
      h1: r.h1,
      h2: r.h2,
      h3: r.h3,
      estoque: r.estoque,
      media30: r.media30,
      ponto_futuro: r.ponto_futuro,
      est_min: r.est_min,
      sugestao: r.sugestao,
      unidade: r.unidade,
      acao: r.acao,
      luz_label: r.luz_label,
    });
    paintLuz(row.getCell('luz'), r.luz);
    if (r.nivel === 'LINHA') {
      row.font = { bold: true };
      row.getCell('tree').font = { bold: true, size: 11 };
    } else if (r.nivel === 'PRODUTO COMPRA') {
      row.getCell('tree').font = { bold: true };
    }
  }
  return ws;
}

async function fetchVelocityMap(client) {
  const { rows } = await client.query(`
    select pvi.produto_id,
           sum(case when pv.created_at >= now() - interval '30 days'
             then coalesce(pvi.quantidade_base, 0) else 0 end)::float as qtd30,
           sum(case when pv.created_at >= now() - interval '60 days'
             then coalesce(pvi.quantidade_base, 0) else 0 end)::float as qtd60
    from pedido_venda_item pvi
    join pedido_venda pv on pv.id = pvi.pedido_venda_id
    where pv.created_at >= now() - interval '60 days'
      and coalesce(pv.status, '') <> 'Cancelado'
    group by pvi.produto_id
  `);
  const map = {};
  for (const r of rows) {
    map[String(r.produto_id)] = { qtd30: Number(r.qtd30) || 0, qtd60: Number(r.qtd60) || 0 };
  }
  return map;
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: produtos } = await client.query(`
    select id, nome, ativo, codigo_interno,
           campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3, campo_hierarquico_4,
           estoque_atual, estoque_minimo, estoque_ideal, estoque_maximo,
           tempo_reposicao_dias, unidade_principal, venda_media_dia
    from produto
    where ativo = true
    order by campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3
  `);
  const velocityMap = await fetchVelocityMap(client);
  await client.end();

  const { rows, resumoLinhas, incendios } = buildLinhaTree(produtos, velocityMap, LINHAS_MESTRE);

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const leiame = wb.addWorksheet('LEIA-ME');
  [
    ['P38 — Painel Blade Ranger (simulação Excel)'],
    [''],
    ['Metáfora (Planos 2 / chefe bombeiro): o Ranger não repõe por hábito — ele vê onde o fogo VAI começar.'],
    ['Fogo = ruptura de estoque.'],
    [''],
    ['Luz VERMELHA — ruptura já ocorreu (estoque zero ou negativo).'],
    ['Luz AMARELA — risco no ponto futuro (estoque − média 30d < 0) ou abaixo do mínimo.'],
    ['Luz VERDE — linha/SKU saudável no horizonte de 30 dias.'],
    [''],
    ['Árvore: LINHA → produto de compra (ex. JOELHO na SOLDÁVEL) → SKU (eixo = medida, cor…).'],
    [''],
    ['Abas:'],
    ['  • Resumo LINHAS — retrato de cada corredor (quantos incêndios).'],
    ['  • Incêndios — só amarelo + vermelho (lista de compra Ranger).'],
    ['  • Painel árvore — visão completa hierárquica.'],
    ['  • Retrato SOLDÁVEL / Retrato TINTA — exemplo mix e portfólio.'],
    [''],
    ['Dados: estoque atual + vendas reais 60d (pedido_venda). Simulação — não é pedido automático.'],
    [`Gerado: ${new Date().toLocaleString('pt-BR')} · ${produtos.length} SKUs`],
  ].forEach((line, i) => {
    leiame.getCell(i + 1, 1).value = line[0];
    if (i === 0) leiame.getCell(i + 1, 1).font = { bold: true, size: 12 };
  });
  leiame.getColumn(1).width = 95;

  const wsResumo = wb.addWorksheet('Resumo LINHAS', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsResumo.columns = [
    { header: 'Luz linha', key: 'luz', width: 11 },
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'LINHA', key: 'nome', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 11 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'Vermelhas', key: 'vermelhas', width: 10 },
    { header: 'Amarelas', key: 'amarelas', width: 10 },
    { header: 'Verdes', key: 'verdes', width: 8 },
  ];
  styleHeader(wsResumo.getRow(1));
  for (const r of resumoLinhas) {
    const row = wsResumo.addRow(r);
    paintLuz(row.getCell('luz'), r.luz);
  }

  const incSorted = [...incendios].sort((a, b) => {
    const rank = { VERMELHA: 2, AMARELA: 1 };
    const d = (rank[b.luz] || 0) - (rank[a.luz] || 0);
    if (d !== 0) return d;
    return a.linha_nome.localeCompare(b.linha_nome, 'pt-BR');
  });
  addTreeSheet(wb, 'Incêndios (amar+verm)', incSorted);

  addTreeSheet(wb, 'Painel árvore', rows);

  const portraitCodes = ['SOLDAVEL', 'TINTA'];
  for (const code of portraitCodes) {
    const portraitRows = rows.filter((r) => r.linha_codigo === code);
    if (!portraitRows.length) continue;
    const meta = LINHAS_MESTRE.find((l) => l.codigo === code);
    addTreeSheet(wb, `Retrato ${meta?.nome?.slice(0, 20) || code}`, portraitRows);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-painel-blade-ranger-simulacao.xlsx');
  } catch { /* ok */ }

  const totalV = resumoLinhas.reduce((s, r) => s + r.vermelhas, 0);
  const totalA = resumoLinhas.reduce((s, r) => s + r.amarelas, 0);
  console.log(`[export-painel-ranger] → ${OUT}`);
  console.log(`Incêndios: ${totalV} vermelhas, ${totalA} amarelas, ${incSorted.length} linhas na lista de ação`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
