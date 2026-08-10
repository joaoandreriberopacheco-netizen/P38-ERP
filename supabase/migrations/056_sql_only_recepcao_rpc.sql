-- Recepção retroativa: ler PedidoCompraItem + EmbarqueItem (SQL), não JSON em pedido/embarque.

create or replace function public.corrigir_movimentos_recepcao_um_pedido(p_payload jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_pedido_id text := p_payload->>'pedido_id';
  v_dry_run boolean := coalesce((p_payload->>'dry_run')::boolean, true);
  v_user_email text := coalesce(p_payload->>'user_email', '');
  v_pedido record;
  v_emb_row record;
  v_ei record;
  v_pci record;
  v_recebido jsonb := '{}'::jsonb;
  v_movimentado jsonb := '{}'::jsonb;
  v_mov record;
  v_pid text;
  v_q numeric;
  v_fator numeric;
  v_r numeric;
  v_m numeric;
  v_faltante numeric;
  v_deltas jsonb := '[]'::jsonb;
  v_linha jsonb;
  v_st text;
  v_linhas int := 0;
  v_produtos text[] := '{}';
  v_nome_prod text;
  v_unidade text;
  v_historico_tag text;
begin
  select * into v_pedido from public.pedido_compra where id = v_pedido_id;
  if not found then
    return jsonb_build_object('pedido_id', v_pedido_id, 'skipped', true, 'motivo', 'pedido_nao_encontrado');
  end if;

  for v_emb_row in select * from public.embarque e where e.pedido_compra_id = v_pedido_id
  loop
    v_st := trim(coalesce(v_emb_row.status_recebimento, v_emb_row.dados->>'status_recebimento', ''));
    if v_st = '' then
      v_st := trim(coalesce(v_emb_row.dados->>'status_recebimento_embarque', ''));
    end if;

    for v_ei in select * from public.embarque_item ei where ei.embarque_id = v_emb_row.id
    loop
      v_q := coalesce(v_ei.quantidade_recebida_comercial, 0);
      if v_q <= 0 then continue; end if;
      v_pid := coalesce(nullif(v_ei.produto_id_recebido_diferente, ''), nullif(v_ei.produto_id, ''));
      if v_pid is null then continue; end if;

      select coalesce(nullif(pci.fator_aplicado, 0), 1) into v_fator
      from public.pedido_compra_item pci
      where pci.pedido_compra_id = v_pedido_id and pci.produto_id = v_pid
      limit 1;
      if v_fator is null or v_fator <= 0 then v_fator := 1; end if;

      v_recebido := jsonb_set(
        v_recebido,
        array[v_pid],
        to_jsonb(public._p38_round_qty(
          coalesce(nullif(v_recebido->>v_pid, '')::numeric, 0) + v_q * v_fator
        )),
        true
      );
    end loop;
  end loop;

  for v_mov in
    select m.*
    from public.movimentacao_estoque m
    where m.referencia_tipo = 'PedidoCompra'
      and m.referencia_id in (v_pedido_id, v_pedido_id::text)
      and coalesce(m.motivo, m.dados->>'motivo') = 'Compra'
      and coalesce(m.tipo, m.dados->>'tipo') = 'Entrada'
  loop
    v_pid := coalesce(v_mov.produto_id, v_mov.dados->>'produto_id');
    if v_pid is null then continue; end if;
    v_q := coalesce(v_mov.quantidade, nullif(v_mov.dados->>'quantidade', '')::numeric, 0);
    v_movimentado := jsonb_set(
      v_movimentado,
      array[v_pid],
      to_jsonb(public._p38_round_qty(coalesce(nullif(v_movimentado->>v_pid, '')::numeric, 0) + v_q)),
      true
    );
  end loop;

  for v_pid in select jsonb_object_keys(v_recebido)
  loop
    v_r := coalesce(nullif(v_recebido->>v_pid, '')::numeric, 0);
    v_m := coalesce(nullif(v_movimentado->>v_pid, '')::numeric, 0);
    v_faltante := public._p38_round_qty(greatest(0, v_r - v_m));
    if v_faltante > 0 then
      v_deltas := v_deltas || jsonb_build_object(
        'produto_id', v_pid,
        'recebido_documental', v_r,
        'ja_movimentado', v_m,
        'faltante', v_faltante
      );
    end if;
  end loop;

  if jsonb_array_length(v_deltas) = 0 then
    return jsonb_build_object(
      'pedido_id', v_pedido_id,
      'numero', v_pedido.numero,
      'skipped', true,
      'motivo', 'sem_delta'
    );
  end if;

  if v_dry_run then
    return jsonb_build_object(
      'pedido_id', v_pedido_id,
      'numero', v_pedido.numero,
      'dryRun', true,
      'deltas', v_deltas
    );
  end if;

  for v_linha in select value as d from jsonb_array_elements(v_deltas) as t(value)
  loop
    v_pid := v_linha.d->>'produto_id';
    v_faltante := (v_linha.d->>'faltante')::numeric;

    select pci.produto_nome, coalesce(nullif(pci.fator_aplicado, 0), 1), pci.unidade_sigla
    into v_nome_prod, v_fator, v_unidade
    from public.pedido_compra_item pci
    where pci.pedido_compra_id = v_pedido_id and pci.produto_id = v_pid
    limit 1;

    if v_fator is null or v_fator <= 0 then v_fator := 1; end if;

    insert into public.movimentacao_estoque (
      id, produto_id, tipo, quantidade, quantidade_base, motivo,
      referencia_tipo, referencia_id, referencia_numero,
      unidade_medida, unidade_sigla, fator_conversao, observacoes, dados
    ) values (
      gen_random_uuid()::text,
      v_pid,
      'Entrada',
      v_faltante,
      v_faltante,
      'Compra',
      'PedidoCompra',
      v_pedido_id,
      v_pedido.numero,
      v_unidade,
      v_unidade,
      case when v_fator > 1 then v_fator else null end,
      format('Correção retroativa recepção→estoque (admin %s); reconcilia EmbarqueItem vs MovimentacaoEstoque.', v_user_email),
      jsonb_build_object(
        'produto_id', v_pid,
        'produto_nome', coalesce(v_nome_prod, 'Produto'),
        'tipo', 'Entrada',
        'motivo', 'Compra',
        'quantidade', v_faltante,
        'quantidade_base', v_faltante,
        'referencia_tipo', 'PedidoCompra',
        'referencia_id', v_pedido_id,
        'referencia_numero', v_pedido.numero
      )
    );
    v_linhas := v_linhas + 1;
    v_produtos := array_append(v_produtos, v_pid);
  end loop;

  v_historico_tag := format(
    E'\n[CORREÇÃO MOVIMENTOS RECEPÇÃO RETROATIVA SQL | PC %s | %s linha(s) | %s]',
    coalesce(v_pedido.numero, v_pedido_id),
    v_linhas,
    now()::text
  );
  update public.pedido_compra
    set historico = coalesce(historico, '') || v_historico_tag
  where id = v_pedido_id;

  foreach v_pid in array v_produtos
  loop
    perform public.recalcular_estoque_produto(v_pid);
  end loop;

  return jsonb_build_object(
    'pedido_id', v_pedido_id,
    'numero', v_pedido.numero,
    'aplicado', true,
    'deltas', v_deltas,
    'linhas_corrigidas', v_linhas
  );
exception when others then
  return jsonb_build_object('pedido_id', v_pedido_id, 'error', sqlerrm);
end;
$$;
