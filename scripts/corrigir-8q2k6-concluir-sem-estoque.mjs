#!/usr/bin/env node
/**
 * Fecha pedido 8Q2K6 (1.000 sacos SDX) como entregue SEM movimentar estoque.
 * O físico já está correto no cadastro; só corrige status documental.
 *
 * Uso:
 *   node scripts/corrigir-8q2k6-concluir-sem-estoque.mjs
 *   node scripts/corrigir-8q2k6-concluir-sem-estoque.mjs --apply
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const NUMERO = '8Q2K6';
const NOTA_HISTORICO =
  '\n[CORREÇÃO ADMIN jul/2026 | 1.000 UN já recebidas fisicamente | Concluído sem entrada de estoque — saldo já conferido]';

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definido');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const { rows: pedidos } = await client.query(
      `select id, numero, status, status_recebimento_geral, itens
       from public.pedido_compra where numero = $1`,
      [NUMERO],
    );
    const pedido = pedidos[0];
    if (!pedido) {
      console.error(`Pedido ${NUMERO} não encontrado`);
      process.exit(1);
    }

    const { rows: embarques } = await client.query(
      `select e.id, e.numero, e.status, e.itens,
              ei.id as item_id, ei.quantidade_embarcada_comercial, ei.quantidade_recebida_comercial
       from public.embarque e
       join public.embarque_item ei on ei.embarque_id = e.id
       where e.pedido_compra_id = $1`,
      [pedido.id],
    );

    const preview = {
      pedido_id: pedido.id,
      antes: {
        status: pedido.status,
        status_recebimento_geral: pedido.status_recebimento_geral,
      },
      depois: {
        status: 'Concluído',
        status_recebimento_geral: 'Concluído OK',
        status_embarque: 'Completo',
        percentual_valor_embarcado: 100,
        data_conclusao: '2026-04-09',
      },
      embarques: embarques.map((e) => ({
        numero: e.numero,
        status_antes: e.status,
        recebido_antes: e.quantidade_recebida_comercial,
        recebido_depois: e.quantidade_embarcada_comercial,
      })),
      movimentacao_estoque: 'nenhuma (proposital)',
    };

    console.log(JSON.stringify(preview, null, 2));

    if (!apply) {
      console.log('\nDry-run. Repita com --apply para gravar.');
      return;
    }

    await client.query('BEGIN');

    const itensAtualizados = (Array.isArray(pedido.itens) ? pedido.itens : []).map((it) => ({
      ...it,
      quantidade_vinculada: Number(it.quantidade) || 1000,
      status_recebimento: 'Recebido OK',
    }));

    await client.query(
      `update public.pedido_compra
       set status = 'Concluído',
           status_recebimento_geral = 'Concluído OK',
           status_embarque = 'Completo',
           percentual_valor_embarcado = 100,
           data_conclusao = '2026-04-09'::date,
           data_chegada = '2026-04-09'::date,
           tem_divergencias = false,
           itens = $2::jsonb,
           historico = coalesce(historico, '') || $3,
           dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
             'status', 'Concluído',
             'status_recebimento_geral', 'Concluído OK',
             'status_embarque', 'Completo',
             'itens', $2::jsonb
           ),
           updated_at = now()
       where id = $1`,
      [pedido.id, JSON.stringify(itensAtualizados), NOTA_HISTORICO],
    );

    await client.query(
      `update public.pedido_compra_item
       set quantidade_vinculada = quantidade_comercial,
           updated_at = now()
       where pedido_compra_id = $1`,
      [pedido.id],
    );

    for (const emb of embarques) {
      const qEmb = Number(emb.quantidade_embarcada_comercial) || 0;
      await client.query(
        `update public.embarque_item
         set quantidade_recebida_comercial = quantidade_embarcada_comercial,
             updated_at = now()
         where id = $1`,
        [emb.item_id],
      );

      const itensEmb = (Array.isArray(emb.itens) ? emb.itens : []).map((it) => ({
        ...it,
        quantidade_recebida: Number(it.quantidade_embarcada) || qEmb,
      }));

      await client.query(
        `update public.embarque
         set status = 'Concluído',
             status_recebimento = 'Recebido OK',
             itens = $2::jsonb,
             dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('status', 'Concluído', 'itens', $2::jsonb),
             updated_at = now()
         where id = $1`,
        [emb.id, JSON.stringify(itensEmb)],
      );
    }

    await client.query('COMMIT');
    console.log('\nAplicado com sucesso. Estoque não foi alterado.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
