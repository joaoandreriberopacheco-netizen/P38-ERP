-- Data de entrada na folha (proporcional salário, 13º e férias para novos; vazio = direito integral / legado).

alter table public.folha_previsao_modelo add column if not exists data_entrada date;

update public.folha_previsao_modelo set
  data_entrada = case
    when data_entrada is null and dados->>'data_entrada' ~ '^\d{4}-\d{2}-\d{2}'
    then left(dados->>'data_entrada', 10)::date
    else data_entrada
  end
where dados is not null and dados <> '{}'::jsonb;

update public.folha_previsao_modelo
  set dados = dados - array['data_entrada']
where dados is not null and dados <> '{}'::jsonb
  and dados ? 'data_entrada';
