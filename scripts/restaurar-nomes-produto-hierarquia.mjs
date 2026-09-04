#!/usr/bin/env node
/**
 * Restaura produto.nome a partir dos campos hierárquicos h1–h5
 * (mesma regra do formulário: gerarNomeCompleto).
 *
 * Uso:
 *   node scripts/restaurar-nomes-produto-hierarquia.mjs          # dry-run
 *   node scripts/restaurar-nomes-produto-hierarquia.mjs --apply
 *   node scripts/restaurar-nomes-produto-hierarquia.mjs --apply --desde 2026-07-26
 */
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const desdeIdx = process.argv.indexOf('--desde');
const DESDE = desdeIdx >= 0 ? process.argv[desdeIdx + 1] : '2026-07-26';

function gerarNomeCompleto(row) {
  return [
    row.campo_hierarquico_1,
    row.campo_hierarquico_2,
    row.campo_hierarquico_3,
    row.campo_hierarquico_4,
    row.campo_hierarquico_5,
  ]
    .map((c) => String(c || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function normNome(s) {
  return String(s || '').trim().toUpperCase();
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(`
    select id, nome,
           campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3,
           campo_hierarquico_4, campo_hierarquico_5,
           updated_at, ativo
    from produto
    where ativo = true
      and updated_at >= $1::timestamptz
    order by nome
  `, [`${DESDE}T00:00:00Z`]);

  const plan = [];
  for (const row of rows) {
    const novo = gerarNomeCompleto(row);
    if (!novo) continue;
    if (normNome(row.nome) === normNome(novo)) continue;
    plan.push({ id: row.id, de: row.nome, para: novo });
  }

  console.log(APPLY ? '=== APLICAR ===' : '=== DRY-RUN ===');
  console.log(`Filtro updated_at >= ${DESDE} · candidatos: ${rows.length} · a corrigir: ${plan.length}`);
  for (const p of plan.slice(0, 15)) {
    console.log(`  ${p.de}  →  ${p.para}`);
  }
  if (plan.length > 15) console.log(`  … +${plan.length - 15} produto(s)`);

  if (!APPLY) {
    console.log('\nUse --apply para gravar.');
    await client.end();
    return;
  }

  let ok = 0;
  for (const p of plan) {
    await client.query(
      `update produto set nome = $2, updated_at = now() where id = $1`,
      [p.id, p.para.toUpperCase()],
    );
    ok += 1;
  }

  await client.end();
  console.log(`\n✓ ${ok} nome(s) restaurado(s) a partir de h1–h5.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
