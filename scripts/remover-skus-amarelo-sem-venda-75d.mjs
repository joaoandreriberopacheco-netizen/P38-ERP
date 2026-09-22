#!/usr/bin/env node
/**
 * Remove SKUs marcados a amarelo no PDF sem-venda-75d.
 * core → CATALOGO_ESPACO · Supabase → ativo=false
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const APPLY = process.argv.includes('--apply');
const LIST_PATH = path.join(
  process.cwd(),
  'docs',
  'exports',
  'P38-catalogo-sem-venda-75d-amarelo.json',
);
const CORE_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');
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

function loadCodigos() {
  const data = JSON.parse(fs.readFileSync(LIST_PATH, 'utf8'));
  return [...new Set((data.codigos ?? []).map((c) => cellStr(c).toUpperCase()).filter(Boolean))];
}

async function patchCoreExcel(codigos) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  const alvo = new Set(codigos);
  let patched = 0;
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = cellStr(row.getCell(1).value).toUpperCase();
    if (!alvo.has(codigo)) return;
    row.getCell(3).value = 'CATALOGO_ESPACO';
    const nome = cellStr(row.getCell(8).value);
    const tag = `[${STAMP}] removido PDF amarelo 75d`;
    if (!nome.includes('removido PDF amarelo')) {
      row.getCell(8).value = nome ? `${nome} · ${tag}` : tag;
    }
    patched += 1;
  });
  if (APPLY) await wb.xlsx.writeFile(CORE_PATH);
  return patched;
}

async function desativarSupabase(codigos) {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl(), supabaseKey());
  let updated = 0;
  for (let i = 0; i < codigos.length; i += 100) {
    const batch = codigos.slice(i, i + 100);
    const { data, error } = await sb
      .from('produto')
      .select('id, codigo_interno, tags, dados, ativo')
      .in('codigo_interno', batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const tags = Array.isArray(row.tags) ? [...row.tags] : [];
      if (!tags.includes('removido-pdf-amarelo-75d')) tags.push('removido-pdf-amarelo-75d');
      const dados =
        row.dados && typeof row.dados === 'object' && !Array.isArray(row.dados)
          ? { ...row.dados }
          : {};
      dados.removido_pdf_amarelo_75d_em = STAMP;
      const { error: upErr } = await sb
        .from('produto')
        .update({ ativo: false, tags, dados, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) throw upErr;
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  const codigos = loadCodigos();
  console.log(`[amarelo-75d] ${codigos.length} SKUs · ${APPLY ? 'APPLY' : 'dry-run'}`);
  const core = await patchCoreExcel(codigos);
  const sb = APPLY ? await desativarSupabase(codigos) : codigos.length;
  console.log(`[amarelo-75d] core ${core} · Supabase ${sb}`);
  if (!APPLY) console.log('[amarelo-75d] dry-run — usar --apply');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
