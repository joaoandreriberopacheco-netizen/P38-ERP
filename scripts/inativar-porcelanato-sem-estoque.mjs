#!/usr/bin/env node
/**
 * Inactiva SKUs da linha Porcelanato (core 4×3) com estoque zero.
 *
 * npm run inativar:porcelanato-sem-estoque
 * npm run inativar:porcelanato-sem-estoque -- --dry-run
 */
import ExcelJS from 'exceljs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { cellStr, to4x3 } from './lib/catalogo3x3Map.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const CORE_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');
const dryRun = process.argv.includes('--dry-run');

async function loadPorcelanatoCodigos() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  const codigos = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const r = {
      codigo_interno: cellStr(row.getCell(1).value),
      etapa: cellStr(row.getCell(2).value),
      core: cellStr(row.getCell(3).value),
      linha: cellStr(row.getCell(4).value),
      produto_compra: cellStr(row.getCell(5).value),
      eixo_a: cellStr(row.getCell(6).value),
      eixo_b: cellStr(row.getCell(7).value),
      sku_atual: cellStr(row.getCell(9).value),
    };
    if (to4x3({ ...r, novo_sku: r.sku_atual }).linha !== 'Porcelanato') return;
    codigos.push(r.codigo_interno.toUpperCase());
  });
  return codigos;
}

async function main() {
  const codigos = await loadPorcelanatoCodigos();
  const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await sb
    .from('produto')
    .select('id, codigo_interno, nome, estoque_atual, ativo')
    .in('codigo_interno', codigos);
  if (error) throw error;

  const activos = (data || []).filter((p) => p.ativo !== false);
  const semEstoque = activos.filter((p) => (Number(p.estoque_atual) || 0) <= 0);
  const comEstoque = activos.filter((p) => (Number(p.estoque_atual) || 0) > 0);

  console.log('═══════════════════════════════════════════════════');
  console.log('  Porcelanato — inactivar sem estoque');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Linha Porcelanato (core): ${codigos.length} SKUs`);
  console.log(`Activos no Supabase:      ${activos.length}`);
  console.log(`Sem estoque → inactivar:  ${semEstoque.length}`);
  console.log(`Com estoque → mantém:     ${comEstoque.length}`);
  console.log('');

  if (comEstoque.length) {
    console.log('── Mantêm activos ──');
    for (const p of comEstoque) {
      console.log(`  ${p.codigo_interno} | est ${Number(p.estoque_atual)} | ${String(p.nome).slice(0, 55)}`);
    }
  }

  if (!semEstoque.length) {
    console.log('\nNada a inactivar.');
    return;
  }

  if (dryRun) {
    console.log('\n[dry-run] Seriam inactivados:');
    for (const p of semEstoque) {
      console.log(`  ${p.codigo_interno} | ${String(p.nome).slice(0, 55)}`);
    }
    return;
  }

  const ids = semEstoque.map((p) => p.id);
  const chunk = 20;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error: upErr } = await sb.from('produto').update({ ativo: false }).in('id', slice);
    if (upErr) throw upErr;
  }

  console.log(`\n[inativar-porcelanato-sem-estoque] ${semEstoque.length} produto(s) inactivado(s).`);
  console.log(`Sobram ${comEstoque.length} porcelanato(s) activo(s) com estoque.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
