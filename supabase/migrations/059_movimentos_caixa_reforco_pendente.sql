-- Reforço pendente: transferência financeira → Caixa PDV aguarda confirmação do operador.
alter table public.movimentos_caixa
  add column if not exists lancamento_financeiro_id text;

create index if not exists idx_movimentos_caixa_lancamento_financeiro_id
  on public.movimentos_caixa (lancamento_financeiro_id)
  where lancamento_financeiro_id is not null;

create index if not exists idx_movimentos_caixa_reforco_pendente
  on public.movimentos_caixa (conta_id, status_registro)
  where tipo = 'Reforço' and status_registro = 'Pendente';
