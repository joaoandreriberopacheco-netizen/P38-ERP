-- 046_llm_telemetry.sql
-- Telemetria de uso de IA (InvokeLLM) — custo, tokens e saúde do OCR.

create table if not exists public.p38_llm_telemetry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  usuario_id uuid,
  source text not null default 'invoke_llm',
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  prompt_chars integer not null default 0,
  catalog_product_count integer not null default 0,
  file_count integer not null default 0,
  duration_ms integer,
  success boolean not null default true,
  error_message text,
  cost_estimate_usd numeric(14, 8)
);

create index if not exists p38_llm_telemetry_created_at_idx
  on public.p38_llm_telemetry (created_at desc);

create index if not exists p38_llm_telemetry_source_idx
  on public.p38_llm_telemetry (source, created_at desc);

alter table public.p38_llm_telemetry disable row level security;

grant select, insert on public.p38_llm_telemetry to service_role;
grant select on public.p38_llm_telemetry to authenticated, anon;

comment on table public.p38_llm_telemetry is
  'Registo de chamadas InvokeLLM (Gemini/OpenAI) para controlo de custo e OCR.';

-- Resumo para painel admin (single-tenant).
create or replace function public.p38_llm_telemetry_resumo(p_dias integer default 30)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_desde timestamptz := now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));
  v_total_chamadas bigint;
  v_total_tokens bigint;
  v_custo numeric;
  v_media numeric;
  v_media_catalogo numeric;
  v_por_fonte jsonb;
  v_ultimas jsonb;
begin
  select count(*)::bigint,
         coalesce(sum(total_tokens), 0)::bigint,
         coalesce(sum(cost_estimate_usd), 0)
    into v_total_chamadas, v_total_tokens, v_custo
    from public.p38_llm_telemetry
   where created_at >= v_desde
     and success = true;

  select case when v_total_chamadas > 0
         then round(v_total_tokens::numeric / v_total_chamadas, 0)
         else 0 end
    into v_media;

  select coalesce(round(avg(catalog_product_count) filter (where catalog_product_count > 0), 0), 0)
    into v_media_catalogo
    from public.p38_llm_telemetry
   where created_at >= v_desde
     and success = true;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.chamadas desc), '[]'::jsonb)
    into v_por_fonte
    from (
      select source,
             count(*)::int as chamadas,
             coalesce(sum(total_tokens), 0)::int as tokens,
             coalesce(round(avg(total_tokens), 0), 0)::int as media_tokens,
             coalesce(round(avg(catalog_product_count), 0), 0)::int as media_catalogo
        from public.p38_llm_telemetry
       where created_at >= v_desde
         and success = true
       group by source
    ) t;

  select coalesce(jsonb_agg(row_to_json(u)::jsonb), '[]'::jsonb)
    into v_ultimas
    from (
      select created_at,
             source,
             provider,
             model,
             total_tokens,
             catalog_product_count,
             file_count,
             duration_ms,
             cost_estimate_usd,
             success,
             left(coalesce(error_message, ''), 120) as error_message
        from public.p38_llm_telemetry
       where created_at >= v_desde
       order by created_at desc
       limit 25
    ) u;

  return jsonb_build_object(
    'periodo_dias', greatest(coalesce(p_dias, 30), 1),
    'total_chamadas', coalesce(v_total_chamadas, 0),
    'total_tokens', coalesce(v_total_tokens, 0),
    'custo_estimado_usd', round(coalesce(v_custo, 0), 6),
    'media_tokens_por_chamada', coalesce(v_media, 0),
    'media_produtos_catalogo_no_prompt', coalesce(v_media_catalogo, 0),
    'alerta_tokens_altos', coalesce(v_media, 0) > 15000,
    'alerta_catalogo_no_prompt', coalesce(v_media_catalogo, 0) > 0,
    'meta_saudavel_tokens', 12000,
    'por_fonte', coalesce(v_por_fonte, '[]'::jsonb),
    'ultimas', coalesce(v_ultimas, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.p38_llm_telemetry_resumo(integer) to authenticated, anon, service_role;
