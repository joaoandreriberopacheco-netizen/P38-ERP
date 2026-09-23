-- =============================================================================
-- 109 — Corrigir backfill 108: fator default 1 não pode vencer fator do pedido
-- =============================================================================

-- Recalcular fator e bases a partir do pedido_compra_item (fonte canónica)
update public.embarque_item ei
set
  fator_aplicado = pci.fator_aplicado,
  quantidade_pedida_base = public._p38_round_qty(
    coalesce(ei.quantidade_pedida_comercial, 0) * coalesce(nullif(pci.fator_aplicado, 0), 1)
  ),
  quantidade_embarcada_base = public._p38_round_qty(
    coalesce(ei.quantidade_embarcada_comercial, 0) * coalesce(nullif(pci.fator_aplicado, 0), 1)
  ),
  quantidade_recebida_base = public._p38_round_qty(
    coalesce(ei.quantidade_recebida_comercial, 0) * coalesce(nullif(pci.fator_aplicado, 0), 1)
  )
from public.pedido_compra_item pci
where ei.pedido_compra_item_id = pci.id
  and coalesce(nullif(pci.fator_aplicado, 0), 1) > 1.001;

-- Linhas ainda sem PCI link: produto_id + pedido
update public.embarque_item ei
set
  pedido_compra_item_id = pci.id,
  fator_aplicado = pci.fator_aplicado,
  quantidade_pedida_base = public._p38_round_qty(
    coalesce(ei.quantidade_pedida_comercial, 0) * coalesce(nullif(pci.fator_aplicado, 0), 1)
  ),
  quantidade_embarcada_base = public._p38_round_qty(
    coalesce(ei.quantidade_embarcada_comercial, 0) * coalesce(nullif(pci.fator_aplicado, 0), 1)
  ),
  quantidade_recebida_base = public._p38_round_qty(
    coalesce(ei.quantidade_recebida_comercial, 0) * coalesce(nullif(pci.fator_aplicado, 0), 1)
  )
from public.pedido_compra_item pci
where ei.pedido_compra_item_id is null
  and ei.pedido_compra_id = pci.pedido_compra_id
  and ei.produto_id = pci.produto_id
  and coalesce(nullif(pci.fator_aplicado, 0), 1) > 1.001;

create or replace function public.p38_embarque_item_biu_normalize()
returns trigger
language plpgsql
as $$
declare
  v_pci public.pedido_compra_item%rowtype;
  v_fator numeric;
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

  -- Pedido vence default 1 da coluna nova
  v_fator := coalesce(
    nullif(v_pci.fator_aplicado, 0),
    nullif((new.dados->>'fator_aplicado')::numeric, 0),
    nullif((new.dados->>'fator_apresentacao')::numeric, 0),
    nullif(new.fator_aplicado, 0),
    1::numeric
  );
  new.fator_aplicado := v_fator;

  if coalesce(new.quantidade_pedida_comercial, 0) > 0 then
    new.quantidade_pedida_base := public._p38_round_qty(new.quantidade_pedida_comercial * v_fator);
  end if;
  if coalesce(new.quantidade_embarcada_comercial, 0) > 0 then
    new.quantidade_embarcada_base := public._p38_round_qty(new.quantidade_embarcada_comercial * v_fator);
  end if;
  if coalesce(new.quantidade_recebida_comercial, 0) > 0 then
    new.quantidade_recebida_base := public._p38_round_qty(new.quantidade_recebida_comercial * v_fator);
  end if;

  if v_pci.id is not null then
    new.unidade_sigla := coalesce(
      nullif(trim(new.unidade_sigla), ''),
      nullif(trim(v_pci.unidade_sigla), ''),
      new.unidade_sigla
    );
  end if;

  return new;
end;
$$;
