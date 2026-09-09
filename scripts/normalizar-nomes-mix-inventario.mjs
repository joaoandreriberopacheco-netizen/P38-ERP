#!/usr/bin/env node
/**
 * Normaliza nomes do mix inventário: remove "para", vírgulas e mesa/bancada → bancada.
 *
 * npm run normalizar:nomes-mix-inventario
 * npm run normalizar:nomes-mix-inventario -- --apply
 */
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('[normalizar-nomes-mix] Defina SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

export function normalizeMixNome(text) {
  let s = String(text || '').trim();
  if (!s) return s;

  s = s.replace(/\bmesa\s*\/\s*bancada\b/gi, 'bancada');
  s = s.replace(/\bmesa\s+ou\s+bancada\b/gi, 'bancada');
  s = s.replace(/\bpara\b/gi, ' ');
  s = s.replace(/,/g, ' ');
  s = s.replace(/\s*-\s*/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  return s.toUpperCase();
}

export function normalizeMixInstalacao(value) {
  const s = String(value || '').trim();
  if (!s) return value;
  if (/^mesa\s*\/\s*bancada$/i.test(s) || /^mesa\s+ou\s+bancada$/i.test(s)) return 'Bancada';
  return s;
}

async function sbFetch(pathSuffix, { method = 'GET', body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathSuffix}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${pathSuffix} → ${res.status}: ${await res.text()}`);
  return method === 'GET' ? res.json() : null;
}

async function main() {
  let all = [];
  let offset = 0;
  while (true) {
    const batch = await sbFetch(
      `produto?select=id,codigo_interno,nome,campo_hierarquico_3,tags&ativo=eq.true&limit=500&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }

  const mix = all.filter((p) => (p.tags || []).includes('mix-inventario-2026'));
  let changed = 0;

  for (const p of mix) {
    const nome = normalizeMixNome(p.nome);
    const h3 = normalizeMixInstalacao(p.campo_hierarquico_3);
    const patch = {};
    if (nome !== p.nome) patch.nome = nome;
    if (h3 !== p.campo_hierarquico_3) patch.campo_hierarquico_3 = h3;

    if (!Object.keys(patch).length) continue;
    changed += 1;
    console.log(`${p.codigo_interno}: ${p.nome}`);
    console.log(`  → ${nome}`);
    if (patch.campo_hierarquico_3) console.log(`  h3 → ${patch.campo_hierarquico_3}`);

    if (apply) {
      await sbFetch(`produto?id=eq.${p.id}`, { method: 'PATCH', body: patch });
    }
  }

  console.log(`\n[normalizar-nomes-mix] ${changed}/${mix.length} alterados${apply ? ' (aplicado)' : ' (dry-run)'}`);
  if (!apply) console.log('Para aplicar: npm run normalizar:nomes-mix-inventario -- --apply');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
