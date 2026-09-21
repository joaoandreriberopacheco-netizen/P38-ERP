/**
 * Cruza catálogo 4×3 com estoque e movimentos (Supabase ou Excel fallback).
 *
 * - Sem estoque: todos os SKUs do comp1 com estoque ≤ 0.
 * - Zumbi: sem estoque E sem movimentação nos últimos N meses (todos os SKUs do comp1).
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import pg from 'pg';

const STOCK_XLSX = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');
const CATALOG_XLSX = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const ZUMBIS_MESES = 4;
const PAGE_SIZE = 1000;

function cellStr(v) {
  return String(v ?? '').trim();
}

function produtoKey(etapa, categoria, subcategoria, linha, comp1) {
  return [etapa, categoria, subcategoria, linha, comp1].map((p) => cellStr(p)).join('\x00');
}

function supabaseUrl() {
  return (
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://zhonvxkkqabfdyehyxpu.supabase.co'
  );
}

function supabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  );
}

function cutoffIso(months = ZUMBIS_MESES) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

function cutoffDiasIso(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

/** @returns {Promise<{ estoque: Map<string, number>, movimentoRecente: Map<string, boolean>, source: string }>} */
export async function loadEstoqueEMovimentos({ meses = ZUMBIS_MESES } = {}) {
  const cutoff = cutoffIso(meses);

  if (process.env.DATABASE_URL) {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      const { rows } = await client.query(
        `
        select
          coalesce(p.codigo_interno, '') as codigo_interno,
          coalesce(p.estoque_atual, 0)::numeric as estoque_atual,
          exists (
            select 1
            from public.movimentacao_estoque m
            where m.produto_id = p.id
              and m.created_at >= now() - ($1::text || ' months')::interval
          ) as movimento_recente
        from public.produto p
        where p.ativo = true
        `,
        [String(meses)],
      );
      await client.end();

      const estoque = new Map();
      const movimentoRecente = new Map();
      for (const r of rows) {
        const cod = cellStr(r.codigo_interno).toUpperCase();
        if (!cod) continue;
        estoque.set(cod, Number(r.estoque_atual) || 0);
        movimentoRecente.set(cod, Boolean(r.movimento_recente));
      }
      return { estoque, movimentoRecente, source: 'supabase-pg' };
    } catch {
      await client.end().catch(() => {});
    }
  }

  const key = supabaseKey();
  if (key) {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(supabaseUrl(), key);

    const estoque = new Map();
    const movimentoRecente = new Map();
    /** @type {Map<string, string>} */
    const idPorCodigo = new Map();

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await sb
        .from('produto')
        .select('id, codigo_interno, estoque_atual')
        .eq('ativo', true)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data?.length) break;
      for (const r of data) {
        const cod = cellStr(r.codigo_interno).toUpperCase();
        if (!cod) continue;
        estoque.set(cod, Number(r.estoque_atual) || 0);
        movimentoRecente.set(cod, false);
        idPorCodigo.set(cod, cellStr(r.id));
      }
      if (data.length < PAGE_SIZE) break;
    }

    /** @type {Set<string>} */
    const idsComMovimento = new Set();
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await sb
        .from('movimentacao_estoque')
        .select('produto_id')
        .gte('created_at', cutoff)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data?.length) break;
      for (const r of data) {
        const id = cellStr(r.produto_id);
        if (id) idsComMovimento.add(id);
      }
      if (data.length < PAGE_SIZE) break;
    }

    for (const [cod, id] of idPorCodigo) {
      if (idsComMovimento.has(id)) movimentoRecente.set(cod, true);
    }

    return { estoque, movimentoRecente, source: 'supabase-rest' };
  }

  if (!fs.existsSync(STOCK_XLSX)) {
    throw new Error(
      `Sem ligação Supabase e sem ${STOCK_XLSX}. Correr: npm run export:catalogo-skus`,
    );
  }

  const estoque = new Map();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(STOCK_XLSX);
  const ws = wb.getWorksheet('Catálogo SKUs');
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cod = cellStr(row.getCell(2).value).toUpperCase();
    const est = Number(row.getCell(9).value) || 0;
    if (cod) estoque.set(cod, est);
  });

  throw new Error(
    'Zumbis exigem movimentos dos últimos 4 meses — ligação Supabase indisponível e Excel não inclui movimentação.',
  );
}

