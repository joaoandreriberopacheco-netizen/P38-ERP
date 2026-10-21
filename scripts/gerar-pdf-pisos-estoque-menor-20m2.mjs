#!/usr/bin/env node
/**
 * PDF — pisos (PISO) com menos de 20 m² em estoque.
 * Uso: npx vite-node scripts/gerar-pdf-pisos-estoque-menor-20m2.mjs [--out=/path/file.pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { requireP38SupabaseScriptClient } from './p38-supabase-script-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIMITE_M2 = 20;

function parseOutArg(argv) {
  const hit = argv.find((a) => a.startsWith('--out='));
  if (hit) return hit.slice('--out='.length);
  const stamp = new Date().toISOString().slice(0, 10);
  return path.join('/opt/cursor/artifacts', `pisos-estoque-menor-20m2-${stamp}.pdf`);
}

function estoqueM2(produto, libs) {
  const { resolvePrimaryFromFactorOne, normalizeUnitCode, buildPurchaseUnitOptions } = libs;
  const estoqueBase = Number(produto.estoque_atual) || 0;
  const principal = normalizeUnitCode(
    resolvePrimaryFromFactorOne(produto, produto.unidade_principal || 'UN'),
  );
  if (principal === 'M2') return estoqueBase;
  const cx = buildPurchaseUnitOptions(produto).find((o) => normalizeUnitCode(o.unidade) === 'CX');
  if (principal === 'CX' && cx) return estoqueBase * (Number(cx.fator_conversao) || 1);
  return null;
}

function estoqueCx(produto, libs) {
  const {
    resolvePrimaryFromFactorOne,
    normalizeUnitCode,
    buildPurchaseUnitOptions,
    resolveCommercialDisplay,
    commercialQuantityFromBase,
  } = libs;
  const estoqueBase = Number(produto.estoque_atual) || 0;
  const principal = normalizeUnitCode(
    resolvePrimaryFromFactorOne(produto, produto.unidade_principal || 'UN'),
  );
  const cxOpt = buildPurchaseUnitOptions(produto).find((o) => normalizeUnitCode(o.unidade) === 'CX');
  if (!cxOpt) {
    const com = resolveCommercialDisplay(produto, estoqueBase, principal);
    return normalizeUnitCode(com.unidade) === 'CX' ? com.quantidade : null;
  }
  const f = Number(cxOpt.fator_conversao) || 1;
  if (principal === 'CX') return estoqueBase;
  if (f > 0) return commercialQuantityFromBase(estoqueBase, f, 'CX');
  return null;
}

function custoPorCx(produto, libs) {
  const {
    resolveCustoTotalUnitBaseProduto,
    normalizeUnitCode,
    buildPurchaseUnitOptions,
    resolveCommercialDisplay,
    resolvePrimaryFromFactorOne,
  } = libs;
  const custoBase = resolveCustoTotalUnitBaseProduto(produto);
  const opts = buildPurchaseUnitOptions(produto);
  const cx = opts.find((o) => normalizeUnitCode(o.unidade) === 'CX');
  if (cx) {
    const f = Number(cx.fator_conversao) || 1;
    if (!cx.is_primary) return custoBase * f;
    return custoBase;
  }
  const principal = resolvePrimaryFromFactorOne(produto, produto.unidade_principal || 'UN');
  const com = resolveCommercialDisplay(produto, 1, principal);
  if (normalizeUnitCode(com.unidade) === 'CX') {
    return custoBase * (Number(com.fator_conversao) || 1);
  }
  return custoBase;
}

async function fetchPisos(supabase) {
  const { data, error } = await supabase
    .from('produto')
    .select(
      'codigo_interno,nome,estoque_atual,preco_custo_calculado,unidade_principal,unidade_vitrine,unidades_alternativas,campo_hierarquico_1,ativo',
    )
    .eq('campo_hierarquico_1', 'PISO')
    .eq('ativo', true);
  if (error) throw error;
  return data || [];
}

async function main() {
  const outPath = parseOutArg(process.argv.slice(2));
  const { supabase } = requireP38SupabaseScriptClient();
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

  try {
    const unitsLib = await server.ssrLoadModule('/src/lib/productUnits.js');
    const pdfLib = await server.ssrLoadModule(
      '/src/lib/relatorioPisosEstoqueBaixoPdf/generateRelatorioPisosEstoqueBaixoPdf.js',
    );

    const produtos = await fetchPisos(supabase);
    const rows = [];
    for (const p of produtos) {
      const estoqueBase = Number(p.estoque_atual) || 0;
      if (estoqueBase <= 0) continue;
      const m2 = estoqueM2(p, unitsLib);
      if (m2 == null || m2 >= LIMITE_M2) continue;
      const cx = estoqueCx(p, unitsLib);
      if (cx == null) continue;
      rows.push({
        codigo: p.codigo_interno,
        nome: p.nome,
        m2: Math.round(m2 * 100) / 100,
        cx: Math.round(cx * 100) / 100,
        custo_calc_x_cx: Math.round(custoPorCx(p, unitsLib) * 100) / 100,
      });
    }
    rows.sort((a, b) => a.m2 - b.m2);

    const { data } = await pdfLib.generateRelatorioPisosEstoqueBaixoPdf({
      rows,
      limiteM2: LIMITE_M2,
    });

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(data));
    console.log(JSON.stringify({ ok: true, out: outPath, count: rows.length }, null, 2));
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
