#!/usr/bin/env node
/** Lista pedidos maio-jul 2026 com embarque Recebido OK mas card ainda Despachado (regra exclusão). */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();

async function main() {
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows } = await client.query(`
      select distinct pc.numero, pc.status, pc.status_recebimento_geral, pc.data_emissao,
             e.status_recebimento as emb_receb, e.status as emb_status,
             coalesce(e.dados->>'codigo_exibicao', e.numero) as embarque
      from public.pedido_compra pc
      join public.embarque e on e.pedido_compra_id = pc.id
      where pc.data_emissao >= '2026-05-01' and pc.data_emissao < '2026-08-01'
        and e.status_recebimento in ('Recebido OK', 'Com Divergência')
        and pc.status not in ('Concluído', 'Cancelado')
      order by pc.data_emissao desc, pc.numero
      limit 40
    `);
    console.log(`Pedidos mai-jul com embarque recebido mas pedido não Concluído: ${rows.length}\n`);
    for (const r of rows) {
      console.log(`${r.numero} | pedido=${r.status} | receb_geral=${r.status_recebimento_geral} | ${r.embarque}=${r.emb_receb}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
