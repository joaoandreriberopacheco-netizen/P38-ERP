-- 038_allow_negative_estoque_atual.sql
-- Permite estoque_atual negativo quando vendas excedem o saldo (ex.: tinha 10, vendeu 20 → -10).
-- KPIs de valorização no app continuam a considerar apenas quantidades > 0.

create or replace function public.recalcular_estoque_produto(p_produto_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_saldo numeric := 0;
  v_avariado numeric := 0;
  v_atual numeric := 0;
  v_novo numeric := 0;
  v_count int := 0;
begin
  select coalesce(sum(
    case
      when coalesce(m.tipo, m.dados->>'tipo') = 'Entrada' then
        coalesce(m.quantidade, nullif(m.dados->>'quantidade', '')::numeric, 0)
      when coalesce(m.tipo, m.dados->>'tipo') = 'Saída' then
        -coalesce(m.quantidade, nullif(m.dados->>'quantidade', '')::numeric, 0)
      else 0
    end
  ), 0), count(*)
  into v_saldo, v_count
  from public.movimentacao_estoque m
  where coalesce(m.produto_id, m.dados->>'produto_id') = p_produto_id;

  select
    coalesce(p.estoque_avariado, nullif(p.dados->>'estoque_avariado', '')::numeric, 0),
    coalesce(p.estoque_atual, nullif(p.dados->>'estoque_atual', '')::numeric, 0)
  into v_avariado, v_atual
  from public.produto p
  where p.id = p_produto_id;

  v_novo := v_saldo - v_avariado;

  if v_novo is distinct from v_atual then
    update public.produto
      set estoque_atual = v_novo,
          dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('estoque_atual', v_novo)
    where id = p_produto_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'estoque_anterior', v_atual,
    'estoque_atual', v_novo,
    'movimentos', v_count,
    'atualizado', (v_novo is distinct from v_atual)
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;
