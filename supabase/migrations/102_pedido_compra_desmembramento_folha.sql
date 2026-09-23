-- =============================================================================
-- 102 — Desmembramento + folha 4 colunas (base canónica + vitrine na view)
-- =============================================================================
-- Modelo (João André, set/2026):
--   Comprada      = quantidade fixa (pedido_compra_item.quantidade_base ou split)
--   Despachada    = acumulado informado no despacho (em trânsito = despachada − recebida)
--   Recepcionada  = acumulado na recepção
--   Saldo pendente = comprada − recepcionada − em_trânsito
--
-- Convive com views 094/098 (legacy). UI/RPCs novos entram após data de corte;
-- histórico (movimentacao_estoque, recepções passadas) não é reprocessado.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tradução unidades (SQL grava só base; vitrine na leitura)
-- ---------------------------------------------------------------------------
create or replace function public.compra_para_base(
  p_qty numeric,
  p_fator numeric default 1
)
returns numeric
language sql
immutable
as $$
  select public._p38_round_qty(
    coalesce(p_qty, 0) * coalesce(nullif(p_fator, 0), 1)
  );
$$;

comment on function public.compra_para_base(numeric, numeric) is
  'Converte quantidade comercial → base (× fator).';

create or replace function public.compra_para_exibicao(
  p_qty_base numeric,
  p_fator numeric default 1
)
returns numeric
language sql
immutable
as $$
  select public._p38_round_qty(
    case
      when coalesce(nullif(p_fator, 0), 1) > 0
        then coalesce(p_qty_base, 0) / coalesce(nullif(p_fator, 0), 1)
      else coalesce(p_qty_base, 0)
    end
  );
$$;

comment on function public.compra_para_exibicao(numeric, numeric) is
  'Converte quantidade base → unidade vitrine/comercial (÷ fator).';

create or replace function public.p38_desmembramento_folha_cutover()
returns timestamptz
language sql
immutable
as $$
  select timestamptz '2026-09-23 00:00:00+00';
$$;

comment on function public.p38_desmembramento_folha_cutover() is
  'Pedidos com created_at >= cutover (ou flag dados.desmembramento_folha_v2) usam RPCs novos.';

create or replace function public.p38_pedido_usa_folha_desmembramento(p_pedido_id text)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select
        (pc.created_at >= public.p38_desmembramento_folha_cutover())
        or coalesce((pc.dados->>'desmembramento_folha_v2')::boolean, false)
      from public.pedido_compra pc
      where pc.id = p_pedido_id
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.pedido_compra_desmembramento (
  id text primary key,
  pedido_compra_id text not null references public.pedido_compra (id) on delete cascade,
  pedido_compra_numero text,
  sequencia integer not null default 1,
  codigo text not null,
  status text not null default 'Pendente',
  embarque_id text references public.embarque (id) on delete set null,
  origem text not null default 'manual',
  observacoes text,
  dados jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pedido_compra_id, sequencia)
);

create index if not exists idx_pcd_pedido on public.pedido_compra_desmembramento (pedido_compra_id);
create index if not exists idx_pcd_embarque on public.pedido_compra_desmembramento (embarque_id);

comment on table public.pedido_compra_desmembramento is
  'Cabeçalho de desmembramento (corte logístico). Card informativo; embarque_id opcional.';

