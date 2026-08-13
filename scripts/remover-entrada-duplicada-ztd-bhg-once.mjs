#!/usr/bin/env node
/**
 * Remove entradas duplicadas do 1º recebimento do embarque ZTD-BHG-A (lote 17:12).
 * Mantém o 2º lote (17:13). Uso único.
 */
import pg from 'pg';
import { resolveP38Secrets } from './p38-secrets.mjs';

const MOVIMENTOS_REMOVER = [
  '7bedf600-bd9d-4e18-b978-bb3f708daf7d',
  '77d275c2-0ffe-451c-98b7-7d424f9b5e78',
  'ffe29b9f-3959-4633-bab8-7eb8ca0be2c4',
];

const PRODUTOS = [
  '69bd5b5b67c53b4e06fa6f8f',
  '69bd5b5c7f3f8c1221640037',
  '69bd5b5c1761fd1c2ce2fcc8',
];

const PEDIDO_ID = 'a9efe8ea-db81-4606-82d5-b7fe2322a14c';
const CODIGO_EMBARQUE = 'ZTD-BHG-A';

const { databaseUrl } = resolveP38Secrets();
if (!databaseUrl) {
  console.error('[ztd-bhg] DATABASE_URL em falta.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl.trim(),
  ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

try {
  const antes = await client.query(
    `select id, produto_id, quantidade, created_at
     from public.movimentacao_estoque
     where id = any($1::text[])
     order by created_at`,
    [MOVIMENTOS_REMOVER],
  );
  if (antes.rows.length !== MOVIMENTOS_REMOVER.length) {
    console.error('[ztd-bhg] Movimentos esperados não encontrados:', antes.rows);
    process.exit(1);
  }

  const del = await client.query(
    `delete from public.movimentacao_estoque where id = any($1::text[])`,
    [MOVIMENTOS_REMOVER],
  );

  for (const pid of PRODUTOS) {
    await client.query('select public.recalcular_estoque_produto($1)', [pid]);
  }

  const restantes = await client.query(
    `select id, produto_id, quantidade, created_at
     from public.movimentacao_estoque
     where referencia_tipo = 'PedidoCompra'
       and referencia_id = $1
       and tipo = 'Entrada'
       and lower(documento_referencia) = lower($2)
     order by created_at`,
    [PEDIDO_ID, CODIGO_EMBARQUE],
  );

  const estoque = await client.query(
    `select id, nome, estoque_atual from public.produto where id = any($1::text[])`,
    [PRODUTOS],
  );

  const tag = `[CORREÇÃO DUPLICATA EMBARQUE ${CODIGO_EMBARQUE} | removido 1º lote (${MOVIMENTOS_REMOVER.length} mov.) | ${new Date().toISOString()}]`;
  await client.query(
    `update public.pedido_compra
     set historico = coalesce(historico, '') || $2
     where id = $1`,
    [PEDIDO_ID, '\n' + tag],
  );

  console.log(JSON.stringify({
    ok: true,
    removidos: del.rowCount,
    movimentos_restantes: restantes.rows,
    estoque: estoque.rows,
  }, null, 2));
} finally {
  await client.end();
}