/** @returns {Promise<{ estoque: Map<string, number>, vendaRecente: Map<string, boolean>, source: string, cutoff: string }>} */
export async function loadEstoqueEVendas({ dias = 75 } = {}) {
  const cutoff = cutoffDiasIso(dias);

  if (process.env.DATABASE_URL) {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      const { rows } = await client.query(
        `
        select
          coalesce(p.codigo_interno, '') as codigo_interno,
          coalesce(p.estoque_atual, 0)::numeric as estoque_atual,
          exists (
            select 1
            from public.movimentacao_estoque m
            where m.produto_id = p.id
              and m.motivo = 'Venda'
              and m.created_at >= now() - ($1::text || ' days')::interval
          ) as venda_recente
        from public.produto p
        where p.ativo = true
        `,
        [String(dias)],
      );
      await client.end();

      const estoque = new Map();
      const vendaRecente = new Map();
      for (const r of rows) {
        const cod = cellStr(r.codigo_interno).toUpperCase();
        if (!cod) continue;
        estoque.set(cod, Number(r.estoque_atual) || 0);
        vendaRecente.set(cod, Boolean(r.venda_recente));
      }
      return { estoque, vendaRecente, source: 'supabase-pg', cutoff: cutoff.slice(0, 10) };
    } catch {
      await client.end().catch(() => {});
    }
  }

  const key = supabaseKey();
  if (!key) {
    throw new Error('Sem ligação Supabase — vendas exigem movimentacao_estoque.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl(), key);

  const estoque = new Map();
  const vendaRecente = new Map();
  /** @type {Map<string, string>} */
  const idPorCodigo = new Map();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('produto')
      .select('id, codigo_interno, estoque_atual')
      .eq('ativo', true)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const cod = cellStr(r.codigo_interno).toUpperCase();
      if (!cod) continue;
      estoque.set(cod, Number(r.estoque_atual) || 0);
      vendaRecente.set(cod, false);
      idPorCodigo.set(cod, cellStr(r.id));
    }
    if (data.length < PAGE_SIZE) break;
  }

  /** @type {Set<string>} */
  const idsComVenda = new Set();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('movimentacao_estoque')
      .select('produto_id')
      .eq('motivo', 'Venda')
      .gte('created_at', cutoff)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) {
      const id = cellStr(r.produto_id);
      if (id) idsComVenda.add(id);
    }
    if (data.length < PAGE_SIZE) break;
  }

  for (const [cod, id] of idPorCodigo) {
    if (idsComVenda.has(id)) vendaRecente.set(cod, true);
  }

  return { estoque, vendaRecente, source: 'supabase-rest', cutoff: cutoff.slice(0, 10) };
}

/** @deprecated use loadEstoqueEMovimentos */
export async function loadEstoquePorCodigo() {
  const { estoque, source } = await loadEstoqueEMovimentos();
  return { map: estoque, source };
}

function isSkuSemEstoque(estoque, codigo) {
  return (estoque.get(codigo) ?? 0) <= 0;
}

function isSkuZumbi(estoque, movimentoRecente, codigo) {
  return isSkuSemEstoque(estoque, codigo) && !movimentoRecente.get(codigo);
}

function isSkuSemEstoqueSemVenda(estoque, vendaRecente, codigo) {
  return isSkuSemEstoque(estoque, codigo) && !vendaRecente.get(codigo);
}

