#!/usr/bin/env node
/**
 * Audita saldo pendente em base vs comercial (recepção em pacotes / vitrine).
 * Uso: node scripts/audit-pedido-unidade-vitrine.mjs --numero=WX7-A5N
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();

function parseNumero(argv) {
  const arg = argv.find((a) => a.startsWith('--numero='));
  return arg?.slice('--numero='.length)?.trim().toUpperCase().replace(/\s+/g, '') || '';
}

async function main() {
  const numero = parseNumero(process.argv.slice(2)) || 'WX7-A5N';
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows: pedidos } = await client.query(
      `select id, numero, status, status_recebimento_geral, data_emissao
       from public.pedido_compra
       where upper(replace(coalesce(numero,''),' ','')) = $1
       limit 1`,
      [numero],
    );
    const pedido = pedidos[0];
    if (!pedido) {
      console.error(`Pedido ${numero} não encontrado.`);
      process.exit(1);
    }

    console.log('\nPedido:', pedido.numero, '|', pedido.status, '|', pedido.status_recebimento_geral);

    const { rows: embarques } = await client.query(
      `select id, numero, coalesce(dados->>'codigo_exibicao', numero) as codigo,
              status, status_recebimento, tipo, transportadora_nome
       from public.embarque where pedido_compra_id = $1 order by created_at`,
      [pedido.id],
    );
    console.log('\nEmbarques:');
    for (const e of embarques) {
      console.log(`  ${e.codigo} | ${e.tipo} | ${e.status} | receb=${e.status_recebimento}`);
    }

    const { rows } = await client.query(
      `select
         coalesce(nullif(trim(e.dados->>'codigo_exibicao'), ''), e.numero) as embarque,
         e.status,
         e.status_recebimento,
         ei.produto_nome,
         ei.unidade_sigla,
         ei.quantidade_embarcada_comercial as emb_com,
         ei.quantidade_recebida_comercial as rec_com,
         coalesce((ei.dados->>'quantidade_embarcada_base')::numeric, 0) as emb_base,
         coalesce((ei.dados->>'quantidade_recebida_base')::numeric, 0) as rec_base,
         coalesce((ei.dados->>'fator_aplicado')::numeric, 1) as fator,
         greatest(coalesce(ei.quantidade_embarcada_comercial,0) - coalesce(ei.quantidade_recebida_comercial,0), 0) as pend_com_errado,
         greatest(coalesce((ei.dados->>'quantidade_embarcada_base')::numeric, ei.quantidade_embarcada_comercial * coalesce((ei.dados->>'fator_aplicado')::numeric,1), 0)
           - coalesce((ei.dados->>'quantidade_recebida_base')::numeric, ei.quantidade_recebida_comercial * coalesce((ei.dados->>'fator_aplicado')::numeric,1), 0), 0) as pend_base_ok
       from public.embarque e
       join public.embarque_item ei on ei.embarque_id = e.id
       where e.pedido_compra_id = $1
       order by e.created_at, ei.produto_nome`,
      [pedido.id],
    );

    let falsosPositivos = 0;
    for (const r of rows) {
      const com = Number(r.pend_com_errado) || 0;
      const base = Number(r.pend_base_ok) || 0;
      if (com > 0.009 && base <= 0.009) {
        falsosPositivos++;
        console.log(`\n✗ FALSO pendente comercial | ${r.embarque} | ${r.produto_nome}`);
        console.log(`  emb/rec com: ${r.emb_com}/${r.rec_com} ${r.unidade_sigla} | base: ${r.emb_base}/${r.rec_base}`);
        console.log(`  pend comercial=${com} | pend base=${base} | status=${r.status_recebimento}`);
      }
    }

    const visiveis = rows.filter((r) => Number(r.pend_base_ok) > 0.009);
    console.log(`\nLinhas com saldo real (base): ${visiveis.length}`);
    console.log(`Falsos positivos (comercial>0, base=0): ${falsosPositivos}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
