-- Impede nova viagem duplicada (mesma embarcação/transportadora + data de saída).
create unique index if not exists evento_logistico_sandbox_tid_saida_uidx
  on public.evento_logistico_sandbox (transportadora_id, data_saida_origem)
  where transportadora_id is not null
    and data_saida_origem is not null;

comment on index public.evento_logistico_sandbox_tid_saida_uidx is
  'Uma viagem por transportadora_id e data_saida_origem (itinerário fluvial).';
