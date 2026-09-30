-- =============================================================================
-- 113 — embarque_item: fator/unidade da ação (despacho/recepção) vence pedido M²
-- =============================================================================
-- Quando unidade_sigla da linha ≠ PCI (ex. CX no embarque, M2 no pedido),
-- não forçar fator_aplicado do pedido nem sobrescrever unidade_sigla.

create or replace function public.p38_embarque_item_biu_normalize()
returns trigger
language plpgsql
as $$
declare
  v_pci public.pedido_compra_item%rowtype;
  v_fator numeric;
  v_un_pci text;
  v_un_new text;
  v_acao_diferente boolean;
begin
  if new.pedido_compra_id is not null and new.produto_id is not null then
    if new.pedido_compra_item_id is not null then
      select * into v_pci from public.pedido_compra_item where id = new.pedido_compra_item_id;
    end if;
    if v_pci.id is null then
      select * into v_pci
      from public.pedido_compra_item pci
      where pci.pedido_compra_id = new.pedido_compra_id
        and pci.produto_id = new.produto_id
      order by pci.ordem
      limit 1;
      if found then
        new.pedido_compra_item_id := v_pci.id;
      end if;
    end if;
  end if;

  v_un_pci := upper(trim(coalesce(v_pci.unidade_sigla, '')));
  v_un_new := upper(trim(coalesce(new.unidade_sigla, '')));
  v_acao_diferente := v_un_new <> '' and v_un_pci <> '' and v_un_new <> v_un_pci;

  v_fator := case
    when v_acao_diferente and coalesce(nullif(new.fator_aplicado, 0), 0) > 0 then new.fator_aplicado
    when coalesce(nullif(new.fator_aplicado, 0), 0) > 1.001 then new.fator_aplicado
    else coalesce(
      nullif(v_pci.fator_aplicado, 0),
      nullif((new.dados->>'fator_aplicado')::numeric, 0),
      nullif((new.dados->>'fator_apresentacao')::numeric, 0),
      nullif(new.fator_aplicado, 0),
      1::numeric
    )
  end;
  new.fator_aplicado := v_fator;

  if coalesce(new.quantidade_pedida_comercial, 0) > 0 then
    new.quantidade_pedida_base := public._p38_round_qty(
      coalesce(
        nullif(v_pci.quantidade_base, 0),
        new.quantidade_pedida_comercial * coalesce(nullif(v_pci.fator_aplicado, 0), 1)
      )
    );
  end if;
  if coalesce(new.quantidade_embarcada_comercial, 0) > 0 then
    new.quantidade_embarcada_base := public._p38_round_qty(new.quantidade_embarcada_comercial * v_fator);
  end if;
  if coalesce(new.quantidade_recebida_comercial, 0) > 0 then
    new.quantidade_recebida_base := public._p38_round_qty(new.quantidade_recebida_comercial * v_fator);
  end if;

  if v_pci.id is not null and not v_acao_diferente then
    new.unidade_sigla := coalesce(
      nullif(trim(new.unidade_sigla), ''),
      nullif(trim(v_pci.unidade_sigla), ''),
      new.unidade_sigla
    );
  elsif nullif(trim(new.unidade_sigla), '') is null and v_pci.id is not null then
    new.unidade_sigla := v_pci.unidade_sigla;
  end if;

  return new;
end;
$$;
