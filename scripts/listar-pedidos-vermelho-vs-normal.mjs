#!/usr/bin/env node
/**
 * Pedidos não concluídos (desde 20/07/2026): card vermelho vs ritmo normal.
 * Regra: pedido primeiro → desmembramentos; vermelho só após 1.º despacho + saldo pendente.
 *
 * Uso: node scripts/listar-pedidos-vermelho-vs-normal.mjs
 *      node scripts/listar-pedidos-vermelho-vs-normal.mjs --view  (usa view 104 se aplicada)
 */
import { connectPg } from './lib/pg-connect-ipv4.mjs';

const DATA_MIN = '2026-07-20T00:00:00Z';

/** Mesma lógica que p38_pedido_desmembramento_iniciado (migration 104). */
function sqlDesmembramentoIniciado(pedidoIdExpr) {
  return `(
    exists (
      select 1 from public.pedido_compra_desmembramento d
      where d.pedido_compra_id = ${pedidoIdExpr}
    )
    or exists (
      select 1 from public.pedido_compra_saldo_a_embarcar_v v2
      where v2.pedido_compra_id = ${pedidoIdExpr}
        and coalesce(v2.quantidade_embarcada_real_base, 0) > 0.009
    )
  )`;
}

async function listarInline(client) {
  const iniciado = sqlDesmembramentoIniciado('v.pedido_compra_id');
  const iniciadoPc = sqlDesmembramentoIniciado('pc.id');

  const vermelhosQ = await client.query(`
    with pedidos_abertos as (
      select pc.*
      from public.pedido_compra pc
      where pc.status is distinct from 'Concluído'
        and coalesce(pc.status_recebimento_geral, '') not like 'Concluído%'
        and pc.created_at >= $1::timestamptz
    ),
    saldo_vermelho as (
      select
        v.pedido_compra_id,
        v.pedido_compra_numero,
        v.fornecedor_nome,
        count(*)::int as linhas_vermelho,
        round(sum(v.falta_operacional)::numeric, 2) as soma_falta_operacional,
        round(sum(v.quantidade_em_transito)::numeric, 2) as soma_em_transito,
        json_agg(json_build_object(
          'produto', v.produto_nome,
          'falta', round(v.falta_operacional::numeric, 2),
          'un', v.unidade_sigla
        ) order by v.produto_nome) as linhas
      from public.pedido_compra_saldo_a_embarcar_v v
      join pedidos_abertos pc on pc.id = v.pedido_compra_id
      where v.falta_operacional > 0.009
        and ${iniciado}
      group by v.pedido_compra_id, v.pedido_compra_numero, v.fornecedor_nome
    )
    select
      s.pedido_compra_numero as numero,
      s.fornecedor_nome as fornecedor,
      pc.status,
      pc.status_embarque,
      s.linhas_vermelho,
      s.soma_falta_operacional,
      s.soma_em_transito,
      s.linhas
    from saldo_vermelho s
    join pedidos_abertos pc on pc.id = s.pedido_compra_id
    order by s.fornecedor_nome, s.pedido_compra_numero
  `, [DATA_MIN]);

  const normaisQ = await client.query(`
    with pedidos_abertos as (
      select pc.*
      from public.pedido_compra pc
      where pc.status is distinct from 'Concluído'
        and coalesce(pc.status_recebimento_geral, '') not like 'Concluído%'
        and pc.created_at >= $1::timestamptz
    ),
    vermelho_ids as (
      select distinct v.pedido_compra_id
      from public.pedido_compra_saldo_a_embarcar_v v
      join pedidos_abertos pc on pc.id = v.pedido_compra_id
      where v.falta_operacional > 0.009
        and ${iniciado}
    )
    select
      pc.numero,
      pc.fornecedor_nome as fornecedor,
      pc.status,
      pc.status_embarque,
      ${iniciadoPc} as desmembramento_iniciado,
      coalesce((
        select count(*)::int from public.embarque e
        where e.pedido_compra_id = pc.id
          and coalesce(e.tipo, 'Embarque') <> 'Necessidade'
      ), 0) as embarques_reais,
      coalesce((
        select round(sum(v.falta_operacional)::numeric, 2)
        from public.pedido_compra_saldo_a_embarcar_v v
        where v.pedido_compra_id = pc.id
      ), 0) as falta_bruta,
      coalesce((
        select round(sum(v.quantidade_em_transito)::numeric, 2)
        from public.pedido_compra_saldo_a_embarcar_v v
        where v.pedido_compra_id = pc.id
      ), 0) as em_transito
    from pedidos_abertos pc
    where pc.id not in (select pedido_compra_id from vermelho_ids)
    order by pc.fornecedor_nome, pc.numero
  `, [DATA_MIN]);

  return { vermelhos: vermelhosQ.rows, normais: normaisQ.rows };
}

