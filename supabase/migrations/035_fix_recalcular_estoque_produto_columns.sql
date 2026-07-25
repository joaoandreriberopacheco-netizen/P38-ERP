-- 035_fix_recalcular_estoque_produto_columns.sql
-- Após 031, movimentacao_estoque e produto usam colunas promovidas;
-- recalcular_estoque_produto lia só dados jsonb → estoque congelado/errado.

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

  v_novo := greatest(0, v_saldo - v_avariado);

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

create or replace function public.trg_recalc_estoque_mov()
returns trigger language plpgsql security definer as $$
declare
  v_pid text;
begin
  v_pid := coalesce(
    case when tg_op = 'DELETE' then old.produto_id else new.produto_id end,
    case when tg_op = 'DELETE' then old.dados->>'produto_id' else new.dados->>'produto_id' end
  );
  if v_pid is null or v_pid = '' then
    return null;
  end if;
  perform public.recalcular_estoque_produto(v_pid);
  return null;
end;
$$;

drop trigger if exists trg_movimentacao_estoque_recalc on public.movimentacao_estoque;
create trigger trg_movimentacao_estoque_recalc
  after insert or update or delete on public.movimentacao_estoque
  for each row execute function public.trg_recalc_estoque_mov();

-- Recalcula estoque de todos os produtos com movimentações
do $$
declare
  v_pid text;
  v_total int := 0;
begin
  for v_pid in
    select distinct coalesce(m.produto_id, m.dados->>'produto_id')
    from public.movimentacao_estoque m
    where coalesce(m.produto_id, m.dados->>'produto_id', '') <> ''
  loop
    perform public.recalcular_estoque_produto(v_pid);
    v_total := v_total + 1;
  end loop;
  raise notice 'recalcular_estoque_produto: % produto(s) processado(s)', v_total;
end$$;
