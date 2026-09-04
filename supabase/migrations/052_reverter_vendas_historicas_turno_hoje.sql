-- 052: reverte efeito colateral da 050 — não mover histórico de turnos fechados para o turno aberto de hoje.
-- Apenas pedidos criados HOJE permanecem no TC-00120; histórico volta ao turno da época.

do $$
declare
  v_caixa_pdv text := '69b9311927ebd3bc12ed37f5';
  v_turno_hoje text := '975e9968-b1f5-4bd5-ae9f-ccad8c11545e';
  v_hoje date := '2026-08-05';
begin
  -- 1) Pedidos antigos: restaurar turno_caixa_id pelo intervalo abertura/fechamento do turno histórico
  update public.pedido_venda p
  set turno_caixa_id = sub.turno_id,
      dados = coalesce(p.dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', sub.turno_id)
  from (
    select distinct on (p2.id)
      p2.id as pedido_id,
      t.id as turno_id
    from public.pedido_venda p2
    join public.turno_caixa t
      on t.conta_caixa_pdv_id = v_caixa_pdv
     and p2.created_at >= t.data_abertura
     and (t.data_fechamento is null or p2.created_at <= t.data_fechamento + interval '2 hours')
    where p2.turno_caixa_id = v_turno_hoje
      and p2.created_at::date < v_hoje
    order by p2.id, t.data_abertura desc
  ) sub
  where p.id = sub.pedido_id;

  -- Pedidos antigos sem turno encontrado: limpar vínculo errado com o turno de hoje
  update public.pedido_venda
  set turno_caixa_id = null
  where turno_caixa_id = v_turno_hoje
    and created_at::date < v_hoje;

  -- 2) Receitas: alinhar turno_caixa_id ao pedido de referência
  update public.lancamento_financeiro l
  set turno_caixa_id = p.turno_caixa_id,
      dados = coalesce(l.dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', p.turno_caixa_id)
  from public.pedido_venda p
  where l.referencia_tipo = 'PedidoVenda'
    and l.referencia_id = p.id
    and l.turno_caixa_id = v_turno_hoje
    and (p.turno_caixa_id is distinct from v_turno_hoje);

  -- 3) Reconstruir vendas_ids do turno de hoje (só pedidos de hoje)
  update public.turno_caixa t
  set vendas_ids = coalesce((
    select jsonb_agg(p.id::text order by p.created_at)
    from public.pedido_venda p
    where p.turno_caixa_id = v_turno_hoje
  ), '[]'::jsonb)
  where t.id = v_turno_hoje;
end $$;
