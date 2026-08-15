-- 068_lancamento_transferencia_conta_destino.sql
-- Opção B: transferência manual num único registo (tipo Transferência + conta destino).

alter table public.lancamento_financeiro add column if not exists conta_destino_id text;
alter table public.lancamento_financeiro add column if not exists conta_destino_nome text;

update public.lancamento_financeiro set
  conta_destino_id = case when conta_destino_id is null then dados->>'conta_destino_id' else conta_destino_id end,
  conta_destino_nome = case when conta_destino_nome is null then dados->>'conta_destino_nome' else conta_destino_nome end
where dados is not null and dados <> '{}'::jsonb;

update public.lancamento_financeiro
  set dados = dados - array['conta_destino_id', 'conta_destino_nome']
where dados is not null and dados <> '{}'::jsonb
  and (dados ? 'conta_destino_id' or dados ? 'conta_destino_nome');

create index if not exists idx_lancamento_financeiro_conta_destino_id
  on public.lancamento_financeiro (conta_destino_id)
  where conta_destino_id is not null;
