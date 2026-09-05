#!/usr/bin/env node
/**
 * Remove autorizações de estorno duplicadas (mesma devolução, status Pendente).
 * Mantém uma por devolução_numero (a mais antiga por created_at).
 *
 * Uso:
 *   node scripts/deduplicar-autorizacoes-estorno.mjs           # dry-run
 *   node scripts/deduplicar-autorizacoes-estorno.mjs --apply   # cancela duplicatas
 *   node scripts/deduplicar-autorizacoes-estorno.mjs --apply --date=2026-09-05
 */
import pg from 'pg';
import { resolveP38Secrets } from './p38-secrets.mjs';

const apply = process.argv.includes('--apply');
const dateArg = process.argv.find((a) => a.startsWith('--date='));
const filterDate = dateArg ? dateArg.split('=')[1] : null;

const { databaseUrl } = resolveP38Secrets();
if (!databaseUrl) {
  console.error('DATABASE_URL em falta.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const params = [];
  let whereDate = '';
  if (filterDate) {
    whereDate = 'AND created_at::date = $1::date';
    params.push(filterDate);
  }

  const { rows } = await client.query(
    `SELECT id, numero, devolucao_numero, valor_autorizado, status,
            turno_caixa_destino_numero, created_at
     FROM autorizacao_estorno
     WHERE status = 'Pendente' ${whereDate}
     ORDER BY devolucao_numero, created_at ASC`,
    params
  );

  const devolucaoNumeros = [...new Set(rows.map((r) => String(r.devolucao_numero || '')).filter(Boolean))];
  let devolucoesJaProcessadas = new Set();

  if (devolucaoNumeros.length > 0) {
    const { rows: processadas } = await client.query(
      `SELECT DISTINCT devolucao_numero
       FROM autorizacao_estorno
       WHERE status = 'Processado' AND devolucao_numero = ANY($1::text[])`,
      [devolucaoNumeros]
    );
    devolucoesJaProcessadas = new Set(
      processadas.map((r) => String(r.devolucao_numero || '')).filter(Boolean)
    );
  }

  const grupos = new Map();
  for (const row of rows) {
    const key = String(row.devolucao_numero || row.numero || row.id);
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(row);
  }

  const manter = [];
  const cancelar = [];

  for (const [devolucaoNumero, lista] of grupos) {
    if (devolucoesJaProcessadas.has(devolucaoNumero)) {
      cancelar.push(...lista);
      console.log(
        `Devolução ${devolucaoNumero}: já tem estorno Processado → cancelar ${lista.length} pendente(s) duplicada(s)`
      );
      continue;
    }

    if (lista.length <= 1) {
      manter.push(lista[0]);
      continue;
    }
    manter.push(lista[0]);
    cancelar.push(...lista.slice(1));
    console.log(
      `Devolução ${devolucaoNumero}: ${lista.length} pendentes → manter ${lista[0].id} (${lista[0].turno_caixa_destino_numero}), cancelar ${lista.length - 1}`
    );
  }

  const resumo = {
    modo: apply ? 'apply' : 'dry-run',
    filtro_data: filterDate || 'todas',
    devolucoes_ja_processadas: [...devolucoesJaProcessadas],
    pendentes_total: rows.length,
    grupos_com_duplicata: cancelar.length > 0 ? grupos.size - manter.length + cancelar.length : 0,
    manter: manter.map((r) => ({
      id: r.id,
      devolucao_numero: r.devolucao_numero,
      valor_autorizado: r.valor_autorizado,
    })),
    cancelar: cancelar.length,
    ids_cancelar: cancelar.map((r) => r.id),
  };

  if (apply && cancelar.length > 0) {
    const ids = cancelar.map((r) => r.id);
    await client.query(
      `UPDATE autorizacao_estorno
       SET status = 'Cancelado',
           dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
             'cancelado_motivo', 'deduplicar-autorizacoes-estorno',
             'cancelado_em', now()::text
           )
       WHERE id = ANY($1::text[])`,
      [ids]
    );
    resumo.aplicado = true;
  }

  console.log(JSON.stringify(resumo, null, 2));
} finally {
  await client.end();
}
