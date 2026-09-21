-- 039_promote_agenda_logistica_columns.sql
-- agenda_logistica foi criada no bootstrap JSONB (000); a 002 não recriou a tabela.
-- Promove campos essenciais de dados→colunas para filtros (pedido_venda_id, data_agendada, etc.).

alter table public.agenda_logistica add column if not exists pedido_venda_id text;
alter table public.agenda_logistica add column if not exists cliente_id text;
alter table public.agenda_logistica add column if not exists endereco_entrega text;
alter table public.agenda_logistica add column if not exists data_agendada date;
alter table public.agenda_logistica add column if not exists motorista_id text;
alter table public.agenda_logistica add column if not exists status text;
alter table public.agenda_logistica add column if not exists observacoes text;

update public.agenda_logistica set
  pedido_venda_id = coalesce(pedido_venda_id, dados->>'pedido_venda_id'),
  cliente_id = coalesce(cliente_id, dados->>'cliente_id'),
  endereco_entrega = coalesce(endereco_entrega, dados->>'endereco_entrega'),
  data_agendada = coalesce(data_agendada, nullif(dados->>'data_agendada', '')::date),
  motorista_id = coalesce(motorista_id, dados->>'motorista_id'),
  status = coalesce(status, dados->>'status'),
  observacoes = coalesce(observacoes, dados->>'observacoes')
where dados is not null and dados <> '{}'::jsonb;

update public.agenda_logistica
  set dados = dados - array[
    'pedido_venda_id',
    'cliente_id',
    'endereco_entrega',
    'data_agendada',
    'motorista_id',
    'status',
    'observacoes'
  ]
where dados is not null and dados <> '{}'::jsonb;

create index if not exists idx_agenda_logistica_pedido_venda_id on public.agenda_logistica (pedido_venda_id);
create index if not exists idx_agenda_logistica_data_agendada on public.agenda_logistica (data_agendada);
