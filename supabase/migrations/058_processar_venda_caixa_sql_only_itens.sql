-- 058: processar_venda_caixa grava linhas em pedido_venda_item; cabeçalho sem espelho JSON itens[].

create or replace function public.processar_venda_caixa(p_payload jsonb)
returns jsonb language plpgsql security definer as $$
declare
  v_rascunho_id text := p_payload->>'rascunho_id';
  v_pagamentos jsonb := coalesce(p_payload->'pagamentos', '[]'::jsonb);
  v_turno_id text := p_payload->>'turno_id';
  v_conta_caixa_id text := p_payload->>'conta_caixa_id';
  v_config_venda jsonb := coalesce(p_payload->'config_venda', '{}'::jsonb);
  v_substitui_id text := p_payload->>'substitui_pedido_id';
  v_substitui_numero text := p_payload->>'substitui_pedido_numero';
  v_user_name text := coalesce(p_payload->>'user_name', 'Operador');

  v_rasc record;
  v_status text;
  v_numero text;
  v_pedido_id text := gen_random_uuid()::text;
  v_hoje date := public._p38_hoje_acre();
  v_hoje_text text := v_hoje::text;
  v_avisos jsonb := '[]'::jsonb;
  v_pag jsonb;
  v_item jsonb;
  v_qtd_base numeric;
  v_mov_id text;
  v_turno record;
  v_vendas_ids jsonb;
  v_conta record;
  v_vale record;
  v_novo_saldo_vale numeric;
  v_saldo_residual jsonb := null;
  v_dev record;
  v_conta_destino_id text;
  v_conta_destino_nome text;
  v_maq record;
  v_forma record;
  v_taxa numeric;
  v_valor_bruto numeric;
  v_valor_liquido numeric;
  v_prazo int;
  v_venc date;
  v_is_cartao boolean;
  v_is_fiado boolean;
  v_is_credito boolean;
  v_forma_id text;
  v_lanc jsonb;
  v_pedido_dados jsonb;
  v_pedido_json jsonb;
  v_pag_vale jsonb;
  v_itens_rasc jsonb;
  v_ord int := 0;
