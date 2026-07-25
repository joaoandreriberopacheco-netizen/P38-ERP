-- 029_promote_core_entities_from_dados.sql
-- Gerado por scripts/generate-migration-029-core.mjs
-- Promove campos do núcleo de `dados` jsonb para colunas SQL consultáveis.
-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE + limpeza de chaves em dados.

-- === produto (57 colunas) ===
alter table public.produto add column if not exists nome text;
alter table public.produto add column if not exists codigo_interno text;
alter table public.produto add column if not exists codigo_barras text;
alter table public.produto add column if not exists campo_hierarquico_1 text;
alter table public.produto add column if not exists campo_hierarquico_2 text;
alter table public.produto add column if not exists campo_hierarquico_3 text;
alter table public.produto add column if not exists campo_hierarquico_4 text;
alter table public.produto add column if not exists campo_hierarquico_5 text;
alter table public.produto add column if not exists categoria_id text;
alter table public.produto add column if not exists categoria_nome text;
alter table public.produto add column if not exists area_id text;
alter table public.produto add column if not exists area_codigo text;
alter table public.produto add column if not exists marca text;
alter table public.produto add column if not exists imagem_url text;
alter table public.produto add column if not exists tags jsonb;
alter table public.produto add column if not exists tipo text;
alter table public.produto add column if not exists abcd text;
alter table public.produto add column if not exists preco_livre boolean;
alter table public.produto add column if not exists casas_decimais integer;
alter table public.produto add column if not exists valor_compra numeric;
alter table public.produto add column if not exists preco_venda_padrao numeric;
alter table public.produto add column if not exists preco_venda_tipo text;
alter table public.produto add column if not exists preco_venda_percentual numeric;
alter table public.produto add column if not exists preco_custo_calculado numeric;
alter table public.produto add column if not exists estoque_atual numeric;
alter table public.produto add column if not exists estoque_minimo numeric;
alter table public.produto add column if not exists estoque_ideal numeric;
alter table public.produto add column if not exists estoque_maximo numeric;
alter table public.produto add column if not exists estoque_avariado numeric;
alter table public.produto add column if not exists unidade_principal text;
alter table public.produto add column if not exists unidade_vitrine text;
alter table public.produto add column if not exists unidades_por_pacote text;
alter table public.produto add column if not exists unidades_alternativas jsonb;
alter table public.produto add column if not exists fornecedor_padrao_id text;
alter table public.produto add column if not exists fornecedor_padrao_codigo text;
alter table public.produto add column if not exists custo_frete_padrao numeric;
alter table public.produto add column if not exists custo_outros_padrao numeric;
alter table public.produto add column if not exists custo_imposto1_padrao numeric;
alter table public.produto add column if not exists custo_imposto2_padrao numeric;
alter table public.produto add column if not exists desconto_compra_padrao text;
alter table public.produto add column if not exists controla_serial boolean;
alter table public.produto add column if not exists controla_lote boolean;
alter table public.produto add column if not exists controla_validade boolean;
alter table public.produto add column if not exists peso_kg numeric;
alter table public.produto add column if not exists volume_cm3 text;
alter table public.produto add column if not exists dimensoes_cm jsonb;
alter table public.produto add column if not exists ativo boolean;
alter table public.produto add column if not exists tempo_reposicao_dias integer;
alter table public.produto add column if not exists venda_media_dia numeric;
alter table public.produto add column if not exists metas_estoque_atualizado_em timestamptz;
alter table public.produto add column if not exists metas_estoque_dias_com_estoque integer;
alter table public.produto add column if not exists metas_estoque_unidade_compra text;
alter table public.produto add column if not exists metas_estoque_outliers_descartados integer;
alter table public.produto add column if not exists metas_estoque_quantidade_limpa_90d numeric;
alter table public.produto add column if not exists estoque_trava_manual boolean;
alter table public.produto add column if not exists metas_estoque_versao text;
alter table public.produto add column if not exists metas_estoque_lead_time_dias integer;

