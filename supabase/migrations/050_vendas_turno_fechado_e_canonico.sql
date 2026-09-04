-- 050: reatribuir vendas/lançamentos de turnos FECHADOS ao turno aberto do mesmo caixa.
-- (Correção de dados; lógica RPC canónica em 051.)

do $$
declare
  r record;
  v_canonico text;
begin
  for r in
    select
      t_fechado.id as turno_fechado_id,
      t_aberto.id as turno_aberto_id
    from public.turno_caixa t_fechado
    join public.turno_caixa t_aberto
      on t_aberto.conta_caixa_pdv_id = t_fechado.conta_caixa_pdv_id
     and t_aberto.status = 'Aberto'
    where t_fechado.status = 'Fechado'
      and t_fechado.conta_caixa_pdv_id is not null
      and trim(t_fechado.conta_caixa_pdv_id) <> ''
    order by t_aberto.data_abertura asc nulls last
  loop
    v_canonico := r.turno_aberto_id;

    update public.pedido_venda
    set turno_caixa_id = v_canonico,
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', v_canonico)
    where turno_caixa_id = r.turno_fechado_id
       or dados->>'turno_caixa_id' = r.turno_fechado_id;

    update public.lancamento_financeiro
    set turno_caixa_id = v_canonico,
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', v_canonico)
    where turno_caixa_id = r.turno_fechado_id
       or dados->>'turno_caixa_id' = r.turno_fechado_id;

    update public.turno_caixa t
    set vendas_ids = (
      select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
      from (
        select jsonb_array_elements_text(coalesce(t.vendas_ids, '[]'::jsonb)) as elem
        union
        select p.id::text
        from public.pedido_venda p
        where p.turno_caixa_id = v_canonico
      ) u
    )
    where t.id = v_canonico;
  end loop;
end $$;
