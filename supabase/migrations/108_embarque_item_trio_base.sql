-- =============================================================================
-- 108 — embarque_item: trio pedido (comercial + fator + base) — despacho/recepção
-- =============================================================================
-- Mesma metodologia de pedido_compra_item: gravação normalizada; SQL lê colunas.
-- Backfill legado + trigger na gravação; views preferem colunas a JSON.
-- =============================================================================

alter table public.embarque_item
  add column if not exists produto_unidade_id text,
  add column if not exists fator_aplicado numeric(18, 6) default 1,
  add column if not exists quantidade_pedida_base numeric(18, 6) default 0,
  add column if not exists quantidade_embarcada_base numeric(18, 6) default 0,
  add column if not exists quantidade_recebida_base numeric(18, 6) default 0;

comment on column public.embarque_item.fator_aplicado is
  'Fator CX→base na linha (espelho pedido_compra_item.fator_aplicado).';
comment on column public.embarque_item.quantidade_embarcada_base is
  'Despachado em unidade base — fonte canónica para folha 4 colunas.';
comment on column public.embarque_item.quantidade_recebida_base is
  'Recepcionado em unidade base — fonte canónica para folha 4 colunas.';

-- Backfill: liga PCI, resolve fator do pedido, preenche bases (comercial × fator)
with src as (
  select
    ei.id,
    coalesce(
      ei.pedido_compra_item_id,
      (
        select pci.id
        from public.pedido_compra_item pci
        where pci.pedido_compra_id = ei.pedido_compra_id
          and pci.produto_id = ei.produto_id
        order by pci.ordem
        limit 1
      )
    ) as pci_id,
    coalesce(
      nullif((ei.dados->>'fator_aplicado')::numeric, 0),
      nullif((ei.dados->>'fator_apresentacao')::numeric, 0),
      nullif((ei.dados->>'fator_conversao')::numeric, 0),
      (
        select nullif(pci.fator_aplicado, 0)
        from public.pedido_compra_item pci
        where pci.pedido_compra_id = ei.pedido_compra_id
          and pci.produto_id = ei.produto_id
        order by
          case when ei.pedido_compra_item_id is not null and pci.id = ei.pedido_compra_item_id then 0 else 1 end,
          pci.ordem
        limit 1
      ),
      nullif(ei.fator_aplicado, 0),
      1::numeric
    ) as fator_resolvido
  from public.embarque_item ei
)
update public.embarque_item ei
set
  pedido_compra_item_id = src.pci_id,
  fator_aplicado = src.fator_resolvido,
  quantidade_pedida_base = public._p38_round_qty(
    coalesce(
      nullif(ei.quantidade_pedida_base, 0),
      nullif((ei.dados->>'quantidade_pedida_base')::numeric, 0),
      coalesce(ei.quantidade_pedida_comercial, 0) * src.fator_resolvido
    )
  ),
  quantidade_embarcada_base = public._p38_round_qty(
    coalesce(
      nullif(ei.quantidade_embarcada_base, 0),
      nullif((ei.dados->>'quantidade_embarcada_base')::numeric, 0),
      coalesce(ei.quantidade_embarcada_comercial, 0) * src.fator_resolvido
    )
  ),
  quantidade_recebida_base = public._p38_round_qty(
    coalesce(
      nullif(ei.quantidade_recebida_base, 0),
      nullif((ei.dados->>'quantidade_recebida_base')::numeric, 0),
      coalesce(ei.quantidade_recebida_comercial, 0) * src.fator_resolvido
    )
  )
from src
where ei.id = src.id;

create or replace function public.p38_embarque_item_resolve_fator(
  p_fator_col numeric,
  p_pedido_compra_id text,
  p_produto_id text,
  p_pedido_compra_item_id text,
  p_ei_dados jsonb default '{}'::jsonb
)
returns numeric
language sql
stable
as $$
  select coalesce(
    nullif(p_fator_col, 0),
    public.p38_pci_fator_para_embarque_item(
      p_pedido_compra_id, p_produto_id, p_pedido_compra_item_id, p_ei_dados
    )
  );
$$;

create or replace function public.p38_embarque_item_qty_base_col(
  p_col_base numeric,
  p_comercial numeric,
  p_ei_dados jsonb,
  p_campo_base text,
  p_fator numeric
)
returns numeric
language sql
immutable
as $$
  select public._p38_round_qty(
    coalesce(
      nullif(p_col_base, 0),
      nullif((p_ei_dados->>p_campo_base)::numeric, 0),
      public.compra_para_base(coalesce(p_comercial, 0), coalesce(nullif(p_fator, 0), 1))
    )
  );
