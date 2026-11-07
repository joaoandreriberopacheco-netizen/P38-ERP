#!/usr/bin/env node
/**
 * Corte financeiro 06/11/2026 — descobre contas na BD e chama aplicar-corte-financeiro-saldos.
 *
 *   npm run financeiro:corte-2026-11-06          # dry-run
 *   npm run financeiro:corte-2026-11-06:apply    # gravar
 *   npm run financeiro:contas-ativas             # só listar nomes
 */
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classificarContaCorte,
  DATA_CORTE_PADRAO,
  loadDatabaseUrlFromEnvFiles,
} from './corte-financeiro-2026-11-06-lib.mjs';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const listOnly = argv.includes('--list-contas') || process.env.npm_lifecycle_event === 'financeiro:contas-ativas';

async function fetchContas(client) {
  return (await client.query(
    `SELECT id, nome, tipo, is_caixa_pdv, is_caixa_geral, ativo
     FROM contas_financeiras WHERE ativo IS NOT FALSE ORDER BY nome`,
  )).rows;
}

async function main() {
  const databaseUrl = loadDatabaseUrlFromEnvFiles();
  if (!databaseUrl) {
    console.error('Defina DATABASE_URL (Supabase → Database → connection string) em .env.local ou no terminal.');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    const rows = await fetchContas(client);
    if (listOnly) {
      console.log('Contas ativas:\n');
      for (const r of rows) {
        const plano = classificarContaCorte(r);
        const tag = plano ? ` → abertura R$ ${plano.alvo.toFixed(2)}` : ' (sem regra de corte)';
        console.log(`  ${r.nome}${tag}`);
      }
      return;
    }

    const alvos = [];
    const ocultarIds = [];
    for (const row of rows) {
      const plano = classificarContaCorte(row);
      if (!plano) {
        console.log(`(ignorada) ${row.nome}`);
        continue;
      }
      alvos.push({ nome: row.nome, ...plano, id: row.id });
      if (plano.ocultar) ocultarIds.push(row.id);
    }

    if (!alvos.length) {
      console.error('Nenhuma conta correspondeu às regras do corte. Use npm run financeiro:contas-ativas.');
      process.exit(1);
    }

    const contasArg = alvos.map((a) => `${a.nome}:${a.alvo}`).join('|');
    const script = join(dirname(fileURLToPath(import.meta.url)), 'aplicar-corte-financeiro-saldos.mjs');
    const args = [
      script,
      `--data-corte=${DATA_CORTE_PADRAO}`,
      ...(apply ? ['--apply'] : []),
      `--contas=${contasArg}`,
    ];

    console.log(`\n→ ${apply ? 'APLICAR' : 'DRY-RUN'} corte ${DATA_CORTE_PADRAO} (${alvos.length} conta(s))\n`);
    const run = spawnSync(process.execPath, args, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    if (run.status !== 0) process.exit(run.status ?? 1);

    if (apply && ocultarIds.length) {
      for (const id of ocultarIds) {
        await client.query(
          `UPDATE contas_financeiras
           SET dados = coalesce(dados, '{}'::jsonb) || '{"ocultar_no_fluxo": true}'::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [id],
        );
      }
      console.log(`\n✓ ocultar_no_fluxo em ${ocultarIds.length} conta(s) (poupança / PJ).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
