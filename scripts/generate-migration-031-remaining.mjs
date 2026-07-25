#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TABLE_PROMOTION_MANIFEST } from '../src/integrations/p38/entityColumnManifest.js';
import { generateTablePromotion } from './lib/jsonb-promotion.mjs';

const ROOT = process.cwd();
const OUTPUT = path.resolve(ROOT, 'supabase/migrations/031_promote_remaining_from_dados.sql');

const lines = [];
lines.push('-- 031_promote_remaining_from_dados.sql');
lines.push('-- Gerado por scripts/generate-migration-031-remaining.mjs');
lines.push('-- Promove todas as tabelas restantes + re-limpa dados duplicado no núcleo.');
lines.push('');

const SKIP_TABLES = new Set([
  // já promovidas e validadas na migration 029
  'produto', 'terceiro', 'lancamento_financeiro', 'turno_caixa', 'movimentos_caixa',
  'formas_de_pagamento', 'contas_financeiras', 'pedido_venda',
]);

let total = 0;
let tables = 0;
for (const [table, fields] of Object.entries(TABLE_PROMOTION_MANIFEST)) {
  if (SKIP_TABLES.has(table)) continue;
  if (!fields?.length) continue;
  const { lines: block, count } = generateTablePromotion(table, fields);
  lines.push(...block);
  total += count;
  tables += 1;
}

lines.push(`-- Total: ${total} colunas em ${tables} tabelas.`);

await writeFile(OUTPUT, lines.join('\n'));
console.log(`OK — ${path.relative(ROOT, OUTPUT)} (${total} colunas, ${tables} tabelas)`);
