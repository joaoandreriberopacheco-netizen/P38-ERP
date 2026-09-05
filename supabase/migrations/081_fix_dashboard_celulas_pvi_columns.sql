-- 081_fix_dashboard_celulas_pvi_columns.sql
-- pedido_venda_item não tem coluna quantidade — só quantidade_base (alinhar com 064/065).

create or replace function public.p38_celula_compute_estoque_supply_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_start date := (p_month_key || '-01')::date;
  v_end date := (date_trunc('month', v_start) + interval '1 month - 1 day')::date;
  v_cmv_efetivo numeric := 0;
  v_cmv_vendido numeric := 0;
  v_ratio numeric := 0;
  v_payload jsonb;
begin
  select coalesce(sum(coalesce(lf.valor, 0)), 0)
    into v_cmv_efetivo
  from public.lancamento_financeiro lf
  where lower(trim(coalesce(lf.tipo, ''))) = 'despesa'
    and coalesce(lf.is_custo_mercadoria, false) = true
    and lower(trim(coalesce(lf.status, ''))) <> 'cancelado'
    and lf.data_pagamento between v_start and v_end;

  select coalesce(sum(
    coalesce(pvi.quantidade_base, 0)
    * coalesce(pvi.custo_unitario_momento, p.preco_custo_calculado, 0)
  ), 0)
  into v_cmv_vendido
  from public.pedido_venda_item pvi
  join public.pedido_venda pv on pv.id = pvi.pedido_venda_id
  left join public.produto p on p.id = pvi.produto_id
  where public.p38_pedido_venda_elegivel_dashboard(pv)
    and public.p38_pedido_venda_sale_date(pv) between v_start and v_end
    and lower(trim(coalesce(pv.status, pv.dados->>'status', ''))) not in (
      'cancelado', 'aguardando caixa', 'orçamento', 'orcamento'
    );

  v_ratio := case when v_cmv_vendido > 0 then round((v_cmv_efetivo / v_cmv_vendido) * 100, 2) else 0 end;

  v_payload := jsonb_build_object(
    'cellType', 'estoque_supply',
    'monthKey', p_month_key,
    'cmvEfetivo', round(v_cmv_efetivo, 2),
    'cmvVendido', round(v_cmv_vendido, 2),
    'ratioPercent', v_ratio
  );

  perform public.p38_anotacao_upsert('dashboard_celulas', 'estoque:supply:' || p_month_key, v_payload, 1);

  delete from public.p38_anotacao_dirty
  where domain = 'dashboard_celulas' and ref_key = 'estoque:supply:' || p_month_key;

  return v_payload;
end;
$$;
