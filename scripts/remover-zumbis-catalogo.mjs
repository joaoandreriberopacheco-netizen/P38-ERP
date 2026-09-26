#!/usr/bin/env node
/**
 * Remove zumbis reais do cadastro:
 * - core Excel → CATALOGO_ESPACO (fora do catálogo 4×3)
 * - Supabase produto → ativo = false
 *
 *   node scripts/remover-zumbis-catalogo.mjs           # dry-run
 *   node scripts/remover-zumbis-catalogo.mjs --apply   # aplica
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { buildZumbisFilter } from './lib/catalogoEstoqueFilter.mjs';

const APPLY = process.argv.includes('--apply');
const FILTER_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-zumbis-filter.json');
const CORE_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');
const ZUMBIS_MESES = 4;
const PAGE_SIZE = 1000;
const STAMP = new Date().toISOString().slice(0, 10);

function cellStr(v) {
  return String(v ?? '').trim();
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

function cutoffIso() {
  const d = new Date();
  d.setMonth(d.getMonth() - ZUMBIS_MESES);
  return d.toISOString();
}

async function loadCodigosZumbis() {
  if (fs.existsSync(FILTER_PATH)) {
    const data = JSON.parse(fs.readFileSync(FILTER_PATH, 'utf8'));
    if (Array.isArray(data.codigos) && data.codigos.length) {
      return [...new Set(data.codigos.map((c) => cellStr(c).toUpperCase()).filter(Boolean))];
    }
  }
  const filter = await buildZumbisFilter();
  return filter.codigos.map((c) => cellStr(c).toUpperCase());
}

async function verificarZumbisSupabase(codigos) {
  const key = supabaseKey();
  if (!key) throw new Error('Supabase key em falta (SUPABASE_SERVICE_ROLE_KEY)');

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl(), key);
  const cutoff = cutoffIso();

  /** @type {Map<string, { id: string, estoque: number, ativo: boolean }>} */
  const porCodigo = new Map();
  for (let i = 0; i < codigos.length; i += 100) {
    const batch = codigos.slice(i, i + 100);
    const { data, error } = await sb
      .from('produto')
      .select('id, codigo_interno, estoque_atual, ativo')
      .in('codigo_interno', batch);
    if (error) throw error;
    for (const r of data ?? []) {
      const cod = cellStr(r.codigo_interno).toUpperCase();
      porCodigo.set(cod, {
        id: cellStr(r.id),
        estoque: Number(r.estoque_atual) || 0,
        ativo: r.ativo !== false,
      });
    }
  }

  /** @type {Set<string>} */
  const idsComMovimento = new Set();
  const ids = [...porCodigo.values()].map((v) => v.id).filter(Boolean);
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await sb
        .from('movimentacao_estoque')
        .select('produto_id')
        .in('produto_id', batch)
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
  }

  const ok = [];
  const skip = [];

  for (const cod of codigos) {
    const p = porCodigo.get(cod);
    if (!p) {
      skip.push({ codigo: cod, reason: 'não encontrado no Supabase' });
      continue;
    }
    if (p.estoque > 0) {
      skip.push({ codigo: cod, reason: `estoque ${p.estoque} > 0` });
      continue;
    }
    if (idsComMovimento.has(p.id)) {
      skip.push({ codigo: cod, reason: `movimentação nos últimos ${ZUMBIS_MESES} meses` });
      continue;
    }
    ok.push({ codigo: cod, id: p.id, ativo: p.ativo });
  }

  return { ok, skip };
}

async function patchCoreExcel(codigos) {
  if (!fs.existsSync(CORE_PATH)) throw new Error(`Core em falta: ${CORE_PATH}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  if (!ws) throw new Error('Aba Catálogo não encontrada');

  const alvo = new Set(codigos.map((c) => c.toUpperCase()));
  let patched = 0;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = cellStr(row.getCell(1).value).toUpperCase();
    if (!alvo.has(codigo)) return;
    row.getCell(3).value = 'CATALOGO_ESPACO';
    const nome = cellStr(row.getCell(8).value);
    const tag = `[${STAMP}] zumbi removido`;
    if (!nome.includes('zumbi removido')) {
      row.getCell(8).value = nome ? `${nome} · ${tag}` : tag;
    }
    patched += 1;
  });

  if (patched !== codigos.length) {
    console.warn(
      `[zumbis] core: ${patched}/${codigos.length} linhas encontradas (${codigos.length - patched} em falta no Excel)`,
    );
  }

  if (APPLY) await wb.xlsx.writeFile(CORE_PATH);
  return patched;
}

async function desativarSupabase(items) {
  const key = supabaseKey();
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl(), key);
  let updated = 0;
  for (const item of items) {
    const { data, error: fetchErr } = await sb
      .from('produto')
      .select('tags, dados')
      .eq('id', item.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const tags = Array.isArray(data?.tags) ? [...data.tags] : [];
    if (!tags.includes('zumbi-removido')) tags.push('zumbi-removido');

    const dados =
      data?.dados && typeof data.dados === 'object' && !Array.isArray(data.dados)
        ? { ...data.dados }
        : {};
    if (!dados.zumbi_removido_em) {
      dados.zumbi_removido_em = STAMP;
      dados.zumbi_removido_motivo = `sem estoque · sem mov. ${ZUMBIS_MESES} meses`;
    }

    const patch = {
      ativo: false,
      tags,
      dados,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from('produto').update(patch).eq('id', item.id);
    if (error) throw error;
    updated += 1;
  }

  return updated;
}

async function main() {
  const codigos = await loadCodigosZumbis();
  console.log(`[zumbis] candidatos: ${codigos.length} SKUs · modo ${APPLY ? 'APPLY' : 'dry-run'}`);

  const { ok, skip } = await verificarZumbisSupabase(codigos);
  if (skip.length) {
    console.warn(`[zumbis] ignorados (${skip.length}):`);
    for (const s of skip) console.warn(`  - ${s.codigo}: ${s.reason}`);
  }
  if (!ok.length) {
    console.error('[zumbis] nenhum SKU elegível após verificação');
    process.exit(1);
  }

  const corePatched = await patchCoreExcel(ok.map((x) => x.codigo));
  const supabaseUpdated = APPLY ? await desativarSupabase(ok) : ok.length;

  console.log(
    `[zumbis] ${APPLY ? 'aplicado' : 'simulado'}: core ${corePatched} · Supabase ${supabaseUpdated} desactivados`,
  );

  if (!APPLY) {
    console.log('[zumbis] dry-run — correr com --apply para gravar');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