async function listarViaView(client) {
  const check = await client.query(`
    select count(*)::int as n
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedido_compra_status_logistica_v'
      and column_name = 'desmembramento_iniciado'
  `);
  if (!check.rows[0]?.n) {
    throw new Error('Migration 104 não aplicada — a correr lógica inline');
  }

  const vermelhosQ = await client.query(`
    select
      c.pedido_compra_numero as numero,
      c.fornecedor_nome as fornecedor,
      pc.status,
      pc.status_embarque,
      s.desmembramento_iniciado,
      count(*)::int as linhas_vermelho,
      round(sum(c.soma_saldo_pendente_base)::numeric, 2) as soma_saldo_pendente
    from public.pedido_compra_card_logistica_v c
    join public.pedido_compra pc on pc.id = c.pedido_compra_id
    left join public.pedido_compra_status_logistica_v s on s.pedido_compra_id = c.pedido_compra_id
    where c.card_paleta = 'vermelho'
      and pc.status is distinct from 'Concluído'
      and pc.created_at >= $1::timestamptz
    group by 1,2,3,4,5
    order by c.fornecedor_nome, c.pedido_compra_numero
  `, [DATA_MIN]);

  const normaisQ = await client.query(`
    select
      pc.numero,
      pc.fornecedor_nome as fornecedor,
      pc.status,
      pc.status_embarque,
      s.desmembramento_iniciado,
      s.status_embarque_calc,
      s.diagnostico
    from public.pedido_compra pc
    left join public.pedido_compra_status_logistica_v s on s.pedido_compra_id = pc.id
    where pc.status is distinct from 'Concluído'
      and coalesce(pc.status_recebimento_geral, '') not like 'Concluído%'
      and pc.created_at >= $1::timestamptz
      and not exists (
        select 1 from public.pedido_compra_card_logistica_v c
        where c.pedido_compra_id = pc.id and c.card_paleta = 'vermelho'
      )
    order by pc.fornecedor_nome, pc.numero
  `, [DATA_MIN]);

  return { vermelhos: vermelhosQ.rows, normais: normaisQ.rows, fonte: 'view-104' };
}

async function main() {
  const useView = process.argv.includes('--view');
  const client = await connectPg(process.env.DATABASE_URL);
  try {
    let data;
    let fonte = 'sql-inline (regra 104)';
    try {
      data = useView ? await listarViaView(client) : await listarInline(client);
      if (data.fonte) fonte = data.fonte;
    } catch (e) {
      if (useView) throw e;
      throw e;
    }

    const out = {
      meta: {
        gerado_em: new Date().toISOString(),
        criterio: 'Vermelho = desmembramento iniciado + saldo pendente; normal = resto dos abertos',
        data_min: '2026-07-20',
        total_vermelhos: data.vermelhos.length,
        total_normais: data.normais.length,
        total_abertos: data.vermelhos.length + data.normais.length,
        fonte,
      },
      vermelhos: data.vermelhos,
      normais: data.normais,
    };

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
