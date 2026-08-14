/**
 * Upsert em lote para public.portal_catalog (Postgres).
 */
import pg from 'pg';

const UPSERT_SQL = `
insert into public.portal_catalog (
  codigo_interno, produto_id, categoria_nome,
  linha_codigo, linha_nome, linha_tipo, linha_ordem,
  produto_compra_codigo, produto_compra_nome,
  eixo_a_texto, eixo_b_texto, novo_sku,
  fonte, ativo, updated_at
) values (
  $1, $2, $3,
  $4, $5, $6, $7,
  $8, $9,
  $10, $11, $12,
  $13, true, $14
)
on conflict (codigo_interno) where ativo = true
do update set
  produto_id = coalesce(excluded.produto_id, portal_catalog.produto_id),
  categoria_nome = excluded.categoria_nome,
  linha_codigo = excluded.linha_codigo,
  linha_nome = excluded.linha_nome,
  linha_tipo = excluded.linha_tipo,
  linha_ordem = excluded.linha_ordem,
  produto_compra_codigo = excluded.produto_compra_codigo,
  produto_compra_nome = excluded.produto_compra_nome,
  eixo_a_texto = excluded.eixo_a_texto,
  eixo_b_texto = excluded.eixo_b_texto,
  novo_sku = excluded.novo_sku,
  fonte = excluded.fonte,
  updated_at = excluded.updated_at
`;

export async function upsertPortalCatalogRows(rows, { client: externalClient } = {}) {
  const ownClient = externalClient || new pg.Client({ connectionString: process.env.DATABASE_URL });
  const client = ownClient;
  if (!externalClient) await client.connect();

  let done = 0;
  try {
    for (const row of rows) {
      await client.query(UPSERT_SQL, [
        row.codigo_interno,
        row.produto_id,
        row.categoria_nome,
        row.linha_codigo,
        row.linha_nome,
        row.linha_tipo,
        row.linha_ordem,
        row.produto_compra_codigo,
        row.produto_compra_nome,
        row.eixo_a_texto,
        row.eixo_b_texto,
        row.novo_sku,
        row.fonte,
        row.updated_at || new Date().toISOString(),
      ]);
      done += 1;
    }
  } finally {
    if (!externalClient) await client.end();
  }
  return done;
}

export async function linkPortalCatalogProdutoIds(client) {
  await client.query(`
    update public.portal_catalog pc
    set produto_id = p.id,
        updated_at = now()
    from public.produto p
    where pc.ativo = true
      and pc.produto_id is null
      and upper(coalesce(p.codigo_interno, '')) = upper(pc.codigo_interno)
  `);
}