$$;

comment on function public.p38_embarque_item_qty_base_col(numeric, numeric, jsonb, text, numeric) is
  'Quantidade base: coluna SQL → dados JSONB → comercial × fator.';

grant execute on function public.p38_embarque_item_resolve_fator(numeric, text, text, text, jsonb)
  to authenticated, anon, service_role;
grant execute on function public.p38_embarque_item_qty_base_col(numeric, numeric, jsonb, text, numeric)
  to authenticated, anon, service_role;

-- Normalização na gravação (sync/replica que só manda comercial)
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

drop trigger if exists trg_embarque_item_normalize on public.embarque_item;
create trigger trg_embarque_item_normalize
  before insert or update on public.embarque_item
  for each row execute function public.p38_embarque_item_biu_normalize();
drop view if exists public.pedido_compra_status_logistica_v;
drop view if exists public.pedido_compra_card_logistica_v;
drop view if exists public.pedido_compra_saldo_resumo_v;
drop view if exists public.pedido_compra_saldo_a_embarcar_v;

create view public.pedido_compra_saldo_a_embarcar_v as
with embarque_codigo as (
  select
    e.id as embarque_id,
    e.pedido_compra_id,
    e.tipo,
    e.status,
    e.status_recebimento,
    coalesce(
      nullif(trim(e.dados->>'codigo_exibicao'), ''),
      nullif(trim(pc.numero || '-' || e.numero), ''),
      e.numero
    ) as codigo_exibicao
  from public.embarque e
  join public.pedido_compra pc on pc.id = e.pedido_compra_id
),
linhas_embarque as (
  select
    ec.pedido_compra_id,
    ec.embarque_id,
    ec.codigo_exibicao,
    ec.tipo as embarque_tipo,
    ec.status as embarque_status,
    ec.status_recebimento,
    ei.produto_id,
    ei.pedido_compra_item_id,
    public.p38_embarque_item_qty_base_col(
      ei.quantidade_embarcada_base,
      ei.quantidade_embarcada_comercial,
      ei.dados,
      'quantidade_embarcada_base',
      public.p38_embarque_item_resolve_fator(
        ei.fator_aplicado,
        ec.pedido_compra_id,
        ei.produto_id,
        ei.pedido_compra_item_id,
        ei.dados
      )
    ) as qtd_embarcada_base,
    public.p38_embarque_item_qty_base_col(
      ei.quantidade_recebida_base,
      ei.quantidade_recebida_comercial,
      ei.dados,
      'quantidade_recebida_base',
      public.p38_embarque_item_resolve_fator(
        ei.fator_aplicado,
        ec.pedido_compra_id,
        ei.produto_id,
        ei.pedido_compra_item_id,
        ei.dados
      )
    ) as qtd_recebida_base,
    coalesce(
      nullif(trim(ei.unidade_sigla), ''),
      ei.dados->>'unidade_medida',
      'UN'
    ) as unidade_sigla,
    (ec.tipo is distinct from 'Necessidade') as embarque_real
  from embarque_codigo ec
  join public.embarque_item ei on ei.embarque_id = ec.embarque_id
),
fator_por_produto as (
  select distinct on (pci.pedido_compra_id, pci.produto_id)
    pci.pedido_compra_id,
    pci.produto_id,
    case
      when coalesce(ef.fator_embarque_max, 0) > coalesce(nullif(pci.fator_aplicado, 0), 1)
        then ef.fator_embarque_max
      else coalesce(nullif(pci.fator_aplicado, 0), 1)
    end as fator_vitrine,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade_vitrine_sigla
  from public.pedido_compra_item pci
  left join lateral (
    select max(
      coalesce(
        nullif(ei.fator_aplicado, 0),
        public.p38_pci_fator_para_embarque_item(
          pci.pedido_compra_id, ei.produto_id, ei.pedido_compra_item_id, ei.dados
        )
      )
    ) as fator_embarque_max
    from public.embarque_item ei
    join public.embarque e on e.id = ei.embarque_id
    where e.pedido_compra_id = pci.pedido_compra_id
      and ei.produto_id = pci.produto_id
      and coalesce(e.tipo, 'Embarque') is distinct from 'Necessidade'
  ) ef on true
  order by pci.pedido_compra_id, pci.produto_id, pci.ordem
),
totais_reais as (
  select
    le.pedido_compra_id,
    le.produto_id,
    public._p38_round_qty(sum(le.qtd_embarcada_base)) as quantidade_embarcada_real_base,
    public._p38_round_qty(sum(le.qtd_recebida_base)) as quantidade_recebida_real_base,
    public._p38_round_qty(
      sum(greatest(le.qtd_embarcada_base - le.qtd_recebida_base, 0))
    ) as quantidade_em_transito_base
  from linhas_embarque le
  where le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
totais_necessidade as (
  select
    le.pedido_compra_id,
    le.produto_id,
    public._p38_round_qty(sum(greatest(le.qtd_embarcada_base, 0))) as saldo_pos_recepcao_base
  from linhas_embarque le
  where not le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
calc as (
  select
    pc.id as pedido_compra_id,
    coalesce(pc.numero, pc.dados->>'numero') as pedido_compra_numero,
    pc.fornecedor_nome,
    pc.fornecedor_id,
    pc.status as pedido_status,
    pc.status_aprovacao_financeira,
    pc.status_embarque,
    pci.id as pedido_item_id,
    pci.produto_id,
    coalesce(nullif(trim(pci.produto_nome), ''), pci.dados->>'produto_nome') as produto_nome,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade_sigla,
    coalesce(pci.quantidade_comercial, 0) as quantidade_pedida_comercial,
    coalesce(pci.quantidade_base, 0) as quantidade_pedida_base,
    coalesce(fp.fator_vitrine, nullif(pci.fator_aplicado, 0), 1) as fator_vitrine,
    coalesce(fp.unidade_vitrine_sigla, pci.unidade_sigla, 'UN') as unidade_vitrine_sigla,
    coalesce(tr.quantidade_embarcada_real_base, 0) as quantidade_embarcada_real_base,
    coalesce(tr.quantidade_recebida_real_base, 0) as quantidade_recebida_real_base,
    coalesce(tr.quantidade_em_transito_base, 0) as quantidade_em_transito_base,
    coalesce(tn.saldo_pos_recepcao_base, 0) as saldo_pos_recepcao_base,
    public._p38_round_qty(
      greatest(
        coalesce(pci.quantidade_base, 0) - coalesce(tr.quantidade_embarcada_real_base, 0),
        0
      )
    ) as saldo_nunca_embarcado_base,
    public._p38_round_qty(
      greatest(
        coalesce(pci.quantidade_base, 0)
        - coalesce(tr.quantidade_recebida_real_base, 0)
        - coalesce(tr.quantidade_em_transito_base, 0),
        0
      )
    ) as falta_operacional_base,
    coalesce(pci.total, 0) as valor_linha_pedido,
    pci.ordem as pedido_item_ordem,
    pc.created_at as pedido_created_at,
    pc.updated_at as pedido_updated_at
  from public.pedido_compra_item pci
  join public.pedido_compra pc on pc.id = pci.pedido_compra_id
  left join fator_por_produto fp
    on fp.pedido_compra_id = pci.pedido_compra_id
   and fp.produto_id = pci.produto_id
  left join totais_reais tr
    on tr.pedido_compra_id = pci.pedido_compra_id
   and tr.produto_id = pci.produto_id
  left join totais_necessidade tn
    on tn.pedido_compra_id = pci.pedido_compra_id
   and tn.produto_id = pci.produto_id
)
select
  c.*,
  public.compra_para_exibicao(c.quantidade_embarcada_real_base, c.fator_vitrine) as quantidade_embarcada_real,
  public.compra_para_exibicao(c.quantidade_recebida_real_base, c.fator_vitrine) as quantidade_recebida_real,
  public.compra_para_exibicao(c.quantidade_em_transito_base, c.fator_vitrine) as quantidade_em_transito,
  public.compra_para_exibicao(c.saldo_nunca_embarcado_base, c.fator_vitrine) as saldo_nunca_embarcado,
  public.compra_para_exibicao(c.saldo_pos_recepcao_base, c.fator_vitrine) as saldo_pos_recepcao,
  public.compra_para_exibicao(c.falta_operacional_base, c.fator_vitrine) as falta_operacional,
  public.compra_para_exibicao(c.falta_operacional_base, c.fator_vitrine) as falta_operacional_vitrine,
  case
    when c.falta_operacional_base > 0.009 then 'FALTA_EMBARCAR'
    when c.quantidade_em_transito_base > 0.009 then 'EM_TRANSITO'
    when c.quantidade_pedida_base - c.quantidade_recebida_real_base <= 0.009 then 'OK'
    else 'REVISAR'
  end as diagnostico
from calc c;

comment on view public.pedido_compra_saldo_a_embarcar_v is
  'Saldo a embarcar. Base em colunas embarque_item (108); vitrine na leitura.';

create view public.pedido_compra_saldo_resumo_v as
select
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  status_aprovacao_financeira,
  status_embarque,
  count(*) filter (where falta_operacional_base > 0.009) as linhas_com_falta,
  count(*) filter (
    where quantidade_em_transito_base > 0.009 and falta_operacional_base <= 0.009
  ) as linhas_so_em_transito,
  round(coalesce(sum(falta_operacional), 0)::numeric, 6) as soma_falta_operacional,
  round(coalesce(sum(quantidade_em_transito), 0)::numeric, 6) as soma_em_transito,
  round(coalesce(sum(saldo_pos_recepcao), 0)::numeric, 6) as soma_saldo_pos_recepcao,
  round(coalesce(sum(falta_operacional_base), 0)::numeric, 6) as soma_falta_operacional_base,
  round(coalesce(sum(valor_linha_pedido), 0)::numeric, 2) as valor_total_pedido,
  pedido_created_at,
  pedido_updated_at
from public.pedido_compra_saldo_a_embarcar_v
group by
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  status_aprovacao_financeira,
  status_embarque,
  pedido_created_at,
  pedido_updated_at;

-- Cards / status (105) — dependem da view corrigida
create view public.pedido_compra_card_logistica_v as
with cards_desmembramento as (
  select
    'desmembramento'::text as card_tipo,
    d.id as card_id,
    d.pedido_compra_id,
    coalesce(d.pedido_compra_numero, pc.numero, pc.dados->>'numero') as pedido_compra_numero,
    pc.fornecedor_nome,
    pc.fornecedor_id,
    d.codigo as titulo,
    d.status,
    d.embarque_id,
    d.sequencia,
    count(di.id) as linhas,
    round(coalesce(sum(di.em_transito_base), 0)::numeric, 6) as soma_em_transito_base,
    round(coalesce(sum(di.saldo_pendente_base), 0)::numeric, 6) as soma_saldo_pendente_base,
    case
      when coalesce(sum(di.em_transito_base), 0) > 0.009 then 'Despachado'
      when coalesce(sum(di.saldo_pendente_base), 0) > 0.009 then 'Pendente'
      else 'Recebido'
    end as card_status,
    'citrus'::text as card_paleta,
    d.created_at,
    d.updated_at
  from public.pedido_compra_desmembramento d
  join public.pedido_compra pc on pc.id = d.pedido_compra_id
  left join public.pedido_compra_desmembramento_item di on di.desmembramento_id = d.id
  group by
    d.id, d.pedido_compra_id, d.pedido_compra_numero, pc.numero, pc.dados,
    pc.fornecedor_nome, pc.fornecedor_id, d.codigo, d.status, d.embarque_id,
    d.sequencia, d.created_at, d.updated_at
  having coalesce(sum(di.em_transito_base), 0) > 0.009
),
cards_saldo as (
  select
    'saldo'::text as card_tipo,
    ('saldo-' || v.pedido_compra_id || '-' || v.pedido_item_id) as card_id,
    v.pedido_compra_id,
    v.pedido_compra_numero,
    v.fornecedor_nome,
    v.fornecedor_id,
    coalesce(v.pedido_compra_numero, v.pedido_compra_id) || ' · saldo' as titulo,
    'Saldo a embarcar'::text as status,
    null::text as embarque_id,
    null::integer as sequencia,
    1 as linhas,
    v.quantidade_em_transito_base as soma_em_transito_base,
    v.falta_operacional_base as soma_saldo_pendente_base,
    'Saldo a embarcar'::text as card_status,
    'vermelho'::text as card_paleta,
    v.pedido_created_at as created_at,
    v.pedido_updated_at as updated_at
  from public.pedido_compra_saldo_a_embarcar_v v
  where v.falta_operacional_base > 0.009
    and v.pedido_status is distinct from 'Concluído'
    and public.p38_pedido_desmembramento_iniciado(v.pedido_compra_id)
)
select * from cards_desmembramento
union all
select * from cards_saldo;

create view public.pedido_compra_status_logistica_v as
with agg as (
  select
    pedido_compra_id,
    max(pedido_compra_numero) as pedido_compra_numero,
    max(fornecedor_nome) as fornecedor_nome,
    count(*) filter (where linha_tipo = 'pedido') as linhas_pedido,
    count(*) filter (where linha_tipo = 'desmembramento') as linhas_desmembramento,
    round(coalesce(sum(saldo_pendente_base) filter (where linha_tipo = 'pedido'), 0)::numeric, 6) as saldo_pedido_base,
    round(coalesce(sum(em_transito_base) filter (where linha_tipo = 'desmembramento'), 0)::numeric, 6) as transito_base,
    round(coalesce(sum(saldo_pendente_base) filter (where linha_tipo = 'desmembramento'), 0)::numeric, 6) as saldo_desmembramento_base,
    round(coalesce(sum(recebida_base) filter (where linha_tipo = 'desmembramento'), 0)::numeric, 6) as recebida_base
  from public.pedido_compra_folha_v
  group by pedido_compra_id
),
legacy as (
  select
    pedido_compra_id,
    round(coalesce(sum(falta_operacional), 0)::numeric, 6) as falta_legacy,
    round(coalesce(sum(quantidade_em_transito), 0)::numeric, 6) as transito_legacy,
    round(
      coalesce(sum(falta_operacional_base) filter (
        where public.p38_pedido_desmembramento_iniciado(pedido_compra_id)
      ), 0)::numeric,
      6
    ) as falta_legacy_card_base
  from public.pedido_compra_saldo_a_embarcar_v
  group by pedido_compra_id
)
select
  pc.id as pedido_compra_id,
  coalesce(pc.numero, pc.dados->>'numero') as pedido_compra_numero,
  pc.fornecedor_nome,
  pc.fornecedor_id,
  pc.status as pedido_status,
  pc.status_embarque,
  pc.status_aprovacao_financeira,
  coalesce(a.linhas_desmembramento, 0) as linhas_desmembramento,
  public.p38_pedido_desmembramento_iniciado(pc.id) as desmembramento_iniciado,
  case
    when coalesce(l.falta_legacy_card_base, 0) > 0.009 then 'Saldo a embarcar'
    when coalesce(a.linhas_desmembramento, 0) > 0 then
      case
        when coalesce(a.transito_base, 0) > 0.009 and coalesce(a.saldo_desmembramento_base, 0) <= 0.009
          then 'Em trânsito'
        when coalesce(a.recebida_base, 0) > 0.009
          then 'Parcialmente recebido'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
    else
      case
        when coalesce(l.transito_legacy, 0) > 0.009 then 'Em trânsito'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
  end as status_embarque_calc,
  case
    when coalesce(a.recebida_base, 0) > 0.009
      and coalesce(l.falta_legacy_card_base, 0) <= 0.009
      then 'Recebido'
    when coalesce(a.recebida_base, 0) > 0.009 then 'Parcial'
    else coalesce(nullif(trim(pc.status_recebimento_geral), ''), 'Pendente')
  end as status_recebimento_geral,
  case
    when coalesce(l.falta_legacy_card_base, 0) > 0.009 then 'FALTA_EMBARCAR'
    when coalesce(a.linhas_desmembramento, 0) > 0 and coalesce(a.transito_base, 0) > 0.009 then 'EM_TRANSITO'
    when coalesce(l.transito_legacy, 0) > 0.009 then 'EM_TRANSITO'
    else 'OK'
  end as diagnostico,
  public.p38_pedido_usa_folha_desmembramento(pc.id) as usa_folha_v2,
  pc.created_at,
  pc.updated_at
from public.pedido_compra pc
left join agg a on a.pedido_compra_id = pc.id
left join legacy l on l.pedido_compra_id = pc.id;

grant select on public.pedido_compra_saldo_a_embarcar_v to authenticated, anon, service_role;
grant select on public.pedido_compra_saldo_resumo_v to authenticated, anon, service_role;
grant select on public.pedido_compra_card_logistica_v to authenticated, anon, service_role;
grant select on public.pedido_compra_status_logistica_v to authenticated, anon, service_role;
