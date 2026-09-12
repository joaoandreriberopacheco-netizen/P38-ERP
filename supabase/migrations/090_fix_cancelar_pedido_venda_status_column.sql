-- 090_fix_cancelar_pedido_venda_status_column.sql
-- Tabelas criadas pelo bootstrap JSONB (000) podem não ter coluna status;
-- a RPC cancelar_pedido_venda falhava com: column "status" does not exist.

alter table public.pedido_venda add column if not exists status text;
alter table public.pedido_venda add column if not exists numero text;
alter table public.pedido_venda add column if not exists observacoes text;
alter table public.pedido_venda add column if not exists pagamentos jsonb default '[]'::jsonb;
alter table public.pedido_venda add column if not exists dados jsonb not null default '{}'::jsonb;

alter table public.lancamento_financeiro add column if not exists observacoes text;
alter table public.lancamento_financeiro add column if not exists dados jsonb not null default '{}'::jsonb;

alter table public.agenda_logistica add column if not exists pedido_venda_id text;
alter table public.agenda_logistica add column if not exists status text;
alter table public.agenda_logistica add column if not exists dados jsonb not null default '{}'::jsonb;

alter table public.ordem_separacao add column if not exists pedido_venda_id text;
alter table public.ordem_separacao add column if not exists status text;
alter table public.ordem_separacao add column if not exists dados jsonb not null default '{}'::jsonb;

alter table public.protocolo_entrega add column if not exists pedido_venda_id text;
alter table public.protocolo_entrega add column if not exists status text;
alter table public.protocolo_entrega add column if not exists dados jsonb not null default '{}'::jsonb;

update public.pedido_venda set
  status = coalesce(status, dados->>'status'),
  numero = coalesce(numero, dados->>'numero'),
  observacoes = coalesce(observacoes, dados->>'observacoes'),
  pagamentos = coalesce(pagamentos, dados->'pagamentos', '[]'::jsonb)
where dados is not null and dados <> '{}'::jsonb;

update public.agenda_logistica set
  pedido_venda_id = coalesce(pedido_venda_id, dados->>'pedido_venda_id'),
  status = coalesce(status, dados->>'status')
where dados is not null and dados <> '{}'::jsonb;

update public.ordem_separacao set
  pedido_venda_id = coalesce(pedido_venda_id, dados->>'pedido_venda_id'),
  status = coalesce(status, dados->>'status')
where dados is not null and dados <> '{}'::jsonb;

update public.protocolo_entrega set
  pedido_venda_id = coalesce(pedido_venda_id, dados->>'pedido_venda_id'),
  status = coalesce(status, dados->>'status')
where dados is not null and dados <> '{}'::jsonb;

create or replace function public.cancelar_pedido_venda(
  p_pedido_id text,
  p_motivo text,
  p_user_name text
) returns jsonb language plpgsql security definer as $$
declare
  v_pedido public.pedido_venda%rowtype;
  v_status text;
  v_tipo text;
  v_numero text;
  v_obs_novo text;
  v_lanc record;
  v_mov record;
  v_conta record;
  v_vale record;
  v_pag_vale jsonb;
  v_pagamentos jsonb;
  v_valor numeric;
  v_delta numeric;
  v_novo_saldo_vale numeric;
  v_valor_original numeric;
  v_lanc_cancelados int := 0;
  v_mov_estornados int := 0;
  v_tem_devolucao boolean := false;
