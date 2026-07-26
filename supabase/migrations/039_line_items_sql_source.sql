-- 039_line_items_sql_source.sql
-- Fase 4: RPC financeiro lê pedido_compra_item quando existir.
-- Fase 5: view de trânsito por hierarquia de produto.
-- Fase 0/6: função de reparo do espelho JSON a partir das linhas SQL.

alter table public.pedido_compra add column if not exists valor_itens numeric;

-- ---------------------------------------------------------------------------
-- Reparo: recompõe pedido_compra.itens a partir de pedido_compra_item
-- ---------------------------------------------------------------------------
create or replace function public.reparar_espelho_pedido_compra_itens(p_pedido_id text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_itens jsonb;
  v_valor_itens numeric;
begin
  if p_pedido_id is null then
    return false;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'produto_id', pci.produto_id,
      'produto_nome', pci.produto_nome,
      'produto_unidade_id', pci.produto_unidade_id,
      'quantidade', pci.quantidade_comercial,
      'unidade_medida', pci.unidade_sigla,
      'fator_conversao', coalesce(pci.fator_aplicado, 1),
      'quantidade_base', pci.quantidade_base,
      'quantidade_vinculada', coalesce(pci.quantidade_vinculada, 0),
      'custo_unitario', coalesce(pci.custo_unitario_fator1, 0),
      'custo_final_unitario', coalesce(pci.custo_total_unitario_fator1, 0),
      'total', coalesce(pci.total, 0),
      'pedido_compra_item_id', pci.id
    )
    order by pci.ordem, pci.created_at
  ), '[]'::jsonb)
  into v_itens
  from public.pedido_compra_item pci
  where pci.pedido_compra_id = p_pedido_id;

  if jsonb_array_length(v_itens) = 0 then
    return false;
  end if;

  select round(coalesce(sum(coalesce(pci.total, 0)), 0), 2)
  into v_valor_itens
  from public.pedido_compra_item pci
  where pci.pedido_compra_id = p_pedido_id;

  update public.pedido_compra
  set itens = v_itens,
      valor_itens = v_valor_itens,
      dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('itens', v_itens, 'valor_itens', v_valor_itens),
      updated_at = now()
  where id = p_pedido_id;

  return found;
end;
$$;

revoke all on function public.reparar_espelho_pedido_compra_itens(text) from public, anon, authenticated;
grant execute on function public.reparar_espelho_pedido_compra_itens(text) to service_role;

