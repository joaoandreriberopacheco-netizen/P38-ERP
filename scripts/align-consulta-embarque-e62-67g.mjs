#!/usr/bin/env node
/**
 * Alinha dados Supabase E62-67G com a regra da Consulta (splits independentes).
 * - Fecha saldo duplicado MACAU no embarque 01 (fica só na Necessidade C).
 * - Sincroniza cabeçalho do pedido a partir de embarque_item SQL.
 * - Sincroniza espelho JSON legado do embarque D (Recebido OK).
 *
 * Uso:
 *   node scripts/align-consulta-embarque-e62-67g.mjs           # dry-run
 *   node scripts/align-consulta-embarque-e62-67g.mjs --apply
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();

const APPLY = process.argv.includes('--apply');
const PEDIDO_ID = '6a5ac9a29a91e583714ef6ca';
const EMBARQUE_01_ID = '96f764bf-e5a3-46ee-8f18-2cefb468dd53';
const EMBARQUE_D_ID = 'b027fc24-d6dd-4184-a178-92cb87d34425';

function mirrorFromSqlRow(row) {
  const d = row.dados || {};
  const fator = Number(d.fator_aplicado || row.fator_aplicado) || 1;
  const unidade = row.unidade_sigla || 'UN';
  const qEmbCom = Number(row.quantidade_embarcada_comercial) || 0;
  const qRecCom = Number(row.quantidade_recebida_comercial) || 0;
  const qPedCom = Number(row.quantidade_pedida_comercial) || 0;
  const qEmbBase = Number(d.quantidade_embarcada_base) || qEmbCom * fator;
  const qRecBase = Number(d.quantidade_recebida_base) || qRecCom * fator;
  return {
    produto_id: row.produto_id,
    produto_nome: row.produto_nome,
    produto_unidade_id: d.produto_unidade_id || '',
    pedido_compra_item_id: row.pedido_compra_item_id || '',
    fator_aplicado: fator,
    fator_apresentacao: fator,
    fator_conversao: 1,
    quantidade_pedida: Number(d.quantidade_pedida_base) || qPedCom * fator,
    quantidade_embarcada: qEmbBase,
    quantidade_recebida: qRecBase,
    quantidade_base: qEmbBase,
    quantidade_pedida_apresentacao: qPedCom,
    quantidade_embarcada_apresentacao: qEmbCom,
    quantidade_recebida_apresentacao: qRecCom,
    unidade_medida: 'M2',
    unidade_apresentacao: unidade,
    unidade_sigla: unidade,
    divergencia_tipo: row.divergencia_tipo || 'Nenhuma',
    embarque_item_id: row.id,
  };
}

async function main() {
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const { rows: macau01 } = await client.query(
      `select id, quantidade_embarcada_comercial, quantidade_recebida_comercial, dados
       from public.embarque_item
       where embarque_id = $1 and produto_nome ilike '%MACAU%'`,
      [EMBARQUE_01_ID],
    );

    if (macau01[0]) {
      const row = macau01[0];
      const rec = Number(row.quantidade_recebida_comercial) || 0;
      const emb = Number(row.quantidade_embarcada_comercial) || 0;
      console.log(`\n1) MACAU embarque 01: embarcado=${emb} recebido=${rec} → fechar split (embarcado=${rec})`);
      if (APPLY && emb > rec) {
        const dados = { ...(row.dados || {}), quantidade_embarcada_base: rec };
        await client.query(
          `update public.embarque_item
           set quantidade_embarcada_comercial = $2,
               dados = $3::jsonb,
               updated_at = now()
           where id = $1`,
          [row.id, rec, JSON.stringify(dados)],
        );
        console.log('   ✓ aplicado');
      }
    }

    const { rows: pctRows } = await client.query(
      `with pedido_itens as (
         select coalesce(quantidade_base, quantidade_comercial, 0) as qtd
         from public.pedido_compra_item where pedido_compra_id = $1
       ),
       emb as (
         select coalesce((ei.dados->>'quantidade_embarcada_base')::numeric,
                         ei.quantidade_embarcada_comercial * coalesce((ei.dados->>'fator_aplicado')::numeric, 1), 0) as q_emb,
                coalesce((ei.dados->>'quantidade_recebida_base')::numeric,
                         ei.quantidade_recebida_comercial * coalesce((ei.dados->>'fator_aplicado')::numeric, 1), 0) as q_rec
         from public.embarque e
         join public.embarque_item ei on ei.embarque_id = e.id
         where e.pedido_compra_id = $1 and coalesce(e.tipo, 'Embarque') is distinct from 'Necessidade'
       ),
       receb as (
         select coalesce(array_agg(distinct coalesce(e.status_recebimento, '')), array[]::text[]) as sts
         from public.embarque e where e.pedido_compra_id = $1
       )
       select
         (select coalesce(sum(qtd), 0) from pedido_itens) as total_pedido,
         (select coalesce(sum(q_emb), 0) from emb) as total_embarcado,
         (select coalesce(sum(q_rec), 0) from emb) as total_recebido,
         (select sts from receb) as status_recebimentos`,
      [PEDIDO_ID],
    );

    const p = pctRows[0];
    const totalPedido = Number(p.total_pedido) || 1;
    const pctDesp = Number(((Number(p.total_embarcado) / totalPedido) * 100).toFixed(2));
    const pctConc = Number(((Number(p.total_recebido) / totalPedido) * 100).toFixed(2));
    const sts = p.status_recebimentos || [];
    let statusRecebGeral = 'Pendente';
    if (sts.some((s) => /diverg/i.test(s))) statusRecebGeral = 'Concluído com Divergência';
    else if (sts.length && sts.every((s) => s === 'Recebido OK')) statusRecebGeral = 'Concluído OK';
    else if (sts.some((s) => /parcial|recebido ok|diverg/i.test(s))) statusRecebGeral = 'Recebido Parcial';

    const temNecessidade = await client.query(
      `select exists(select 1 from public.embarque where pedido_compra_id=$1 and tipo='Necessidade') as v`,
      [PEDIDO_ID],
    );
    const statusEmbarque = temNecessidade.rows[0]?.v || pctDesp < 100 ? 'Parcial' : 'Total';

    console.log('\n2) Cabeçalho pedido E62-67G:');
    console.log(`   status_recebimento_geral=${statusRecebGeral}`);
    console.log(`   status_embarque=${statusEmbarque}`);
    console.log(`   percentual_despachado=${pctDesp}% | percentual_concluido=${pctConc}%`);

    if (APPLY) {
      await client.query(
        `update public.pedido_compra
         set status_recebimento_geral = $2,
             status_embarque = $3,
             percentual_valor_embarcado = $4,
             updated_at = now()
         where id = $1`,
        [PEDIDO_ID, statusRecebGeral, statusEmbarque, pctDesp],
      );
      await client.query(
        `update public.pedido_compra
         set dados = coalesce(dados, '{}'::jsonb) || $2::jsonb,
             updated_at = now()
         where id = $1`,
        [
          PEDIDO_ID,
          JSON.stringify({
            percentual_despachado: pctDesp,
            percentual_concluido: pctConc,
            percentual_valor_embarcado: pctDesp,
          }),
        ],
      );
      console.log('   ✓ aplicado');
    }

    const { rows: dItens } = await client.query(
      `select * from public.embarque_item where embarque_id = $1 order by ordem nulls last, id`,
      [EMBARQUE_D_ID],
    );
    const mirrorD = dItens.map(mirrorFromSqlRow);
    console.log(`\n3) Espelho JSON embarque D: ${mirrorD.length} linha(s)`);
    if (APPLY && mirrorD.length) {
      await client.query(
        `update public.embarque
         set dados = coalesce(dados, '{}'::jsonb)
             || jsonb_build_object('codigo_exibicao', 'E62-67G-D', 'itens_embarcados', $2::jsonb),
             itens = $2::jsonb,
             updated_at = now()
         where id = $1`,
        [EMBARQUE_D_ID, JSON.stringify(mirrorD)],
      );
      console.log('   ✓ aplicado');
    }

    console.log(APPLY ? '\nOK — alinhamento aplicado.' : '\nDry-run. Use --apply para gravar.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