begin
  if coalesce(trim(p_pedido_id), '') = '' then
    return jsonb_build_object('error', 'pedidoId obrigatório.');
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    return jsonb_build_object('error', 'Informe o motivo do cancelamento.');
  end if;

  select * into v_pedido from public.pedido_venda where id = p_pedido_id for update;
  if not found then
    return jsonb_build_object('error', 'Pedido de venda não encontrado.');
  end if;

  v_status := public.p38_pedido_venda_status(v_pedido);
  v_tipo := public.p38_pedido_venda_tipo(v_pedido);
  v_numero := coalesce(v_pedido.numero, v_pedido.dados->>'numero', p_pedido_id);
  v_pagamentos := coalesce(v_pedido.pagamentos, v_pedido.dados->'pagamentos', '[]'::jsonb);

  if v_status = 'cancelado' then
    return jsonb_build_object('error', 'Este pedido já está cancelado.');
  end if;
  if v_status in ('orçamento', 'orcamento') or v_tipo in ('orçamento', 'orcamento') then
    return jsonb_build_object('error', 'Orçamentos devem ser excluídos ou convertidos, não cancelados por este fluxo.');
  end if;

  select exists (
    select 1 from public.devolucao_troca d
    where coalesce(d.pedido_origem_id, d.dados->>'pedido_origem_id', '') = p_pedido_id
      and lower(coalesce(d.status, d.dados->>'status', '')) = 'processada'
  ) into v_tem_devolucao;

  if v_tem_devolucao then
    return jsonb_build_object(
      'error',
      'Pedido possui devolução/troca processada. Estorne ou ajuste a devolução antes de cancelar a venda.'
    );
  end if;

  v_obs_novo := E'\n[Cancelado: ' || trim(p_motivo) || ' | ' || coalesce(p_user_name, 'Operador') || ' | ' ||
    to_char(now() at time zone 'America/Rio_Branco', 'DD/MM/YYYY HH24:MI:SS') || ']';

  for v_lanc in
    select l.*
    from public.lancamento_financeiro l
    where coalesce(l.referencia_id, l.dados->>'referencia_id', '') = p_pedido_id
      and lower(coalesce(l.status, l.dados->>'status', '')) <> 'cancelado'
  loop
    if coalesce(v_lanc.status, v_lanc.dados->>'status') = 'Pago'
       or v_lanc.data_pagamento is not null
       or coalesce(v_lanc.dados->>'data_pagamento', '') <> '' then
      if coalesce(v_lanc.conta_financeira_id, v_lanc.dados->>'conta_financeira_id', '') <> '' then
        select * into v_conta
        from public.contas_financeiras
        where id = coalesce(v_lanc.conta_financeira_id, v_lanc.dados->>'conta_financeira_id')
        for update;
        if found then
          v_valor := coalesce(v_lanc.valor, (v_lanc.dados->>'valor')::numeric, 0);
          v_delta := case when coalesce(v_lanc.tipo, v_lanc.dados->>'tipo') = 'Receita' then -v_valor else v_valor end;
          update public.contas_financeiras
            set saldo_atual = coalesce(saldo_atual, (dados->>'saldo_atual')::numeric, 0) + v_delta,
                dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
                  'saldo_atual', coalesce(saldo_atual, (dados->>'saldo_atual')::numeric, 0) + v_delta
                )
          where id = v_conta.id;
        end if;
      end if;
    end if;

    update public.lancamento_financeiro
      set status = 'Cancelado',
          observacoes = coalesce(observacoes, dados->>'observacoes', '') || v_obs_novo,
          dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
            'status', 'Cancelado',
            'observacoes', coalesce(observacoes, dados->>'observacoes', '') || v_obs_novo
          )
    where id = v_lanc.id;

    v_lanc_cancelados := v_lanc_cancelados + 1;
  end loop;

  for v_mov in
    select m.*
    from public.movimentacao_estoque m
    where coalesce(m.referencia_id, m.dados->>'referencia_id', '') = p_pedido_id
      and coalesce(m.tipo, m.dados->>'tipo', '') = 'Saída'
      and coalesce(m.motivo, m.dados->>'motivo', '') = 'Venda'
      and coalesce(m.quantidade, (m.dados->>'quantidade')::numeric, 0) > 0
      and not exists (
        select 1
        from public.movimentacao_estoque e
        where coalesce(e.referencia_id, e.dados->>'referencia_id', '') = p_pedido_id
          and coalesce(e.tipo, e.dados->>'tipo', '') = 'Entrada'
          and coalesce(e.motivo, e.dados->>'motivo', '') = 'Cancelamento'
          and coalesce(e.produto_id, e.dados->>'produto_id', '') =
              coalesce(m.produto_id, m.dados->>'produto_id', '')
      )
  loop
    insert into public.movimentacao_estoque (
      id, produto_id, tipo, quantidade, motivo,
      referencia_tipo, referencia_id, referencia_numero,
      observacoes, usuario_responsavel, custo_unitario, dados
    ) values (
      gen_random_uuid()::text,
      coalesce(v_mov.produto_id, v_mov.dados->>'produto_id'),
      'Entrada',
      coalesce(v_mov.quantidade, (v_mov.dados->>'quantidade')::numeric, 0),
      'Cancelamento',
      'PedidoVenda',
      p_pedido_id,
      v_numero,
      'Estorno por cancelamento de venda: ' || trim(p_motivo),
      coalesce(p_user_name, 'Operador'),
      coalesce(v_mov.custo_unitario, (v_mov.dados->>'custo_unitario')::numeric, 0),
      jsonb_build_object(
        'produto_id', coalesce(v_mov.produto_id, v_mov.dados->>'produto_id'),
        'produto_nome', coalesce(v_mov.dados->>'produto_nome', ''),
        'tipo', 'Entrada',
        'motivo', 'Cancelamento',
        'quantidade', coalesce(v_mov.quantidade, (v_mov.dados->>'quantidade')::numeric, 0),
        'referencia_tipo', 'PedidoVenda',
        'referencia_id', p_pedido_id,
        'referencia_numero', v_numero,
        'cliente_nome', coalesce(v_pedido.cliente_nome, v_pedido.dados->>'cliente_nome'),
        'usuario_responsavel', coalesce(p_user_name, 'Operador')
      )
    );
    v_mov_estornados := v_mov_estornados + 1;
  end loop;

  select elem into v_pag_vale
  from jsonb_array_elements(v_pagamentos) elem
  where elem->>'forma_pagamento' = 'Vale Troca'
    and coalesce(elem->>'vale_id', '') <> ''
  limit 1;

  if v_pag_vale is not null then
    select * into v_vale
    from public.vale_compra
    where id = v_pag_vale->>'vale_id'
    for update;
    if found then
      v_novo_saldo_vale := coalesce(v_vale.valor_disponivel, (v_vale.dados->>'valor_disponivel')::numeric, 0)
        + coalesce(nullif(v_pag_vale->>'valor', '')::numeric, 0);
      v_valor_original := coalesce(v_vale.valor_original, (v_vale.dados->>'valor_original')::numeric, v_novo_saldo_vale);
      update public.vale_compra
        set valor_disponivel = least(v_novo_saldo_vale, v_valor_original),
            status = case
              when v_novo_saldo_vale <= 0.01 then 'Utilizado'
              when v_novo_saldo_vale < v_valor_original - 0.01 then 'Utilizado Parcialmente'
              else 'Ativo'
            end,
            dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
              'valor_disponivel', least(v_novo_saldo_vale, v_valor_original),
              'status', case
                when v_novo_saldo_vale <= 0.01 then 'Utilizado'
                when v_novo_saldo_vale < v_valor_original - 0.01 then 'Utilizado Parcialmente'
                else 'Ativo'
              end
            )
      where id = v_vale.id;
    end if;
  end if;

  update public.agenda_logistica
    set status = 'Cancelado',
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('status', 'Cancelado')
  where coalesce(pedido_venda_id, dados->>'pedido_venda_id', '') = p_pedido_id
    and lower(coalesce(status, dados->>'status', '')) <> 'cancelado';

  update public.ordem_separacao
    set status = 'Cancelado',
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('status', 'Cancelado')
  where coalesce(pedido_venda_id, dados->>'pedido_venda_id', '') = p_pedido_id
    and lower(coalesce(status, dados->>'status', '')) <> 'cancelado';

  update public.protocolo_entrega
    set status = 'Cancelado',
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('status', 'Cancelado')
  where coalesce(pedido_venda_id, dados->>'pedido_venda_id', '') = p_pedido_id
    and lower(coalesce(status, dados->>'status', '')) <> 'cancelado';

  update public.pedido_venda
    set status = 'Cancelado',
        observacoes = coalesce(observacoes, dados->>'observacoes', '') || v_obs_novo,
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
          'status', 'Cancelado',
          'observacoes', coalesce(observacoes, dados->>'observacoes', '') || v_obs_novo
        )
  where id = p_pedido_id;

  return jsonb_build_object(
    'sucesso', true,
    'pedido_id', p_pedido_id,
    'numero', v_numero,
    'status', 'Cancelado',
    'lancamentos_cancelados', v_lanc_cancelados,
    'movimentos_estornados', v_mov_estornados
  );
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function public.cancelar_pedido_venda(text, text, text) from public, anon, authenticated;
grant execute on function public.cancelar_pedido_venda(text, text, text) to service_role;
