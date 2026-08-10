#!/usr/bin/env node
/**
 * Excel de análise: LINHA de compra → produto de compra → eixos A×B.
 * (Não confundir com h1 do cadastro — ex.: JOELHO é produto de compra dentro de CONEXÃO SOLDÁVEL.)
 *
 * Uso: npm run export:analise-linhas
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import {
  linhaSortKey,
  planLinhaCompraAnalise,
} from './lib/planLinhaCompraAnalise.mjs';

const OUT_DIR = path.join(process.cwd(), 'docs', 'exports');
const OUT_XLSX = path.join(OUT_DIR, 'P38-analise-linhas-compra.xlsx');

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function addSheet(wb, name, columns, rows, { freezeRow = 1 } = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: freezeRow }] });
  ws.columns = columns;
  const hr = ws.getRow(freezeRow);
  hr.values = columns.map((c) => c.header);
  styleHeader(hr);
  for (const r of rows) ws.addRow(r);
  if (rows.length) {
    const lastCol = String.fromCharCode(64 + columns.length);
    ws.autoFilter = { from: `A${freezeRow}`, to: `${lastCol}${freezeRow + rows.length}` };
  }
  return ws;
}

async function fetchProdutos(client) {
  const { rows } = await client.query(`
    select
      id,
      nome,
      marca,
      categoria_nome,
      categoria_id,
      campo_hierarquico_1,
      campo_hierarquico_2,
      campo_hierarquico_3,
      campo_hierarquico_4,
      campo_hierarquico_5,
      coalesce(estoque_atual, 0) as estoque_atual
    from produto
    where ativo = true
    order by categoria_nome nulls last, campo_hierarquico_1, nome
  `);
  return rows;
}

function buildAnalise(produtos) {
  return produtos.map((p) => {
    const a = planLinhaCompraAnalise(p);
    return {
      ...a,
      categoria: String(p.categoria_nome || '').trim() || '(sem categoria)',
      categoria_id: p.categoria_id || '',
      estoque_atual: Number(p.estoque_atual) || 0,
      id: p.id,
    };
  });
}

function groupLinhas(analise) {
  const map = new Map();
  for (const row of analise) {
    const key = row.linha_nome;
    const cur = map.get(key) || {
      linha_nome: key,
      linha_tipo: row.linha_tipo,
      skus: 0,
      com_estoque: 0,
      produtos_compra: new Set(),
      h1_distintos: new Set(),
      confianca_baixa: 0,
    };
    cur.skus += 1;
    if (row.estoque_atual > 0) cur.com_estoque += 1;
    if (row.produto_compra_nome) cur.produtos_compra.add(row.produto_compra_nome);
    if (row.h1_cadastro) cur.h1_distintos.add(row.h1_cadastro);
    if (row.confianca === 'baixa') cur.confianca_baixa += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({
      linha_nome: r.linha_nome,
      linha_tipo: r.linha_tipo,
      qtd_skus: r.skus,
      qtd_com_estoque: r.com_estoque,
      qtd_produtos_compra: r.produtos_compra.size,
      h1_no_cadastro: [...r.h1_distintos].sort((a, b) => a.localeCompare(b, 'pt-BR')).join(' | '),
      revisar: r.confianca_baixa > 0 ? `${r.confianca_baixa} SKU(s)` : '',
      _sort: linhaSortKey(r.linha_nome),
    }))
    .sort((a, b) => a._sort.localeCompare(b._sort));
}

function groupProdutoCompra(analise) {
  const map = new Map();
  for (const row of analise) {
    const key = `${row.linha_nome}::${row.produto_compra_nome}`;
    const cur = map.get(key) || {
      linha_nome: row.linha_nome,
      linha_tipo: row.linha_tipo,
      produto_compra_nome: row.produto_compra_nome,
      eixo_a_rotulo: row.eixo_a_rotulo,
      eixo_b_rotulo: row.eixo_b_rotulo,
      skus: 0,
      eixo_b_vals: new Set(),
      h1_cadastro: new Set(),
    };
    cur.skus += 1;
    if (row.eixo_b) cur.eixo_b_vals.add(row.eixo_b);
    if (row.h1_cadastro) cur.h1_cadastro.add(row.h1_cadastro);
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({
      linha_nome: r.linha_nome,
      produto_compra: r.produto_compra_nome,
      tipo_linha: r.linha_tipo,
      rotulo_eixo_a: r.eixo_a_rotulo || '—',
      rotulo_eixo_b: r.eixo_b_rotulo || '—',
      qtd_skus: r.skus,
      valores_eixo_b: [...r.eixo_b_vals].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).join(' | '),
      h1_cadastro: [...r.h1_cadastro].join(' | '),
      _sort: `${linhaSortKey(r.linha_nome)}_${r.produto_compra_nome}`,
    }))
    .sort((a, b) => a._sort.localeCompare(b._sort));
}

function mapH1ParaLinha(analise) {
  const map = new Map();
  for (const row of analise) {
    const h1 = row.h1_cadastro || '(sem h1)';
    const cur = map.get(h1) || {
      h1_cadastro: h1,
      linhas: new Set(),
      produtos_compra: new Set(),
      skus: 0,
    };
    cur.skus += 1;
    cur.linhas.add(row.linha_nome);
    if (row.produto_compra_nome) cur.produtos_compra.add(row.produto_compra_nome);
    map.set(h1, cur);
  }
  return [...map.values()]
    .map((r) => ({
      h1_cadastro: r.h1_cadastro,
      linha_compra_proposta: [...r.linhas].sort().join(' | '),
      produto_compra_tipico: [...r.produtos_compra].slice(0, 5).join(' | '),
      qtd_skus: r.skus,
      nota: r.h1_cadastro !== [...r.linhas][0] && r.linhas.size === 1
        ? 'h1 ≠ linha — ver produto de compra'
        : r.linhas.size > 1 ? 'h1 mapeia várias linhas — rever' : '',
    }))
    .sort((a, b) => a.h1_cadastro.localeCompare(b.h1_cadastro, 'pt-BR'));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const produtos = await fetchProdutos(client);
  await client.end();

  const analise = buildAnalise(produtos);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 ERP — análise (sem alterar BD)';
  wb.created = new Date();

  const ws0 = wb.addWorksheet('LEIA-ME', { views: [{ state: 'frozen', ySplit: 1 }] });
  [
    ['Como ler este ficheiro'],
    [''],
    ['LINHA = corredor de compra/análise (ex.: CIMENTO, CONEXÃO SOLDÁVEL). Não é o mesmo que h1.'],
    ['Ex.: JOELHO no cadastro (h1) → LINHA CONEXÃO SOLDÁVEL + produto de compra JOELHO 90° SOLDÁVEL.'],
    [''],
    ['Abas:'],
    ['  1. Linhas de compra — resumo por LINHA'],
    ['  2. Produtos de compra — peças/famílias dentro de cada LINHA'],
    ['  3. Mapa h1 → LINHA — o que hoje está no campo 1 vs linha proposta'],
    ['  4. Detalhe SKUs — cada produto com proposta de nome'],
    [''],
    [`Gerado: ${new Date().toLocaleString('pt-BR')} · ${produtos.length} SKUs ativos`],
    ['Regras: pilotos (cimento, argamassa, piso, soldável, tinta) + genérico h1→linha.'],
    ['Coluna "confiança" = alta (cadastro claro) | media (inferido) | baixa (rever).'],
  ].forEach((line, i) => {
    const row = ws0.getRow(i + 1);
    row.getCell(1).value = line[0];
    if (i === 0) row.font = { bold: true, size: 12 };
  });
  ws0.getColumn(1).width = 100;

  addSheet(wb, 'Linhas de compra', [
    { header: 'LINHA de compra', key: 'linha_nome', width: 28 },
    { header: 'Tipo', key: 'linha_tipo', width: 12 },
    { header: 'SKUs', key: 'qtd_skus', width: 8 },
    { header: 'Com estoque', key: 'qtd_com_estoque', width: 12 },
    { header: 'Qtd produtos de compra', key: 'qtd_produtos_compra', width: 22 },
    { header: 'h1 no cadastro (referência)', key: 'h1_no_cadastro', width: 48 },
    { header: 'Rever', key: 'revisar', width: 14 },
  ], groupLinhas(analise).map(({ _sort, ...r }) => r));

  addSheet(wb, 'Produtos de compra', [
    { header: 'LINHA', key: 'linha_nome', width: 24 },
    { header: 'Produto de compra', key: 'produto_compra', width: 36 },
    { header: 'Tipo linha', key: 'tipo_linha', width: 12 },
    { header: 'Rótulo eixo A', key: 'rotulo_eixo_a', width: 14 },
    { header: 'Rótulo eixo B', key: 'rotulo_eixo_b', width: 14 },
    { header: 'SKUs', key: 'qtd_skus', width: 8 },
    { header: 'Valores eixo B (ex. medidas)', key: 'valores_eixo_b', width: 40 },
    { header: 'h1 cadastro', key: 'h1_cadastro', width: 20 },
  ], groupProdutoCompra(analise).map(({ _sort, ...r }) => r));

  addSheet(wb, 'Mapa h1 → LINHA', [
    { header: 'h1 cadastro (campo 1)', key: 'h1_cadastro', width: 32 },
    { header: 'LINHA de compra proposta', key: 'linha_compra_proposta', width: 28 },
    { header: 'Produtos de compra (amostra)', key: 'produto_compra_tipico', width: 48 },
    { header: 'SKUs', key: 'qtd_skus', width: 8 },
    { header: 'Nota', key: 'nota', width: 36 },
  ], mapH1ParaLinha(analise));

  const detalhe = analise
    .map((r) => ({
      categoria: r.categoria,
      linha_compra: r.linha_nome,
      produto_compra: r.produto_compra_nome,
      eixo_a: r.eixo_a,
      eixo_b: r.eixo_b,
      marca: r.marca,
      h1: r.h1_cadastro,
      h2: r.h2_cadastro,
      h3: r.h3_cadastro,
      h4: r.h4_cadastro,
      nome_atual: r.nome_atual,
      nome_proposto: r.nome_proposto,
      confianca: r.confianca,
      motivo: r.motivo,
      estoque: r.estoque_atual,
      _sort: `${linhaSortKey(r.linha_nome)}_${r.produto_compra_nome}_${r.nome_atual}`,
    }))
    .sort((a, b) => a._sort.localeCompare(b._sort));

  addSheet(wb, 'Detalhe SKUs', [
    { header: 'Categoria', key: 'categoria', width: 28 },
    { header: 'LINHA compra', key: 'linha_compra', width: 22 },
    { header: 'Produto compra', key: 'produto_compra', width: 32 },
    { header: 'Eixo A', key: 'eixo_a', width: 16 },
    { header: 'Eixo B', key: 'eixo_b', width: 16 },
    { header: 'Marca', key: 'marca', width: 14 },
    { header: 'h1', key: 'h1', width: 18 },
    { header: 'h2', key: 'h2', width: 14 },
    { header: 'h3', key: 'h3', width: 14 },
    { header: 'h4', key: 'h4', width: 14 },
    { header: 'Nome actual', key: 'nome_atual', width: 40 },
    { header: 'Nome proposto', key: 'nome_proposto', width: 40 },
    { header: 'Confiança', key: 'confianca', width: 10 },
    { header: 'Motivo', key: 'motivo', width: 18 },
    { header: 'Estoque', key: 'estoque', width: 10 },
  ], detalhe.map(({ _sort, ...r }) => r));

  await wb.xlsx.writeFile(OUT_XLSX);

  const mirror = '/opt/cursor/artifacts/P38-analise-linhas-compra.xlsx';
  try {
    fs.mkdirSync(path.dirname(mirror), { recursive: true });
    fs.copyFileSync(OUT_XLSX, mirror);
  } catch { /* ok */ }

  console.log(`[export-analise-linhas] ${produtos.length} SKUs → ${OUT_XLSX}`);
  console.log(`[export-analise-linhas] Linhas de compra: ${groupLinhas(analise).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
