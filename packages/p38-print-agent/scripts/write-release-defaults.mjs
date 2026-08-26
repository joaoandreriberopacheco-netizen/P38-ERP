#!/usr/bin/env node
/** Grava defaults.p38.mjs para o instalador .exe (CI ou build local com env). */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'defaults.p38.mjs');

const url =
  process.env.P38_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://zhonvxkkqabfdyehyxpu.supabase.co';

const anonKey =
  process.env.P38_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!anonKey) {
  console.error(
    '[write-release-defaults] NEXT_PUBLIC_SUPABASE_ANON_KEY (ou VITE_SUPABASE_ANON_KEY) em falta — necessário para o instalador do cliente.',
  );
  process.exit(1);
}

const body = `/** Gerado automaticamente — não editar. */
export const P38_SUPABASE_URL = ${JSON.stringify(url)};
export const P38_SUPABASE_ANON_KEY = ${JSON.stringify(anonKey)};
`;

writeFileSync(out, body, 'utf8');
console.log('[write-release-defaults] OK →', out);
