#!/usr/bin/env node
/**
 * Excel — trabalho braçal: ordenar catálogo Categoria → LINHA → produto compra → SKU.
 * Definir eixos e comportamento (solo/mix/portfolio) antes do painel / código.
 *
 * npm run export:hierarquia-catalogo
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { LINHAS_MESTRE, inferirLinhaCodigo, findLinhaMeta, norm, trim } from './lib/inferirLinha.mjs';
import { inferirProdutoCompraLabel } from './lib/bladeRangerPanel.mjs';
import { LINHA_COMPORTAMENTOS, pulaProdutoCompra, TIPOS_RUPTURA, MAX_EIXOS_PRODUTO_COMPRA } from './lib/linhaComportamento.mjs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-hierarquia-catalogo-trabalho.xlsx');

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
}

function slugCodigo(s) {
  return norm(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32) || 'ITEM';
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: produtos } = await client.query(`
    select id, nome, codigo_interno, categoria_nome,
           campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3,
           campo_hierarquico_4, campo_hierarquico_5, linha_id, estoque_atual
    from produto where ativo = true
  `);

  const { rows: linhasDb } = await client.query(`
    select id, codigo, nome, tipo, eixo_a_rotulo, eixo_b_rotulo, ordem
    from linha order by ordem
  `);
  await client.end();

  const linhaByCodigo = new Map(linhasDb.map((l) => [l.codigo, l]));

  // —— Agregar categorias
  const catMap = new Map();
  for (const p of produtos) {
    const cat = trim(p.categoria_nome) || '(sem categoria)';
    if (!catMap.has(cat)) catMap.set(cat, { nome: cat, skus: 0, linhas: new Map() });
    const c = catMap.get(cat);
    c.skus += 1;
    const lc = inferirLinhaCodigo(p);
    c.linhas.set(lc, (c.linhas.get(lc) || 0) + 1);
  }

  // —— Produto compra + eixos candidatos
  const compraMap = new Map();
  const eixoCand = new Map();

  for (const p of produtos) {
    const linhaCod = inferirLinhaCodigo(p);
    const meta = findLinhaMeta(linhaCod);
    const compraLabel = inferirProdutoCompraLabel(p, linhaCod, meta.tipo);
    const compraKey = `${linhaCod}||${norm(compraLabel)}`;

    if (!compraMap.has(compraKey)) {
      compraMap.set(compraKey, {
        linha_codigo: linhaCod,
        linha_nome: meta.nome,
        tipo: meta.tipo,
        produto_compra_nome: compraLabel,
        produto_compra_codigo: slugCodigo(compraLabel),
        skus: 0,
        categorias: new Map(),
        h2: new Set(),
        h3: new Set(),
        h4: new Set(),
      });
    }
    const pc = compraMap.get(compraKey);
    pc.skus += 1;
    const cat = trim(p.categoria_nome) || '(sem categoria)';
    pc.categorias.set(cat, (pc.categorias.get(cat) || 0) + 1);
    if (trim(p.campo_hierarquico_2)) pc.h2.add(trim(p.campo_hierarquico_2));
    if (trim(p.campo_hierarquico_3)) pc.h3.add(trim(p.campo_hierarquico_3));
    if (trim(p.campo_hierarquico_4)) pc.h4.add(trim(p.campo_hierarquico_4));

    const eKey = compraKey;
    if (!eixoCand.has(eKey)) {
      eixoCand.set(eKey, { linha_codigo: linhaCod, produto_compra: compraLabel, h2: new Map(), h3: new Map(), h4: new Map() });
    }
    const ec = eixoCand.get(eKey);
    const h2 = trim(p.campo_hierarquico_2);
    const h3 = trim(p.campo_hierarquico_3);
    const h4 = trim(p.campo_hierarquico_4);
    if (h2) ec.h2.set(h2, (ec.h2.get(h2) || 0) + 1);
    if (h3) ec.h3.set(h3, (ec.h3.get(h3) || 0) + 1);
    if (h4) ec.h4.set(h4, (ec.h4.get(h4) || 0) + 1);
  }

  // —— Árvore flat para ordenação manual
  const treeRows = [];

  const catsSorted = [...catMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  for (const cat of catsSorted) {
    treeRows.push({
      nivel: 'CATEGORIA',
      ordem_trabalho: '',
      categoria: cat.nome,
      linha_codigo: '',
      linha_nome: '',
      tipo: '',
      produto_compra: '',
      sku_id: '',
      sku_nome: '',
      eixo_a: '',
      eixo_b: '',
      h1: '',
      h2: '',
      h3: '',
      status: '',
      obs: `${cat.skus} SKUs`,
    });

    const linhasInCat = [...cat.linhas.entries()]
      .sort((a, b) => {
        const oa = LINHAS_MESTRE.find((l) => l.codigo === a[0])?.ordem ?? 999;
        const ob = LINHAS_MESTRE.find((l) => l.codigo === b[0])?.ordem ?? 999;
        return oa - ob;
      });

    for (const [linhaCod, skuCount] of linhasInCat) {
      const meta = findLinhaMeta(linhaCod);
      const db = linhaByCodigo.get(linhaCod);
      treeRows.push({
        nivel: 'LINHA',
        ordem_trabalho: '',
        categoria: cat.nome,
        linha_codigo: linhaCod,
        linha_nome: meta.nome,
        tipo: meta.tipo,
        produto_compra: '',
        sku_id: '',
        sku_nome: '',
        eixo_a: '',
        eixo_b: '',
        h1: '',
        h2: '',
        h3: '',
        status: '',
        obs: `${skuCount} SKUs nesta categoria · ${niveisLabel(meta.tipo)}`,
      });

      const comprasInLinha = [...compraMap.values()]
        .filter((c) => c.linha_codigo === linhaCod && c.categorias.has(cat.nome))
        .sort((a, b) => a.produto_compra_nome.localeCompare(b.produto_compra_nome, 'pt-BR'));

      const skusInLinhaCat = produtos.filter(
        (p) => inferirLinhaCodigo(p) === linhaCod && (trim(p.categoria_nome) || '(sem categoria)') === cat.nome,
      );

      if (pulaProdutoCompra(meta.tipo)) {
        for (const p of skusInLinhaCat.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))) {
          treeRows.push(skuRow(cat.nome, linhaCod, meta, '', p));
        }
        continue;
      }

      for (const pc of comprasInLinha) {
        if (!pc.categorias.has(cat.nome)) continue;
        treeRows.push({
          nivel: 'PRODUTO COMPRA',
          ordem_trabalho: '',
          categoria: cat.nome,
          linha_codigo: linhaCod,
          linha_nome: meta.nome,
          tipo: meta.tipo,
          produto_compra: pc.produto_compra_nome,
          sku_id: '',
          sku_nome: '',
          eixo_a: '',
          eixo_b: '',
          h1: '',
          h2: '',
          h3: '',
          status: '',
          obs: `${pc.categorias.get(cat.nome)} SKUs · candidatos h2: ${[...pc.h2].slice(0, 3).join(', ')}`,
        });

        const pcSkus = skusInLinhaCat.filter(
          (p) => inferirProdutoCompraLabel(p, linhaCod, meta.tipo) === pc.produto_compra_nome,
        );
        for (const p of pcSkus.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))) {
          treeRows.push(skuRow(cat.nome, linhaCod, meta, pc.produto_compra_nome, p));
        }
      }
    }
  }

  function niveisLabel(tipo) {
    return LINHA_COMPORTAMENTOS[tipo]?.niveis || tipo;
  }

  function skuRow(categoria, linhaCod, meta, produtoCompra, p) {
    return {
      nivel: 'SKU',
      ordem_trabalho: '',
      categoria: categoria,
      linha_codigo: linhaCod,
      linha_nome: meta.nome,
      tipo: meta.tipo,
      produto_compra: produtoCompra || '(solo)',
      sku_id: p.id,
      sku_nome: p.nome,
      eixo_a: trim(p.campo_hierarquico_2) || trim(p.campo_hierarquico_3),
      eixo_b: trim(p.campo_hierarquico_4) || trim(p.campo_hierarquico_3),
      h1: trim(p.campo_hierarquico_1),
      h2: trim(p.campo_hierarquico_2),
      h3: trim(p.campo_hierarquico_3),
      status: '',
      obs: p.codigo_interno || '',
    };
  }

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const leiame = wb.addWorksheet('LEIA-ME');
  [
    ['P38 — Hierarquia catálogo (trabalho braçal — ANTES do painel)'],
    [''],
    ['Ordem do trabalho:'],
    ['  1. Comportamentos LINHA — entender solo / mix / portfolio'],
    ['  2. Categorias — ordenar e validar campo de batalha'],
    ['  3. LINHAS — tipo, categoria principal, rótulos eixo A/B da LINHA, STATUS'],
    ['  4. Produto compra — nome, código, rótulos eixo A/B de cada esquadra, STATUS'],
    ['  5. Eixos candidatos — ajuda a escolher o que é A vs B (h2/h3/h4 hoje)'],
    ['  6. Árvore trabalho — coluna ORDEM: reordenar formação (categ > linha > prod > sku)'],
    ['  7. SKUs mapa — massa crítica e tipo de ruptura por SKU'],
    [''],
    ['Regras: produto compra (mix/portfolio) = até 2 eixos. Terceiro eixo = outro produto compra.'],
    ['Mix = composição plena. Portfolio = cobertura % + tamanho do time (ex. 11 opções).'],
    ['Ruptura ≠ só estoque zero — inclui perda de massa crítica (ex. cerâmica com 3 caixas).'],
    [''],
    ['O painel Blade Ranger vem DEPOIS desta hierarquia está madura.'],
    ['Cadastro e interface absorvem o Excel quando STATUS = SIM nas folhas.'],
    [''],
    [`Gerado: ${new Date().toLocaleString('pt-BR')} · ${produtos.length} SKUs`],
  ].forEach((line, i) => {
    leiame.getCell(i + 1, 1).value = line[0];
    if (i === 0) leiame.getCell(i + 1, 1).font = { bold: true, size: 12 };
  });
  leiame.getColumn(1).width = 95;

  const wsComp = wb.addWorksheet('Comportamentos LINHA');
  wsComp.columns = [
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Nome', key: 'nome', width: 20 },
    { header: 'Níveis árvore', key: 'niveis', width: 32 },
    { header: 'Pula nível', key: 'pula', width: 14 },
    { header: 'Forma de controle', key: 'controle', width: 36 },
    { header: 'Intersubstituibilidade', key: 'intersubstituibilidade', width: 32 },
    { header: 'Ruptura típica', key: 'ruptura_tipica', width: 36 },
    { header: 'Eixos máx', key: 'eixos_max', width: 28 },
    { header: 'Exemplo', key: 'exemplo', width: 28 },
  ];
  styleHeader(wsComp.getRow(1));
  Object.values(LINHA_COMPORTAMENTOS).forEach((c) => wsComp.addRow(c));

  const wsDoutrina = wb.addWorksheet('Doutrina ruptura');
  wsDoutrina.columns = [
    { header: 'Conceito', key: 'conceito', width: 28 },
    { header: 'Definição', key: 'def', width: 72 },
  ];
  styleHeader(wsDoutrina.getRow(1));
  [
    { conceito: 'Eixos produto compra', def: `Máximo ${MAX_EIXOS_PRODUTO_COMPRA} (A e B). Precisa de terceiro? Crie outro produto compra — não um terceiro eixo.` },
    { conceito: 'Mix — controle', def: 'Composição plena: a grelha do produto compra deve estar coberta (cada célula relevante).' },
    { conceito: 'Portfolio — controle', def: 'Nível de cobertura (ex. 80% das opções saldáveis). Tamanho do time: qtd máx de SKUs/opções por produto compra (ex. 11 jogadores).' },
    { conceito: 'Portfolio — mínimo saldável', def: 'Quantas opções “contam” para dizer que o leque está ok (abaixo disso = formação fraca).' },
    { conceito: 'Massa crítica (SKU)', def: 'Quantidade mínima para o SKU ser relevante no balcão — mesmo com estoque > 0.' },
    { conceito: 'Ruptura estoque zero', def: TIPOS_RUPTURA.estoque_zero },
    { conceito: 'Ruptura ponto futuro', def: TIPOS_RUPTURA.ponto_futuro_negativo },
    { conceito: 'Ruptura massa crítica', def: TIPOS_RUPTURA.massa_critica + ' — cerâmica: 3 caixas não sustenta a opção no portfólio.' },
    { conceito: 'Solo', def: 'Também exige massa crítica por SKU; ruptura costuma ser zero ou ponto futuro.' },
  ].forEach((r) => wsDoutrina.addRow(r));
  wsDoutrina.getColumn(2).width = 80;

  const wsCat = wb.addWorksheet('Categorias', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsCat.columns = [
    { header: 'Ordem', key: 'ordem', width: 8 },
    { header: 'Categoria', key: 'nome', width: 28 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'LINHAS presentes', key: 'linhas', width: 48 },
    { header: 'STATUS', key: 'status', width: 10 },
    { header: 'OBS', key: 'obs', width: 24 },
  ];
  styleHeader(wsCat.getRow(1));
  catsSorted.forEach((c, i) => {
    wsCat.addRow({
      ordem: i + 1,
      nome: c.nome,
      skus: c.skus,
      linhas: [...c.linhas.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k}(${n})`)
        .join(' · '),
      status: '',
      obs: '',
    });
  });

  const wsLin = wb.addWorksheet('LINHAS', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsLin.columns = [
    { header: 'Ordem', key: 'ordem', width: 8 },
    { header: 'Código', key: 'codigo', width: 16 },
    { header: 'Nome LINHA', key: 'nome', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 11 },
    { header: 'Níveis árvore', key: 'niveis', width: 32 },
    { header: 'Categoria principal (sugestão)', key: 'cat_sug', width: 28 },
    { header: 'Rótulo eixo A (LINHA)', key: 'eixo_a', width: 18 },
    { header: 'Rótulo eixo B (LINHA)', key: 'eixo_b', width: 18 },
    { header: 'Forma controle', key: 'controle', width: 28 },
    { header: 'Ruptura predominante', key: 'ruptura', width: 22 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'STATUS', key: 'status', width: 10 },
    { header: 'OBS', key: 'obs', width: 24 },
  ];
  styleHeader(wsLin.getRow(1));

  const linhaSkuCount = new Map();
  const linhaCatCount = new Map();
  for (const p of produtos) {
    const lc = inferirLinhaCodigo(p);
    linhaSkuCount.set(lc, (linhaSkuCount.get(lc) || 0) + 1);
    const cat = trim(p.categoria_nome) || '(sem categoria)';
    if (!linhaCatCount.has(lc)) linhaCatCount.set(lc, new Map());
    linhaCatCount.get(lc).set(cat, (linhaCatCount.get(lc).get(cat) || 0) + 1);
  }

  for (const l of LINHAS_MESTRE) {
    const db = linhaByCodigo.get(l.codigo);
    const cats = linhaCatCount.get(l.codigo);
    const topCat = cats
      ? [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      : '';
    wsLin.addRow({
      ordem: db?.ordem ?? l.ordem,
      codigo: l.codigo,
      nome: db?.nome ?? l.nome,
      tipo: db?.tipo ?? l.tipo,
      niveis: niveisLabel(l.tipo),
      cat_sug: topCat,
      eixo_a: db?.eixo_a_rotulo ?? '',
      eixo_b: db?.eixo_b_rotulo ?? '',
      controle: LINHA_COMPORTAMENTOS[l.tipo]?.controle ?? '',
      ruptura: LINHA_COMPORTAMENTOS[l.tipo]?.ruptura_tipica ?? '',
      skus: linhaSkuCount.get(l.codigo) || 0,
      status: '',
      obs: l.chave,
    });
  }

  const wsPc = wb.addWorksheet('Produto compra', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsPc.columns = [
    { header: 'Ordem', key: 'ordem', width: 8 },
    { header: 'LINHA código', key: 'linha_codigo', width: 14 },
    { header: 'LINHA nome', key: 'linha_nome', width: 26 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Cód. prod. compra', key: 'codigo', width: 18 },
    { header: 'Nome produto compra', key: 'nome', width: 28 },
    { header: 'Rótulo eixo A', key: 'eixo_a', width: 16 },
    { header: 'Rótulo eixo B', key: 'eixo_b', width: 16 },
    { header: 'Meta opções (time)', key: 'meta_opcoes', width: 14 },
    { header: 'Cobertura mín %', key: 'cobertura_pct', width: 14 },
    { header: 'Massa crítica SKU', key: 'massa_critica', width: 14 },
    { header: 'Tipo ruptura', key: 'tipo_ruptura', width: 18 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'STATUS', key: 'status', width: 10 },
    { header: 'OBS', key: 'obs', width: 32 },
  ];
  styleHeader(wsPc.getRow(1));

  const comprasSorted = [...compraMap.values()]
    .filter((c) => !pulaProdutoCompra(c.tipo))
    .sort((a, b) => {
      const oa = LINHAS_MESTRE.find((l) => l.codigo === a.linha_codigo)?.ordem ?? 999;
      const ob = LINHAS_MESTRE.find((l) => l.codigo === b.linha_codigo)?.ordem ?? 999;
      if (oa !== ob) return oa - ob;
      return a.produto_compra_nome.localeCompare(b.produto_compra_nome, 'pt-BR');
    });

  comprasSorted.forEach((pc, i) => {
    wsPc.addRow({
      ordem: i + 1,
      linha_codigo: pc.linha_codigo,
      linha_nome: pc.linha_nome,
      tipo: pc.tipo,
      codigo: pc.produto_compra_codigo,
      nome: pc.produto_compra_nome,
      eixo_a: '',
      eixo_b: '',
      meta_opcoes: pc.tipo === 'portfolio' ? '' : '',
      cobertura_pct: pc.tipo === 'portfolio' ? '' : '',
      massa_critica: '',
      tipo_ruptura: pc.tipo === 'portfolio' ? 'massa_critica' : 'ponto_futuro_negativo',
      skus: pc.skus,
      status: '',
      obs: `h2: ${[...pc.h2].slice(0, 4).join(' | ')}`,
    });
  });

  const wsEixo = wb.addWorksheet('Eixos candidatos', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsEixo.columns = [
    { header: 'LINHA', key: 'linha', width: 14 },
    { header: 'Produto compra', key: 'pc', width: 26 },
    { header: 'Campo h2 (valores)', key: 'h2', width: 36 },
    { header: 'Campo h3 (valores)', key: 'h3', width: 36 },
    { header: 'Campo h4 (valores)', key: 'h4', width: 36 },
    { header: 'Sugestão eixo A', key: 'sug_a', width: 14 },
    { header: 'Sugestão eixo B', key: 'sug_b', width: 14 },
  ];
  styleHeader(wsEixo.getRow(1));

  for (const ec of [...eixoCand.values()].sort((a, b) => a.linha_codigo.localeCompare(b.linha_codigo))) {
    const meta = findLinhaMeta(ec.linha_codigo);
    if (pulaProdutoCompra(meta.tipo)) continue;
    const fmt = (m) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([k, n]) => `${k} (${n})`)
        .join(' · ');
    wsEixo.addRow({
      linha: ec.linha_codigo,
      pc: ec.produto_compra,
      h2: fmt(ec.h2),
      h3: fmt(ec.h3),
      h4: fmt(ec.h4),
      sug_a: ec.h2.size ? 'h2?' : ec.h3.size ? 'h3?' : 'h4?',
      sug_b: ec.h3.size && ec.h2.size ? 'h3?' : ec.h4.size ? 'h4?' : '—',
    });
  }

  const wsTree = wb.addWorksheet('Árvore trabalho', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsTree.columns = [
    { header: 'ORDEM', key: 'ordem_trabalho', width: 8 },
    { header: 'Nível', key: 'nivel', width: 14 },
    { header: 'Categoria', key: 'categoria', width: 22 },
    { header: 'LINHA', key: 'linha_codigo', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Produto compra', key: 'produto_compra', width: 22 },
    { header: 'SKU id', key: 'sku_id', width: 14 },
    { header: 'SKU nome', key: 'sku_nome', width: 36 },
    { header: 'Eixo A valor', key: 'eixo_a', width: 14 },
    { header: 'Eixo B valor', key: 'eixo_b', width: 14 },
    { header: 'h1', key: 'h1', width: 14 },
    { header: 'h2', key: 'h2', width: 12 },
    { header: 'h3', key: 'h3', width: 12 },
    { header: 'STATUS', key: 'status', width: 10 },
    { header: 'OBS', key: 'obs', width: 28 },
  ];
  styleHeader(wsTree.getRow(1));
  treeRows.forEach((r) => wsTree.addRow(r));

  const wsSku = wb.addWorksheet('SKUs mapa', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsSku.columns = [
    { header: 'Categoria', key: 'categoria', width: 22 },
    { header: 'LINHA', key: 'linha_codigo', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Produto compra', key: 'produto_compra', width: 22 },
    { header: 'id', key: 'id', width: 14 },
    { header: 'Nome', key: 'nome', width: 40 },
    { header: 'h1', key: 'h1', width: 16 },
    { header: 'h2', key: 'h2', width: 14 },
    { header: 'h3', key: 'h3', width: 14 },
    { header: 'h4', key: 'h4', width: 14 },
    { header: 'h5', key: 'h5', width: 12 },
    { header: 'Estoque', key: 'estoque', width: 10 },
    { header: 'Massa crítica', key: 'massa_critica', width: 12 },
    { header: 'Tipo ruptura', key: 'tipo_ruptura', width: 18 },
    { header: 'STATUS', key: 'status', width: 10 },
  ];
  styleHeader(wsSku.getRow(1));
  for (const p of produtos) {
    const lc = inferirLinhaCodigo(p);
    const meta = findLinhaMeta(lc);
    const pc = inferirProdutoCompraLabel(p, lc, meta.tipo);
    const tipoRupt =
      meta.tipo === 'portfolio' ? 'massa_critica' : meta.tipo === 'solo' ? 'estoque_zero' : 'ponto_futuro_negativo';
    wsSku.addRow({
      categoria: trim(p.categoria_nome),
      linha_codigo: lc,
      tipo: meta.tipo,
      produto_compra: pulaProdutoCompra(meta.tipo) ? '(solo)' : pc,
      id: p.id,
      nome: p.nome,
      h1: trim(p.campo_hierarquico_1),
      h2: trim(p.campo_hierarquico_2),
      h3: trim(p.campo_hierarquico_3),
      h4: trim(p.campo_hierarquico_4),
      h5: trim(p.campo_hierarquico_5),
      estoque: Number(p.estoque_atual) || 0,
      massa_critica: '',
      tipo_ruptura: tipoRupt,
      status: '',
    });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-hierarquia-catalogo-trabalho.xlsx');
  } catch { /* ok */ }

  console.log(`[export-hierarquia-catalogo] → ${OUT}`);
  console.log(`Categorias: ${catsSorted.length} · Produto compra: ${comprasSorted.length} · Árvore: ${treeRows.length} linhas`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
