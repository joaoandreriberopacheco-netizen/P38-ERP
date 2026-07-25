-- 038_fix_gerar_numero_sequencial_columns.sql
-- Verifica unicidade em coluna promovida + fallback dados jsonb.

create or replace function public.gerar_numero_sequencial(p_tipo text)
returns jsonb language plpgsql security definer as $$
declare
  v_table text;
  v_field text;
  v_existing text;
  v_codigo text;
begin
  case p_tipo
    when 'PV'  then v_table := 'pedido_venda';      v_field := 'numero';
    when 'DT'  then v_table := 'devolucao_troca';   v_field := 'numero';
    when 'VC'  then v_table := 'vale_compra';       v_field := 'codigo';
    when 'TC'  then v_table := 'turno_caixa';       v_field := 'numero';
    when 'MCX' then v_table := 'movimentos_caixa';  v_field := 'numero';
    when 'PC'  then v_table := 'pedido_compra';     v_field := 'numero';
    when 'CI'  then v_table := 'consumo_interno';   v_field := 'numero';
    else
      return jsonb_build_object('error', 'Tipo "' || p_tipo || '" não suportado.');
  end case;

  for i in 1..50 loop
    v_codigo := public._gerar_bloco_aleatorio(3) || '-' || public._gerar_bloco_aleatorio(3);
    execute format(
      'select 1 from public.%I where coalesce(%I, dados->>%L) = %L limit 1',
      v_table, v_field, v_field, v_codigo
    ) into v_existing;
    if v_existing is null then
      return jsonb_build_object('numero', v_codigo);
    end if;
  end loop;

  return jsonb_build_object('error', 'Não foi possível gerar um identificador único.');
end;
$$;
