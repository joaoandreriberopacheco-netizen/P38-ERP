#!/usr/bin/env node
/**
 * Restaura nomes distintos dos 7 thinners (lote IA cadastro colapsou para THINNER + volume).
 * Fonte: docs/tmp/cadastro-antes-depois-lotes-1-4.csv (commit da8b1bbb).
 *
 * Uso: DATABASE_URL=... node scripts/restaurar-nomes-thinner-once.mjs
 */
import pg from 'pg';

const RESTORE = [
  { codigo: 'I2H-1R0', nome: 'THINNER ANJO 2750 900ML' },
  { codigo: '77V-9SN', nome: 'THINNER ANJO 5L' },
  { codigo: '8ST-MNF', nome: 'THINNER KING 900ML' },
  { codigo: 'JIP-SW4', nome: 'THINNER LUKSNOVA SUPER-EXTRA 206 5L' },
  { codigo: 'P73-7FB', nome: 'THINNER LUKSNOVA SUPER-EXTRA 206 900 ML' },
  { codigo: 'CDE-68I', nome: 'THINNER LUKSNOVA SUPER-EXTRA 237 5L' },
  { codigo: 'V7M-ZMJ', nome: 'THINNER LUKSNOVA SUPER-EXTRA 237 900 ML' },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL em falta');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let ok = 0;
  for (const { codigo, nome } of RESTORE) {
    const { rowCount, rows } = await client.query(
      `update produto
       set nome = $1, updated_at = now()
       where upper(trim(codigo_interno)) = upper(trim($2))
       returning id, codigo_interno, nome`,
      [nome, codigo],
    );
    if (rowCount === 1) {
      ok += 1;
      console.log(`✓ ${rows[0].codigo_interno} → ${rows[0].nome}`);
    } else {
      console.warn(`⚠ ${codigo}: ${rowCount} linha(s) actualizada(s)`);
    }
  }

  await client.end();
  console.log(`\n[restaurar-nomes-thinner] ${ok}/${RESTORE.length} restaurados`);
  if (ok !== RESTORE.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