-- ---------------------------------------------------------------------------
-- enviar_financeiro_lote_um_pedido — prioriza soma em pedido_compra_item
-- ---------------------------------------------------------------------------
create or replace function public.enviar_financeiro_lote_um_pedido(p_payload jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_pedido_id text := p_payload->>'pedido_id';
  v_user_name text := coalesce(p_payload->>'user_name', 'Usuário');
  v_user_id text := p_payload->>'user_id';
  v_forma text := coalesce(p_payload->>'forma_pagamento', 'Parcelado');
  v_data_venc date := coalesce(nullif(p_payload->>'data_primeiro_vencimento', '')::date, public._p38_hoje_acre());
  v_parcelas int := greatest(1, coalesce(nullif(p_payload->>'num_parcelas', '')::int, 1));
  v_intervalo int := greatest(1, coalesce(nullif(p_payload->>'intervalo_parcelas_dias', '')::int, 30));

  v_pedido record;
  v_status text;
  v_numero text;
  v_itens jsonb;
  v_valor_itens numeric;
  v_valor_total numeric;
  v_valor_frete numeric;
  v_valor_desconto numeric;
  v_fornecedor_id text;
  v_fornecedor_nome text;
  v_data_prevista text;
  v_sql_count int;
  v_item jsonb;
  v_i int;
  v_valor_parcela numeric;
  v_venc date;
  v_base jsonb;
  v_historico text;
begin
  if v_pedido_id is null then
    return jsonb_build_object('error', 'Pedido sem id');
  end if;

  select * into v_pedido from public.pedido_compra where id = v_pedido_id for update;
  if not found then
    return jsonb_build_object('error', 'Pedido não encontrado');
  end if;

  v_status := coalesce(v_pedido.status, v_pedido.dados->>'status');
  v_numero := coalesce(v_pedido.numero, v_pedido.dados->>'numero', v_pedido_id);

  if v_status is distinct from 'Rascunho' then
    return jsonb_build_object('error', format('Pedido %s não está em Rascunho', v_numero));
  end if;

  if exists (
    select 1 from public.lancamento_financeiro l
    where (
      coalesce(l.pedido_compra_vinculado_id, l.dados->>'pedido_compra_vinculado_id', '') = v_pedido_id
      or (l.referencia_id = v_pedido_id and coalesce(l.referencia_tipo, l.dados->>'referencia_tipo') = 'PedidoCompra')
    )
    and coalesce(l.status, l.dados->>'status') = 'Pago'
  ) then
    return jsonb_build_object('error', format('Pedido %s tem parcelas pagas', v_numero));
  end if;

  update public.lancamento_financeiro l
    set status = 'Cancelado',
        dados = jsonb_set(coalesce(l.dados, '{}'::jsonb), '{status}', '"Cancelado"'),
        observacoes = trim(both from coalesce(l.observacoes, l.dados->>'observacoes', '') || E'\n[Cancelado: envio em lote ao financeiro]')
    where (
      coalesce(l.pedido_compra_vinculado_id, l.dados->>'pedido_compra_vinculado_id', '') = v_pedido_id
      or (l.referencia_id = v_pedido_id and coalesce(l.referencia_tipo, l.dados->>'referencia_tipo') = 'PedidoCompra')
    )
    and coalesce(l.status, l.dados->>'status') in ('Em Aberto', 'Vencido')
    and coalesce(l.data_pagamento, nullif(l.dados->>'data_pagamento', '')::date) is null;

  select count(*)::int into v_sql_count
  from public.pedido_compra_item pci
  where pci.pedido_compra_id = v_pedido_id;

  v_itens := coalesce(v_pedido.itens, v_pedido.dados->'itens', '[]'::jsonb);
  v_fornecedor_id := coalesce(v_pedido.fornecedor_id, v_pedido.dados->>'fornecedor_id', v_pedido.dados->>'terceiro_id');
  v_fornecedor_nome := coalesce(v_pedido.fornecedor_nome, v_pedido.dados->>'fornecedor_nome', v_pedido.dados->>'terceiro_nome');
  v_valor_frete := coalesce(
    v_pedido.valor_frete,
    nullif(v_pedido.dados->>'valor_frete', '')::numeric,
    0
  );
  v_valor_desconto := coalesce(
    v_pedido.valor_desconto,
    nullif(v_pedido.dados->>'valor_desconto', '')::numeric,
    0
  );
  v_data_prevista := coalesce(
    left(v_pedido.data_prevista_entrega::text, 10),
    left(v_pedido.dados->>'data_prevista_entrega', 10),
    ''
  );

  v_valor_itens := 0;
  if v_sql_count > 0 then
    select round(coalesce(sum(coalesce(pci.total, 0)), 0), 2)
    into v_valor_itens
    from public.pedido_compra_item pci
    where pci.pedido_compra_id = v_pedido_id;
  elsif jsonb_typeof(v_itens) = 'array' and jsonb_array_length(v_itens) > 0 then
    for v_item in select * from jsonb_array_elements(v_itens)
    loop
      v_valor_itens := v_valor_itens + coalesce(
        nullif(v_item->>'total', '')::numeric,
        nullif(v_item->>'valor_total_item', '')::numeric,
        nullif(v_item->>'subtotal', '')::numeric,
        0
      );
    end loop;
    v_valor_itens := round(v_valor_itens, 2);
  else
    v_valor_itens := coalesce(
      v_pedido.valor_itens,
      nullif(v_pedido.dados->>'valor_itens', '')::numeric,
      0
    );
  end if;

  v_valor_total := round(v_valor_itens + v_valor_frete - v_valor_desconto, 2);
  if v_valor_total <= 0 then
    v_valor_total := round(coalesce(
      v_pedido.valor_total,
      nullif(v_pedido.dados->>'valor_total', '')::numeric,
      v_valor_itens
    ), 2);
  end if;

  v_base := jsonb_build_object(
    'tipo', 'Despesa',
    'terceiro_id', v_fornecedor_id,
    'terceiro_nome', v_fornecedor_nome,
    'status', 'Em Aberto',
    'categoria', 'Compra de Mercadoria',
    'referencia_id', v_pedido_id,
    'referencia_tipo', 'PedidoCompra',
    'referencia_numero', v_numero,
    'is_custo_mercadoria', true,
    'pedido_compra_vinculado_id', v_pedido_id,
    'pedido_compra_vinculado_numero', v_numero
  );

  if v_forma = 'À Vista' then
    perform public._p38_insert_lancamento(v_base || jsonb_build_object(
      'descricao', format('Compra de Mercadoria - %s (À Vista)', v_numero),
      'forma_pagamento_tipo', 'À Vista',
      'forma_pagamento_compra', 'À Vista',
      'valor', v_valor_total,
      'data_vencimento', v_data_venc::text,
      'observacoes', 'Pagamento à vista. Aguardando aprovação do financeiro.'
    ));
    v_parcelas := 1;
  else
    v_valor_parcela := v_valor_total / v_parcelas;
    for v_i in 0..(v_parcelas - 1) loop
      v_venc := public._p38_add_dias_uteis(v_data_venc, v_i * v_intervalo);
      perform public._p38_insert_lancamento(v_base || jsonb_build_object(
        'descricao', format('Compra de Mercadoria - %s (%s/%s)', v_numero, v_i + 1, v_parcelas),
        'forma_pagamento_tipo', 'Parcelado',
        'forma_pagamento_compra', 'Parcelado',
        'valor', v_valor_parcela,
        'data_vencimento', v_venc::text,
        'observacoes', format('Parcela %s de %s. Aguardando aprovação do financeiro.', v_i + 1, v_parcelas)
      ));
    end loop;
  end if;

  v_historico := coalesce(v_pedido.historico, v_pedido.dados->>'historico', '') ||
    format(E'\n[Enviado ao financeiro em lote: %s | %s]', v_user_name, now()::text);

  update public.pedido_compra
    set status = 'Aguardando Aprovação Financeira',
        status_aprovacao_financeira = 'Aguardando Aprovação Financeira',
        valor_total = v_valor_total,
        valor_itens = v_valor_itens,
        valor_frete = v_valor_frete,
        valor_desconto = v_valor_desconto,
        forma_pagamento_compra = v_forma,
        historico = v_historico,
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
          'status', 'Aguardando Aprovação Financeira',
          'status_aprovacao_financeira', 'Aguardando Aprovação Financeira',
          'forma_pagamento_compra', v_forma,
          'data_primeiro_vencimento', v_data_venc::text,
          'num_parcelas', case when v_forma = 'Parcelado' then v_parcelas else 1 end,
          'intervalo_parcelas_dias', v_intervalo,
          'valor_itens', v_valor_itens,
          'valor_total', v_valor_total,
          'historico', v_historico
        )
  where id = v_pedido_id;

  insert into public.tarefa (id, dados, titulo, tipo, status, prioridade, responsavel_id, responsavel_nome, referencia_tipo, referencia_id, referencia_numero, valor_pendente, descricao, data_vencimento)
  values (
    gen_random_uuid()::text,
    jsonb_build_object(
      'titulo', format('Recebimento de Mercadoria - %s', v_numero),
      'tipo', 'Recebimento de Mercadoria',
      'status', 'Pendente',
      'prioridade', 'Alta',
      'responsavel_id', v_user_id,
      'responsavel_nome', v_user_name,
      'referencia_tipo', 'PedidoCompra',
      'referencia_id', v_pedido_id,
      'referencia_numero', v_numero,
      'valor_pendente', v_valor_total,
      'descricao', format('Aguardando recebimento da mercadoria do fornecedor %s.', coalesce(v_fornecedor_nome, '')),
      'data_vencimento', coalesce(nullif(v_data_prevista, ''), v_data_venc::text)
    ),
    format('Recebimento de Mercadoria - %s', v_numero),
    'Recebimento de Mercadoria',
    'Pendente',
    'Alta',
    v_user_id,
    v_user_name,
    'PedidoCompra',
    v_pedido_id,
    v_numero,
    v_valor_total,
    format('Aguardando recebimento da mercadoria do fornecedor %s.', coalesce(v_fornecedor_nome, '')),
    coalesce(nullif(v_data_prevista, ''), v_data_venc::text)::date
  );

  return jsonb_build_object('success', true, 'pedido_id', v_pedido_id);
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fase 5: trânsito pendente por produto e hierarquia (base unidades)
-- ---------------------------------------------------------------------------
create or replace view public.v_transito_compra_hierarquia as
with pedidos_abertos as (
  select pc.id, pc.numero, pc.status, pc.status_aprovacao_financeira, pc.status_recebimento_geral
  from public.pedido_compra pc
  where coalesce(pc.status, '') not in ('Rascunho', 'Cancelado', 'Rejeitado', 'Rejeitado Financeiramente', 'Concluído', 'Devolvido')
    and coalesce(pc.status_recebimento_geral, '') not ilike 'Concluído%'
    and coalesce(pc.status_recebimento_geral, '') not ilike 'Recebido OK%'
),
recebido_por_item as (
  select
    ei.pedido_compra_item_id,
    ei.produto_id,
    e.pedido_compra_id,
    sum(coalesce(ei.quantidade_recebida_comercial, 0) * coalesce(nullif(pci.fator_aplicado, 0), 1)) as recebido_base
  from public.embarque e
  join public.embarque_item ei on ei.embarque_id = e.id
  left join public.pedido_compra_item pci on pci.id = ei.pedido_compra_item_id
  group by ei.pedido_compra_item_id, ei.produto_id, e.pedido_compra_id
),
pendente_item as (
  select
    pci.produto_id,
    pci.pedido_compra_id,
    pa.numero as pedido_numero,
    pa.status as pedido_status,
    greatest(
      0,
      coalesce(pci.quantidade_base, pci.quantidade_comercial * coalesce(nullif(pci.fator_aplicado, 0), 1), 0)
      - coalesce(r.recebido_base, 0)
    ) as pendente_base
  from public.pedido_compra_item pci
  join pedidos_abertos pa on pa.id = pci.pedido_compra_id
  left join recebido_por_item r
    on r.pedido_compra_item_id = pci.id
   and r.pedido_compra_id = pci.pedido_compra_id
  where pci.produto_id is not null
)
select
  p.id as produto_id,
  p.nome as produto_nome,
  upper(trim(coalesce(p.campo_hierarquico_1, ''))) as campo_hierarquico_1,
  upper(trim(coalesce(p.campo_hierarquico_2, ''))) as campo_hierarquico_2,
  upper(trim(coalesce(p.campo_hierarquico_3, ''))) as campo_hierarquico_3,
  upper(trim(coalesce(p.campo_hierarquico_4, ''))) as campo_hierarquico_4,
  upper(trim(coalesce(p.campo_hierarquico_5, ''))) as campo_hierarquico_5,
  coalesce(p.estoque_atual, 0) as estoque_fisico_base,
  round(coalesce(sum(pi.pendente_base), 0), 6) as transito_base,
  round(coalesce(p.estoque_atual, 0) + coalesce(sum(pi.pendente_base), 0), 6) as estoque_virtual_base,
  count(distinct pi.pedido_compra_id) as pedidos_em_transito
from public.produto p
left join pendente_item pi on pi.produto_id = p.id
where coalesce(p.ativo, true) = true
group by
  p.id, p.nome,
  p.campo_hierarquico_1, p.campo_hierarquico_2, p.campo_hierarquico_3,
  p.campo_hierarquico_4, p.campo_hierarquico_5,
  p.estoque_atual;

grant select on public.v_transito_compra_hierarquia to anon, authenticated, service_role;