create table if not exists public.pedido_compra_desmembramento_item (
  id text primary key,
  desmembramento_id text not null references public.pedido_compra_desmembramento (id) on delete cascade,
  pedido_compra_id text not null,
  pedido_compra_item_id text references public.pedido_compra_item (id) on delete set null,
  produto_id text,
  produto_nome text,
  unidade_vitrine_sigla text default 'UN',
  fator_vitrine numeric(18, 6) not null default 1,
  quantidade_comprada_base numeric(18, 6) not null default 0,
  quantidade_despachada_base numeric(18, 6) not null default 0,
  quantidade_recebida_base numeric(18, 6) not null default 0,
  em_transito_base numeric(18, 6) generated always as (
    public._p38_round_qty(
      greatest(
        coalesce(quantidade_despachada_base, 0) - coalesce(quantidade_recebida_base, 0),
        0
      )
    )
  ) stored,
  saldo_pendente_base numeric(18, 6) generated always as (
    public._p38_round_qty(
      greatest(
        coalesce(quantidade_comprada_base, 0)
        - coalesce(quantidade_recebida_base, 0)
        - greatest(
            coalesce(quantidade_despachada_base, 0) - coalesce(quantidade_recebida_base, 0),
            0
          ),
        0
      )
    )
  ) stored,
  ordem integer not null default 0,
  observacoes text,
  dados jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pcdi_desmembramento on public.pedido_compra_desmembramento_item (desmembramento_id);
create index if not exists idx_pcdi_pedido on public.pedido_compra_desmembramento_item (pedido_compra_id);
create index if not exists idx_pcdi_pedido_item on public.pedido_compra_desmembramento_item (pedido_compra_item_id);
create index if not exists idx_pcdi_produto on public.pedido_compra_desmembramento_item (produto_id);

comment on table public.pedido_compra_desmembramento_item is
  'Linha de desmembramento: quantidades só em base; em_trânsito e saldo_pendente gerados.';

alter table public.pedido_compra_desmembramento disable row level security;
alter table public.pedido_compra_desmembramento_item disable row level security;

-- ---------------------------------------------------------------------------
-- Folha 4 colunas — pedido + desmembramentos (com fallback legacy em base)
-- ---------------------------------------------------------------------------
create or replace view public.pedido_compra_folha_v as
with pedidos_com_desmembramento as (
  select distinct pedido_compra_id
  from public.pedido_compra_desmembramento
),
legacy_por_item as (
  select
    pci.id as pedido_item_id,
    pci.pedido_compra_id,
    pci.produto_id,
    coalesce(pci.quantidade_base, 0) as comprada_base,
    public._p38_round_qty(
      sum(
        public.compra_para_base(
          coalesce(ei.quantidade_embarcada_comercial, 0),
          coalesce(nullif(pci.fator_aplicado, 0), 1)
        )
      )
    ) as despachada_base,
    public._p38_round_qty(
      sum(
        public.compra_para_base(
          coalesce(ei.quantidade_recebida_comercial, 0),
          coalesce(nullif(pci.fator_aplicado, 0), 1)
        )
      )
    ) as recebida_base
  from public.pedido_compra_item pci
  left join public.embarque_item ei on ei.pedido_compra_item_id = pci.id
  left join public.embarque e on e.id = ei.embarque_id and e.tipo is distinct from 'Necessidade'
  where not exists (
    select 1 from pedidos_com_desmembramento pcd where pcd.pedido_compra_id = pci.pedido_compra_id
  )
  group by pci.id, pci.pedido_compra_id, pci.produto_id, pci.quantidade_base
),
linhas_pedido as (
  select
    'pedido'::text as linha_tipo,
    pci.id as linha_id,
    pc.id as pedido_compra_id,
    coalesce(pc.numero, pc.dados->>'numero') as pedido_compra_numero,
    pc.fornecedor_nome,
    pc.fornecedor_id,
    pci.id as pedido_item_id,
    null::text as desmembramento_id,
    null::text as desmembramento_item_id,
    null::integer as desmembramento_sequencia,
    null::text as desmembramento_codigo,
    pci.produto_id,
    coalesce(nullif(trim(pci.produto_nome), ''), pci.dados->>'produto_nome') as produto_nome,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade_vitrine_sigla,
    coalesce(nullif(pci.fator_aplicado, 0), 1) as fator_vitrine,
    coalesce(pci.quantidade_base, 0) as comprada_base,
    coalesce(lp.despachada_base, 0) as despachada_base,
    coalesce(lp.recebida_base, 0) as recebida_base,
    public._p38_round_qty(
      greatest(coalesce(lp.despachada_base, 0) - coalesce(lp.recebida_base, 0), 0)
    ) as em_transito_base,
    public._p38_round_qty(
      greatest(
        coalesce(pci.quantidade_base, 0)
        - coalesce(lp.recebida_base, 0)
        - greatest(coalesce(lp.despachada_base, 0) - coalesce(lp.recebida_base, 0), 0),
        0
      )
    ) as saldo_pendente_base,
    pci.ordem as ordem,
    0 as sub_ordem
  from public.pedido_compra_item pci
  join public.pedido_compra pc on pc.id = pci.pedido_compra_id
  left join legacy_por_item lp on lp.pedido_item_id = pci.id
),
linhas_desmembramento as (
  select
    'desmembramento'::text as linha_tipo,
    di.id as linha_id,
    d.pedido_compra_id,
    coalesce(d.pedido_compra_numero, pc.numero, pc.dados->>'numero') as pedido_compra_numero,
    pc.fornecedor_nome,
    pc.fornecedor_id,
    di.pedido_compra_item_id as pedido_item_id,
    d.id as desmembramento_id,
    di.id as desmembramento_item_id,
    d.sequencia as desmembramento_sequencia,
    d.codigo as desmembramento_codigo,
    di.produto_id,
    coalesce(nullif(trim(di.produto_nome), ''), pci.produto_nome) as produto_nome,
    coalesce(nullif(trim(di.unidade_vitrine_sigla), ''), pci.unidade_sigla, 'UN') as unidade_vitrine_sigla,
    coalesce(nullif(di.fator_vitrine, 0), nullif(pci.fator_aplicado, 0), 1) as fator_vitrine,
    di.quantidade_comprada_base as comprada_base,
    di.quantidade_despachada_base as despachada_base,
    di.quantidade_recebida_base as recebida_base,
    di.em_transito_base,
    di.saldo_pendente_base,
    coalesce(pci.ordem, di.ordem, 0) as ordem,
    di.ordem as sub_ordem
  from public.pedido_compra_desmembramento_item di
  join public.pedido_compra_desmembramento d on d.id = di.desmembramento_id
  join public.pedido_compra pc on pc.id = d.pedido_compra_id
  left join public.pedido_compra_item pci on pci.id = di.pedido_compra_item_id
)
select
  f.*,
  public.compra_para_exibicao(f.comprada_base, f.fator_vitrine) as comprada_exib,
  public.compra_para_exibicao(f.despachada_base, f.fator_vitrine) as despachada_exib,
  public.compra_para_exibicao(f.recebida_base, f.fator_vitrine) as recebida_exib,
  public.compra_para_exibicao(f.em_transito_base, f.fator_vitrine) as em_transito_exib,
  public.compra_para_exibicao(f.saldo_pendente_base, f.fator_vitrine) as saldo_pendente_exib
from (
  select * from linhas_pedido
  union all
  select * from linhas_desmembramento
) f;

comment on view public.pedido_compra_folha_v is
  'Folha logística 4 colunas (base + vitrine). Legacy: linha pedido agrega embarques; '
  'novo: sub-linhas em pedido_compra_desmembramento_item.';

-- ---------------------------------------------------------------------------
-- Cards logística (desmembramento informativo + saldo vermelho)
-- ---------------------------------------------------------------------------
create or replace view public.pedido_compra_card_logistica_v as
with saldo_por_item as (
  select
    pedido_compra_id,
    pedido_item_id,
    max(pedido_compra_numero) as pedido_compra_numero,
    max(fornecedor_nome) as fornecedor_nome,
    max(fornecedor_id) as fornecedor_id,
    max(produto_id) as produto_id,
    max(produto_nome) as produto_nome,
    max(unidade_vitrine_sigla) as unidade_vitrine_sigla,
    max(fator_vitrine) as fator_vitrine,
    max(comprada_base) filter (where linha_tipo = 'pedido') as comprada_base,
    sum(despachada_base) filter (where linha_tipo = 'desmembramento') as despachada_base,
    sum(recebida_base) filter (where linha_tipo = 'desmembramento') as recebida_base,
    sum(em_transito_base) filter (where linha_tipo = 'desmembramento') as em_transito_base,
    public._p38_round_qty(
      greatest(
        coalesce(max(comprada_base) filter (where linha_tipo = 'pedido'), 0)
        - coalesce(sum(recebida_base) filter (where linha_tipo = 'desmembramento'), 0)
        - coalesce(sum(em_transito_base) filter (where linha_tipo = 'desmembramento'), 0),
        0
      )
    ) as saldo_pendente_base
  from public.pedido_compra_folha_v
  where pedido_item_id is not null
  group by pedido_compra_id, pedido_item_id
),
cards_desmembramento as (
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
    ('saldo-' || s.pedido_compra_id || '-' || s.pedido_item_id) as card_id,
    s.pedido_compra_id,
    s.pedido_compra_numero,
    s.fornecedor_nome,
    s.fornecedor_id,
    coalesce(s.pedido_compra_numero, s.pedido_compra_id) || ' · saldo' as titulo,
    'Saldo a embarcar'::text as status,
    null::text as embarque_id,
    null::integer as sequencia,
    1 as linhas,
    s.em_transito_base as soma_em_transito_base,
    s.saldo_pendente_base as soma_saldo_pendente_base,
    'Saldo a embarcar'::text as card_status,
    'vermelho'::text as card_paleta,
    null::timestamptz as created_at,
    null::timestamptz as updated_at
  from saldo_por_item s
  join public.pedido_compra pc on pc.id = s.pedido_compra_id
  where s.saldo_pendente_base > 0.009
    and pc.status is distinct from 'Concluído'
),
legacy_saldo as (
  select
    'saldo'::text as card_tipo,
    ('legacy-saldo-' || v.pedido_compra_id || '-' || v.pedido_item_id) as card_id,
    v.pedido_compra_id,
    v.pedido_compra_numero,
    v.fornecedor_nome,
    v.fornecedor_id,
    coalesce(v.pedido_compra_numero, v.pedido_compra_id) || ' · saldo' as titulo,
    'Saldo a embarcar'::text as status,
    null::text as embarque_id,
    null::integer as sequencia,
    1 as linhas,
    public.compra_para_base(v.quantidade_em_transito, coalesce(nullif(pci.fator_aplicado, 0), 1)) as soma_em_transito_base,
    public.compra_para_base(v.falta_operacional, coalesce(nullif(pci.fator_aplicado, 0), 1)) as soma_saldo_pendente_base,
    'Saldo a embarcar'::text as card_status,
    'vermelho'::text as card_paleta,
    v.pedido_created_at as created_at,
    v.pedido_updated_at as updated_at
  from public.pedido_compra_saldo_a_embarcar_v v
  join public.pedido_compra_item pci on pci.id = v.pedido_item_id
  where v.falta_operacional > 0.009
    and v.pedido_status is distinct from 'Concluído'
    and not exists (
      select 1 from public.pedido_compra_desmembramento d where d.pedido_compra_id = v.pedido_compra_id
    )
)
select * from cards_desmembramento
union all
select * from cards_saldo
union all
select * from legacy_saldo;

comment on view public.pedido_compra_card_logistica_v is
  'Cards logística: desmembramento (cítrico, em trânsito) + saldo (vermelho). '
  'Legacy sem desmembramento: espelha falta_operacional da view 094.';

-- ---------------------------------------------------------------------------
-- Status logístico por pedido
-- ---------------------------------------------------------------------------
create or replace view public.pedido_compra_status_logistica_v as
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
    round(coalesce(sum(quantidade_em_transito), 0)::numeric, 6) as transito_legacy
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
  case
    when coalesce(a.linhas_desmembramento, 0) > 0 then
      case
        when coalesce(a.transito_base, 0) > 0.009 and coalesce(a.saldo_desmembramento_base, 0) <= 0.009
          then 'Em trânsito'
        when coalesce(a.saldo_desmembramento_base, 0) > 0.009
          then 'Saldo a embarcar'
        when coalesce(a.recebida_base, 0) > 0.009
          then 'Parcialmente recebido'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
    else
      case
        when coalesce(l.falta_legacy, 0) > 0.009 then 'Saldo a embarcar'
        when coalesce(l.transito_legacy, 0) > 0.009 then 'Em trânsito'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
  end as status_embarque_calc,
  case
    when coalesce(a.recebida_base, 0) > 0.009
      and coalesce(a.saldo_pedido_base, a.saldo_desmembramento_base, l.falta_legacy, 0) <= 0.009
      then 'Recebido'
    when coalesce(a.recebida_base, 0) > 0.009 then 'Parcial'
    else coalesce(nullif(trim(pc.status_recebimento_geral), ''), 'Pendente')
  end as status_recebimento_geral,
  case
    when coalesce(a.linhas_desmembramento, 0) > 0 then
      case
        when coalesce(a.saldo_desmembramento_base, 0) > 0.009 then 'FALTA_EMBARCAR'
        when coalesce(a.transito_base, 0) > 0.009 then 'EM_TRANSITO'
        else 'OK'
      end
    else
      case
        when coalesce(l.falta_legacy, 0) > 0.009 then 'FALTA_EMBARCAR'
        when coalesce(l.transito_legacy, 0) > 0.009 then 'EM_TRANSITO'
        else 'OK'
      end
  end as diagnostico,
  public.p38_pedido_usa_folha_desmembramento(pc.id) as usa_folha_v2,
  pc.created_at,
  pc.updated_at
from public.pedido_compra pc
left join agg a on a.pedido_compra_id = pc.id
left join legacy l on l.pedido_compra_id = pc.id;

comment on view public.pedido_compra_status_logistica_v is
  'Status logístico calculado: embarque, recebimento geral e diagnóstico (folha v2 ou legacy 094).';

-- ---------------------------------------------------------------------------
-- RPCs (fase UI — não substituem stock/movimentacao_estoque)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_criar_desmembramento(p_payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_pedido_id text := nullif(trim(p_payload->>'pedido_compra_id'), '');
  v_embarque_id text := nullif(trim(p_payload->>'embarque_id'), '');
  v_user text := coalesce(nullif(trim(p_payload->>'created_by'), ''), 'rpc');
  v_origem text := coalesce(nullif(trim(p_payload->>'origem'), ''), 'manual');
  v_pedido record;
  v_seq int;
  v_codigo text;
  v_desm_id text;
  v_item jsonb;
  v_di_id text;
  v_pci record;
  v_fator numeric;
  v_inseridos int := 0;
begin
  if v_pedido_id is null then
    raise exception 'pedido_compra_id obrigatório';
  end if;

  select * into v_pedido from public.pedido_compra where id = v_pedido_id;
  if not found then
    raise exception 'Pedido % não encontrado', v_pedido_id;
  end if;

  if jsonb_typeof(p_payload->'itens') <> 'array' or jsonb_array_length(p_payload->'itens') = 0 then
    raise exception 'itens[] obrigatório';
  end if;

  select coalesce(max(sequencia), 0) + 1 into v_seq
  from public.pedido_compra_desmembramento
  where pedido_compra_id = v_pedido_id;

  v_desm_id := coalesce(nullif(trim(p_payload->>'id'), ''), 'pcd_' || encode(gen_random_bytes(9), 'hex'));
  v_codigo := coalesce(
    nullif(trim(p_payload->>'codigo'), ''),
    coalesce(v_pedido.numero, v_pedido.dados->>'numero', v_pedido_id) || '-' || v_seq::text
  );

  insert into public.pedido_compra_desmembramento (
    id, pedido_compra_id, pedido_compra_numero, sequencia, codigo,
    status, embarque_id, origem, created_by, updated_at
  ) values (
    v_desm_id, v_pedido_id,
    coalesce(v_pedido.numero, v_pedido.dados->>'numero'),
    v_seq, v_codigo,
    coalesce(nullif(trim(p_payload->>'status'), ''), 'Pendente'),
    v_embarque_id, v_origem, v_user, now()
  );

  for v_item in select value from jsonb_array_elements(p_payload->'itens') as t(value)
  loop
    select * into v_pci
    from public.pedido_compra_item
    where id = nullif(trim(v_item->>'pedido_compra_item_id'), '')
       or (pedido_compra_id = v_pedido_id and produto_id = nullif(trim(v_item->>'produto_id'), ''))
    order by ordem
    limit 1;

    if not found then
      raise exception 'Item não encontrado: %', v_item;
    end if;

    v_fator := coalesce(nullif(v_pci.fator_aplicado, 0), 1);
    v_di_id := coalesce(
      nullif(trim(v_item->>'id'), ''),
      v_desm_id || '_i' || v_inseridos::text
    );

    insert into public.pedido_compra_desmembramento_item (
      id, desmembramento_id, pedido_compra_id, pedido_compra_item_id,
      produto_id, produto_nome, unidade_vitrine_sigla, fator_vitrine,
      quantidade_comprada_base, ordem, created_by, updated_at
    ) values (
      v_di_id, v_desm_id, v_pedido_id, v_pci.id,
      v_pci.produto_id,
      coalesce(nullif(trim(v_item->>'produto_nome'), ''), v_pci.produto_nome),
      coalesce(nullif(trim(v_item->>'unidade_vitrine_sigla'), ''), v_pci.unidade_sigla, 'UN'),
      coalesce(nullif((v_item->>'fator_vitrine')::numeric, 0), v_fator),
      public._p38_round_qty(
        coalesce(
          nullif((v_item->>'quantidade_comprada_base')::numeric, null),
          public.compra_para_base(
            coalesce((v_item->>'quantidade_comprada')::numeric, 0),
            v_fator
          )
        )
      ),
      coalesce((v_item->>'ordem')::int, v_inseridos),
      v_user,
      now()
    );

    v_inseridos := v_inseridos + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'desmembramento_id', v_desm_id,
    'codigo', v_codigo,
    'sequencia', v_seq,
    'itens', v_inseridos
  );
end;
$$;

create or replace function public.rpc_informar_despacho(p_payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_desm_id text := nullif(trim(p_payload->>'desmembramento_id'), '');
  v_user text := coalesce(nullif(trim(p_payload->>'updated_by'), ''), 'rpc');
  v_item jsonb;
  v_di_id text;
  v_qty numeric;
  v_atualizados int := 0;
begin
  if v_desm_id is null then
    raise exception 'desmembramento_id obrigatório';
  end if;

  if jsonb_typeof(p_payload->'itens') <> 'array' then
    raise exception 'itens[] obrigatório';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'itens') as t(value)
  loop
    v_di_id := nullif(trim(v_item->>'desmembramento_item_id'), '');
    v_qty := public._p38_round_qty(
      coalesce(
        nullif((v_item->>'quantidade_despachada_base')::numeric, null),
        public.compra_para_base(
          coalesce((v_item->>'quantidade_despachada')::numeric, 0),
          coalesce((v_item->>'fator_vitrine')::numeric, 1)
        )
      )
    );

    update public.pedido_compra_desmembramento_item di
    set
      quantidade_despachada_base = v_qty,
      updated_at = now()
    where di.desmembramento_id = v_desm_id
      and (v_di_id is null or di.id = v_di_id)
      and (v_di_id is not null or di.produto_id = nullif(trim(v_item->>'produto_id'), ''));

    v_atualizados := v_atualizados + 1;
  end loop;

  update public.pedido_compra_desmembramento
  set status = coalesce(nullif(trim(p_payload->>'status'), ''), 'Despachado'), updated_at = now()
  where id = v_desm_id;

  return jsonb_build_object('ok', true, 'desmembramento_id', v_desm_id, 'itens', v_atualizados);
end;
$$;

create or replace function public.rpc_recepcionar_desmembramento(p_payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_desm_id text := nullif(trim(p_payload->>'desmembramento_id'), '');
  v_user text := coalesce(nullif(trim(p_payload->>'updated_by'), ''), 'rpc');
  v_item jsonb;
  v_di_id text;
  v_delta numeric;
  v_atualizados int := 0;
begin
  if v_desm_id is null then
    raise exception 'desmembramento_id obrigatório';
  end if;

  if jsonb_typeof(p_payload->'itens') <> 'array' then
    raise exception 'itens[] obrigatório';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'itens') as t(value)
  loop
    v_di_id := nullif(trim(v_item->>'desmembramento_item_id'), '');
    v_delta := public._p38_round_qty(
      coalesce(
        nullif((v_item->>'quantidade_recebida_delta_base')::numeric, null),
        public.compra_para_base(
          coalesce((v_item->>'quantidade_recebida_delta')::numeric, 0),
          coalesce((v_item->>'fator_vitrine')::numeric, 1)
        )
      )
    );

    update public.pedido_compra_desmembramento_item di
    set
      quantidade_recebida_base = public._p38_round_qty(
        least(
          coalesce(di.quantidade_comprada_base, 0),
          coalesce(di.quantidade_recebida_base, 0) + v_delta
        )
      ),
      updated_at = now()
    where di.desmembramento_id = v_desm_id
      and (v_di_id is null or di.id = v_di_id)
      and (v_di_id is not null or di.produto_id = nullif(trim(v_item->>'produto_id'), ''));

    v_atualizados := v_atualizados + 1;
  end loop;

  update public.pedido_compra_desmembramento d
  set
    status = case
      when exists (
        select 1 from public.pedido_compra_desmembramento_item di
        where di.desmembramento_id = d.id and di.saldo_pendente_base > 0.009
      ) then 'Parcial'
      when exists (
        select 1 from public.pedido_compra_desmembramento_item di
        where di.desmembramento_id = d.id and di.em_transito_base > 0.009
      ) then 'Despachado'
      else coalesce(nullif(trim(p_payload->>'status'), ''), 'Recebido')
    end,
    updated_at = now()
  where d.id = v_desm_id;

  return jsonb_build_object(
    'ok', true,
    'desmembramento_id', v_desm_id,
    'itens', v_atualizados,
    'nota', 'Stock continua via movimentacao_estoque na UI de recepção; RPC só actualiza folha.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants REST
-- ---------------------------------------------------------------------------
grant select on public.pedido_compra_folha_v to authenticated, anon, service_role;
grant select on public.pedido_compra_card_logistica_v to authenticated, anon, service_role;
grant select on public.pedido_compra_status_logistica_v to authenticated, anon, service_role;

grant execute on function public.compra_para_base(numeric, numeric) to authenticated, anon, service_role;
grant execute on function public.compra_para_exibicao(numeric, numeric) to authenticated, anon, service_role;
grant execute on function public.p38_pedido_usa_folha_desmembramento(text) to authenticated, anon, service_role;

grant execute on function public.rpc_criar_desmembramento(jsonb) to authenticated, service_role;
grant execute on function public.rpc_informar_despacho(jsonb) to authenticated, service_role;
grant execute on function public.rpc_recepcionar_desmembramento(jsonb) to authenticated, service_role;