begin
  if v_rascunho_id is null or jsonb_array_length(v_pagamentos) = 0 then
    return jsonb_build_object('error', 'Parâmetros obrigatórios ausentes.');
  end if;

  if v_conta_caixa_id is null or trim(v_conta_caixa_id) = '' then
    return jsonb_build_object('error', 'Conta do caixa PDV obrigatória.');
  end if;

  select * into v_turno
  from public.turno_caixa
  where conta_caixa_pdv_id = v_conta_caixa_id
    and status = 'Aberto'
  order by data_abertura asc nulls last, created_at asc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Nenhum turno aberto para este caixa PDV.');
  end if;

  v_turno_id := v_turno.id;

  select * into v_rasc from public.rascunho_pedido_venda where id = v_rascunho_id for update;
  if not found then
    return jsonb_build_object('error', 'Rascunho não encontrado.');
  end if;

  v_status := coalesce(v_rasc.status, v_rasc.dados->>'status');
  if v_status = 'Convertido' then
    return jsonb_build_object('error', 'Este pedido já foi processado.', 'ja_processado', true);
  end if;
  if v_status = 'Em Processamento' then
    return jsonb_build_object('error', 'Este pedido já está sendo processado.', 'em_processamento', true);
  end if;

  v_numero := 'PV-' || lpad(nextval('public.pedido_venda_numero_seq')::text, 5, '0');

  -- Vale troca → substituto
  select elem into v_pag_vale
  from jsonb_array_elements(v_pagamentos) elem
  where elem->>'forma_pagamento' = 'Vale Troca' and coalesce(elem->>'vale_id', '') <> ''
  limit 1;
  if v_pag_vale is not null and v_substitui_id is null then
    select * into v_vale from public.vale_compra where id = v_pag_vale->>'vale_id';
    if found then
      v_substitui_id := coalesce(v_vale.pedido_origem_id, v_vale.dados->>'pedido_origem_id', null);
      v_substitui_numero := coalesce(v_vale.pedido_origem_numero, v_vale.dados->>'pedido_origem_numero', v_substitui_numero);
    end if;
  end if;

  v_pedido_dados := jsonb_build_object(
    'numero', v_numero,
    'senha_atendimento', coalesce(v_rasc.senha_atendimento, v_rasc.dados->>'senha_atendimento', ''),
    'cliente_id', coalesce(v_rasc.cliente_id, v_rasc.dados->>'cliente_id'),
    'cliente_nome', coalesce(v_rasc.cliente_nome, v_rasc.dados->>'cliente_nome', ''),
    'vendedor_id', coalesce(v_rasc.vendedor_id, v_rasc.dados->>'vendedor_id'),
    'vendedor_nome', coalesce(v_rasc.vendedor_nome, v_rasc.dados->>'vendedor_nome', ''),
    'tabela_preco_id', coalesce(v_rasc.tabela_preco_id, v_rasc.dados->>'tabela_preco_id', ''),
    'tipo', coalesce(v_rasc.tipo, v_rasc.dados->>'tipo', 'Venda'),
    'status', 'Financeiro OK',
    'metodo_entrega', coalesce(v_rasc.metodo_entrega, v_rasc.dados->>'metodo_entrega', ''),
    'turno_caixa_id', v_turno_id,
    'itens', coalesce(v_rasc.itens, v_rasc.dados->'itens', '[]'::jsonb),
    'subtotal', coalesce(v_rasc.subtotal::text, v_rasc.dados->>'subtotal', '0'),
    'valor_desconto', coalesce(v_rasc.valor_desconto::text, v_rasc.dados->>'valor_desconto', '0'),
    'valor_frete', coalesce(v_rasc.valor_frete::text, v_rasc.dados->>'valor_frete', '0'),
    'valor_total', coalesce(v_rasc.valor_total::text, v_rasc.dados->>'valor_total', '0'),
    'pagamentos', v_pagamentos,
    'observacoes', coalesce(v_rasc.observacoes, v_rasc.dados->>'observacoes', '')
  );
  if v_substitui_id is not null then
    v_pedido_dados := v_pedido_dados || jsonb_build_object(
      'substitui_pedido_id', v_substitui_id,
      'substitui_pedido_numero', v_substitui_numero
    );
  end if;

  v_itens_rasc := coalesce(v_pedido_dados->'itens', '[]'::jsonb);

  insert into public.pedido_venda (
    id, numero, cliente_id, cliente_nome, status, total, itens, pagamentos, dados, turno_caixa_id
  ) values (
    v_pedido_id,
    v_numero,
    nullif(v_pedido_dados->>'cliente_id', ''),
    nullif(v_pedido_dados->>'cliente_nome', ''),
    'Financeiro OK',
    coalesce(nullif(v_pedido_dados->>'valor_total', '')::numeric, 0),
    '[]'::jsonb,
    v_pagamentos,
    v_pedido_dados - 'itens',
    v_turno_id
  );

  for v_item in select * from jsonb_array_elements(v_itens_rasc)
  loop
    if nullif(v_item->>'produto_id', '') is null then continue; end if;
    insert into public.pedido_venda_item (
      id,
      pedido_venda_id,
      pedido_venda_numero,
      produto_id,
      produto_nome,
      produto_unidade_id,
      unidade_sigla,
      fator_aplicado,
      quantidade_comercial,
      quantidade_base,
      preco_unitario_fator1,
      preco_unitario_comercial,
      desconto_unitario_fator1,
      preco_final_unitario_fator1,
      total,
      custo_unitario_momento,
      ordem
    ) values (
      v_pedido_id || '_i' || v_ord::text,
      v_pedido_id,
      v_numero,
      v_item->>'produto_id',
      v_item->>'produto_nome',
      nullif(v_item->>'produto_unidade_id', ''),
      coalesce(nullif(v_item->>'unidade_medida', ''), 'UN'),
      coalesce(nullif(v_item->>'fator_conversao', '')::numeric, 1),
      coalesce(nullif(v_item->>'quantidade', '')::numeric, 0),
      coalesce(
        nullif(v_item->>'quantidade_base', '')::numeric,
        coalesce(nullif(v_item->>'quantidade', '')::numeric, 0)
          * coalesce(nullif(v_item->>'fator_conversao', '')::numeric, 1)
      ),
      coalesce(nullif(v_item->>'preco_unitario_praticado', '')::numeric, 0),
      coalesce(nullif(v_item->>'preco_unitario_apresentacao', '')::numeric, 0),
      coalesce(nullif(v_item->>'desconto_unitario', '')::numeric, 0),
      coalesce(nullif(v_item->>'preco_unitario_praticado', '')::numeric, 0)
        - coalesce(nullif(v_item->>'desconto_unitario', '')::numeric, 0),
      coalesce(nullif(v_item->>'total', '')::numeric, 0),
      coalesce(nullif(v_item->>'custo_unitario_momento', '')::numeric, 0),
      v_ord
    );
    v_ord := v_ord + 1;
  end loop;

  update public.rascunho_pedido_venda
    set status = 'Convertido',
        pedido_venda_final_id = v_pedido_id,
        data_conversao = now(),
        dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
          'status', 'Convertido',
          'pedido_venda_final_id', v_pedido_id,
          'data_conversao', now()::text
        )
  where id = v_rascunho_id;

  select * into v_turno from public.turno_caixa where id = v_turno_id;
  if found then
    v_vendas_ids := coalesce(v_turno.vendas_ids, v_turno.dados->'vendas_ids', '[]'::jsonb);
    if jsonb_typeof(v_vendas_ids) <> 'array' then v_vendas_ids := '[]'::jsonb; end if;
    v_vendas_ids := v_vendas_ids || to_jsonb(v_pedido_id);
    update public.turno_caixa
      set vendas_ids = v_vendas_ids,
          dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('vendas_ids', v_vendas_ids)
      where id = v_turno_id;
  else
    v_avisos := v_avisos || to_jsonb('Turno não atualizado: turno inexistente');
  end if;

  for v_item in select * from jsonb_array_elements(v_itens_rasc)
  loop
    v_qtd_base := coalesce(
      nullif(v_item->>'quantidade_base', '')::numeric,
      nullif(v_item->>'quantidade', '')::numeric,
      0
    );
    v_mov_id := gen_random_uuid()::text;
    insert into public.movimentacao_estoque (
      id, produto_id, tipo, quantidade, motivo,
      referencia_tipo, referencia_id, referencia_numero,
      observacoes, usuario_responsavel, custo_unitario, dados
    ) values (
      v_mov_id,
      v_item->>'produto_id',
      'Saída',
      v_qtd_base,
      'Venda',
      'PedidoVenda',
      v_pedido_id,
      v_numero,
      case when coalesce(v_item->>'unidade_medida', '') <> '' then
        format('Venda em %s (%s %s)', v_item->>'unidade_medida', v_item->>'quantidade', v_item->>'unidade_medida')
      else null end,
      v_user_name,
      coalesce(nullif(v_item->>'custo_unitario_momento', '')::numeric, 0),
      jsonb_build_object(
        'produto_id', v_item->>'produto_id',
        'produto_nome', v_item->>'produto_nome',
        'tipo', 'Saída',
        'motivo', 'Venda',
        'quantidade', v_qtd_base,
        'custo_unitario', coalesce(nullif(v_item->>'custo_unitario_momento', '')::numeric, 0),
        'referencia_tipo', 'PedidoVenda',
        'referencia_id', v_pedido_id,
        'referencia_numero', v_numero,
        'cliente_nome', v_pedido_dados->>'cliente_nome',
        'usuario_responsavel', v_user_name
      )
    );
  end loop;

  -- Dinheiro físico → saldo caixa
  select elem into v_pag
  from jsonb_array_elements(v_pagamentos) elem
  where elem->>'forma_pagamento' = 'Dinheiro'
    and coalesce(nullif(elem->>'valor', '')::numeric, 0) > 0
  limit 1;
  if v_pag is not null and coalesce(v_conta_caixa_id, '') <> '' then
    select * into v_conta from public.contas_financeiras where id = v_conta_caixa_id for update;
    if found then
      update public.contas_financeiras
        set saldo_atual = coalesce(saldo_atual, 0) + coalesce(nullif(v_pag->>'valor', '')::numeric, 0),
            dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
              'saldo_atual', coalesce(saldo_atual, 0) + coalesce(nullif(v_pag->>'valor', '')::numeric, 0)
            )
        where id = v_conta_caixa_id;
    end if;
  end if;

  -- Vale troca
  if v_pag_vale is not null then
    select * into v_vale from public.vale_compra where id = v_pag_vale->>'vale_id' for update;
    if found then
      v_novo_saldo_vale := greatest(0, coalesce(v_vale.valor_disponivel, nullif(v_vale.dados->>'valor_disponivel', '')::numeric, 0) - coalesce(nullif(v_pag_vale->>'valor', '')::numeric, 0));
      update public.vale_compra
        set valor_disponivel = v_novo_saldo_vale,
            status = case when v_novo_saldo_vale <= 0.01 then 'Utilizado' else 'Utilizado Parcialmente' end,
            historico_uso = coalesce(v_vale.historico_uso, v_vale.dados->'historico_uso', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
              'data', now()::text,
              'valor_usado', coalesce(nullif(v_pag_vale->>'valor', '')::numeric, 0),
              'pedido_id', v_pedido_id,
              'pedido_numero', v_numero
            )),
            dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
              'valor_disponivel', v_novo_saldo_vale,
              'status', case when v_novo_saldo_vale <= 0.01 then 'Utilizado' else 'Utilizado Parcialmente' end,
              'historico_uso', coalesce(v_vale.historico_uso, v_vale.dados->'historico_uso', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                'data', now()::text,
                'valor_usado', coalesce(nullif(v_pag_vale->>'valor', '')::numeric, 0),
                'pedido_id', v_pedido_id,
                'pedido_numero', v_numero
              ))
            )
      where id = v_pag_vale->>'vale_id';
      if v_novo_saldo_vale > 0.01 then
        v_saldo_residual := jsonb_build_object(
          'codigo', coalesce(v_vale.codigo, v_vale.dados->>'codigo'),
          'saldo', v_novo_saldo_vale,
          'vale_id', v_pag_vale->>'vale_id'
        );
      end if;
    end if;
  end if;

  -- Devolução aguardando substituto
  if v_substitui_id is not null then
    for v_dev in
      select * from public.devolucao_troca
      where coalesce(aguarda_substituto, dados->>'aguarda_substituto', 'false') in ('true', 't', '1')
        and coalesce(pedido_substituto_id, dados->>'pedido_substituto_id', '') = ''
        and coalesce(pedido_origem_id, dados->>'pedido_origem_id', '') = v_substitui_id
    loop
      update public.devolucao_troca
        set pedido_substituto_id = v_pedido_id,
            pedido_substituto_numero = v_numero,
            dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object(
              'pedido_substituto_id', v_pedido_id,
              'pedido_substituto_numero', v_numero
            )
      where id = v_dev.id;
    end loop;
  end if;

  -- Lançamentos financeiros
  for v_pag in select * from jsonb_array_elements(v_pagamentos)
  loop
    if coalesce(nullif(v_pag->>'valor', '')::numeric, 0) <= 0 then continue; end if;
    if v_pag->>'forma_pagamento' = 'Vale Troca' then continue; end if;

    v_is_cartao := v_pag->>'forma_pagamento' in ('Cartão de Débito', 'Cartão de Crédito');
    v_is_fiado := v_pag->>'forma_pagamento' = 'Conta a Pagar';
    v_is_credito := v_pag->>'forma_pagamento' = 'Cartão de Crédito';

    if v_is_fiado then
      perform public._p38_insert_lancamento(jsonb_build_object(
        'tipo', 'Receita',
        'descricao', format('Fiado - Venda %s%s', v_numero, case when coalesce(v_pedido_dados->>'cliente_nome','') <> '' then ' - ' || (v_pedido_dados->>'cliente_nome') else '' end),
        'terceiro_id', v_pedido_dados->>'cliente_id',
        'terceiro_nome', v_pedido_dados->>'cliente_nome',
        'valor', v_pag->>'valor',
        'valor_liquido', v_pag->>'valor',
        'data_vencimento', v_hoje_text,
        'status', 'Em Aberto',
        'status_conciliacao', 'N/A',
        'forma_pagamento', 'Conta a Pagar',
        'forma_pagamento_tipo', 'Boleto',
        'categoria', 'Venda de Produto',
        'tags', jsonb_build_array('FIADO'),
        'conta_financeira_id', v_conta_caixa_id,
        'conta_financeira_nome', 'A Receber',
        'turno_caixa_id', v_turno_id,
        'referencia_id', v_pedido_id,
        'referencia_tipo', 'PedidoVenda',
        'referencia_numero', v_numero
      ));
      continue;
    end if;

    if v_is_cartao then
      v_taxa := coalesce(nullif(v_pag->>'taxa_maquininha', '')::numeric, 0);
      v_valor_bruto := coalesce(nullif(v_pag->>'valor', '')::numeric, 0);
      v_valor_liquido := round(v_valor_bruto * (1 - v_taxa / 100.0), 2);
      v_prazo := coalesce(nullif(v_pag->>'prazo_maquininha_dias', '')::int, 1);
      v_venc := public._p38_add_dias_uteis(v_hoje, v_prazo);

      v_conta_destino_id := coalesce(v_pag->>'maquininha_conta_id', '');
      v_conta_destino_nome := coalesce(v_pag->>'maquininha_conta_nome', v_pag->>'maquininha_nome', 'Maquininha');
      if v_conta_destino_id = '' and coalesce(v_pag->>'maquininha_id', '') <> '' then
        select * into v_maq from public.maquininha where id = v_pag->>'maquininha_id';
        if found then
          v_conta_destino_id := coalesce(v_maq.dados->>'conta_destino_id', '');
          v_conta_destino_nome := coalesce(v_maq.dados->>'conta_destino_nome', v_maq.dados->>'nome', v_conta_destino_nome);
        end if;
      end if;
      if v_conta_destino_id = '' then
        raise exception 'Maquininha "%" sem conta destino.', coalesce(v_pag->>'maquininha_nome', '?');
      end if;

      perform public._p38_insert_lancamento(jsonb_build_object(
        'tipo', 'Receita',
        'descricao', format('%s%s%s - %s - Venda %s',
          v_pag->>'forma_pagamento',
          case when coalesce(v_pag->>'bandeira', '') <> '' then ' ' || (v_pag->>'bandeira') else '' end,
          case when coalesce(nullif(v_pag->>'parcelas', '')::int, 1) > 1 then ' ' || (v_pag->>'parcelas') || 'x' else '' end,
          coalesce(v_pag->>'maquininha_nome', v_pag->>'forma_pagamento'),
          v_numero
        ),
        'terceiro_id', v_pedido_dados->>'cliente_id',
        'terceiro_nome', v_pedido_dados->>'cliente_nome',
        'valor', v_valor_bruto,
        'valor_liquido', v_valor_liquido,
        'data_vencimento', v_venc::text,
        'data_liquidacao_prevista', v_venc::text,
        'status', 'Em Aberto',
        'status_conciliacao', 'Pendente',
        'forma_pagamento', v_pag->>'forma_pagamento',
        'forma_pagamento_tipo', case when v_pag->>'forma_pagamento' = 'Cartão de Débito' then 'Cartão Débito' else 'Cartão Crédito' end,
        'categoria', 'Venda de Produto',
        'tags', jsonb_build_array('CARTAO', case when v_is_credito then 'conta_receber' else null end, v_pag->>'maquininha_nome', v_pag->>'bandeira'),
        'conta_financeira_id', v_conta_destino_id,
        'conta_financeira_nome', v_conta_destino_nome,
        'turno_caixa_id', v_turno_id,
        'referencia_id', v_pedido_id,
        'referencia_tipo', 'PedidoVenda',
        'referencia_numero', v_numero,
        'observacoes', jsonb_build_object(
          'maquininha_id', v_pag->>'maquininha_id',
          'maquininha_nome', v_pag->>'maquininha_nome',
          'bandeira', v_pag->>'bandeira',
          'taxa_pct', v_taxa,
          'parcelas', coalesce(nullif(v_pag->>'parcelas', '')::int, 1),
          'data_venda', v_hoje_text
        )::text
      ));
      continue;
    end if;

    v_conta_destino_id := v_conta_caixa_id;
    v_conta_destino_nome := 'Caixa';
    v_forma_id := null;
    if v_pag->>'forma_pagamento' <> 'Dinheiro' then
      select * into v_forma from public.formas_de_pagamento
      where coalesce(nome, dados->>'nome') = v_pag->>'forma_pagamento'
      limit 1;
      if found then
        v_conta_destino_id := coalesce(v_forma.conta_destino_id, v_forma.dados->>'conta_destino_id', v_conta_destino_id);
        v_conta_destino_nome := coalesce(v_forma.conta_destino_nome, v_forma.dados->>'conta_destino_nome', v_pag->>'forma_pagamento');
        v_forma_id := v_forma.id;
      end if;
    end if;

    perform public._p38_insert_lancamento(jsonb_build_object(
      'tipo', 'Receita',
      'descricao', format('Venda %s%s', v_numero, case when coalesce(v_pedido_dados->>'cliente_nome','') <> '' then ' - ' || (v_pedido_dados->>'cliente_nome') else '' end),
      'terceiro_id', v_pedido_dados->>'cliente_id',
      'terceiro_nome', v_pedido_dados->>'cliente_nome',
      'valor', v_pag->>'valor',
      'valor_liquido', coalesce(v_pag->>'valor_liquido_recebido', v_pag->>'valor'),
      'data_vencimento', v_hoje_text,
      'data_pagamento', v_hoje_text,
      'status', 'Pago',
      'status_conciliacao', case when v_pag->>'forma_pagamento' = 'Dinheiro' then 'N/A' else 'Pendente' end,
      'forma_pagamento', v_pag->>'forma_pagamento',
      'forma_pagamento_id', v_forma_id,
      'forma_pagamento_tipo', v_pag->>'forma_pagamento',
      'categoria', 'Venda de Produto',
      'conta_financeira_id', v_conta_destino_id,
      'conta_financeira_nome', v_conta_destino_nome,
      'turno_caixa_id', v_turno_id,
      'referencia_id', v_pedido_id,
      'referencia_tipo', 'PedidoVenda',
      'referencia_numero', v_numero
    ));
  end loop;

  if coalesce(v_config_venda->>'fluxo_venda_padrao', '') = 'Completo' then
    begin
      insert into public.ordem_separacao (id, pedido_venda_id, dados)
      values (
        gen_random_uuid()::text,
        v_pedido_id,
        jsonb_build_object(
          'pedido_venda_id', v_pedido_id,
          'pedido_numero', v_numero,
          'status', 'Pendente',
          'itens', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'produto_id', it->>'produto_id',
              'produto_nome', it->>'produto_nome',
              'quantidade_solicitada', coalesce(nullif(it->>'quantidade_base', '')::numeric, nullif(it->>'quantidade', '')::numeric, 0),
              'quantidade_separada', 0,
              'observacao', case when coalesce(it->>'unidade_medida', '') <> '' then (it->>'quantidade') || ' ' || (it->>'unidade_medida') else null end
            )), '[]'::jsonb)
            from jsonb_array_elements(coalesce(v_pedido_dados->'itens', '[]'::jsonb)) it
          )
        )
      );
    exception when others then
      v_avisos := v_avisos || to_jsonb('Ordem de separação: ' || sqlerrm);
    end;
  end if;

  v_pedido_json := v_pedido_dados || jsonb_build_object('id', v_pedido_id, 'created_at', now()::text);

  return jsonb_build_object(
    'success', true,
    'pedido_venda', v_pedido_json,
    'numero', v_numero,
    'saldo_residual_vale', v_saldo_residual,
    'avisos', case when jsonb_array_length(v_avisos) > 0 then v_avisos else null end
  );
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function public.processar_venda_caixa(jsonb) from public, anon, authenticated;
grant execute on function public.processar_venda_caixa(jsonb) to service_role;