update public.produto set
  nome = coalesce(nome, dados->>'nome'),
  codigo_interno = coalesce(codigo_interno, dados->>'codigo_interno'),
  codigo_barras = coalesce(codigo_barras, dados->>'codigo_barras'),
  campo_hierarquico_1 = coalesce(campo_hierarquico_1, dados->>'campo_hierarquico_1'),
  campo_hierarquico_2 = coalesce(campo_hierarquico_2, dados->>'campo_hierarquico_2'),
  campo_hierarquico_3 = coalesce(campo_hierarquico_3, dados->>'campo_hierarquico_3'),
  campo_hierarquico_4 = coalesce(campo_hierarquico_4, dados->>'campo_hierarquico_4'),
  campo_hierarquico_5 = coalesce(campo_hierarquico_5, dados->>'campo_hierarquico_5'),
  categoria_id = coalesce(categoria_id, dados->>'categoria_id'),
  categoria_nome = coalesce(categoria_nome, dados->>'categoria_nome'),
  area_id = coalesce(area_id, dados->>'area_id'),
  area_codigo = coalesce(area_codigo, dados->>'area_codigo'),
  marca = coalesce(marca, dados->>'marca'),
  imagem_url = coalesce(imagem_url, dados->>'imagem_url'),
  tags = coalesce(tags, dados->'tags'),
  tipo = coalesce(tipo, dados->>'tipo'),
  abcd = coalesce(abcd, dados->>'abcd'),
  preco_livre = coalesce(preco_livre, case when lower(dados->>'preco_livre') in ('true', 'false') then (dados->>'preco_livre')::boolean else null end),
  casas_decimais = coalesce(casas_decimais, case when dados->>'casas_decimais' ~ '^-?[0-9]' then (dados->>'casas_decimais')::integer else null end),
  valor_compra = coalesce(valor_compra, case when dados->>'valor_compra' ~ '^-?[0-9]' then (dados->>'valor_compra')::numeric else null end),
  preco_venda_padrao = coalesce(preco_venda_padrao, case when dados->>'preco_venda_padrao' ~ '^-?[0-9]' then (dados->>'preco_venda_padrao')::numeric else null end),
  preco_venda_tipo = coalesce(preco_venda_tipo, dados->>'preco_venda_tipo'),
  preco_venda_percentual = coalesce(preco_venda_percentual, case when dados->>'preco_venda_percentual' ~ '^-?[0-9]' then (dados->>'preco_venda_percentual')::numeric else null end),
  preco_custo_calculado = coalesce(preco_custo_calculado, case when dados->>'preco_custo_calculado' ~ '^-?[0-9]' then (dados->>'preco_custo_calculado')::numeric else null end),
  estoque_atual = coalesce(estoque_atual, case when dados->>'estoque_atual' ~ '^-?[0-9]' then (dados->>'estoque_atual')::numeric else null end),
  estoque_minimo = coalesce(estoque_minimo, case when dados->>'estoque_minimo' ~ '^-?[0-9]' then (dados->>'estoque_minimo')::numeric else null end),
  estoque_ideal = coalesce(estoque_ideal, case when dados->>'estoque_ideal' ~ '^-?[0-9]' then (dados->>'estoque_ideal')::numeric else null end),
  estoque_maximo = coalesce(estoque_maximo, case when dados->>'estoque_maximo' ~ '^-?[0-9]' then (dados->>'estoque_maximo')::numeric else null end),
  estoque_avariado = coalesce(estoque_avariado, case when dados->>'estoque_avariado' ~ '^-?[0-9]' then (dados->>'estoque_avariado')::numeric else null end),
  unidade_principal = coalesce(unidade_principal, dados->>'unidade_principal'),
  unidade_vitrine = coalesce(unidade_vitrine, dados->>'unidade_vitrine'),
  unidades_por_pacote = coalesce(unidades_por_pacote, dados->>'unidades_por_pacote'),
  unidades_alternativas = coalesce(unidades_alternativas, dados->'unidades_alternativas'),
  fornecedor_padrao_id = coalesce(fornecedor_padrao_id, dados->>'fornecedor_padrao_id'),
  fornecedor_padrao_codigo = coalesce(fornecedor_padrao_codigo, dados->>'fornecedor_padrao_codigo'),
  custo_frete_padrao = coalesce(custo_frete_padrao, case when dados->>'custo_frete_padrao' ~ '^-?[0-9]' then (dados->>'custo_frete_padrao')::numeric else null end),
  custo_outros_padrao = coalesce(custo_outros_padrao, case when dados->>'custo_outros_padrao' ~ '^-?[0-9]' then (dados->>'custo_outros_padrao')::numeric else null end),
  custo_imposto1_padrao = coalesce(custo_imposto1_padrao, case when dados->>'custo_imposto1_padrao' ~ '^-?[0-9]' then (dados->>'custo_imposto1_padrao')::numeric else null end),
  custo_imposto2_padrao = coalesce(custo_imposto2_padrao, case when dados->>'custo_imposto2_padrao' ~ '^-?[0-9]' then (dados->>'custo_imposto2_padrao')::numeric else null end),
  desconto_compra_padrao = coalesce(desconto_compra_padrao, dados->>'desconto_compra_padrao'),
  controla_serial = coalesce(controla_serial, case when lower(dados->>'controla_serial') in ('true', 'false') then (dados->>'controla_serial')::boolean else null end),
  controla_lote = coalesce(controla_lote, case when lower(dados->>'controla_lote') in ('true', 'false') then (dados->>'controla_lote')::boolean else null end),
  controla_validade = coalesce(controla_validade, case when lower(dados->>'controla_validade') in ('true', 'false') then (dados->>'controla_validade')::boolean else null end),
  peso_kg = coalesce(peso_kg, case when dados->>'peso_kg' ~ '^-?[0-9]' then (dados->>'peso_kg')::numeric else null end),
  volume_cm3 = coalesce(volume_cm3, dados->>'volume_cm3'),
  dimensoes_cm = coalesce(dimensoes_cm, dados->'dimensoes_cm'),
  ativo = coalesce(ativo, case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end),
  tempo_reposicao_dias = coalesce(tempo_reposicao_dias, case when dados->>'tempo_reposicao_dias' ~ '^-?[0-9]' then (dados->>'tempo_reposicao_dias')::integer else null end),
  venda_media_dia = coalesce(venda_media_dia, case when dados->>'venda_media_dia' ~ '^-?[0-9]' then (dados->>'venda_media_dia')::numeric else null end),
  metas_estoque_atualizado_em = coalesce(metas_estoque_atualizado_em, case when dados->>'metas_estoque_atualizado_em' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'metas_estoque_atualizado_em')::timestamptz else null end),
  metas_estoque_dias_com_estoque = coalesce(metas_estoque_dias_com_estoque, case when dados->>'metas_estoque_dias_com_estoque' ~ '^-?[0-9]' then (dados->>'metas_estoque_dias_com_estoque')::integer else null end),
  metas_estoque_unidade_compra = coalesce(metas_estoque_unidade_compra, dados->>'metas_estoque_unidade_compra'),
  metas_estoque_outliers_descartados = coalesce(metas_estoque_outliers_descartados, case when dados->>'metas_estoque_outliers_descartados' ~ '^-?[0-9]' then (dados->>'metas_estoque_outliers_descartados')::integer else null end),
  metas_estoque_quantidade_limpa_90d = coalesce(metas_estoque_quantidade_limpa_90d, case when dados->>'metas_estoque_quantidade_limpa_90d' ~ '^-?[0-9]' then (dados->>'metas_estoque_quantidade_limpa_90d')::numeric else null end),
  estoque_trava_manual = coalesce(estoque_trava_manual, case when lower(dados->>'estoque_trava_manual') in ('true', 'false') then (dados->>'estoque_trava_manual')::boolean else null end),
  metas_estoque_versao = coalesce(metas_estoque_versao, dados->>'metas_estoque_versao'),
  metas_estoque_lead_time_dias = coalesce(metas_estoque_lead_time_dias, case when dados->>'metas_estoque_lead_time_dias' ~ '^-?[0-9]' then (dados->>'metas_estoque_lead_time_dias')::integer else null end)