async function aggregateCatalogo(catalogPath, classifySku) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(catalogPath);
  const ws = wb.getWorksheet('Catálogo 4×3');
  if (!ws) throw new Error('Aba Catálogo 4×3 não encontrada');

  /** @type {Map<string, { total: number, match: number, codigos: string[] }>} */
  const porProduto = new Map();

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = cellStr(row.getCell(10).value).toUpperCase();
    if (!codigo) return;

    const etapa = cellStr(row.getCell(3).value);
    const categoria = cellStr(row.getCell(4).value);
    const sub = cellStr(row.getCell(5).value);
    const linha = cellStr(row.getCell(6).value);
    const comp1 = cellStr(row.getCell(7).value);
    const pk = produtoKey(etapa, categoria, sub, linha, comp1);

    if (!porProduto.has(pk)) {
      porProduto.set(pk, { total: 0, match: 0, codigos: [] });
    }
    const bucket = porProduto.get(pk);
    bucket.total += 1;
    bucket.codigos.push(codigo);
    if (classifySku(codigo)) bucket.match += 1;
  });

  return porProduto;
}

function buildFilterFromBuckets(porProduto, { kind, source, extra = {} }) {
  const produtoKeys = [];
  const codigos = new Set();
  let skusMatch = 0;

  for (const [pk, info] of porProduto) {
    skusMatch += info.match;
    if (info.match === info.total) {
      produtoKeys.push(pk);
      for (const cod of info.codigos) codigos.add(cod);
    }
  }

  return {
    kind,
    source,
    produtosCompraTotal: porProduto.size,
    skusCatalogo: skusMatch,
    produto_keys: produtoKeys,
    codigos: [...codigos],
    ...extra,
  };
}

export async function buildSemEstoqueFilter(catalogPath = CATALOG_XLSX) {
  const { estoque, source } = await loadEstoqueEMovimentos();
  const porProduto = await aggregateCatalogo(catalogPath, (codigo) =>
    isSkuSemEstoque(estoque, codigo),
  );

  const filter = buildFilterFromBuckets(porProduto, {
    kind: 'sem-estoque',
    source,
    extra: {
      estoqueSkus: estoque.size,
      produtosCompraSemEstoque: 0,
      skusSemEstoque: 0,
    },
  });
  filter.produtosCompraSemEstoque = filter.produto_keys.length;
  filter.skusSemEstoque = filter.codigos.length;
  return filter;
}

export async function buildZumbisFilter(catalogPath = CATALOG_XLSX, { meses = ZUMBIS_MESES } = {}) {
  const { estoque, movimentoRecente, source } = await loadEstoqueEMovimentos({ meses });
  const porProduto = await aggregateCatalogo(catalogPath, (codigo) =>
    isSkuZumbi(estoque, movimentoRecente, codigo),
  );

  let skusZumbi = 0;
  for (const info of porProduto.values()) skusZumbi += info.match;

  const filter = buildFilterFromBuckets(porProduto, {
    kind: 'zumbis',
    source,
    extra: {
      mesesSemMovimento: meses,
      estoqueSkus: estoque.size,
      produtosCompraZumbis: 0,
      skusZumbi: 0,
    },
  });
  filter.produtosCompraZumbis = filter.produto_keys.length;
  filter.skusZumbi = filter.codigos.length;
  filter.skusZumbiTotal = skusZumbi;
  return filter;
}

export async function buildSemEstoqueSemVendaFilter(
  catalogPath = CATALOG_XLSX,
  { dias = 75 } = {},
) {
  const { estoque, vendaRecente, source, cutoff } = await loadEstoqueEVendas({ dias });
  const porProduto = await aggregateCatalogo(catalogPath, (codigo) =>
    isSkuSemEstoqueSemVenda(estoque, vendaRecente, codigo),
  );

  let skusMatch = 0;
  for (const info of porProduto.values()) skusMatch += info.match;

  const filter = buildFilterFromBuckets(porProduto, {
    kind: 'sem-venda-75d',
    source,
    extra: {
      diasSemVenda: dias,
      cutoff,
      estoqueSkus: estoque.size,
      produtosCompraMatch: 0,
      skusMatch: 0,
    },
  });
  filter.produtosCompraMatch = filter.produto_keys.length;
  filter.skusMatch = filter.codigos.length;
  filter.skusMatchTotal = skusMatch;
  return filter;
}
