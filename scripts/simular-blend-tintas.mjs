#!/usr/bin/env node
/**
 * Simula blend cadastral de tintas (legados → produto compra curado · cor).
 *
 * Colunas: produto compra · cor · estoque · custo médio · preço venda médio
 *
 * npm run simular:blend-tintas
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { cellStr, to4x3 } from './lib/catalogo3x3Map.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const CORE_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');
const OUT_CSV = path.join(process.cwd(), 'docs', 'exports', 'P38-blend-tintas-simulacao.csv');

const MARCAS = [
  'VERBRAS',
  'VITÓRIA RÉGIA',
  'VITORIA REGIA',
  'HIPERCOR',
  'IQUINE',
  'HIDRACOR',
  'COLORGIN',
  'RENNER',
  'METÁLICA',
  'METALICA',
  'CITYCOLOR',
  'VERTEX',
  'VPRO',
  'CORAL',
  'TEKBOND',
  'ZARCOFER',
  'SUZAN',
  'SHERWIN',
  'SUVINIL',
];

const H3_PRODUTO_COMPRA = {
  ESMALTE: 'TINTA ESMALTE SINTETICO',
  'P/ PISO': 'TINTA P/ PISO',
  'ACR. FOSCO ECON.': 'TINTA ACRILICA FOSCO ECONOMICA',
  'SEMI-BRILHO': 'TINTA SEMI-BRILHO',
  STANDARD: 'TINTA STANDARD',
  'STANDARD POUPE+': 'TINTA STANDARD POUPE+',
  'INT/EXT STAND': 'TINTA STANDARD',
};

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function stripMarca(text = '') {
  let out = cellStr(text);
  for (const marca of MARCAS) {
    const re = new RegExp(`\\b${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, ' ').replace(/\s+/g, ' ').trim();
  }
  return out.replace(/\s+/g, ' ').trim();
}

function canonicalProdutoCompra(text = '') {
  return stripMarca(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bSINTETICO\b/gi, 'SINTETICO')
    .replace(/\bACRILICA\b/gi, 'ACRILICA')
    .replace(/\bECONOMICO\b/gi, 'ECONOMICA')
    .replace(/\bECON\b/gi, 'ECONOMICA')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeCor(cor = '') {
  let c = cellStr(cor).replace(/\s+/g, ' ').trim();
  c = c.replace(/^BRRANCO/i, 'BRANCO');
  c = c.replace(/\bCARTEPILA\b/i, 'CATERPILAR');
  c = c.replace(/\bAÇAI\b/i, 'ACAI');
  c = c.replace(/\bAÇAÍ\b/i, 'ACAI');
  c = c.replace(/\bDEMARÇÃO\b/i, 'DEMARCACAO');
  c = c.replace(/\bDEMARCAÇÃO\b/i, 'DEMARCACAO');
  return c;
}

function apresentacaoCurada(fmt = '', sku = '') {
  const raw = cellStr(fmt) || cellStr(sku);
  const n = norm(raw).replace(/[()]/g, '').replace(/\s+/g, ' ');
  if (!n) return /SPRAY/i.test(sku) ? 'SPRAY' : '';
  if (/SPRAY/.test(n) || /\b(300|350|360|400)\s*ML\b/.test(n)) return 'SPRAY';

  const ml = n.match(/(\d+[,.]?\d*)\s*ML\b/);
  if (ml) {
    const v = parseFloat(ml[1].replace(',', '.'));
    if (v >= 700 && v <= 950) return 'LT';
    return 'LT';
  }

  const gl = n.match(/\bGL\b/);
  if (gl) return 'GL';

  const l = n.match(/(\d+[,.]?\d*)\s*L\b/);
  if (l) {
    const v = parseFloat(l[1].replace(',', '.'));
    if (v >= 2.5 && v <= 4.5) return 'GL';
    if (v >= 14 && v <= 20) return 'BD';
    return `${v} L`;
  }

  return n;
}

function produtoCompraCurado(comp1 = '', comp2 = '', sku = '') {
  let base = canonicalProdutoCompra(comp1);
  if (!base || base === 'TINTA') {
    if (/ACAB/i.test(sku)) base = 'TINTA ACABAMENTO';
    else base = 'TINTA';
  }
  const ap = apresentacaoCurada(comp2, sku);
  if (!ap) return base;
  return `${base} · ${ap}`;
}

async function loadCoreByCodigo() {
  const map = new Map();
  if (!fs.existsSync(CORE_PATH)) return map;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  if (!ws) return map;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = cellStr(row.getCell(1).value).toUpperCase();
    if (!codigo) return;
    map.set(codigo, {
      codigo_interno: codigo,
      etapa: cellStr(row.getCell(2).value),
      core: cellStr(row.getCell(3).value),
      linha: cellStr(row.getCell(4).value),
      produto_compra: cellStr(row.getCell(5).value),
      eixo_a: cellStr(row.getCell(6).value),
      eixo_b: cellStr(row.getCell(7).value),
      novo_sku: cellStr(row.getCell(8).value),
      sku_atual: cellStr(row.getCell(9).value),
    });
  });
  return map;
}

function inferCatalogRow(produto) {
  const codigo = cellStr(produto.codigo_interno).toUpperCase();
  const nome = cellStr(produto.nome);
  const h1 = cellStr(produto.campo_hierarquico_1);
  const h2 = cellStr(produto.campo_hierarquico_2);
  const h3 = cellStr(produto.campo_hierarquico_3);
  const h4 = cellStr(produto.campo_hierarquico_4);
  const h5 = cellStr(produto.campo_hierarquico_5);

  if (h1 === 'TINTA') {
    const pc = H3_PRODUTO_COMPRA[h3] || (h3 ? `TINTA ${h3}` : 'TINTA');
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: pc,
      eixo_a: h2,
      eixo_b: h4,
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h5,
    };
  }

  if (/^TINTA ESMALTE IQUINE/i.test(h1)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA ESMALTE SINTETICO',
      eixo_a: h2,
      eixo_b: 'IQUINE',
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h3,
    };
  }

  if (/^TINTA ANTICORROSIVA/i.test(h1)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA ANTICORROSIVA',
      eixo_a: h2,
      eixo_b: h1.replace(/^TINTA ANTICORROSIVA\s*/i, '').trim(),
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h3 || nome.replace(/.*\s(\w+)\s*$/i, '$1'),
    };
  }

  if (/SPRAY/i.test(h1) || /SPRAY/i.test(nome)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA SPRAY',
      eixo_a: '',
      eixo_b: '',
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: '',
    };
  }

  if (/^TINTA ACAB/i.test(h1)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA ACABAMENTO',
      eixo_a: h2,
      eixo_b: h4 || 'CITYCOLOR',
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h5,
    };
  }

  return {
    codigo_interno: codigo,
    etapa: '6 — Acabamento seco',
    core: 'PINTURA_OBRA',
    linha: 'TINTA',
    produto_compra: h1 || 'TINTA',
    eixo_a: h2,
    eixo_b: h4 || h3,
    novo_sku: nome,
    sku_atual: nome,
    _cor_hint: h5 || h3,
  };
}

