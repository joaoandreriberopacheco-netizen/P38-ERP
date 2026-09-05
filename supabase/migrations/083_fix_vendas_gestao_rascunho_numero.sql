-- 083_fix_vendas_gestao_rascunho_numero.sql
create or replace function public.p38_anotacao_compute_vendas_gestao_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_start date := (p_month_key || '-01')::date;
  v_end date := (date_trunc('month', v_start) + interval '1 month - 1 day')::date;
  v_hoje date := public.p38_tabatinga_hoje();
  v_headers jsonb := '[]'::jsonb;
  v_rascunhos jsonb := '[]'::jsonb;
  v_payload jsonb;
begin
  if v_end >= v_hoje then
    v_end := v_hoje - 1;
  end if;

  if v_end < v_start then
    return jsonb_build_object('skipped', true, 'reason', 'month_not_closed');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pv.id,
      'numero', pv.numero,
      'cliente_id', pv.cliente_id,
      'cliente_nome', pv.cliente_nome,
      'status', coalesce(pv.status, pv.dados->>'status'),
      'tipo', coalesce(pv.tipo, pv.dados->>'tipo'),
      'total', coalesce(pv.total, (pv.dados->>'valor_total')::numeric, 0),
      'valor_total', coalesce(pv.total, (pv.dados->>'valor_total')::numeric, 0),
      'subtotal', pv.subtotal,
      'valor_desconto', pv.valor_desconto,
      'valor_frete', pv.valor_frete,
      'vendedor_id', pv.vendedor_id,
      'vendedor_nome', coalesce(pv.vendedor_nome, pv.dados->>'vendedor_nome'),
      'pagamentos', coalesce(pv.dados->'pagamentos', '[]'::jsonb),
      'created_date', pv.created_at,
      'data_venda', coalesce(pv.dados->>'data_venda', to_char(pv.created_at at time zone 'America/Rio_Branco', 'YYYY-MM-DD'))
    ) order by pv.created_at desc
  ), '[]'::jsonb)
  into v_headers
  from public.pedido_venda pv
  where (pv.created_at at time zone 'America/Rio_Branco')::date between v_start and v_end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'numero', coalesce(r.dados->>'numero', r.id),
      'cliente_id', r.cliente_id,
      'cliente_nome', r.cliente_nome,
      'status', coalesce(r.status, r.dados->>'status'),
      'total', coalesce(r.valor_total, (r.dados->>'valor_total')::numeric, 0),
      'valor_total', coalesce(r.valor_total, (r.dados->>'valor_total')::numeric, 0),
      'vendedor_id', r.vendedor_id,
      'vendedor_nome', coalesce(r.vendedor_nome, r.dados->>'vendedor_nome'),
      'senha_atendimento', coalesce(r.senha_atendimento, r.dados->>'senha_atendimento'),
      'created_date', r.created_at
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_rascunhos
  from public.rascunho_pedido_venda r
  where (r.created_at at time zone 'America/Rio_Branco')::date between v_start and v_end;

  v_payload := jsonb_build_object(
    'monthKey', p_month_key,
    'closedThrough', to_char(v_end, 'YYYY-MM-DD'),
    'headers', v_headers,
    'rascunhos', v_rascunhos,
    'headerCount', jsonb_array_length(v_headers),
    'rascunhoCount', jsonb_array_length(v_rascunhos)
  );

  perform public.p38_anotacao_upsert('vendas_gestao', p_month_key, v_payload, 1);

  delete from public.p38_anotacao_dirty
  where domain = 'vendas_gestao' and ref_key = p_month_key;

  return v_payload;
end;
$$;