where dados is not null and dados <> '{}'::jsonb;

update public.produto
  set dados = dados - array['nome', 'codigo_interno', 'codigo_barras', 'campo_hierarquico_1', 'campo_hierarquico_2', 'campo_hierarquico_3', 'campo_hierarquico_4', 'campo_hierarquico_5', 'categoria_id', 'categoria_nome', 'area_id', 'area_codigo', 'marca', 'imagem_url', 'tags', 'tipo', 'abcd', 'preco_livre', 'casas_decimais', 'valor_compra', 'preco_venda_padrao', 'preco_venda_tipo', 'preco_venda_percentual', 'preco_custo_calculado', 'estoque_atual', 'estoque_minimo', 'estoque_ideal', 'estoque_maximo', 'estoque_avariado', 'unidade_principal', 'unidade_vitrine', 'unidades_por_pacote', 'unidades_alternativas', 'fornecedor_padrao_id', 'fornecedor_padrao_codigo', 'custo_frete_padrao', 'custo_outros_padrao', 'custo_imposto1_padrao', 'custo_imposto2_padrao', 'desconto_compra_padrao', 'controla_serial', 'controla_lote', 'controla_validade', 'peso_kg', 'volume_cm3', 'dimensoes_cm', 'ativo', 'tempo_reposicao_dias', 'venda_media_dia', 'metas_estoque_atualizado_em', 'metas_estoque_dias_com_estoque', 'metas_estoque_unidade_compra', 'metas_estoque_outliers_descartados', 'metas_estoque_quantidade_limpa_90d', 'estoque_trava_manual', 'metas_estoque_versao', 'metas_estoque_lead_time_dias']
where dados is not null and dados <> '{}'::jsonb;

create index if not exists idx_produto_nome on public.produto (nome);
create index if not exists idx_produto_codigo_interno on public.produto (codigo_interno);
create index if not exists idx_produto_categoria_id on public.produto (categoria_id);
create index if not exists idx_produto_ativo on public.produto (ativo);
create index if not exists idx_produto_estoque_atual on public.produto (estoque_atual);

-- === terceiro (15 colunas) ===
alter table public.terceiro add column if not exists codigo_interno text;
alter table public.terceiro add column if not exists nome text;
alter table public.terceiro add column if not exists cpf_cnpj text;
alter table public.terceiro add column if not exists email text;
alter table public.terceiro add column if not exists telefone text;
alter table public.terceiro add column if not exists endereco text;
alter table public.terceiro add column if not exists bairro text;
alter table public.terceiro add column if not exists cidade text;
alter table public.terceiro add column if not exists estado text;
alter table public.terceiro add column if not exists cep text;
alter table public.terceiro add column if not exists tipo text;
alter table public.terceiro add column if not exists perfil text;
alter table public.terceiro add column if not exists data_nascimento date;
alter table public.terceiro add column if not exists observacoes text;
alter table public.terceiro add column if not exists ativo boolean;