function blendKey(produtoCompra, cor) {
  return `${canonicalProdutoCompra(produtoCompra)}\x00${norm(cor)}`;
}

function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function weightedAvg(items, qtyKey, valKey) {
  let qtySum = 0;
  let valSum = 0;
  for (const it of items) {
    const q = Math.max(0, Number(it[qtyKey]) || 0);
    const v = Number(it[valKey]) || 0;
    if (q > 0) {
      qtySum += q;
      valSum += q * v;
    }
  }
  if (qtySum > 0) return valSum / qtySum;
  const vals = items.map((it) => Number(it[valKey]) || 0).filter((v) => v > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function main() {
  const coreMap = await loadCoreByCodigo();
  const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: produtosRaw, error } = await sb
    .from('produto')
    .select(
      'codigo_interno,nome,campo_hierarquico_1,campo_hierarquico_2,campo_hierarquico_3,campo_hierarquico_4,campo_hierarquico_5,estoque_atual,preco_custo_calculado,preco_venda_padrao',
    )
    .eq('ativo', true)
    .or('nome.ilike.%TINTA%,campo_hierarquico_1.ilike.%TINTA%');

  const produtos = (produtosRaw || []).filter(
    (p) => !/^VERNIZ/i.test(p.nome || '') && !/^VERNIZ/i.test(p.campo_hierarquico_1 || ''),
  );

  if (error) throw error;

  const legados = [];
  for (const p of produtos) {
    const codigo = cellStr(p.codigo_interno).toUpperCase();
    const catalogRow = coreMap.get(codigo) || inferCatalogRow(p);
    const mapped = to4x3(catalogRow);
    let cor = normalizeCor(mapped.comp3 || catalogRow._cor_hint || '');
    if (!cor && /SPRAY/i.test(p.nome)) {
      const dash = p.nome.match(/\s[-–—]\s+(.+)$/);
      if (dash) cor = normalizeCor(dash[1]);
      else {
        const tail = p.nome.replace(/^TINTA SPRAY[^A-Z0-9ÁÉÍÓÚÃÕÂÊÔÇ]*\d*\s*ML?\s*[-–—]?\s*/i, '');
        if (tail && tail !== p.nome) cor = normalizeCor(tail);
      }
    }
    const pcCurado = produtoCompraCurado(mapped.comp1, mapped.comp2, p.nome);

    legados.push({
      codigo,
      nome: p.nome,
      produto_compra: pcCurado,
      cor,
      estoque: Math.max(0, Number(p.estoque_atual) || 0),
      custo: Number(p.preco_custo_calculado) || 0,
      preco: Number(p.preco_venda_padrao) || 0,
      comp1: mapped.comp1,
      comp2: mapped.comp2,
      comp3: mapped.comp3,
    });
  }

  const grupos = new Map();
  for (const leg of legados) {
    const k = blendKey(leg.produto_compra, leg.cor);
    if (!grupos.has(k)) {
      grupos.set(k, {
        produto_compra: leg.produto_compra,
        cor: leg.cor,
        legados: [],
      });
    }
    grupos.get(k).legados.push(leg);
  }

  const blended = [...grupos.values()]
    .map((g) => {
      const estoque = g.legados.reduce((s, l) => s + l.estoque, 0);
      const custo_medio = weightedAvg(g.legados, 'estoque', 'custo');
      const preco_medio = weightedAvg(g.legados, 'estoque', 'preco');
      return {
        produto_compra: g.produto_compra,
        cor: g.cor,
        estoque,
        custo_medio,
        preco_medio,
        n_legados: g.legados.length,
        legados: g.legados,
      };
    })
    .sort(
      (a, b) =>
        a.produto_compra.localeCompare(b.produto_compra, 'pt-BR') ||
        a.cor.localeCompare(b.cor, 'pt-BR'),
    );

  const comEstoque = blended.filter((r) => r.estoque > 0);
  const fusoes = blended.filter((r) => r.n_legados > 1);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BLEND CADASTRAL — TINTAS (simulação)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Legados activos: ${legados.length}`);
  console.log(`Linhas curadas:  ${blended.length} (${fusoes.length} fusões N→1)`);
  console.log(`Com estoque:     ${comEstoque.length} linhas · ${comEstoque.reduce((s, r) => s + r.estoque, 0)} un`);
  console.log('');

  const hdr = ['produto compra', 'cor', 'estoque', 'custo médio', 'preço venda médio', 'legados'];
  console.log(hdr.join('\t'));
  for (const r of blended) {
    console.log(
      [
        r.produto_compra,
        r.cor || '(sem cor)',
        r.estoque,
        fmtMoney(r.custo_medio),
        fmtMoney(r.preco_medio),
        r.n_legados > 1 ? `${r.n_legados}→1` : '1',
      ].join('\t'),
    );
  }

  if (fusoes.length) {
    console.log('\n── Fusões (amostra) ──');
    for (const r of fusoes.slice(0, 12)) {
      console.log(`\n${r.produto_compra} · ${r.cor || '(sem cor)'} (${r.n_legados} legados → estoque ${r.estoque})`);
      for (const l of r.legados) {
        console.log(`  · ${l.codigo} | ${l.nome.slice(0, 60)} | est ${l.estoque}`);
      }
    }
  }

  const csvLines = [
    hdr.join(';'),
    ...blended.map((r) =>
      [
        r.produto_compra,
        r.cor,
        r.estoque,
        r.custo_medio.toFixed(2).replace('.', ','),
        r.preco_medio.toFixed(2).replace('.', ','),
        r.n_legados,
      ].join(';'),
    ),
  ];
  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'), 'utf8');
  console.log(`\n[simular-blend-tintas] CSV → ${OUT_CSV}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
