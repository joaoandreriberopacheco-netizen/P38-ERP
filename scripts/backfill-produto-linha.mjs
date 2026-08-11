#!/usr/bin/env node
/**
 * Atribui produto.linha_id por inferência (chave comum h2/h1).
 *
 * npm run linha:backfill
 * npm run linha:backfill:apply
 */
import pg from 'pg';
import { inferirLinhaCodigo } from './lib/inferirLinha.mjs';

const apply = process.argv.includes('--apply');

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: linhas } = await client.query('select id, codigo from linha');
  const byCodigo = new Map(linhas.map((l) => [l.codigo, l.id]));

  if (byCodigo.size === 0) {
    console.error('[linha:backfill] Tabela linha vazia — aplicar migration 047 primeiro.');
    process.exit(1);
  }

  const { rows: produtos } = await client.query(`
    select id, nome, ativo,
           campo_hierarquico_1, campo_hierarquico_2, linha_id
    from produto
    where ativo = true
  `);

  const plan = [];
  const counts = new Map();

  for (const p of produtos) {
    const cod = inferirLinhaCodigo(p);
    const linhaId = byCodigo.get(cod) || byCodigo.get('OUTROS');
    if (!linhaId) continue;
    counts.set(cod, (counts.get(cod) || 0) + 1);
    if (p.linha_id !== linhaId) {
      plan.push({ id: p.id, nome: p.nome, cod, linhaId });
    }
  }

  console.log(`[linha:backfill] ${produtos.length} SKUs ativos · ${plan.length} a atualizar`);
  console.log(
    'Distribuição:',
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}:${n}`)
      .join(', '),
  );

  if (!apply) {
    plan.slice(0, 15).forEach((r) => console.log(`  ${r.cod} ← ${r.nome?.slice(0, 50)}`));
    if (plan.length > 15) console.log(`  … +${plan.length - 15} mais`);
    console.log('\nDry-run. Para aplicar: npm run linha:backfill:apply');
    await client.end();
    return;
  }

  let done = 0;
  for (const row of plan) {
    await client.query('update produto set linha_id = $1 where id = $2', [row.linhaId, row.id]);
    done += 1;
    if (done % 100 === 0) console.log(`  … ${done}/${plan.length}`);
  }
  console.log(`[linha:backfill] aplicado: ${done} produto(s)`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
