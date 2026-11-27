#!/usr/bin/env node
/** JSON da análise — node scripts/analisar-vendas-sazonalidade-6m.mjs */
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38SupabaseAdminConfig } from './p38-supabase-admin.mjs';
import { runVendasSazonalidadeAnalise } from './lib/vendas-sazonalidade-analise.mjs';

loadDotEnvFiles();
const { url, serviceRoleKey } = resolveP38SupabaseAdminConfig();
if (!url || !serviceRoleKey) {
  console.error('Defina credenciais Supabase (service role).');
  process.exit(1);
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const data = await runVendasSazonalidadeAnalise(supabase);
console.log(JSON.stringify(data, null, 2));