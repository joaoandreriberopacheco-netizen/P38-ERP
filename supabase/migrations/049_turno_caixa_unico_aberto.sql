-- 049: um único turno aberto por caixa PDV + fundir duplicatas existentes.

-- ---------------------------------------------------------------------------
-- 1) Fundir turnos abertos duplicados no mais antigo (por data_abertura)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_canonico text;
  v_dup text;
  v_merged_vendas jsonb;
  v_merged_movs jsonb;
  i int;
begin
  for r in
    select
      conta_caixa_pdv_id,
      array_agg(id order by data_abertura asc nulls last, created_at asc nulls last) as ids
    from public.turno_caixa
    where status = 'Aberto'
      and conta_caixa_pdv_id is not null
      and trim(conta_caixa_pdv_id) <> ''
    group by conta_caixa_pdv_id
    having count(*) > 1
  loop
    v_canonico := r.ids[1];

    for i in 2..coalesce(array_length(r.ids, 1), 0) loop
      v_dup := r.ids[i];

      select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
      into v_merged_vendas
      from (
        select jsonb_array_elements_text(coalesce(vendas_ids, '[]'::jsonb)) as elem
        from public.turno_caixa where id in (v_canonico, v_dup)
      ) u;

      select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
      into v_merged_movs
      from (
        select jsonb_array_elements_text(coalesce(movimentos_ids, '[]'::jsonb)) as elem
        from public.turno_caixa where id in (v_canonico, v_dup)
      ) u;

      update public.turno_caixa
      set vendas_ids = v_merged_vendas,
          movimentos_ids = v_merged_movs
      where id = v_canonico;

      update public.pedido_venda
      set turno_caixa_id = v_canonico,
          dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', v_canonico)
      where turno_caixa_id = v_dup
         or dados->>'turno_caixa_id' = v_dup;

      update public.lancamento_financeiro
      set turno_caixa_id = v_canonico,
          dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('turno_caixa_id', v_canonico)
      where turno_caixa_id = v_dup
         or dados->>'turno_caixa_id' = v_dup;

      update public.movimentos_caixa
      set turno_caixa_id = v_canonico
      where turno_caixa_id = v_dup;

      update public.turno_caixa
      set status = 'Fechado',
          data_fechamento = coalesce(data_fechamento, now()),
          observacoes = trim(
            coalesce(observacoes, '') ||
            ' [auto: turno duplicado fundido no turno canônico ' || v_canonico || ']'
          )
      where id = v_dup;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Impedir novos turnos duplicados no mesmo caixa PDV
-- ---------------------------------------------------------------------------
create unique index if not exists idx_turno_caixa_um_aberto_por_pdv
  on public.turno_caixa (conta_caixa_pdv_id)
  where status = 'Aberto';
