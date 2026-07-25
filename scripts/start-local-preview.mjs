#!/usr/bin/env node
/**
 * Preview local sem login — não gasta deploy Vercel.
 * Uso: npm run dev:preview
 *
 * Abre directamente em /PreviewTemaClaro (modo claro por defeito).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = path.join(root, '.env.local');

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

const lines = [
  '# Gerado por scripts/start-local-preview.mjs — NÃO commitar',
  'VITE_P38_PROVIDER=supabase',
  'VITE_P38_BYPASS_BASE44=true',
  'VITE_P38_USE_SUPABASE_AUTH=false',
  '',
];

if (supabaseUrl) lines.push(`VITE_SUPABASE_URL=${supabaseUrl}`);
if (supabaseAnon) lines.push(`VITE_SUPABASE_ANON_KEY=${supabaseAnon}`);

fs.writeFileSync(envLocal, `${lines.join('\n')}\n`, 'utf8');
console.log('[preview] .env.local escrito (auth bypass — entra sem login)');
console.log('[preview] URL: http://localhost:5173/PreviewTemaClaro');
console.log('[preview] Dica: localStorage.theme = "light" já aplicado na página\n');

const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

child.on('exit', (code) => process.exit(code ?? 0));