update public.terceiro set
  codigo_interno = coalesce(codigo_interno, dados->>'codigo_interno'),
  nome = coalesce(nome, dados->>'nome'),
  cpf_cnpj = coalesce(cpf_cnpj, dados->>'cpf_cnpj'),
  email = coalesce(email, dados->>'email'),
  telefone = coalesce(telefone, dados->>'telefone'),
  endereco = coalesce(endereco, dados->>'endereco'),
  bairro = coalesce(bairro, dados->>'bairro'),
  cidade = coalesce(cidade, dados->>'cidade'),
  estado = coalesce(estado, dados->>'estado'),
  cep = coalesce(cep, dados->>'cep'),
  tipo = coalesce(tipo, dados->>'tipo'),
  perfil = coalesce(perfil, dados->>'perfil'),
  data_nascimento = coalesce(data_nascimento, case when dados->>'data_nascimento' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_nascimento', 10)::date else null end),
  observacoes = coalesce(observacoes, dados->>'observacoes'),
  ativo = coalesce(ativo, case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end)
where dados is not null and dados <> '{}'::jsonb;

update public.terceiro
  set dados = dados - array['codigo_interno', 'nome', 'cpf_cnpj', 'email', 'telefone', 'endereco', 'bairro', 'cidade', 'estado', 'cep', 'tipo', 'perfil', 'data_nascimento', 'observacoes', 'ativo']
where dados is not null and dados <> '{}'::jsonb;

create index if not exists idx_terceiro_nome on public.terceiro (nome);
create index if not exists idx_terceiro_tipo on public.terceiro (tipo);
create index if not exists idx_terceiro_ativo on public.terceiro (ativo);
create index if not exists idx_terceiro_cpf_cnpj on public.terceiro (cpf_cnpj);

-- === lancamento_financeiro (36 colunas) ===
alter table public.lancamento_financeiro add column if not exists tipo text;
alter table public.lancamento_financeiro add column if not exists descricao text;
alter table public.lancamento_financeiro add column if not exists terceiro_id text;
alter table public.lancamento_financeiro add column if not exists terceiro_nome text;
alter table public.lancamento_financeiro add column if not exists valor numeric;
alter table public.lancamento_financeiro add column if not exists valor_liquido numeric;
alter table public.lancamento_financeiro add column if not exists data_vencimento date;
alter table public.lancamento_financeiro add column if not exists data_pagamento date;
alter table public.lancamento_financeiro add column if not exists data_liquidacao_prevista date;
alter table public.lancamento_financeiro add column if not exists data_liquidacao_efetiva date;
alter table public.lancamento_financeiro add column if not exists data_lancamento date;
alter table public.lancamento_financeiro add column if not exists status text;
alter table public.lancamento_financeiro add column if not exists status_conciliacao text;
alter table public.lancamento_financeiro add column if not exists categoria text;
alter table public.lancamento_financeiro add column if not exists categoria_id text;
alter table public.lancamento_financeiro add column if not exists conta_financeira_id text;
alter table public.lancamento_financeiro add column if not exists conta_financeira_nome text;
alter table public.lancamento_financeiro add column if not exists forma_pagamento text;
alter table public.lancamento_financeiro add column if not exists forma_pagamento_id text;
alter table public.lancamento_financeiro add column if not exists forma_pagamento_tipo text;
alter table public.lancamento_financeiro add column if not exists turno_caixa_id text;
alter table public.lancamento_financeiro add column if not exists grupo_lancamento_id text;
alter table public.lancamento_financeiro add column if not exists is_recorrente boolean;
alter table public.lancamento_financeiro add column if not exists is_custo_mercadoria boolean;
alter table public.lancamento_financeiro add column if not exists frequencia_recorrencia text;
alter table public.lancamento_financeiro add column if not exists data_fim_recorrencia date;
alter table public.lancamento_financeiro add column if not exists numero_parcelas_total integer;
alter table public.lancamento_financeiro add column if not exists parcela_atual integer;
alter table public.lancamento_financeiro add column if not exists pedido_compra_vinculado_id text;
alter table public.lancamento_financeiro add column if not exists pedido_compra_vinculado_numero text;
alter table public.lancamento_financeiro add column if not exists referencia_tipo text;
alter table public.lancamento_financeiro add column if not exists referencia_id text;
alter table public.lancamento_financeiro add column if not exists referencia_numero text;
alter table public.lancamento_financeiro add column if not exists conciliacao_grupo_id text;
alter table public.lancamento_financeiro add column if not exists codigo_lancamento text;
alter table public.lancamento_financeiro add column if not exists tags jsonb;

update public.lancamento_financeiro set
  tipo = coalesce(tipo, dados->>'tipo'),
  descricao = coalesce(descricao, dados->>'descricao'),
  terceiro_id = coalesce(terceiro_id, dados->>'terceiro_id'),
  terceiro_nome = coalesce(terceiro_nome, dados->>'terceiro_nome'),
  valor = coalesce(valor, case when dados->>'valor' ~ '^-?[0-9]' then (dados->>'valor')::numeric else null end),
  valor_liquido = coalesce(valor_liquido, case when dados->>'valor_liquido' ~ '^-?[0-9]' then (dados->>'valor_liquido')::numeric else null end),
  data_vencimento = coalesce(data_vencimento, case when dados->>'data_vencimento' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_vencimento', 10)::date else null end),
  data_pagamento = coalesce(data_pagamento, case when dados->>'data_pagamento' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_pagamento', 10)::date else null end),
  data_liquidacao_prevista = coalesce(data_liquidacao_prevista, case when dados->>'data_liquidacao_prevista' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_liquidacao_prevista', 10)::date else null end),
  data_liquidacao_efetiva = coalesce(data_liquidacao_efetiva, case when dados->>'data_liquidacao_efetiva' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_liquidacao_efetiva', 10)::date else null end),
  data_lancamento = coalesce(data_lancamento, case when dados->>'data_lancamento' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_lancamento', 10)::date else null end),
  status = coalesce(status, dados->>'status'),
  status_conciliacao = coalesce(status_conciliacao, dados->>'status_conciliacao'),
  categoria = coalesce(categoria, dados->>'categoria'),
  categoria_id = coalesce(categoria_id, dados->>'categoria_id'),
  conta_financeira_id = coalesce(conta_financeira_id, dados->>'conta_financeira_id'),
  conta_financeira_nome = coalesce(conta_financeira_nome, dados->>'conta_financeira_nome'),
  forma_pagamento = coalesce(forma_pagamento, dados->>'forma_pagamento'),
  forma_pagamento_id = coalesce(forma_pagamento_id, dados->>'forma_pagamento_id'),
  forma_pagamento_tipo = coalesce(forma_pagamento_tipo, dados->>'forma_pagamento_tipo'),
  turno_caixa_id = coalesce(turno_caixa_id, dados->>'turno_caixa_id'),
  grupo_lancamento_id = coalesce(grupo_lancamento_id, dados->>'grupo_lancamento_id'),
  is_recorrente = coalesce(is_recorrente, case when lower(dados->>'is_recorrente') in ('true', 'false') then (dados->>'is_recorrente')::boolean else null end),
  is_custo_mercadoria = coalesce(is_custo_mercadoria, case when lower(dados->>'is_custo_mercadoria') in ('true', 'false') then (dados->>'is_custo_mercadoria')::boolean else null end),
  frequencia_recorrencia = coalesce(frequencia_recorrencia, dados->>'frequencia_recorrencia'),
  data_fim_recorrencia = coalesce(data_fim_recorrencia, case when dados->>'data_fim_recorrencia' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_fim_recorrencia', 10)::date else null end),
  numero_parcelas_total = coalesce(numero_parcelas_total, case when dados->>'numero_parcelas_total' ~ '^-?[0-9]' then (dados->>'numero_parcelas_total')::integer else null end),
  parcela_atual = coalesce(parcela_atual, case when dados->>'parcela_atual' ~ '^-?[0-9]' then (dados->>'parcela_atual')::integer else null end),
  pedido_compra_vinculado_id = coalesce(pedido_compra_vinculado_id, dados->>'pedido_compra_vinculado_id'),
  pedido_compra_vinculado_numero = coalesce(pedido_compra_vinculado_numero, dados->>'pedido_compra_vinculado_numero'),
  referencia_tipo = coalesce(referencia_tipo, dados->>'referencia_tipo'),
  referencia_id = coalesce(referencia_id, dados->>'referencia_id'),
  referencia_numero = coalesce(referencia_numero, dados->>'referencia_numero'),
  conciliacao_grupo_id = coalesce(conciliacao_grupo_id, dados->>'conciliacao_grupo_id'),
  codigo_lancamento = coalesce(codigo_lancamento, dados->>'codigo_lancamento'),
  tags = coalesce(tags, dados->'tags')
where dados is not null and dados <> '{}'::jsonb;

update public.lancamento_financeiro
  set dados = dados - array['tipo', 'descricao', 'terceiro_id', 'terceiro_nome', 'valor', 'valor_liquido', 'data_vencimento', 'data_pagamento', 'data_liquidacao_prevista', 'data_liquidacao_efetiva', 'data_lancamento', 'status', 'status_conciliacao', 'categoria', 'categoria_id', 'conta_financeira_id', 'conta_financeira_nome', 'forma_pagamento', 'forma_pagamento_id', 'forma_pagamento_tipo', 'turno_caixa_id', 'grupo_lancamento_id', 'is_recorrente', 'is_custo_mercadoria', 'frequencia_recorrencia', 'data_fim_recorrencia', 'numero_parcelas_total', 'parcela_atual', 'pedido_compra_vinculado_id', 'pedido_compra_vinculado_numero', 'referencia_tipo', 'referencia_id', 'referencia_numero', 'conciliacao_grupo_id', 'codigo_lancamento', 'tags']
where dados is not null and dados <> '{}'::jsonb;

create index if not exists idx_lancamento_financeiro_status on public.lancamento_financeiro (status);
create index if not exists idx_lancamento_financeiro_data_vencimento on public.lancamento_financeiro (data_vencimento);
create index if not exists idx_lancamento_financeiro_tipo on public.lancamento_financeiro (tipo);
create index if not exists idx_lancamento_financeiro_conta_financeira_id on public.lancamento_financeiro (conta_financeira_id);
create index if not exists idx_lancamento_financeiro_terceiro_id on public.lancamento_financeiro (terceiro_id);

-- === turno_caixa (28 colunas) ===
alter table public.turno_caixa add column if not exists numero text;
alter table public.turno_caixa add column if not exists status text;
alter table public.turno_caixa add column if not exists data_abertura timestamptz;
alter table public.turno_caixa add column if not exists data_fechamento timestamptz;
alter table public.turno_caixa add column if not exists usuario_abertura_id text;
alter table public.turno_caixa add column if not exists usuario_abertura_nome text;
alter table public.turno_caixa add column if not exists usuario_fechamento_id text;
alter table public.turno_caixa add column if not exists usuario_fechamento_nome text;
alter table public.turno_caixa add column if not exists conta_caixa_pdv_id text;
alter table public.turno_caixa add column if not exists conta_caixa_pdv_nome text;
alter table public.turno_caixa add column if not exists saldo_inicial numeric;
alter table public.turno_caixa add column if not exists saldo_final numeric;
alter table public.turno_caixa add column if not exists total_vendas numeric;
alter table public.turno_caixa add column if not exists total_despesas numeric;
alter table public.turno_caixa add column if not exists total_reforcos numeric;
alter table public.turno_caixa add column if not exists total_sangrias numeric;
alter table public.turno_caixa add column if not exists recebimentos_dinheiro numeric;
alter table public.turno_caixa add column if not exists recebimentos_pix numeric;
alter table public.turno_caixa add column if not exists recebimentos_credito numeric;
alter table public.turno_caixa add column if not exists recebimentos_debito numeric;
alter table public.turno_caixa add column if not exists recebimentos_vale_troca numeric;
alter table public.turno_caixa add column if not exists dinheiro_conferido numeric;
alter table public.turno_caixa add column if not exists diferenca numeric;
alter table public.turno_caixa add column if not exists vendas_ids jsonb;
alter table public.turno_caixa add column if not exists movimentos_ids jsonb;
alter table public.turno_caixa add column if not exists despesas_ids jsonb;
alter table public.turno_caixa add column if not exists cancelamentos_rastro jsonb;
alter table public.turno_caixa add column if not exists observacoes text;

update public.turno_caixa set
  numero = coalesce(numero, dados->>'numero'),
  status = coalesce(status, dados->>'status'),
  data_abertura = coalesce(data_abertura, case when dados->>'data_abertura' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_abertura')::timestamptz else null end),
  data_fechamento = coalesce(data_fechamento, case when dados->>'data_fechamento' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_fechamento')::timestamptz else null end),
  usuario_abertura_id = coalesce(usuario_abertura_id, dados->>'usuario_abertura_id'),
  usuario_abertura_nome = coalesce(usuario_abertura_nome, dados->>'usuario_abertura_nome'),
  usuario_fechamento_id = coalesce(usuario_fechamento_id, dados->>'usuario_fechamento_id'),
  usuario_fechamento_nome = coalesce(usuario_fechamento_nome, dados->>'usuario_fechamento_nome'),
  conta_caixa_pdv_id = coalesce(conta_caixa_pdv_id, dados->>'conta_caixa_pdv_id'),
  conta_caixa_pdv_nome = coalesce(conta_caixa_pdv_nome, dados->>'conta_caixa_pdv_nome'),
  saldo_inicial = coalesce(saldo_inicial, case when dados->>'saldo_inicial' ~ '^-?[0-9]' then (dados->>'saldo_inicial')::numeric else null end),
  saldo_final = coalesce(saldo_final, case when dados->>'saldo_final' ~ '^-?[0-9]' then (dados->>'saldo_final')::numeric else null end),
  total_vendas = coalesce(total_vendas, case when dados->>'total_vendas' ~ '^-?[0-9]' then (dados->>'total_vendas')::numeric else null end),
  total_despesas = coalesce(total_despesas, case when dados->>'total_despesas' ~ '^-?[0-9]' then (dados->>'total_despesas')::numeric else null end),
  total_reforcos = coalesce(total_reforcos, case when dados->>'total_reforcos' ~ '^-?[0-9]' then (dados->>'total_reforcos')::numeric else null end),
  total_sangrias = coalesce(total_sangrias, case when dados->>'total_sangrias' ~ '^-?[0-9]' then (dados->>'total_sangrias')::numeric else null end),
  recebimentos_dinheiro = coalesce(recebimentos_dinheiro, case when dados->>'recebimentos_dinheiro' ~ '^-?[0-9]' then (dados->>'recebimentos_dinheiro')::numeric else null end),
  recebimentos_pix = coalesce(recebimentos_pix, case when dados->>'recebimentos_pix' ~ '^-?[0-9]' then (dados->>'recebimentos_pix')::numeric else null end),
  recebimentos_credito = coalesce(recebimentos_credito, case when dados->>'recebimentos_credito' ~ '^-?[0-9]' then (dados->>'recebimentos_credito')::numeric else null end),
  recebimentos_debito = coalesce(recebimentos_debito, case when dados->>'recebimentos_debito' ~ '^-?[0-9]' then (dados->>'recebimentos_debito')::numeric else null end),
  recebimentos_vale_troca = coalesce(recebimentos_vale_troca, case when dados->>'recebimentos_vale_troca' ~ '^-?[0-9]' then (dados->>'recebimentos_vale_troca')::numeric else null end),
  dinheiro_conferido = coalesce(dinheiro_conferido, case when dados->>'dinheiro_conferido' ~ '^-?[0-9]' then (dados->>'dinheiro_conferido')::numeric else null end),
  diferenca = coalesce(diferenca, case when dados->>'diferenca' ~ '^-?[0-9]' then (dados->>'diferenca')::numeric else null end),
  vendas_ids = coalesce(vendas_ids, dados->'vendas_ids'),
  movimentos_ids = coalesce(movimentos_ids, dados->'movimentos_ids'),
  despesas_ids = coalesce(despesas_ids, dados->'despesas_ids'),
  cancelamentos_rastro = coalesce(cancelamentos_rastro, dados->'cancelamentos_rastro'),
  observacoes = coalesce(observacoes, dados->>'observacoes')
where dados is not null and dados <> '{}'::jsonb;

update public.turno_caixa
  set dados = dados - array['numero', 'status', 'data_abertura', 'data_fechamento', 'usuario_abertura_id', 'usuario_abertura_nome', 'usuario_fechamento_id', 'usuario_fechamento_nome', 'conta_caixa_pdv_id', 'conta_caixa_pdv_nome', 'saldo_inicial', 'saldo_final', 'total_vendas', 'total_despesas', 'total_reforcos', 'total_sangrias', 'recebimentos_dinheiro', 'recebimentos_pix', 'recebimentos_credito', 'recebimentos_debito', 'recebimentos_vale_troca', 'dinheiro_conferido', 'diferenca', 'vendas_ids', 'movimentos_ids', 'despesas_ids', 'cancelamentos_rastro', 'observacoes']
where dados is not null and dados <> '{}'::jsonb;

create index if not exists idx_turno_caixa_status on public.turno_caixa (status);
create index if not exists idx_turno_caixa_numero on public.turno_caixa (numero);

-- === movimentos_caixa (17 colunas) ===
alter table public.movimentos_caixa add column if not exists numero text;
alter table public.movimentos_caixa add column if not exists tipo text;
alter table public.movimentos_caixa add column if not exists valor numeric;
alter table public.movimentos_caixa add column if not exists valor_original numeric;
alter table public.movimentos_caixa add column if not exists status_registro text;
alter table public.movimentos_caixa add column if not exists conta_id text;
alter table public.movimentos_caixa add column if not exists turno_caixa_id text;
alter table public.movimentos_caixa add column if not exists usuario_responsavel_id text;
alter table public.movimentos_caixa add column if not exists usuario_responsavel_nome text;
alter table public.movimentos_caixa add column if not exists observacao text;
alter table public.movimentos_caixa add column if not exists observacao_original text;
alter table public.movimentos_caixa add column if not exists motivo_ajuste text;
alter table public.movimentos_caixa add column if not exists editado_por_nome text;
alter table public.movimentos_caixa add column if not exists editado_em text;
alter table public.movimentos_caixa add column if not exists cancelado_em text;
alter table public.movimentos_caixa add column if not exists cancelado_por_nome text;
alter table public.movimentos_caixa add column if not exists historico_ajustes jsonb;

update public.movimentos_caixa set
  numero = coalesce(numero, dados->>'numero'),
  tipo = coalesce(tipo, dados->>'tipo'),
  valor = coalesce(valor, case when dados->>'valor' ~ '^-?[0-9]' then (dados->>'valor')::numeric else null end),
  valor_original = coalesce(valor_original, case when dados->>'valor_original' ~ '^-?[0-9]' then (dados->>'valor_original')::numeric else null end),
  status_registro = coalesce(status_registro, dados->>'status_registro'),
  conta_id = coalesce(conta_id, dados->>'conta_id'),
  turno_caixa_id = coalesce(turno_caixa_id, dados->>'turno_caixa_id'),
  usuario_responsavel_id = coalesce(usuario_responsavel_id, dados->>'usuario_responsavel_id'),
  usuario_responsavel_nome = coalesce(usuario_responsavel_nome, dados->>'usuario_responsavel_nome'),
  observacao = coalesce(observacao, dados->>'observacao'),
  observacao_original = coalesce(observacao_original, dados->>'observacao_original'),
  motivo_ajuste = coalesce(motivo_ajuste, dados->>'motivo_ajuste'),
  editado_por_nome = coalesce(editado_por_nome, dados->>'editado_por_nome'),
  editado_em = coalesce(editado_em, dados->>'editado_em'),
  cancelado_em = coalesce(cancelado_em, dados->>'cancelado_em'),
  cancelado_por_nome = coalesce(cancelado_por_nome, dados->>'cancelado_por_nome'),
  historico_ajustes = coalesce(historico_ajustes, dados->'historico_ajustes')
where dados is not null and dados <> '{}'::jsonb;

update public.movimentos_caixa
  set dados = dados - array['numero', 'tipo', 'valor', 'valor_original', 'status_registro', 'conta_id', 'turno_caixa_id', 'usuario_responsavel_id', 'usuario_responsavel_nome', 'observacao', 'observacao_original', 'motivo_ajuste', 'editado_por_nome', 'editado_em', 'cancelado_em', 'cancelado_por_nome', 'historico_ajustes']
where dados is not null and dados <> '{}'::jsonb;

create index if not exists idx_movimentos_caixa_turno_caixa_id on public.movimentos_caixa (turno_caixa_id);
create index if not exists idx_movimentos_caixa_tipo on public.movimentos_caixa (tipo);

-- === formas_de_pagamento (10 colunas) ===
alter table public.formas_de_pagamento add column if not exists nome text;
alter table public.formas_de_pagamento add column if not exists tipo text;
alter table public.formas_de_pagamento add column if not exists ativo boolean;
alter table public.formas_de_pagamento add column if not exists valor_taxa numeric;
alter table public.formas_de_pagamento add column if not exists tipo_taxa text;
alter table public.formas_de_pagamento add column if not exists prazo_recebimento_dias integer;
alter table public.formas_de_pagamento add column if not exists parcelas_max integer;
alter table public.formas_de_pagamento add column if not exists adquirente text;
alter table public.formas_de_pagamento add column if not exists conta_destino_id text;
alter table public.formas_de_pagamento add column if not exists conta_destino_nome text;

update public.formas_de_pagamento set
  nome = coalesce(nome, dados->>'nome'),
  tipo = coalesce(tipo, dados->>'tipo'),
  ativo = coalesce(ativo, case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end),
  valor_taxa = coalesce(valor_taxa, case when dados->>'valor_taxa' ~ '^-?[0-9]' then (dados->>'valor_taxa')::numeric else null end),
  tipo_taxa = coalesce(tipo_taxa, dados->>'tipo_taxa'),
  prazo_recebimento_dias = coalesce(prazo_recebimento_dias, case when dados->>'prazo_recebimento_dias' ~ '^-?[0-9]' then (dados->>'prazo_recebimento_dias')::integer else null end),
  parcelas_max = coalesce(parcelas_max, case when dados->>'parcelas_max' ~ '^-?[0-9]' then (dados->>'parcelas_max')::integer else null end),
  adquirente = coalesce(adquirente, dados->>'adquirente'),
  conta_destino_id = coalesce(conta_destino_id, dados->>'conta_destino_id'),
  conta_destino_nome = coalesce(conta_destino_nome, dados->>'conta_destino_nome')
where dados is not null and dados <> '{}'::jsonb;

update public.formas_de_pagamento
  set dados = dados - array['nome', 'tipo', 'ativo', 'valor_taxa', 'tipo_taxa', 'prazo_recebimento_dias', 'parcelas_max', 'adquirente', 'conta_destino_id', 'conta_destino_nome']
where dados is not null and dados <> '{}'::jsonb;


-- === contas_financeiras (14 colunas) ===
alter table public.contas_financeiras add column if not exists nome text;
alter table public.contas_financeiras add column if not exists tipo text;
alter table public.contas_financeiras add column if not exists ativo boolean;
alter table public.contas_financeiras add column if not exists saldo_atual numeric;
alter table public.contas_financeiras add column if not exists saldo_inicial numeric;
alter table public.contas_financeiras add column if not exists banco text;
alter table public.contas_financeiras add column if not exists agencia text;
alter table public.contas_financeiras add column if not exists conta text;
alter table public.contas_financeiras add column if not exists cor text;
alter table public.contas_financeiras add column if not exists is_caixa_pdv boolean;
alter table public.contas_financeiras add column if not exists is_caixa_geral boolean;
alter table public.contas_financeiras add column if not exists usuario_atribuido_id text;
alter table public.contas_financeiras add column if not exists usuario_atribuido_nome text;
alter table public.contas_financeiras add column if not exists observacoes text;

update public.contas_financeiras set
  nome = coalesce(nome, dados->>'nome'),
  tipo = coalesce(tipo, dados->>'tipo'),
  ativo = coalesce(ativo, case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end),
  saldo_atual = coalesce(saldo_atual, case when dados->>'saldo_atual' ~ '^-?[0-9]' then (dados->>'saldo_atual')::numeric else null end),
  saldo_inicial = coalesce(saldo_inicial, case when dados->>'saldo_inicial' ~ '^-?[0-9]' then (dados->>'saldo_inicial')::numeric else null end),
  banco = coalesce(banco, dados->>'banco'),
  agencia = coalesce(agencia, dados->>'agencia'),
  conta = coalesce(conta, dados->>'conta'),
  cor = coalesce(cor, dados->>'cor'),
  is_caixa_pdv = coalesce(is_caixa_pdv, case when lower(dados->>'is_caixa_pdv') in ('true', 'false') then (dados->>'is_caixa_pdv')::boolean else null end),
  is_caixa_geral = coalesce(is_caixa_geral, case when lower(dados->>'is_caixa_geral') in ('true', 'false') then (dados->>'is_caixa_geral')::boolean else null end),
  usuario_atribuido_id = coalesce(usuario_atribuido_id, dados->>'usuario_atribuido_id'),
  usuario_atribuido_nome = coalesce(usuario_atribuido_nome, dados->>'usuario_atribuido_nome'),
  observacoes = coalesce(observacoes, dados->>'observacoes')
where dados is not null and dados <> '{}'::jsonb;

update public.contas_financeiras
  set dados = dados - array['nome', 'tipo', 'ativo', 'saldo_atual', 'saldo_inicial', 'banco', 'agencia', 'conta', 'cor', 'is_caixa_pdv', 'is_caixa_geral', 'usuario_atribuido_id', 'usuario_atribuido_nome', 'observacoes']
where dados is not null and dados <> '{}'::jsonb;


-- === pedido_venda (13 colunas) ===
alter table public.pedido_venda add column if not exists tipo text;
alter table public.pedido_venda add column if not exists subtotal numeric;
alter table public.pedido_venda add column if not exists valor_desconto numeric;
alter table public.pedido_venda add column if not exists valor_frete numeric;
alter table public.pedido_venda add column if not exists data_entrega date;
alter table public.pedido_venda add column if not exists metodo_entrega text;
alter table public.pedido_venda add column if not exists observacoes text;
alter table public.pedido_venda add column if not exists tabela_preco_id text;
alter table public.pedido_venda add column if not exists turno_caixa_id text;
alter table public.pedido_venda add column if not exists vendedor_id text;
alter table public.pedido_venda add column if not exists vendedor_nome text;
alter table public.pedido_venda add column if not exists orcamento_origem_id text;
alter table public.pedido_venda add column if not exists senha_atendimento text;

update public.pedido_venda set
  tipo = coalesce(tipo, dados->>'tipo'),
  subtotal = coalesce(subtotal, case when dados->>'subtotal' ~ '^-?[0-9]' then (dados->>'subtotal')::numeric else null end),
  valor_desconto = coalesce(valor_desconto, case when dados->>'valor_desconto' ~ '^-?[0-9]' then (dados->>'valor_desconto')::numeric else null end),
  valor_frete = coalesce(valor_frete, case when dados->>'valor_frete' ~ '^-?[0-9]' then (dados->>'valor_frete')::numeric else null end),
  data_entrega = coalesce(data_entrega, case when dados->>'data_entrega' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_entrega', 10)::date else null end),
  metodo_entrega = coalesce(metodo_entrega, dados->>'metodo_entrega'),
  observacoes = coalesce(observacoes, dados->>'observacoes'),
  tabela_preco_id = coalesce(tabela_preco_id, dados->>'tabela_preco_id'),
  turno_caixa_id = coalesce(turno_caixa_id, dados->>'turno_caixa_id'),
  vendedor_id = coalesce(vendedor_id, dados->>'vendedor_id'),
  vendedor_nome = coalesce(vendedor_nome, dados->>'vendedor_nome'),
  orcamento_origem_id = coalesce(orcamento_origem_id, dados->>'orcamento_origem_id'),
  senha_atendimento = coalesce(senha_atendimento, dados->>'senha_atendimento')
where dados is not null and dados <> '{}'::jsonb;

update public.pedido_venda
  set dados = dados - array['tipo', 'subtotal', 'valor_desconto', 'valor_frete', 'data_entrega', 'metodo_entrega', 'observacoes', 'tabela_preco_id', 'turno_caixa_id', 'vendedor_id', 'vendedor_nome', 'orcamento_origem_id', 'senha_atendimento']
where dados is not null and dados <> '{}'::jsonb;

create index if not exists idx_pedido_venda_vendedor_id on public.pedido_venda (vendedor_id);
create index if not exists idx_pedido_venda_turno_caixa_id on public.pedido_venda (turno_caixa_id);
create index if not exists idx_pedido_venda_data_entrega on public.pedido_venda (data_entrega);

-- Total promovido: 190 colunas em 8 tabelas.