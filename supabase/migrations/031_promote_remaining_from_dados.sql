-- 031_promote_remaining_from_dados.sql
-- Gerado por scripts/generate-migration-031-remaining.mjs
-- Promove todas as tabelas restantes + re-limpa dados duplicado no núcleo.

-- === pedido_compra (29 colunas) ===
alter table public.pedido_compra add column if not exists numero text;
alter table public.pedido_compra add column if not exists fornecedor_id text;
alter table public.pedido_compra add column if not exists fornecedor_nome text;
alter table public.pedido_compra add column if not exists data_emissao date;
alter table public.pedido_compra add column if not exists data_prevista_entrega date;
alter table public.pedido_compra add column if not exists status text;
alter table public.pedido_compra add column if not exists status_embarque text;
alter table public.pedido_compra add column if not exists percentual_valor_embarcado numeric;
alter table public.pedido_compra add column if not exists status_recebimento_geral text;
alter table public.pedido_compra add column if not exists itens jsonb;
alter table public.pedido_compra add column if not exists valor_total numeric;
alter table public.pedido_compra add column if not exists observacoes text;
alter table public.pedido_compra add column if not exists historico text;
alter table public.pedido_compra add column if not exists tags jsonb;
alter table public.pedido_compra add column if not exists nfe_emitida boolean;
alter table public.pedido_compra add column if not exists conta_pagamento_id text;
alter table public.pedido_compra add column if not exists tem_divergencias boolean;
alter table public.pedido_compra add column if not exists conferencia_id text;
alter table public.pedido_compra add column if not exists data_aprovacao_financeira timestamptz;
alter table public.pedido_compra add column if not exists data_despacho date;
alter table public.pedido_compra add column if not exists data_chegada date;
alter table public.pedido_compra add column if not exists data_conclusao date;
alter table public.pedido_compra add column if not exists motivo_rejeicao_financeira text;
alter table public.pedido_compra add column if not exists status_conferencia_pedido text;
alter table public.pedido_compra add column if not exists solicitacao_edicao_data timestamptz;
alter table public.pedido_compra add column if not exists solicitacao_edicao_motivo text;
alter table public.pedido_compra add column if not exists solicitacao_edicao_solicitante text;
alter table public.pedido_compra add column if not exists solicitacao_cancelamento_data timestamptz;
alter table public.pedido_compra add column if not exists solicitacao_cancelamento_motivo text;

update public.pedido_compra set
  numero = case when numero is null then dados->>'numero' else numero end,
  fornecedor_id = case when fornecedor_id is null then dados->>'fornecedor_id' else fornecedor_id end,
  fornecedor_nome = case when fornecedor_nome is null then dados->>'fornecedor_nome' else fornecedor_nome end,
  data_emissao = case when data_emissao is null then case when dados->>'data_emissao' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_emissao', 10)::date else null end else data_emissao end,
  data_prevista_entrega = case when data_prevista_entrega is null then case when dados->>'data_prevista_entrega' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_prevista_entrega', 10)::date else null end else data_prevista_entrega end,
  status = case when status is null then dados->>'status' else status end,
  status_embarque = case when status_embarque is null then dados->>'status_embarque' else status_embarque end,
  percentual_valor_embarcado = case when percentual_valor_embarcado is null then case when dados->>'percentual_valor_embarcado' ~ '^-?[0-9]' then (dados->>'percentual_valor_embarcado')::numeric else null end else percentual_valor_embarcado end,
  status_recebimento_geral = case when status_recebimento_geral is null then dados->>'status_recebimento_geral' else status_recebimento_geral end,
  itens = case when itens is null then (dados->'itens') else itens end,
  valor_total = case when valor_total is null then case when dados->>'valor_total' ~ '^-?[0-9]' then (dados->>'valor_total')::numeric else null end else valor_total end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  historico = case when historico is null then dados->>'historico' else historico end,
  tags = case when tags is null then (dados->'tags') else tags end,
  nfe_emitida = case when nfe_emitida is null then case when lower(dados->>'nfe_emitida') in ('true', 'false') then (dados->>'nfe_emitida')::boolean else null end else nfe_emitida end,
  conta_pagamento_id = case when conta_pagamento_id is null then dados->>'conta_pagamento_id' else conta_pagamento_id end,
  tem_divergencias = case when tem_divergencias is null then case when lower(dados->>'tem_divergencias') in ('true', 'false') then (dados->>'tem_divergencias')::boolean else null end else tem_divergencias end,
  conferencia_id = case when conferencia_id is null then dados->>'conferencia_id' else conferencia_id end,
  data_aprovacao_financeira = case when data_aprovacao_financeira is null then case when dados->>'data_aprovacao_financeira' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_aprovacao_financeira')::timestamptz else null end else data_aprovacao_financeira end,
  data_despacho = case when data_despacho is null then case when dados->>'data_despacho' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_despacho', 10)::date else null end else data_despacho end,
  data_chegada = case when data_chegada is null then case when dados->>'data_chegada' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_chegada', 10)::date else null end else data_chegada end,
  data_conclusao = case when data_conclusao is null then case when dados->>'data_conclusao' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_conclusao', 10)::date else null end else data_conclusao end,
  motivo_rejeicao_financeira = case when motivo_rejeicao_financeira is null then dados->>'motivo_rejeicao_financeira' else motivo_rejeicao_financeira end,
  status_conferencia_pedido = case when status_conferencia_pedido is null then dados->>'status_conferencia_pedido' else status_conferencia_pedido end,
  solicitacao_edicao_data = case when solicitacao_edicao_data is null then case when dados->>'solicitacao_edicao_data' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'solicitacao_edicao_data')::timestamptz else null end else solicitacao_edicao_data end,
  solicitacao_edicao_motivo = case when solicitacao_edicao_motivo is null then dados->>'solicitacao_edicao_motivo' else solicitacao_edicao_motivo end,
  solicitacao_edicao_solicitante = case when solicitacao_edicao_solicitante is null then dados->>'solicitacao_edicao_solicitante' else solicitacao_edicao_solicitante end,
  solicitacao_cancelamento_data = case when solicitacao_cancelamento_data is null then case when dados->>'solicitacao_cancelamento_data' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'solicitacao_cancelamento_data')::timestamptz else null end else solicitacao_cancelamento_data end,
  solicitacao_cancelamento_motivo = case when solicitacao_cancelamento_motivo is null then dados->>'solicitacao_cancelamento_motivo' else solicitacao_cancelamento_motivo end
where dados is not null and dados <> '{}'::jsonb;

update public.pedido_compra
  set dados = dados - array['numero', 'fornecedor_id', 'fornecedor_nome', 'data_emissao', 'data_prevista_entrega', 'status', 'status_embarque', 'percentual_valor_embarcado', 'status_recebimento_geral', 'itens', 'valor_total', 'observacoes', 'historico', 'tags', 'nfe_emitida', 'conta_pagamento_id', 'tem_divergencias', 'conferencia_id', 'data_aprovacao_financeira', 'data_despacho', 'data_chegada', 'data_conclusao', 'motivo_rejeicao_financeira', 'status_conferencia_pedido', 'solicitacao_edicao_data', 'solicitacao_edicao_motivo', 'solicitacao_edicao_solicitante', 'solicitacao_cancelamento_data', 'solicitacao_cancelamento_motivo']
where dados is not null and dados <> '{}'::jsonb;


-- === embarque (20 colunas) ===
alter table public.embarque add column if not exists pedido_compra_id text;
alter table public.embarque add column if not exists pedido_compra_numero text;
alter table public.embarque add column if not exists numero text;
alter table public.embarque add column if not exists tipo text;
alter table public.embarque add column if not exists status text;
alter table public.embarque add column if not exists status_recebimento text;
alter table public.embarque add column if not exists data_embarque timestamptz;
alter table public.embarque add column if not exists eta timestamptz;
alter table public.embarque add column if not exists fornecedor_id text;
alter table public.embarque add column if not exists fornecedor_nome text;
alter table public.embarque add column if not exists transportadora_id text;
alter table public.embarque add column if not exists transportadora_nome text;
alter table public.embarque add column if not exists supermanifesto_id text;
alter table public.embarque add column if not exists manifesto_entrada_id text;
alter table public.embarque add column if not exists evento_logistico_id text;
alter table public.embarque add column if not exists volumes jsonb;
alter table public.embarque add column if not exists volumes_detalhados jsonb;
alter table public.embarque add column if not exists peso_kg numeric;
alter table public.embarque add column if not exists observacoes text;
alter table public.embarque add column if not exists itens jsonb;

update public.embarque set
  pedido_compra_id = case when pedido_compra_id is null then dados->>'pedido_compra_id' else pedido_compra_id end,
  pedido_compra_numero = case when pedido_compra_numero is null then dados->>'pedido_compra_numero' else pedido_compra_numero end,
  numero = case when numero is null then dados->>'numero' else numero end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  status = case when status is null then dados->>'status' else status end,
  status_recebimento = case when status_recebimento is null then dados->>'status_recebimento' else status_recebimento end,
  data_embarque = case when data_embarque is null then case when dados->>'data_embarque' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_embarque')::timestamptz else null end else data_embarque end,
  eta = case when eta is null then case when dados->>'eta' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'eta')::timestamptz else null end else eta end,
  fornecedor_id = case when fornecedor_id is null then dados->>'fornecedor_id' else fornecedor_id end,
  fornecedor_nome = case when fornecedor_nome is null then dados->>'fornecedor_nome' else fornecedor_nome end,
  transportadora_id = case when transportadora_id is null then dados->>'transportadora_id' else transportadora_id end,
  transportadora_nome = case when transportadora_nome is null then dados->>'transportadora_nome' else transportadora_nome end,
  supermanifesto_id = case when supermanifesto_id is null then dados->>'supermanifesto_id' else supermanifesto_id end,
  manifesto_entrada_id = case when manifesto_entrada_id is null then dados->>'manifesto_entrada_id' else manifesto_entrada_id end,
  evento_logistico_id = case when evento_logistico_id is null then dados->>'evento_logistico_id' else evento_logistico_id end,
  volumes = case when volumes is null then (dados->'volumes') else volumes end,
  volumes_detalhados = case when volumes_detalhados is null then (dados->'volumes_detalhados') else volumes_detalhados end,
  peso_kg = case when peso_kg is null then case when dados->>'peso_kg' ~ '^-?[0-9]' then (dados->>'peso_kg')::numeric else null end else peso_kg end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  itens = case when itens is null then (dados->'itens') else itens end
where dados is not null and dados <> '{}'::jsonb;

update public.embarque
  set dados = dados - array['pedido_compra_id', 'pedido_compra_numero', 'numero', 'tipo', 'status', 'status_recebimento', 'data_embarque', 'eta', 'fornecedor_id', 'fornecedor_nome', 'transportadora_id', 'transportadora_nome', 'supermanifesto_id', 'manifesto_entrada_id', 'evento_logistico_id', 'volumes', 'volumes_detalhados', 'peso_kg', 'observacoes', 'itens']
where dados is not null and dados <> '{}'::jsonb;


-- === movimentacao_estoque (23 colunas) ===
alter table public.movimentacao_estoque add column if not exists produto_id text;
alter table public.movimentacao_estoque add column if not exists produto_nome text;
alter table public.movimentacao_estoque add column if not exists tipo text;
alter table public.movimentacao_estoque add column if not exists quantidade numeric;
alter table public.movimentacao_estoque add column if not exists quantidade_base numeric;
alter table public.movimentacao_estoque add column if not exists quantidade_comercial numeric;
alter table public.movimentacao_estoque add column if not exists origem_tipo text;
alter table public.movimentacao_estoque add column if not exists origem_id text;
alter table public.movimentacao_estoque add column if not exists motivo text;
alter table public.movimentacao_estoque add column if not exists unidade_medida text;
alter table public.movimentacao_estoque add column if not exists unidade_sigla text;
alter table public.movimentacao_estoque add column if not exists produto_unidade_id text;
alter table public.movimentacao_estoque add column if not exists fator_conversao numeric;
alter table public.movimentacao_estoque add column if not exists custo_unitario numeric;
alter table public.movimentacao_estoque add column if not exists documento_referencia text;
alter table public.movimentacao_estoque add column if not exists referencia_tipo text;
alter table public.movimentacao_estoque add column if not exists referencia_id text;
alter table public.movimentacao_estoque add column if not exists referencia_numero text;
alter table public.movimentacao_estoque add column if not exists observacoes text;
alter table public.movimentacao_estoque add column if not exists usuario_responsavel text;
alter table public.movimentacao_estoque add column if not exists numero_lote text;
alter table public.movimentacao_estoque add column if not exists data_validade date;
alter table public.movimentacao_estoque add column if not exists numeros_serie jsonb;

update public.movimentacao_estoque set
  produto_id = case when produto_id is null then dados->>'produto_id' else produto_id end,
  produto_nome = case when produto_nome is null then dados->>'produto_nome' else produto_nome end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  quantidade = case when quantidade is null then case when dados->>'quantidade' ~ '^-?[0-9]' then (dados->>'quantidade')::numeric else null end else quantidade end,
  quantidade_base = case when quantidade_base is null then case when dados->>'quantidade_base' ~ '^-?[0-9]' then (dados->>'quantidade_base')::numeric else null end else quantidade_base end,
  quantidade_comercial = case when quantidade_comercial is null then case when dados->>'quantidade_comercial' ~ '^-?[0-9]' then (dados->>'quantidade_comercial')::numeric else null end else quantidade_comercial end,
  origem_tipo = case when origem_tipo is null then dados->>'origem_tipo' else origem_tipo end,
  origem_id = case when origem_id is null then dados->>'origem_id' else origem_id end,
  motivo = case when motivo is null then dados->>'motivo' else motivo end,
  unidade_medida = case when unidade_medida is null then dados->>'unidade_medida' else unidade_medida end,
  unidade_sigla = case when unidade_sigla is null then dados->>'unidade_sigla' else unidade_sigla end,
  produto_unidade_id = case when produto_unidade_id is null then dados->>'produto_unidade_id' else produto_unidade_id end,
  fator_conversao = case when fator_conversao is null then case when dados->>'fator_conversao' ~ '^-?[0-9]' then (dados->>'fator_conversao')::numeric else null end else fator_conversao end,
  custo_unitario = case when custo_unitario is null then case when dados->>'custo_unitario' ~ '^-?[0-9]' then (dados->>'custo_unitario')::numeric else null end else custo_unitario end,
  documento_referencia = case when documento_referencia is null then dados->>'documento_referencia' else documento_referencia end,
  referencia_tipo = case when referencia_tipo is null then dados->>'referencia_tipo' else referencia_tipo end,
  referencia_id = case when referencia_id is null then dados->>'referencia_id' else referencia_id end,
  referencia_numero = case when referencia_numero is null then dados->>'referencia_numero' else referencia_numero end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  usuario_responsavel = case when usuario_responsavel is null then dados->>'usuario_responsavel' else usuario_responsavel end,
  numero_lote = case when numero_lote is null then dados->>'numero_lote' else numero_lote end,
  data_validade = case when data_validade is null then case when dados->>'data_validade' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_validade', 10)::date else null end else data_validade end,
  numeros_serie = case when numeros_serie is null then (dados->'numeros_serie') else numeros_serie end
where dados is not null and dados <> '{}'::jsonb;

update public.movimentacao_estoque
  set dados = dados - array['produto_id', 'produto_nome', 'tipo', 'quantidade', 'quantidade_base', 'quantidade_comercial', 'origem_tipo', 'origem_id', 'motivo', 'unidade_medida', 'unidade_sigla', 'produto_unidade_id', 'fator_conversao', 'custo_unitario', 'documento_referencia', 'referencia_tipo', 'referencia_id', 'referencia_numero', 'observacoes', 'usuario_responsavel', 'numero_lote', 'data_validade', 'numeros_serie']
where dados is not null and dados <> '{}'::jsonb;


-- === tabela_preco (5 colunas) ===
alter table public.tabela_preco add column if not exists nome_tabela text;
alter table public.tabela_preco add column if not exists fator_ajuste numeric;
alter table public.tabela_preco add column if not exists is_default boolean;
alter table public.tabela_preco add column if not exists percentual_desconto_maximo numeric;
alter table public.tabela_preco add column if not exists ativo boolean;

update public.tabela_preco set
  nome_tabela = case when nome_tabela is null then dados->>'nome_tabela' else nome_tabela end,
  fator_ajuste = case when fator_ajuste is null then case when dados->>'fator_ajuste' ~ '^-?[0-9]' then (dados->>'fator_ajuste')::numeric else null end else fator_ajuste end,
  is_default = case when is_default is null then case when lower(dados->>'is_default') in ('true', 'false') then (dados->>'is_default')::boolean else null end else is_default end,
  percentual_desconto_maximo = case when percentual_desconto_maximo is null then case when dados->>'percentual_desconto_maximo' ~ '^-?[0-9]' then (dados->>'percentual_desconto_maximo')::numeric else null end else percentual_desconto_maximo end,
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end
where dados is not null and dados <> '{}'::jsonb;

update public.tabela_preco
  set dados = dados - array['nome_tabela', 'fator_ajuste', 'is_default', 'percentual_desconto_maximo', 'ativo']
where dados is not null and dados <> '{}'::jsonb;


-- === categoria_financeira (3 colunas) ===
alter table public.categoria_financeira add column if not exists nome text;
alter table public.categoria_financeira add column if not exists tipo text;
alter table public.categoria_financeira add column if not exists ativa boolean;

update public.categoria_financeira set
  nome = case when nome is null then dados->>'nome' else nome end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  ativa = case when ativa is null then case when lower(dados->>'ativa') in ('true', 'false') then (dados->>'ativa')::boolean else null end else ativa end
where dados is not null and dados <> '{}'::jsonb;

update public.categoria_financeira
  set dados = dados - array['nome', 'tipo', 'ativa']
where dados is not null and dados <> '{}'::jsonb;


-- === rascunho_pedido_venda (21 colunas) ===
alter table public.rascunho_pedido_venda add column if not exists status text;
alter table public.rascunho_pedido_venda add column if not exists data_retorno timestamptz;
alter table public.rascunho_pedido_venda add column if not exists motivo_retorno text;
alter table public.rascunho_pedido_venda add column if not exists tipo text;
alter table public.rascunho_pedido_venda add column if not exists cliente_id text;
alter table public.rascunho_pedido_venda add column if not exists cliente_nome text;
alter table public.rascunho_pedido_venda add column if not exists vendedor_id text;
alter table public.rascunho_pedido_venda add column if not exists vendedor_nome text;
alter table public.rascunho_pedido_venda add column if not exists tabela_preco_id text;
alter table public.rascunho_pedido_venda add column if not exists subtotal numeric;
alter table public.rascunho_pedido_venda add column if not exists valor_desconto numeric;
alter table public.rascunho_pedido_venda add column if not exists valor_frete numeric;
alter table public.rascunho_pedido_venda add column if not exists valor_total numeric;
alter table public.rascunho_pedido_venda add column if not exists metodo_entrega text;
alter table public.rascunho_pedido_venda add column if not exists observacoes text;
alter table public.rascunho_pedido_venda add column if not exists senha_atendimento text;
alter table public.rascunho_pedido_venda add column if not exists itens jsonb;
alter table public.rascunho_pedido_venda add column if not exists pedido_venda_final_id text;
alter table public.rascunho_pedido_venda add column if not exists data_inicio_processamento timestamptz;
alter table public.rascunho_pedido_venda add column if not exists data_conversao timestamptz;
alter table public.rascunho_pedido_venda add column if not exists operador_processamento text;

update public.rascunho_pedido_venda set
  status = case when status is null then dados->>'status' else status end,
  data_retorno = case when data_retorno is null then case when dados->>'data_retorno' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_retorno')::timestamptz else null end else data_retorno end,
  motivo_retorno = case when motivo_retorno is null then dados->>'motivo_retorno' else motivo_retorno end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  cliente_id = case when cliente_id is null then dados->>'cliente_id' else cliente_id end,
  cliente_nome = case when cliente_nome is null then dados->>'cliente_nome' else cliente_nome end,
  vendedor_id = case when vendedor_id is null then dados->>'vendedor_id' else vendedor_id end,
  vendedor_nome = case when vendedor_nome is null then dados->>'vendedor_nome' else vendedor_nome end,
  tabela_preco_id = case when tabela_preco_id is null then dados->>'tabela_preco_id' else tabela_preco_id end,
  subtotal = case when subtotal is null then case when dados->>'subtotal' ~ '^-?[0-9]' then (dados->>'subtotal')::numeric else null end else subtotal end,
  valor_desconto = case when valor_desconto is null then case when dados->>'valor_desconto' ~ '^-?[0-9]' then (dados->>'valor_desconto')::numeric else null end else valor_desconto end,
  valor_frete = case when valor_frete is null then case when dados->>'valor_frete' ~ '^-?[0-9]' then (dados->>'valor_frete')::numeric else null end else valor_frete end,
  valor_total = case when valor_total is null then case when dados->>'valor_total' ~ '^-?[0-9]' then (dados->>'valor_total')::numeric else null end else valor_total end,
  metodo_entrega = case when metodo_entrega is null then dados->>'metodo_entrega' else metodo_entrega end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  senha_atendimento = case when senha_atendimento is null then dados->>'senha_atendimento' else senha_atendimento end,
  itens = case when itens is null then (dados->'itens') else itens end,
  pedido_venda_final_id = case when pedido_venda_final_id is null then dados->>'pedido_venda_final_id' else pedido_venda_final_id end,
  data_inicio_processamento = case when data_inicio_processamento is null then case when dados->>'data_inicio_processamento' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_inicio_processamento')::timestamptz else null end else data_inicio_processamento end,
  data_conversao = case when data_conversao is null then case when dados->>'data_conversao' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_conversao')::timestamptz else null end else data_conversao end,
  operador_processamento = case when operador_processamento is null then dados->>'operador_processamento' else operador_processamento end
where dados is not null and dados <> '{}'::jsonb;

update public.rascunho_pedido_venda
  set dados = dados - array['status', 'data_retorno', 'motivo_retorno', 'tipo', 'cliente_id', 'cliente_nome', 'vendedor_id', 'vendedor_nome', 'tabela_preco_id', 'subtotal', 'valor_desconto', 'valor_frete', 'valor_total', 'metodo_entrega', 'observacoes', 'senha_atendimento', 'itens', 'pedido_venda_final_id', 'data_inicio_processamento', 'data_conversao', 'operador_processamento']
where dados is not null and dados <> '{}'::jsonb;


-- === dados_empresa (23 colunas) ===
alter table public.dados_empresa add column if not exists razao_social text;
alter table public.dados_empresa add column if not exists nome_fantasia text;
alter table public.dados_empresa add column if not exists cnpj text;
alter table public.dados_empresa add column if not exists inscricao_estadual text;
alter table public.dados_empresa add column if not exists inscricao_municipal text;
alter table public.dados_empresa add column if not exists email text;
alter table public.dados_empresa add column if not exists telefone text;
alter table public.dados_empresa add column if not exists site text;
alter table public.dados_empresa add column if not exists endereco text;
alter table public.dados_empresa add column if not exists numero text;
alter table public.dados_empresa add column if not exists complemento text;
alter table public.dados_empresa add column if not exists bairro text;
alter table public.dados_empresa add column if not exists cidade text;
alter table public.dados_empresa add column if not exists estado text;
alter table public.dados_empresa add column if not exists cep text;
alter table public.dados_empresa add column if not exists logo_url text;
alter table public.dados_empresa add column if not exists situacao_cadastral text;
alter table public.dados_empresa add column if not exists atividade_principal text;
alter table public.dados_empresa add column if not exists natureza_juridica text;
alter table public.dados_empresa add column if not exists porte text;
alter table public.dados_empresa add column if not exists data_abertura timestamptz;
alter table public.dados_empresa add column if not exists mensagem_rodape text;
alter table public.dados_empresa add column if not exists folha_centros_custo jsonb;

update public.dados_empresa set
  razao_social = case when razao_social is null then dados->>'razao_social' else razao_social end,
  nome_fantasia = case when nome_fantasia is null then dados->>'nome_fantasia' else nome_fantasia end,
  cnpj = case when cnpj is null then dados->>'cnpj' else cnpj end,
  inscricao_estadual = case when inscricao_estadual is null then dados->>'inscricao_estadual' else inscricao_estadual end,
  inscricao_municipal = case when inscricao_municipal is null then dados->>'inscricao_municipal' else inscricao_municipal end,
  email = case when email is null then dados->>'email' else email end,
  telefone = case when telefone is null then dados->>'telefone' else telefone end,
  site = case when site is null then dados->>'site' else site end,
  endereco = case when endereco is null then dados->>'endereco' else endereco end,
  numero = case when numero is null then dados->>'numero' else numero end,
  complemento = case when complemento is null then dados->>'complemento' else complemento end,
  bairro = case when bairro is null then dados->>'bairro' else bairro end,
  cidade = case when cidade is null then dados->>'cidade' else cidade end,
  estado = case when estado is null then dados->>'estado' else estado end,
  cep = case when cep is null then dados->>'cep' else cep end,
  logo_url = case when logo_url is null then dados->>'logo_url' else logo_url end,
  situacao_cadastral = case when situacao_cadastral is null then dados->>'situacao_cadastral' else situacao_cadastral end,
  atividade_principal = case when atividade_principal is null then dados->>'atividade_principal' else atividade_principal end,
  natureza_juridica = case when natureza_juridica is null then dados->>'natureza_juridica' else natureza_juridica end,
  porte = case when porte is null then dados->>'porte' else porte end,
  data_abertura = case when data_abertura is null then case when dados->>'data_abertura' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_abertura')::timestamptz else null end else data_abertura end,
  mensagem_rodape = case when mensagem_rodape is null then dados->>'mensagem_rodape' else mensagem_rodape end,
  folha_centros_custo = case when folha_centros_custo is null then (dados->'folha_centros_custo') else folha_centros_custo end
where dados is not null and dados <> '{}'::jsonb;

update public.dados_empresa
  set dados = dados - array['razao_social', 'nome_fantasia', 'cnpj', 'inscricao_estadual', 'inscricao_municipal', 'email', 'telefone', 'site', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep', 'logo_url', 'situacao_cadastral', 'atividade_principal', 'natureza_juridica', 'porte', 'data_abertura', 'mensagem_rodape', 'folha_centros_custo']
where dados is not null and dados <> '{}'::jsonb;


-- === conferencia_estoque (10 colunas) ===
alter table public.conferencia_estoque add column if not exists nome_conferencia text;
alter table public.conferencia_estoque add column if not exists tipo_conferencia text;
alter table public.conferencia_estoque add column if not exists observacoes text;
alter table public.conferencia_estoque add column if not exists ajuste_aplicado text;
alter table public.conferencia_estoque add column if not exists data_fim date;
alter table public.conferencia_estoque add column if not exists data_inicio date;
alter table public.conferencia_estoque add column if not exists itens_conferidos jsonb;
alter table public.conferencia_estoque add column if not exists responsavel_id text;
alter table public.conferencia_estoque add column if not exists responsavel_nome text;
alter table public.conferencia_estoque add column if not exists status text;

update public.conferencia_estoque set
  nome_conferencia = case when nome_conferencia is null then dados->>'nome_conferencia' else nome_conferencia end,
  tipo_conferencia = case when tipo_conferencia is null then dados->>'tipo_conferencia' else tipo_conferencia end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  ajuste_aplicado = case when ajuste_aplicado is null then dados->>'ajuste_aplicado' else ajuste_aplicado end,
  data_fim = case when data_fim is null then case when dados->>'data_fim' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_fim', 10)::date else null end else data_fim end,
  data_inicio = case when data_inicio is null then case when dados->>'data_inicio' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_inicio', 10)::date else null end else data_inicio end,
  itens_conferidos = case when itens_conferidos is null then (dados->'itens_conferidos') else itens_conferidos end,
  responsavel_id = case when responsavel_id is null then dados->>'responsavel_id' else responsavel_id end,
  responsavel_nome = case when responsavel_nome is null then dados->>'responsavel_nome' else responsavel_nome end,
  status = case when status is null then dados->>'status' else status end
where dados is not null and dados <> '{}'::jsonb;

update public.conferencia_estoque
  set dados = dados - array['nome_conferencia', 'tipo_conferencia', 'observacoes', 'ajuste_aplicado', 'data_fim', 'data_inicio', 'itens_conferidos', 'responsavel_id', 'responsavel_nome', 'status']
where dados is not null and dados <> '{}'::jsonb;


-- === consumo_interno (16 colunas) ===
alter table public.consumo_interno add column if not exists numero text;
alter table public.consumo_interno add column if not exists status text;
alter table public.consumo_interno add column if not exists destinacao text;
alter table public.consumo_interno add column if not exists responsavel_recebimento text;
alter table public.consumo_interno add column if not exists usuario_solicitante_id text;
alter table public.consumo_interno add column if not exists usuario_solicitante_nome text;
alter table public.consumo_interno add column if not exists turno_caixa_id text;
alter table public.consumo_interno add column if not exists turno_caixa_numero text;
alter table public.consumo_interno add column if not exists quantidade_total_itens numeric;
alter table public.consumo_interno add column if not exists valor_total numeric;
alter table public.consumo_interno add column if not exists observacoes text;
alter table public.consumo_interno add column if not exists tags jsonb;
alter table public.consumo_interno add column if not exists itens jsonb;
alter table public.consumo_interno add column if not exists data_confirmacao timestamptz;
alter table public.consumo_interno add column if not exists assinatura_recolhedor_url text;
alter table public.consumo_interno add column if not exists assinatura_recolhedor_nome text;

update public.consumo_interno set
  numero = case when numero is null then dados->>'numero' else numero end,
  status = case when status is null then dados->>'status' else status end,
  destinacao = case when destinacao is null then dados->>'destinacao' else destinacao end,
  responsavel_recebimento = case when responsavel_recebimento is null then dados->>'responsavel_recebimento' else responsavel_recebimento end,
  usuario_solicitante_id = case when usuario_solicitante_id is null then dados->>'usuario_solicitante_id' else usuario_solicitante_id end,
  usuario_solicitante_nome = case when usuario_solicitante_nome is null then dados->>'usuario_solicitante_nome' else usuario_solicitante_nome end,
  turno_caixa_id = case when turno_caixa_id is null then dados->>'turno_caixa_id' else turno_caixa_id end,
  turno_caixa_numero = case when turno_caixa_numero is null then dados->>'turno_caixa_numero' else turno_caixa_numero end,
  quantidade_total_itens = case when quantidade_total_itens is null then case when dados->>'quantidade_total_itens' ~ '^-?[0-9]' then (dados->>'quantidade_total_itens')::numeric else null end else quantidade_total_itens end,
  valor_total = case when valor_total is null then case when dados->>'valor_total' ~ '^-?[0-9]' then (dados->>'valor_total')::numeric else null end else valor_total end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  tags = case when tags is null then (dados->'tags') else tags end,
  itens = case when itens is null then (dados->'itens') else itens end,
  data_confirmacao = case when data_confirmacao is null then case when dados->>'data_confirmacao' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_confirmacao')::timestamptz else null end else data_confirmacao end,
  assinatura_recolhedor_url = case when assinatura_recolhedor_url is null then dados->>'assinatura_recolhedor_url' else assinatura_recolhedor_url end,
  assinatura_recolhedor_nome = case when assinatura_recolhedor_nome is null then dados->>'assinatura_recolhedor_nome' else assinatura_recolhedor_nome end
where dados is not null and dados <> '{}'::jsonb;

update public.consumo_interno
  set dados = dados - array['numero', 'status', 'destinacao', 'responsavel_recebimento', 'usuario_solicitante_id', 'usuario_solicitante_nome', 'turno_caixa_id', 'turno_caixa_numero', 'quantidade_total_itens', 'valor_total', 'observacoes', 'tags', 'itens', 'data_confirmacao', 'assinatura_recolhedor_url', 'assinatura_recolhedor_nome']
where dados is not null and dados <> '{}'::jsonb;


-- === evento_logistico_sandbox (22 colunas) ===
alter table public.evento_logistico_sandbox add column if not exists codigo text;
alter table public.evento_logistico_sandbox add column if not exists nome text;
alter table public.evento_logistico_sandbox add column if not exists tipo_registro text;
alter table public.evento_logistico_sandbox add column if not exists status_operacao text;
alter table public.evento_logistico_sandbox add column if not exists transportadora_id text;
alter table public.evento_logistico_sandbox add column if not exists transportadora_nome text;
alter table public.evento_logistico_sandbox add column if not exists embarcacao_nome text;
alter table public.evento_logistico_sandbox add column if not exists embarcacao_template_id text;
alter table public.evento_logistico_sandbox add column if not exists rota_nome text;
alter table public.evento_logistico_sandbox add column if not exists rota_template_id text;
alter table public.evento_logistico_sandbox add column if not exists data_referencia date;
alter table public.evento_logistico_sandbox add column if not exists data_saida_origem date;
alter table public.evento_logistico_sandbox add column if not exists data_retorno_origem timestamptz;
alter table public.evento_logistico_sandbox add column if not exists data_chegada_manaus date;
alter table public.evento_logistico_sandbox add column if not exists previsao_chegada text;
alter table public.evento_logistico_sandbox add column if not exists previsao_retorno text;
alter table public.evento_logistico_sandbox add column if not exists proxima_chegada_manaus text;
alter table public.evento_logistico_sandbox add column if not exists data_chegada_destino date;
alter table public.evento_logistico_sandbox add column if not exists dias_atraso text;
alter table public.evento_logistico_sandbox add column if not exists ocupacao_percentual text;
alter table public.evento_logistico_sandbox add column if not exists chave_relacional_futura text;
alter table public.evento_logistico_sandbox add column if not exists observacoes text;

update public.evento_logistico_sandbox set
  codigo = case when codigo is null then dados->>'codigo' else codigo end,
  nome = case when nome is null then dados->>'nome' else nome end,
  tipo_registro = case when tipo_registro is null then dados->>'tipo_registro' else tipo_registro end,
  status_operacao = case when status_operacao is null then dados->>'status_operacao' else status_operacao end,
  transportadora_id = case when transportadora_id is null then dados->>'transportadora_id' else transportadora_id end,
  transportadora_nome = case when transportadora_nome is null then dados->>'transportadora_nome' else transportadora_nome end,
  embarcacao_nome = case when embarcacao_nome is null then dados->>'embarcacao_nome' else embarcacao_nome end,
  embarcacao_template_id = case when embarcacao_template_id is null then dados->>'embarcacao_template_id' else embarcacao_template_id end,
  rota_nome = case when rota_nome is null then dados->>'rota_nome' else rota_nome end,
  rota_template_id = case when rota_template_id is null then dados->>'rota_template_id' else rota_template_id end,
  data_referencia = case when data_referencia is null then case when dados->>'data_referencia' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_referencia', 10)::date else null end else data_referencia end,
  data_saida_origem = case when data_saida_origem is null then case when dados->>'data_saida_origem' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_saida_origem', 10)::date else null end else data_saida_origem end,
  data_retorno_origem = case when data_retorno_origem is null then case when dados->>'data_retorno_origem' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_retorno_origem')::timestamptz else null end else data_retorno_origem end,
  data_chegada_manaus = case when data_chegada_manaus is null then case when dados->>'data_chegada_manaus' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_chegada_manaus', 10)::date else null end else data_chegada_manaus end,
  previsao_chegada = case when previsao_chegada is null then dados->>'previsao_chegada' else previsao_chegada end,
  previsao_retorno = case when previsao_retorno is null then dados->>'previsao_retorno' else previsao_retorno end,
  proxima_chegada_manaus = case when proxima_chegada_manaus is null then dados->>'proxima_chegada_manaus' else proxima_chegada_manaus end,
  data_chegada_destino = case when data_chegada_destino is null then case when dados->>'data_chegada_destino' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_chegada_destino', 10)::date else null end else data_chegada_destino end,
  dias_atraso = case when dias_atraso is null then dados->>'dias_atraso' else dias_atraso end,
  ocupacao_percentual = case when ocupacao_percentual is null then dados->>'ocupacao_percentual' else ocupacao_percentual end,
  chave_relacional_futura = case when chave_relacional_futura is null then dados->>'chave_relacional_futura' else chave_relacional_futura end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end
where dados is not null and dados <> '{}'::jsonb;

update public.evento_logistico_sandbox
  set dados = dados - array['codigo', 'nome', 'tipo_registro', 'status_operacao', 'transportadora_id', 'transportadora_nome', 'embarcacao_nome', 'embarcacao_template_id', 'rota_nome', 'rota_template_id', 'data_referencia', 'data_saida_origem', 'data_retorno_origem', 'data_chegada_manaus', 'previsao_chegada', 'previsao_retorno', 'proxima_chegada_manaus', 'data_chegada_destino', 'dias_atraso', 'ocupacao_percentual', 'chave_relacional_futura', 'observacoes']
where dados is not null and dados <> '{}'::jsonb;


-- === anexo_documento (12 colunas) ===
alter table public.anexo_documento add column if not exists descricao text;
alter table public.anexo_documento add column if not exists mime_type text;
alter table public.anexo_documento add column if not exists nome_arquivo text;
alter table public.anexo_documento add column if not exists origem text;
alter table public.anexo_documento add column if not exists referencia_id text;
alter table public.anexo_documento add column if not exists referencia_numero text;
alter table public.anexo_documento add column if not exists referencia_tipo text;
alter table public.anexo_documento add column if not exists tamanho_bytes text;
alter table public.anexo_documento add column if not exists tipo_documento text;
alter table public.anexo_documento add column if not exists url_drive text;
alter table public.anexo_documento add column if not exists url_thumbnail text;
alter table public.anexo_documento add column if not exists drive_file_id text;

update public.anexo_documento set
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  mime_type = case when mime_type is null then dados->>'mime_type' else mime_type end,
  nome_arquivo = case when nome_arquivo is null then dados->>'nome_arquivo' else nome_arquivo end,
  origem = case when origem is null then dados->>'origem' else origem end,
  referencia_id = case when referencia_id is null then dados->>'referencia_id' else referencia_id end,
  referencia_numero = case when referencia_numero is null then dados->>'referencia_numero' else referencia_numero end,
  referencia_tipo = case when referencia_tipo is null then dados->>'referencia_tipo' else referencia_tipo end,
  tamanho_bytes = case when tamanho_bytes is null then dados->>'tamanho_bytes' else tamanho_bytes end,
  tipo_documento = case when tipo_documento is null then dados->>'tipo_documento' else tipo_documento end,
  url_drive = case when url_drive is null then dados->>'url_drive' else url_drive end,
  url_thumbnail = case when url_thumbnail is null then dados->>'url_thumbnail' else url_thumbnail end,
  drive_file_id = case when drive_file_id is null then dados->>'drive_file_id' else drive_file_id end
where dados is not null and dados <> '{}'::jsonb;

update public.anexo_documento
  set dados = dados - array['descricao', 'mime_type', 'nome_arquivo', 'origem', 'referencia_id', 'referencia_numero', 'referencia_tipo', 'tamanho_bytes', 'tipo_documento', 'url_drive', 'url_thumbnail', 'drive_file_id']
where dados is not null and dados <> '{}'::jsonb;


-- === area (4 colunas) ===
alter table public.area add column if not exists ativo boolean;
alter table public.area add column if not exists codigo text;
alter table public.area add column if not exists descricao text;
alter table public.area add column if not exists nome text;

update public.area set
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  codigo = case when codigo is null then dados->>'codigo' else codigo end,
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  nome = case when nome is null then dados->>'nome' else nome end
where dados is not null and dados <> '{}'::jsonb;

update public.area
  set dados = dados - array['ativo', 'codigo', 'descricao', 'nome']
where dados is not null and dados <> '{}'::jsonb;


-- === autorizacao_estorno (15 colunas) ===
alter table public.autorizacao_estorno add column if not exists caixa_operador_id text;
alter table public.autorizacao_estorno add column if not exists caixa_operador_nome text;
alter table public.autorizacao_estorno add column if not exists cliente_nome text;
alter table public.autorizacao_estorno add column if not exists devolucao_id text;
alter table public.autorizacao_estorno add column if not exists devolucao_numero text;
alter table public.autorizacao_estorno add column if not exists forma_reembolso text;
alter table public.autorizacao_estorno add column if not exists gerente_aprovador_id text;
alter table public.autorizacao_estorno add column if not exists gerente_aprovador_nome text;
alter table public.autorizacao_estorno add column if not exists motivo text;
alter table public.autorizacao_estorno add column if not exists numero text;
alter table public.autorizacao_estorno add column if not exists pedido_origem_numero text;
alter table public.autorizacao_estorno add column if not exists status text;
alter table public.autorizacao_estorno add column if not exists turno_caixa_destino_id text;
alter table public.autorizacao_estorno add column if not exists turno_caixa_destino_numero text;
alter table public.autorizacao_estorno add column if not exists valor_autorizado numeric;

update public.autorizacao_estorno set
  caixa_operador_id = case when caixa_operador_id is null then dados->>'caixa_operador_id' else caixa_operador_id end,
  caixa_operador_nome = case when caixa_operador_nome is null then dados->>'caixa_operador_nome' else caixa_operador_nome end,
  cliente_nome = case when cliente_nome is null then dados->>'cliente_nome' else cliente_nome end,
  devolucao_id = case when devolucao_id is null then dados->>'devolucao_id' else devolucao_id end,
  devolucao_numero = case when devolucao_numero is null then dados->>'devolucao_numero' else devolucao_numero end,
  forma_reembolso = case when forma_reembolso is null then dados->>'forma_reembolso' else forma_reembolso end,
  gerente_aprovador_id = case when gerente_aprovador_id is null then dados->>'gerente_aprovador_id' else gerente_aprovador_id end,
  gerente_aprovador_nome = case when gerente_aprovador_nome is null then dados->>'gerente_aprovador_nome' else gerente_aprovador_nome end,
  motivo = case when motivo is null then dados->>'motivo' else motivo end,
  numero = case when numero is null then dados->>'numero' else numero end,
  pedido_origem_numero = case when pedido_origem_numero is null then dados->>'pedido_origem_numero' else pedido_origem_numero end,
  status = case when status is null then dados->>'status' else status end,
  turno_caixa_destino_id = case when turno_caixa_destino_id is null then dados->>'turno_caixa_destino_id' else turno_caixa_destino_id end,
  turno_caixa_destino_numero = case when turno_caixa_destino_numero is null then dados->>'turno_caixa_destino_numero' else turno_caixa_destino_numero end,
  valor_autorizado = case when valor_autorizado is null then case when dados->>'valor_autorizado' ~ '^-?[0-9]' then (dados->>'valor_autorizado')::numeric else null end else valor_autorizado end
where dados is not null and dados <> '{}'::jsonb;

update public.autorizacao_estorno
  set dados = dados - array['caixa_operador_id', 'caixa_operador_nome', 'cliente_nome', 'devolucao_id', 'devolucao_numero', 'forma_reembolso', 'gerente_aprovador_id', 'gerente_aprovador_nome', 'motivo', 'numero', 'pedido_origem_numero', 'status', 'turno_caixa_destino_id', 'turno_caixa_destino_numero', 'valor_autorizado']
where dados is not null and dados <> '{}'::jsonb;


-- === comprovante_template (5 colunas) ===
alter table public.comprovante_template add column if not exists descricao text;
alter table public.comprovante_template add column if not exists html_template text;
alter table public.comprovante_template add column if not exists is_default boolean;
alter table public.comprovante_template add column if not exists nome text;
alter table public.comprovante_template add column if not exists tipo text;

update public.comprovante_template set
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  html_template = case when html_template is null then dados->>'html_template' else html_template end,
  is_default = case when is_default is null then case when lower(dados->>'is_default') in ('true', 'false') then (dados->>'is_default')::boolean else null end else is_default end,
  nome = case when nome is null then dados->>'nome' else nome end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end
where dados is not null and dados <> '{}'::jsonb;

update public.comprovante_template
  set dados = dados - array['descricao', 'html_template', 'is_default', 'nome', 'tipo']
where dados is not null and dados <> '{}'::jsonb;


-- === conferencia_compra (15 colunas) ===
alter table public.conferencia_compra add column if not exists assinatura_url text;
alter table public.conferencia_compra add column if not exists conferente_id text;
alter table public.conferencia_compra add column if not exists conferente_nome text;
alter table public.conferencia_compra add column if not exists data_conclusao date;
alter table public.conferencia_compra add column if not exists interveniente_id text;
alter table public.conferencia_compra add column if not exists interveniente_nome text;
alter table public.conferencia_compra add column if not exists itens_conferidos jsonb;
alter table public.conferencia_compra add column if not exists observacoes_gerais text;
alter table public.conferencia_compra add column if not exists pedido_compra_id text;
alter table public.conferencia_compra add column if not exists pedido_numero text;
alter table public.conferencia_compra add column if not exists senha_confirmacao text;
alter table public.conferencia_compra add column if not exists status text;
alter table public.conferencia_compra add column if not exists tipo text;
alter table public.conferencia_compra add column if not exists total_divergencias numeric;
alter table public.conferencia_compra add column if not exists total_itens_ok numeric;

update public.conferencia_compra set
  assinatura_url = case when assinatura_url is null then dados->>'assinatura_url' else assinatura_url end,
  conferente_id = case when conferente_id is null then dados->>'conferente_id' else conferente_id end,
  conferente_nome = case when conferente_nome is null then dados->>'conferente_nome' else conferente_nome end,
  data_conclusao = case when data_conclusao is null then case when dados->>'data_conclusao' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_conclusao', 10)::date else null end else data_conclusao end,
  interveniente_id = case when interveniente_id is null then dados->>'interveniente_id' else interveniente_id end,
  interveniente_nome = case when interveniente_nome is null then dados->>'interveniente_nome' else interveniente_nome end,
  itens_conferidos = case when itens_conferidos is null then (dados->'itens_conferidos') else itens_conferidos end,
  observacoes_gerais = case when observacoes_gerais is null then dados->>'observacoes_gerais' else observacoes_gerais end,
  pedido_compra_id = case when pedido_compra_id is null then dados->>'pedido_compra_id' else pedido_compra_id end,
  pedido_numero = case when pedido_numero is null then dados->>'pedido_numero' else pedido_numero end,
  senha_confirmacao = case when senha_confirmacao is null then dados->>'senha_confirmacao' else senha_confirmacao end,
  status = case when status is null then dados->>'status' else status end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  total_divergencias = case when total_divergencias is null then case when dados->>'total_divergencias' ~ '^-?[0-9]' then (dados->>'total_divergencias')::numeric else null end else total_divergencias end,
  total_itens_ok = case when total_itens_ok is null then case when dados->>'total_itens_ok' ~ '^-?[0-9]' then (dados->>'total_itens_ok')::numeric else null end else total_itens_ok end
where dados is not null and dados <> '{}'::jsonb;

update public.conferencia_compra
  set dados = dados - array['assinatura_url', 'conferente_id', 'conferente_nome', 'data_conclusao', 'interveniente_id', 'interveniente_nome', 'itens_conferidos', 'observacoes_gerais', 'pedido_compra_id', 'pedido_numero', 'senha_confirmacao', 'status', 'tipo', 'total_divergencias', 'total_itens_ok']
where dados is not null and dados <> '{}'::jsonb;


-- === config_auto_atendimento (3 colunas) ===
alter table public.config_auto_atendimento add column if not exists ativo boolean;
alter table public.config_auto_atendimento add column if not exists subtitulo_boas_vindas text;
alter table public.config_auto_atendimento add column if not exists titulo_boas_vindas text;

update public.config_auto_atendimento set
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  subtitulo_boas_vindas = case when subtitulo_boas_vindas is null then dados->>'subtitulo_boas_vindas' else subtitulo_boas_vindas end,
  titulo_boas_vindas = case when titulo_boas_vindas is null then dados->>'titulo_boas_vindas' else titulo_boas_vindas end
where dados is not null and dados <> '{}'::jsonb;

update public.config_auto_atendimento
  set dados = dados - array['ativo', 'subtitulo_boas_vindas', 'titulo_boas_vindas']
where dados is not null and dados <> '{}'::jsonb;


-- === cotacao (7 colunas) ===
alter table public.cotacao add column if not exists data_abertura timestamptz;
alter table public.cotacao add column if not exists fornecedores jsonb;
alter table public.cotacao add column if not exists itens jsonb;
alter table public.cotacao add column if not exists numero text;
alter table public.cotacao add column if not exists respostas jsonb;
alter table public.cotacao add column if not exists status text;
alter table public.cotacao add column if not exists titulo text;

update public.cotacao set
  data_abertura = case when data_abertura is null then case when dados->>'data_abertura' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_abertura')::timestamptz else null end else data_abertura end,
  fornecedores = case when fornecedores is null then (dados->'fornecedores') else fornecedores end,
  itens = case when itens is null then (dados->'itens') else itens end,
  numero = case when numero is null then dados->>'numero' else numero end,
  respostas = case when respostas is null then (dados->'respostas') else respostas end,
  status = case when status is null then dados->>'status' else status end,
  titulo = case when titulo is null then dados->>'titulo' else titulo end
where dados is not null and dados <> '{}'::jsonb;

update public.cotacao
  set dados = dados - array['data_abertura', 'fornecedores', 'itens', 'numero', 'respostas', 'status', 'titulo']
where dados is not null and dados <> '{}'::jsonb;


-- === destinacao_consumo_interno (2 colunas) ===
alter table public.destinacao_consumo_interno add column if not exists ativo boolean;
alter table public.destinacao_consumo_interno add column if not exists nome text;

update public.destinacao_consumo_interno set
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  nome = case when nome is null then dados->>'nome' else nome end
where dados is not null and dados <> '{}'::jsonb;

update public.destinacao_consumo_interno
  set dados = dados - array['ativo', 'nome']
where dados is not null and dados <> '{}'::jsonb;


-- === devolucao_troca (19 colunas) ===
alter table public.devolucao_troca add column if not exists cliente_id text;
alter table public.devolucao_troca add column if not exists cliente_nome text;
alter table public.devolucao_troca add column if not exists forma_reembolso text;
alter table public.devolucao_troca add column if not exists fotos_mercadoria jsonb;
alter table public.devolucao_troca add column if not exists itens_devolvidos jsonb;
alter table public.devolucao_troca add column if not exists motivo text;
alter table public.devolucao_troca add column if not exists numero text;
alter table public.devolucao_troca add column if not exists operador_id text;
alter table public.devolucao_troca add column if not exists operador_nome text;
alter table public.devolucao_troca add column if not exists pedido_origem_id text;
alter table public.devolucao_troca add column if not exists pedido_origem_numero text;
alter table public.devolucao_troca add column if not exists aguarda_substituto text;
alter table public.devolucao_troca add column if not exists pedido_substituto_id text;
alter table public.devolucao_troca add column if not exists pedido_substituto_numero text;
alter table public.devolucao_troca add column if not exists status text;
alter table public.devolucao_troca add column if not exists tipo text;
alter table public.devolucao_troca add column if not exists vale_compra_codigo text;
alter table public.devolucao_troca add column if not exists vale_compra_id text;
alter table public.devolucao_troca add column if not exists valor_total_devolvido numeric;

update public.devolucao_troca set
  cliente_id = case when cliente_id is null then dados->>'cliente_id' else cliente_id end,
  cliente_nome = case when cliente_nome is null then dados->>'cliente_nome' else cliente_nome end,
  forma_reembolso = case when forma_reembolso is null then dados->>'forma_reembolso' else forma_reembolso end,
  fotos_mercadoria = case when fotos_mercadoria is null then (dados->'fotos_mercadoria') else fotos_mercadoria end,
  itens_devolvidos = case when itens_devolvidos is null then (dados->'itens_devolvidos') else itens_devolvidos end,
  motivo = case when motivo is null then dados->>'motivo' else motivo end,
  numero = case when numero is null then dados->>'numero' else numero end,
  operador_id = case when operador_id is null then dados->>'operador_id' else operador_id end,
  operador_nome = case when operador_nome is null then dados->>'operador_nome' else operador_nome end,
  pedido_origem_id = case when pedido_origem_id is null then dados->>'pedido_origem_id' else pedido_origem_id end,
  pedido_origem_numero = case when pedido_origem_numero is null then dados->>'pedido_origem_numero' else pedido_origem_numero end,
  aguarda_substituto = case when aguarda_substituto is null then dados->>'aguarda_substituto' else aguarda_substituto end,
  pedido_substituto_id = case when pedido_substituto_id is null then dados->>'pedido_substituto_id' else pedido_substituto_id end,
  pedido_substituto_numero = case when pedido_substituto_numero is null then dados->>'pedido_substituto_numero' else pedido_substituto_numero end,
  status = case when status is null then dados->>'status' else status end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  vale_compra_codigo = case when vale_compra_codigo is null then dados->>'vale_compra_codigo' else vale_compra_codigo end,
  vale_compra_id = case when vale_compra_id is null then dados->>'vale_compra_id' else vale_compra_id end,
  valor_total_devolvido = case when valor_total_devolvido is null then case when dados->>'valor_total_devolvido' ~ '^-?[0-9]' then (dados->>'valor_total_devolvido')::numeric else null end else valor_total_devolvido end
where dados is not null and dados <> '{}'::jsonb;

update public.devolucao_troca
  set dados = dados - array['cliente_id', 'cliente_nome', 'forma_reembolso', 'fotos_mercadoria', 'itens_devolvidos', 'motivo', 'numero', 'operador_id', 'operador_nome', 'pedido_origem_id', 'pedido_origem_numero', 'aguarda_substituto', 'pedido_substituto_id', 'pedido_substituto_numero', 'status', 'tipo', 'vale_compra_codigo', 'vale_compra_id', 'valor_total_devolvido']
where dados is not null and dados <> '{}'::jsonb;


-- === divergencia_compra (16 colunas) ===
alter table public.divergencia_compra add column if not exists acao_tomada text;
alter table public.divergencia_compra add column if not exists conferencia_id text;
alter table public.divergencia_compra add column if not exists data_resolucao timestamptz;
alter table public.divergencia_compra add column if not exists descricao text;
alter table public.divergencia_compra add column if not exists fotos_urls jsonb;
alter table public.divergencia_compra add column if not exists pedido_compra_id text;
alter table public.divergencia_compra add column if not exists produto_id text;
alter table public.divergencia_compra add column if not exists produto_nome text;
alter table public.divergencia_compra add column if not exists quantidade_avariada numeric;
alter table public.divergencia_compra add column if not exists quantidade_esperada numeric;
alter table public.divergencia_compra add column if not exists quantidade_recebida numeric;
alter table public.divergencia_compra add column if not exists resolucao text;
alter table public.divergencia_compra add column if not exists responsavel_resolucao_id text;
alter table public.divergencia_compra add column if not exists responsavel_resolucao_nome text;
alter table public.divergencia_compra add column if not exists status text;
alter table public.divergencia_compra add column if not exists tipo text;

update public.divergencia_compra set
  acao_tomada = case when acao_tomada is null then dados->>'acao_tomada' else acao_tomada end,
  conferencia_id = case when conferencia_id is null then dados->>'conferencia_id' else conferencia_id end,
  data_resolucao = case when data_resolucao is null then case when dados->>'data_resolucao' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_resolucao')::timestamptz else null end else data_resolucao end,
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  fotos_urls = case when fotos_urls is null then (dados->'fotos_urls') else fotos_urls end,
  pedido_compra_id = case when pedido_compra_id is null then dados->>'pedido_compra_id' else pedido_compra_id end,
  produto_id = case when produto_id is null then dados->>'produto_id' else produto_id end,
  produto_nome = case when produto_nome is null then dados->>'produto_nome' else produto_nome end,
  quantidade_avariada = case when quantidade_avariada is null then case when dados->>'quantidade_avariada' ~ '^-?[0-9]' then (dados->>'quantidade_avariada')::numeric else null end else quantidade_avariada end,
  quantidade_esperada = case when quantidade_esperada is null then case when dados->>'quantidade_esperada' ~ '^-?[0-9]' then (dados->>'quantidade_esperada')::numeric else null end else quantidade_esperada end,
  quantidade_recebida = case when quantidade_recebida is null then case when dados->>'quantidade_recebida' ~ '^-?[0-9]' then (dados->>'quantidade_recebida')::numeric else null end else quantidade_recebida end,
  resolucao = case when resolucao is null then dados->>'resolucao' else resolucao end,
  responsavel_resolucao_id = case when responsavel_resolucao_id is null then dados->>'responsavel_resolucao_id' else responsavel_resolucao_id end,
  responsavel_resolucao_nome = case when responsavel_resolucao_nome is null then dados->>'responsavel_resolucao_nome' else responsavel_resolucao_nome end,
  status = case when status is null then dados->>'status' else status end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end
where dados is not null and dados <> '{}'::jsonb;

update public.divergencia_compra
  set dados = dados - array['acao_tomada', 'conferencia_id', 'data_resolucao', 'descricao', 'fotos_urls', 'pedido_compra_id', 'produto_id', 'produto_nome', 'quantidade_avariada', 'quantidade_esperada', 'quantidade_recebida', 'resolucao', 'responsavel_resolucao_id', 'responsavel_resolucao_nome', 'status', 'tipo']
where dados is not null and dados <> '{}'::jsonb;


-- === evento_editor_layout (5 colunas) ===
alter table public.evento_editor_layout add column if not exists dados_evento jsonb;
alter table public.evento_editor_layout add column if not exists descricao_acao text;
alter table public.evento_editor_layout add column if not exists sequencia_blocos jsonb;
alter table public.evento_editor_layout add column if not exists template_layout_id text;
alter table public.evento_editor_layout add column if not exists tipo_evento text;

update public.evento_editor_layout set
  dados_evento = case when dados_evento is null then (dados->'dados_evento') else dados_evento end,
  descricao_acao = case when descricao_acao is null then dados->>'descricao_acao' else descricao_acao end,
  sequencia_blocos = case when sequencia_blocos is null then (dados->'sequencia_blocos') else sequencia_blocos end,
  template_layout_id = case when template_layout_id is null then dados->>'template_layout_id' else template_layout_id end,
  tipo_evento = case when tipo_evento is null then dados->>'tipo_evento' else tipo_evento end
where dados is not null and dados <> '{}'::jsonb;

update public.evento_editor_layout
  set dados = dados - array['dados_evento', 'descricao_acao', 'sequencia_blocos', 'template_layout_id', 'tipo_evento']
where dados is not null and dados <> '{}'::jsonb;


-- === eventos_logisticos (18 colunas) ===
alter table public.eventos_logisticos add column if not exists causa_atraso text;
alter table public.eventos_logisticos add column if not exists contagem_volumes_ok integer;
alter table public.eventos_logisticos add column if not exists data_hora_conclusao timestamptz;
alter table public.eventos_logisticos add column if not exists data_prevista date;
alter table public.eventos_logisticos add column if not exists foto_avarias_url text;
alter table public.eventos_logisticos add column if not exists itens_recebidos jsonb;
alter table public.eventos_logisticos add column if not exists numero text;
alter table public.eventos_logisticos add column if not exists observacoes_discrepancia text;
alter table public.eventos_logisticos add column if not exists pedidos_compra_ids jsonb;
alter table public.eventos_logisticos add column if not exists responsavel_id text;
alter table public.eventos_logisticos add column if not exists responsavel_nome text;
alter table public.eventos_logisticos add column if not exists status text;
alter table public.eventos_logisticos add column if not exists sugestao_melhoria text;
alter table public.eventos_logisticos add column if not exists teve_atraso text;
alter table public.eventos_logisticos add column if not exists teve_avarias text;
alter table public.eventos_logisticos add column if not exists tipo text;
alter table public.eventos_logisticos add column if not exists titulo text;
alter table public.eventos_logisticos add column if not exists veredito_conformidade text;

update public.eventos_logisticos set
  causa_atraso = case when causa_atraso is null then dados->>'causa_atraso' else causa_atraso end,
  contagem_volumes_ok = case when contagem_volumes_ok is null then case when dados->>'contagem_volumes_ok' ~ '^-?[0-9]' then (dados->>'contagem_volumes_ok')::integer else null end else contagem_volumes_ok end,
  data_hora_conclusao = case when data_hora_conclusao is null then case when dados->>'data_hora_conclusao' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_hora_conclusao')::timestamptz else null end else data_hora_conclusao end,
  data_prevista = case when data_prevista is null then case when dados->>'data_prevista' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_prevista', 10)::date else null end else data_prevista end,
  foto_avarias_url = case when foto_avarias_url is null then dados->>'foto_avarias_url' else foto_avarias_url end,
  itens_recebidos = case when itens_recebidos is null then (dados->'itens_recebidos') else itens_recebidos end,
  numero = case when numero is null then dados->>'numero' else numero end,
  observacoes_discrepancia = case when observacoes_discrepancia is null then dados->>'observacoes_discrepancia' else observacoes_discrepancia end,
  pedidos_compra_ids = case when pedidos_compra_ids is null then (dados->'pedidos_compra_ids') else pedidos_compra_ids end,
  responsavel_id = case when responsavel_id is null then dados->>'responsavel_id' else responsavel_id end,
  responsavel_nome = case when responsavel_nome is null then dados->>'responsavel_nome' else responsavel_nome end,
  status = case when status is null then dados->>'status' else status end,
  sugestao_melhoria = case when sugestao_melhoria is null then dados->>'sugestao_melhoria' else sugestao_melhoria end,
  teve_atraso = case when teve_atraso is null then dados->>'teve_atraso' else teve_atraso end,
  teve_avarias = case when teve_avarias is null then dados->>'teve_avarias' else teve_avarias end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  titulo = case when titulo is null then dados->>'titulo' else titulo end,
  veredito_conformidade = case when veredito_conformidade is null then dados->>'veredito_conformidade' else veredito_conformidade end
where dados is not null and dados <> '{}'::jsonb;

update public.eventos_logisticos
  set dados = dados - array['causa_atraso', 'contagem_volumes_ok', 'data_hora_conclusao', 'data_prevista', 'foto_avarias_url', 'itens_recebidos', 'numero', 'observacoes_discrepancia', 'pedidos_compra_ids', 'responsavel_id', 'responsavel_nome', 'status', 'sugestao_melhoria', 'teve_atraso', 'teve_avarias', 'tipo', 'titulo', 'veredito_conformidade']
where dados is not null and dados <> '{}'::jsonb;


-- === importacao_log (7 colunas) ===
alter table public.importacao_log add column if not exists data_desfeita timestamptz;
alter table public.importacao_log add column if not exists quantidade_itens integer;
alter table public.importacao_log add column if not exists snapshot_dados jsonb;
alter table public.importacao_log add column if not exists status text;
alter table public.importacao_log add column if not exists tipo_importacao text;
alter table public.importacao_log add column if not exists usuario_desfez text;
alter table public.importacao_log add column if not exists usuario_responsavel text;

update public.importacao_log set
  data_desfeita = case when data_desfeita is null then case when dados->>'data_desfeita' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_desfeita')::timestamptz else null end else data_desfeita end,
  quantidade_itens = case when quantidade_itens is null then case when dados->>'quantidade_itens' ~ '^-?[0-9]' then (dados->>'quantidade_itens')::integer else null end else quantidade_itens end,
  snapshot_dados = case when snapshot_dados is null then (dados->'snapshot_dados') else snapshot_dados end,
  status = case when status is null then dados->>'status' else status end,
  tipo_importacao = case when tipo_importacao is null then dados->>'tipo_importacao' else tipo_importacao end,
  usuario_desfez = case when usuario_desfez is null then dados->>'usuario_desfez' else usuario_desfez end,
  usuario_responsavel = case when usuario_responsavel is null then dados->>'usuario_responsavel' else usuario_responsavel end
where dados is not null and dados <> '{}'::jsonb;

update public.importacao_log
  set dados = dados - array['data_desfeita', 'quantidade_itens', 'snapshot_dados', 'status', 'tipo_importacao', 'usuario_desfez', 'usuario_responsavel']
where dados is not null and dados <> '{}'::jsonb;


-- === interveniente (1 colunas) ===
alter table public.interveniente add column if not exists ativo boolean;

update public.interveniente set
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end
where dados is not null and dados <> '{}'::jsonb;

update public.interveniente
  set dados = dados - array['ativo']
where dados is not null and dados <> '{}'::jsonb;


-- === layout_template (6 colunas) ===
alter table public.layout_template add column if not exists blocks_config jsonb;
alter table public.layout_template add column if not exists categoria text;
alter table public.layout_template add column if not exists descricao text;
alter table public.layout_template add column if not exists is_default boolean;
alter table public.layout_template add column if not exists nome text;
alter table public.layout_template add column if not exists tipo text;

update public.layout_template set
  blocks_config = case when blocks_config is null then (dados->'blocks_config') else blocks_config end,
  categoria = case when categoria is null then dados->>'categoria' else categoria end,
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  is_default = case when is_default is null then case when lower(dados->>'is_default') in ('true', 'false') then (dados->>'is_default')::boolean else null end else is_default end,
  nome = case when nome is null then dados->>'nome' else nome end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end
where dados is not null and dados <> '{}'::jsonb;

update public.layout_template
  set dados = dados - array['blocks_config', 'categoria', 'descricao', 'is_default', 'nome', 'tipo']
where dados is not null and dados <> '{}'::jsonb;


-- === lote_estoque (8 colunas) ===
alter table public.lote_estoque add column if not exists data_entrada_no_lote date;
alter table public.lote_estoque add column if not exists data_validade date;
alter table public.lote_estoque add column if not exists numero_lote text;
alter table public.lote_estoque add column if not exists numeros_serie jsonb;
alter table public.lote_estoque add column if not exists produto_id text;
alter table public.lote_estoque add column if not exists produto_nome text;
alter table public.lote_estoque add column if not exists quantidade_atual numeric;
alter table public.lote_estoque add column if not exists status text;

update public.lote_estoque set
  data_entrada_no_lote = case when data_entrada_no_lote is null then case when dados->>'data_entrada_no_lote' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_entrada_no_lote', 10)::date else null end else data_entrada_no_lote end,
  data_validade = case when data_validade is null then case when dados->>'data_validade' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_validade', 10)::date else null end else data_validade end,
  numero_lote = case when numero_lote is null then dados->>'numero_lote' else numero_lote end,
  numeros_serie = case when numeros_serie is null then (dados->'numeros_serie') else numeros_serie end,
  produto_id = case when produto_id is null then dados->>'produto_id' else produto_id end,
  produto_nome = case when produto_nome is null then dados->>'produto_nome' else produto_nome end,
  quantidade_atual = case when quantidade_atual is null then case when dados->>'quantidade_atual' ~ '^-?[0-9]' then (dados->>'quantidade_atual')::numeric else null end else quantidade_atual end,
  status = case when status is null then dados->>'status' else status end
where dados is not null and dados <> '{}'::jsonb;

update public.lote_estoque
  set dados = dados - array['data_entrada_no_lote', 'data_validade', 'numero_lote', 'numeros_serie', 'produto_id', 'produto_nome', 'quantidade_atual', 'status']
where dados is not null and dados <> '{}'::jsonb;


-- === manifesto_entrada (7 colunas) ===
alter table public.manifesto_entrada add column if not exists conferente_id text;
alter table public.manifesto_entrada add column if not exists conferente_nome text;
alter table public.manifesto_entrada add column if not exists data_conferencia timestamptz;
alter table public.manifesto_entrada add column if not exists itens_conferidos jsonb;
alter table public.manifesto_entrada add column if not exists status text;
alter table public.manifesto_entrada add column if not exists status_codigo_conferencia_itens text;
alter table public.manifesto_entrada add column if not exists volumes jsonb;

update public.manifesto_entrada set
  conferente_id = case when conferente_id is null then dados->>'conferente_id' else conferente_id end,
  conferente_nome = case when conferente_nome is null then dados->>'conferente_nome' else conferente_nome end,
  data_conferencia = case when data_conferencia is null then case when dados->>'data_conferencia' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_conferencia')::timestamptz else null end else data_conferencia end,
  itens_conferidos = case when itens_conferidos is null then (dados->'itens_conferidos') else itens_conferidos end,
  status = case when status is null then dados->>'status' else status end,
  status_codigo_conferencia_itens = case when status_codigo_conferencia_itens is null then dados->>'status_codigo_conferencia_itens' else status_codigo_conferencia_itens end,
  volumes = case when volumes is null then (dados->'volumes') else volumes end
where dados is not null and dados <> '{}'::jsonb;

update public.manifesto_entrada
  set dados = dados - array['conferente_id', 'conferente_nome', 'data_conferencia', 'itens_conferidos', 'status', 'status_codigo_conferencia_itens', 'volumes']
where dados is not null and dados <> '{}'::jsonb;


-- === maquininha (1 colunas) ===
alter table public.maquininha add column if not exists ativo boolean;

update public.maquininha set
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end
where dados is not null and dados <> '{}'::jsonb;

update public.maquininha
  set dados = dados - array['ativo']
where dados is not null and dados <> '{}'::jsonb;


-- === ordem_separacao (1 colunas) ===
alter table public.ordem_separacao add column if not exists pedido_venda_id text;

update public.ordem_separacao set
  pedido_venda_id = case when pedido_venda_id is null then dados->>'pedido_venda_id' else pedido_venda_id end
where dados is not null and dados <> '{}'::jsonb;

update public.ordem_separacao
  set dados = dados - array['pedido_venda_id']
where dados is not null and dados <> '{}'::jsonb;


-- === protocolo_entrega (1 colunas) ===
alter table public.protocolo_entrega add column if not exists pedido_venda_id text;

update public.protocolo_entrega set
  pedido_venda_id = case when pedido_venda_id is null then dados->>'pedido_venda_id' else pedido_venda_id end
where dados is not null and dados <> '{}'::jsonb;

update public.protocolo_entrega
  set dados = dados - array['pedido_venda_id']
where dados is not null and dados <> '{}'::jsonb;


-- === responsavel_consumo_interno (2 colunas) ===
alter table public.responsavel_consumo_interno add column if not exists ativo boolean;
alter table public.responsavel_consumo_interno add column if not exists nome text;

update public.responsavel_consumo_interno set
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  nome = case when nome is null then dados->>'nome' else nome end
where dados is not null and dados <> '{}'::jsonb;

update public.responsavel_consumo_interno
  set dados = dados - array['ativo', 'nome']
where dados is not null and dados <> '{}'::jsonb;


-- === supermanifesto (17 colunas) ===
alter table public.supermanifesto add column if not exists conferente_volumes_foto text;
alter table public.supermanifesto add column if not exists conferente_volumes_id text;
alter table public.supermanifesto add column if not exists conferente_volumes_nome text;
alter table public.supermanifesto add column if not exists conferente_volumes_senha_hash text;
alter table public.supermanifesto add column if not exists data_conferencia_volumes timestamptz;
alter table public.supermanifesto add column if not exists observacoes_consolidadas text;
alter table public.supermanifesto add column if not exists ocorrencias_conferencia jsonb;
alter table public.supermanifesto add column if not exists pedidos_vinculados jsonb;
alter table public.supermanifesto add column if not exists peso_total_bruto_kg numeric;
alter table public.supermanifesto add column if not exists reabertura_data text;
alter table public.supermanifesto add column if not exists reabertura_foto text;
alter table public.supermanifesto add column if not exists reabertura_responsavel text;
alter table public.supermanifesto add column if not exists reabertura_senha_hash text;
alter table public.supermanifesto add column if not exists status text;
alter table public.supermanifesto add column if not exists status_codigo_conferencia_volumes text;
alter table public.supermanifesto add column if not exists tem_divergencias boolean;
alter table public.supermanifesto add column if not exists volumes_conferidos jsonb;

update public.supermanifesto set
  conferente_volumes_foto = case when conferente_volumes_foto is null then dados->>'conferente_volumes_foto' else conferente_volumes_foto end,
  conferente_volumes_id = case when conferente_volumes_id is null then dados->>'conferente_volumes_id' else conferente_volumes_id end,
  conferente_volumes_nome = case when conferente_volumes_nome is null then dados->>'conferente_volumes_nome' else conferente_volumes_nome end,
  conferente_volumes_senha_hash = case when conferente_volumes_senha_hash is null then dados->>'conferente_volumes_senha_hash' else conferente_volumes_senha_hash end,
  data_conferencia_volumes = case when data_conferencia_volumes is null then case when dados->>'data_conferencia_volumes' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_conferencia_volumes')::timestamptz else null end else data_conferencia_volumes end,
  observacoes_consolidadas = case when observacoes_consolidadas is null then dados->>'observacoes_consolidadas' else observacoes_consolidadas end,
  ocorrencias_conferencia = case when ocorrencias_conferencia is null then (dados->'ocorrencias_conferencia') else ocorrencias_conferencia end,
  pedidos_vinculados = case when pedidos_vinculados is null then (dados->'pedidos_vinculados') else pedidos_vinculados end,
  peso_total_bruto_kg = case when peso_total_bruto_kg is null then case when dados->>'peso_total_bruto_kg' ~ '^-?[0-9]' then (dados->>'peso_total_bruto_kg')::numeric else null end else peso_total_bruto_kg end,
  reabertura_data = case when reabertura_data is null then dados->>'reabertura_data' else reabertura_data end,
  reabertura_foto = case when reabertura_foto is null then dados->>'reabertura_foto' else reabertura_foto end,
  reabertura_responsavel = case when reabertura_responsavel is null then dados->>'reabertura_responsavel' else reabertura_responsavel end,
  reabertura_senha_hash = case when reabertura_senha_hash is null then dados->>'reabertura_senha_hash' else reabertura_senha_hash end,
  status = case when status is null then dados->>'status' else status end,
  status_codigo_conferencia_volumes = case when status_codigo_conferencia_volumes is null then dados->>'status_codigo_conferencia_volumes' else status_codigo_conferencia_volumes end,
  tem_divergencias = case when tem_divergencias is null then case when lower(dados->>'tem_divergencias') in ('true', 'false') then (dados->>'tem_divergencias')::boolean else null end else tem_divergencias end,
  volumes_conferidos = case when volumes_conferidos is null then (dados->'volumes_conferidos') else volumes_conferidos end
where dados is not null and dados <> '{}'::jsonb;

update public.supermanifesto
  set dados = dados - array['conferente_volumes_foto', 'conferente_volumes_id', 'conferente_volumes_nome', 'conferente_volumes_senha_hash', 'data_conferencia_volumes', 'observacoes_consolidadas', 'ocorrencias_conferencia', 'pedidos_vinculados', 'peso_total_bruto_kg', 'reabertura_data', 'reabertura_foto', 'reabertura_responsavel', 'reabertura_senha_hash', 'status', 'status_codigo_conferencia_volumes', 'tem_divergencias', 'volumes_conferidos']
where dados is not null and dados <> '{}'::jsonb;


-- === tarefa (13 colunas) ===
alter table public.tarefa add column if not exists data_conclusao date;
alter table public.tarefa add column if not exists data_vencimento date;
alter table public.tarefa add column if not exists descricao text;
alter table public.tarefa add column if not exists prioridade text;
alter table public.tarefa add column if not exists referencia_id text;
alter table public.tarefa add column if not exists referencia_numero text;
alter table public.tarefa add column if not exists referencia_tipo text;
alter table public.tarefa add column if not exists responsavel_id text;
alter table public.tarefa add column if not exists responsavel_nome text;
alter table public.tarefa add column if not exists status text;
alter table public.tarefa add column if not exists tipo text;
alter table public.tarefa add column if not exists titulo text;
alter table public.tarefa add column if not exists valor_pendente numeric;

update public.tarefa set
  data_conclusao = case when data_conclusao is null then case when dados->>'data_conclusao' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_conclusao', 10)::date else null end else data_conclusao end,
  data_vencimento = case when data_vencimento is null then case when dados->>'data_vencimento' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_vencimento', 10)::date else null end else data_vencimento end,
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  prioridade = case when prioridade is null then dados->>'prioridade' else prioridade end,
  referencia_id = case when referencia_id is null then dados->>'referencia_id' else referencia_id end,
  referencia_numero = case when referencia_numero is null then dados->>'referencia_numero' else referencia_numero end,
  referencia_tipo = case when referencia_tipo is null then dados->>'referencia_tipo' else referencia_tipo end,
  responsavel_id = case when responsavel_id is null then dados->>'responsavel_id' else responsavel_id end,
  responsavel_nome = case when responsavel_nome is null then dados->>'responsavel_nome' else responsavel_nome end,
  status = case when status is null then dados->>'status' else status end,
  tipo = case when tipo is null then dados->>'tipo' else tipo end,
  titulo = case when titulo is null then dados->>'titulo' else titulo end,
  valor_pendente = case when valor_pendente is null then case when dados->>'valor_pendente' ~ '^-?[0-9]' then (dados->>'valor_pendente')::numeric else null end else valor_pendente end
where dados is not null and dados <> '{}'::jsonb;

update public.tarefa
  set dados = dados - array['data_conclusao', 'data_vencimento', 'descricao', 'prioridade', 'referencia_id', 'referencia_numero', 'referencia_tipo', 'responsavel_id', 'responsavel_nome', 'status', 'tipo', 'titulo', 'valor_pendente']
where dados is not null and dados <> '{}'::jsonb;


-- === transicao_pedido_compra (11 colunas) ===
alter table public.transicao_pedido_compra add column if not exists codigo_operacao text;
alter table public.transicao_pedido_compra add column if not exists data_transicao timestamptz;
alter table public.transicao_pedido_compra add column if not exists observacao text;
alter table public.transicao_pedido_compra add column if not exists pedido_id text;
alter table public.transicao_pedido_compra add column if not exists pedido_numero text;
alter table public.transicao_pedido_compra add column if not exists responsavel_email text;
alter table public.transicao_pedido_compra add column if not exists responsavel_id text;
alter table public.transicao_pedido_compra add column if not exists responsavel_nome text;
alter table public.transicao_pedido_compra add column if not exists status_anterior text;
alter table public.transicao_pedido_compra add column if not exists status_novo text;
alter table public.transicao_pedido_compra add column if not exists tipo_autenticacao text;

update public.transicao_pedido_compra set
  codigo_operacao = case when codigo_operacao is null then dados->>'codigo_operacao' else codigo_operacao end,
  data_transicao = case when data_transicao is null then case when dados->>'data_transicao' ~ '^\d{4}-\d{2}-\d{2}' then (dados->>'data_transicao')::timestamptz else null end else data_transicao end,
  observacao = case when observacao is null then dados->>'observacao' else observacao end,
  pedido_id = case when pedido_id is null then dados->>'pedido_id' else pedido_id end,
  pedido_numero = case when pedido_numero is null then dados->>'pedido_numero' else pedido_numero end,
  responsavel_email = case when responsavel_email is null then dados->>'responsavel_email' else responsavel_email end,
  responsavel_id = case when responsavel_id is null then dados->>'responsavel_id' else responsavel_id end,
  responsavel_nome = case when responsavel_nome is null then dados->>'responsavel_nome' else responsavel_nome end,
  status_anterior = case when status_anterior is null then dados->>'status_anterior' else status_anterior end,
  status_novo = case when status_novo is null then dados->>'status_novo' else status_novo end,
  tipo_autenticacao = case when tipo_autenticacao is null then dados->>'tipo_autenticacao' else tipo_autenticacao end
where dados is not null and dados <> '{}'::jsonb;

update public.transicao_pedido_compra
  set dados = dados - array['codigo_operacao', 'data_transicao', 'observacao', 'pedido_id', 'pedido_numero', 'responsavel_email', 'responsavel_id', 'responsavel_nome', 'status_anterior', 'status_novo', 'tipo_autenticacao']
where dados is not null and dados <> '{}'::jsonb;


-- === transportadora (8 colunas) ===
alter table public.transportadora add column if not exists ativo boolean;
alter table public.transportadora add column if not exists nome text;
alter table public.transportadora add column if not exists saida_referencia text;
alter table public.transportadora add column if not exists cnpj text;
alter table public.transportadora add column if not exists contato text;
alter table public.transportadora add column if not exists email text;
alter table public.transportadora add column if not exists telefone text;
alter table public.transportadora add column if not exists observacoes text;

update public.transportadora set
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  nome = case when nome is null then dados->>'nome' else nome end,
  saida_referencia = case when saida_referencia is null then dados->>'saida_referencia' else saida_referencia end,
  cnpj = case when cnpj is null then dados->>'cnpj' else cnpj end,
  contato = case when contato is null then dados->>'contato' else contato end,
  email = case when email is null then dados->>'email' else email end,
  telefone = case when telefone is null then dados->>'telefone' else telefone end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end
where dados is not null and dados <> '{}'::jsonb;

update public.transportadora
  set dados = dados - array['ativo', 'nome', 'saida_referencia', 'cnpj', 'contato', 'email', 'telefone', 'observacoes']
where dados is not null and dados <> '{}'::jsonb;


-- === usuario (12 colunas) ===
alter table public.usuario add column if not exists caixas_pdv_autorizados_ids jsonb;
alter table public.usuario add column if not exists email text;
alter table public.usuario add column if not exists full_name text;
alter table public.usuario add column if not exists role text;
alter table public.usuario add column if not exists login text;
alter table public.usuario add column if not exists auth_ativado boolean;
alter table public.usuario add column if not exists nickname text;
alter table public.usuario add column if not exists perfil text;
alter table public.usuario add column if not exists perfil_acesso_id text;
alter table public.usuario add column if not exists perfil_acesso_nome text;
alter table public.usuario add column if not exists tabela_preco_id text;
alter table public.usuario add column if not exists tabela_preco_nome text;

update public.usuario set
  caixas_pdv_autorizados_ids = case when caixas_pdv_autorizados_ids is null then (dados->'caixas_pdv_autorizados_ids') else caixas_pdv_autorizados_ids end,
  email = case when email is null then dados->>'email' else email end,
  full_name = case when full_name is null then dados->>'full_name' else full_name end,
  role = case when role is null then dados->>'role' else role end,
  login = case when login is null then dados->>'login' else login end,
  auth_ativado = case when auth_ativado is null then case when lower(dados->>'auth_ativado') in ('true', 'false') then (dados->>'auth_ativado')::boolean else null end else auth_ativado end,
  nickname = case when nickname is null then dados->>'nickname' else nickname end,
  perfil = case when perfil is null then dados->>'perfil' else perfil end,
  perfil_acesso_id = case when perfil_acesso_id is null then dados->>'perfil_acesso_id' else perfil_acesso_id end,
  perfil_acesso_nome = case when perfil_acesso_nome is null then dados->>'perfil_acesso_nome' else perfil_acesso_nome end,
  tabela_preco_id = case when tabela_preco_id is null then dados->>'tabela_preco_id' else tabela_preco_id end,
  tabela_preco_nome = case when tabela_preco_nome is null then dados->>'tabela_preco_nome' else tabela_preco_nome end
where dados is not null and dados <> '{}'::jsonb;

update public.usuario
  set dados = dados - array['caixas_pdv_autorizados_ids', 'email', 'full_name', 'role', 'login', 'auth_ativado', 'nickname', 'perfil', 'perfil_acesso_id', 'perfil_acesso_nome', 'tabela_preco_id', 'tabela_preco_nome']
where dados is not null and dados <> '{}'::jsonb;


-- === vale_compra (12 colunas) ===
alter table public.vale_compra add column if not exists cliente_id text;
alter table public.vale_compra add column if not exists cliente_nome text;
alter table public.vale_compra add column if not exists codigo text;
alter table public.vale_compra add column if not exists historico_uso jsonb;
alter table public.vale_compra add column if not exists origem_tipo text;
alter table public.vale_compra add column if not exists pedido_origem_id text;
alter table public.vale_compra add column if not exists pedido_origem_numero text;
alter table public.vale_compra add column if not exists status text;
alter table public.vale_compra add column if not exists valor_disponivel numeric;
alter table public.vale_compra add column if not exists valor_original numeric;
alter table public.vale_compra add column if not exists data_expiracao date;
alter table public.vale_compra add column if not exists observacoes text;

update public.vale_compra set
  cliente_id = case when cliente_id is null then dados->>'cliente_id' else cliente_id end,
  cliente_nome = case when cliente_nome is null then dados->>'cliente_nome' else cliente_nome end,
  codigo = case when codigo is null then dados->>'codigo' else codigo end,
  historico_uso = case when historico_uso is null then (dados->'historico_uso') else historico_uso end,
  origem_tipo = case when origem_tipo is null then dados->>'origem_tipo' else origem_tipo end,
  pedido_origem_id = case when pedido_origem_id is null then dados->>'pedido_origem_id' else pedido_origem_id end,
  pedido_origem_numero = case when pedido_origem_numero is null then dados->>'pedido_origem_numero' else pedido_origem_numero end,
  status = case when status is null then dados->>'status' else status end,
  valor_disponivel = case when valor_disponivel is null then case when dados->>'valor_disponivel' ~ '^-?[0-9]' then (dados->>'valor_disponivel')::numeric else null end else valor_disponivel end,
  valor_original = case when valor_original is null then case when dados->>'valor_original' ~ '^-?[0-9]' then (dados->>'valor_original')::numeric else null end else valor_original end,
  data_expiracao = case when data_expiracao is null then case when dados->>'data_expiracao' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_expiracao', 10)::date else null end else data_expiracao end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end
where dados is not null and dados <> '{}'::jsonb;

update public.vale_compra
  set dados = dados - array['cliente_id', 'cliente_nome', 'codigo', 'historico_uso', 'origem_tipo', 'pedido_origem_id', 'pedido_origem_numero', 'status', 'valor_disponivel', 'valor_original', 'data_expiracao', 'observacoes']
where dados is not null and dados <> '{}'::jsonb;


-- === venda_perdida (6 colunas) ===
alter table public.venda_perdida add column if not exists data_registro date;
alter table public.venda_perdida add column if not exists motivo text;
alter table public.venda_perdida add column if not exists origem text;
alter table public.venda_perdida add column if not exists produto_nome text;
alter table public.venda_perdida add column if not exists quantidade_desejada numeric;
alter table public.venda_perdida add column if not exists vendedor_id text;

update public.venda_perdida set
  data_registro = case when data_registro is null then case when dados->>'data_registro' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_registro', 10)::date else null end else data_registro end,
  motivo = case when motivo is null then dados->>'motivo' else motivo end,
  origem = case when origem is null then dados->>'origem' else origem end,
  produto_nome = case when produto_nome is null then dados->>'produto_nome' else produto_nome end,
  quantidade_desejada = case when quantidade_desejada is null then case when dados->>'quantidade_desejada' ~ '^-?[0-9]' then (dados->>'quantidade_desejada')::numeric else null end else quantidade_desejada end,
  vendedor_id = case when vendedor_id is null then dados->>'vendedor_id' else vendedor_id end
where dados is not null and dados <> '{}'::jsonb;

update public.venda_perdida
  set dados = dados - array['data_registro', 'motivo', 'origem', 'produto_nome', 'quantidade_desejada', 'vendedor_id']
where dados is not null and dados <> '{}'::jsonb;


-- === folha_previsao_modelo (21 colunas) ===
alter table public.folha_previsao_modelo add column if not exists nome text;
alter table public.folha_previsao_modelo add column if not exists descricao text;
alter table public.folha_previsao_modelo add column if not exists ativo boolean;
alter table public.folha_previsao_modelo add column if not exists colaborador_id text;
alter table public.folha_previsao_modelo add column if not exists colaborador_nome text;
alter table public.folha_previsao_modelo add column if not exists centro_custo text;
alter table public.folha_previsao_modelo add column if not exists classificacao_despesa text;
alter table public.folha_previsao_modelo add column if not exists custo_direto numeric;
alter table public.folha_previsao_modelo add column if not exists data_desligamento date;
alter table public.folha_previsao_modelo add column if not exists decimo_mes_parcela_1 text;
alter table public.folha_previsao_modelo add column if not exists decimo_mes_parcela_2 text;
alter table public.folha_previsao_modelo add column if not exists decimo_percentual_parcela text;
alter table public.folha_previsao_modelo add column if not exists decimo_terceiro_ativo text;
alter table public.folha_previsao_modelo add column if not exists dia_vencimento integer;
alter table public.folha_previsao_modelo add column if not exists ferias_programadas text;
alter table public.folha_previsao_modelo add column if not exists retirada_frequencia text;
alter table public.folha_previsao_modelo add column if not exists retirada_valor_fixo text;
alter table public.folha_previsao_modelo add column if not exists rubricas jsonb;
alter table public.folha_previsao_modelo add column if not exists situacao text;
alter table public.folha_previsao_modelo add column if not exists tipo_vinculo text;
alter table public.folha_previsao_modelo add column if not exists valor_rescisao_previsto numeric;

update public.folha_previsao_modelo set
  nome = case when nome is null then dados->>'nome' else nome end,
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  colaborador_id = case when colaborador_id is null then dados->>'colaborador_id' else colaborador_id end,
  colaborador_nome = case when colaborador_nome is null then dados->>'colaborador_nome' else colaborador_nome end,
  centro_custo = case when centro_custo is null then dados->>'centro_custo' else centro_custo end,
  classificacao_despesa = case when classificacao_despesa is null then dados->>'classificacao_despesa' else classificacao_despesa end,
  custo_direto = case when custo_direto is null then case when dados->>'custo_direto' ~ '^-?[0-9]' then (dados->>'custo_direto')::numeric else null end else custo_direto end,
  data_desligamento = case when data_desligamento is null then case when dados->>'data_desligamento' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_desligamento', 10)::date else null end else data_desligamento end,
  decimo_mes_parcela_1 = case when decimo_mes_parcela_1 is null then dados->>'decimo_mes_parcela_1' else decimo_mes_parcela_1 end,
  decimo_mes_parcela_2 = case when decimo_mes_parcela_2 is null then dados->>'decimo_mes_parcela_2' else decimo_mes_parcela_2 end,
  decimo_percentual_parcela = case when decimo_percentual_parcela is null then dados->>'decimo_percentual_parcela' else decimo_percentual_parcela end,
  decimo_terceiro_ativo = case when decimo_terceiro_ativo is null then dados->>'decimo_terceiro_ativo' else decimo_terceiro_ativo end,
  dia_vencimento = case when dia_vencimento is null then case when dados->>'dia_vencimento' ~ '^-?[0-9]' then (dados->>'dia_vencimento')::integer else null end else dia_vencimento end,
  ferias_programadas = case when ferias_programadas is null then dados->>'ferias_programadas' else ferias_programadas end,
  retirada_frequencia = case when retirada_frequencia is null then dados->>'retirada_frequencia' else retirada_frequencia end,
  retirada_valor_fixo = case when retirada_valor_fixo is null then dados->>'retirada_valor_fixo' else retirada_valor_fixo end,
  rubricas = case when rubricas is null then (dados->'rubricas') else rubricas end,
  situacao = case when situacao is null then dados->>'situacao' else situacao end,
  tipo_vinculo = case when tipo_vinculo is null then dados->>'tipo_vinculo' else tipo_vinculo end,
  valor_rescisao_previsto = case when valor_rescisao_previsto is null then case when dados->>'valor_rescisao_previsto' ~ '^-?[0-9]' then (dados->>'valor_rescisao_previsto')::numeric else null end else valor_rescisao_previsto end
where dados is not null and dados <> '{}'::jsonb;

update public.folha_previsao_modelo
  set dados = dados - array['nome', 'descricao', 'ativo', 'colaborador_id', 'colaborador_nome', 'centro_custo', 'classificacao_despesa', 'custo_direto', 'data_desligamento', 'decimo_mes_parcela_1', 'decimo_mes_parcela_2', 'decimo_percentual_parcela', 'decimo_terceiro_ativo', 'dia_vencimento', 'ferias_programadas', 'retirada_frequencia', 'retirada_valor_fixo', 'rubricas', 'situacao', 'tipo_vinculo', 'valor_rescisao_previsto']
where dados is not null and dados <> '{}'::jsonb;


-- === folha_previsao_competencia (13 colunas) ===
alter table public.folha_previsao_competencia add column if not exists modelo_id text;
alter table public.folha_previsao_competencia add column if not exists modelo_nome text;
alter table public.folha_previsao_competencia add column if not exists competencia text;
alter table public.folha_previsao_competencia add column if not exists colaborador_id text;
alter table public.folha_previsao_competencia add column if not exists colaborador_nome text;
alter table public.folha_previsao_competencia add column if not exists dia_vencimento integer;
alter table public.folha_previsao_competencia add column if not exists grupo_lancamento_id text;
alter table public.folha_previsao_competencia add column if not exists movimentos jsonb;
alter table public.folha_previsao_competencia add column if not exists observacoes text;
alter table public.folha_previsao_competencia add column if not exists rubricas jsonb;
alter table public.folha_previsao_competencia add column if not exists situacao_mes text;
alter table public.folha_previsao_competencia add column if not exists status text;
alter table public.folha_previsao_competencia add column if not exists tipo_vinculo text;

update public.folha_previsao_competencia set
  modelo_id = case when modelo_id is null then dados->>'modelo_id' else modelo_id end,
  modelo_nome = case when modelo_nome is null then dados->>'modelo_nome' else modelo_nome end,
  competencia = case when competencia is null then dados->>'competencia' else competencia end,
  colaborador_id = case when colaborador_id is null then dados->>'colaborador_id' else colaborador_id end,
  colaborador_nome = case when colaborador_nome is null then dados->>'colaborador_nome' else colaborador_nome end,
  dia_vencimento = case when dia_vencimento is null then case when dados->>'dia_vencimento' ~ '^-?[0-9]' then (dados->>'dia_vencimento')::integer else null end else dia_vencimento end,
  grupo_lancamento_id = case when grupo_lancamento_id is null then dados->>'grupo_lancamento_id' else grupo_lancamento_id end,
  movimentos = case when movimentos is null then (dados->'movimentos') else movimentos end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  rubricas = case when rubricas is null then (dados->'rubricas') else rubricas end,
  situacao_mes = case when situacao_mes is null then dados->>'situacao_mes' else situacao_mes end,
  status = case when status is null then dados->>'status' else status end,
  tipo_vinculo = case when tipo_vinculo is null then dados->>'tipo_vinculo' else tipo_vinculo end
where dados is not null and dados <> '{}'::jsonb;

update public.folha_previsao_competencia
  set dados = dados - array['modelo_id', 'modelo_nome', 'competencia', 'colaborador_id', 'colaborador_nome', 'dia_vencimento', 'grupo_lancamento_id', 'movimentos', 'observacoes', 'rubricas', 'situacao_mes', 'status', 'tipo_vinculo']
where dados is not null and dados <> '{}'::jsonb;


-- === folha_centro_custo (3 colunas) ===
alter table public.folha_centro_custo add column if not exists nome text;
alter table public.folha_centro_custo add column if not exists ativo boolean;
alter table public.folha_centro_custo add column if not exists ordem text;

update public.folha_centro_custo set
  nome = case when nome is null then dados->>'nome' else nome end,
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  ordem = case when ordem is null then dados->>'ordem' else ordem end
where dados is not null and dados <> '{}'::jsonb;

update public.folha_centro_custo
  set dados = dados - array['nome', 'ativo', 'ordem']
where dados is not null and dados <> '{}'::jsonb;


-- === budget_modelo (11 colunas) ===
alter table public.budget_modelo add column if not exists nome text;
alter table public.budget_modelo add column if not exists ativo boolean;
alter table public.budget_modelo add column if not exists categoria_id text;
alter table public.budget_modelo add column if not exists categoria_nome text;
alter table public.budget_modelo add column if not exists centro_custo text;
alter table public.budget_modelo add column if not exists ciclo_dias text;
alter table public.budget_modelo add column if not exists modo_estimativa text;
alter table public.budget_modelo add column if not exists observacoes text;
alter table public.budget_modelo add column if not exists ordem text;
alter table public.budget_modelo add column if not exists usa_dias_uteis text;
alter table public.budget_modelo add column if not exists valor_entrada numeric;

update public.budget_modelo set
  nome = case when nome is null then dados->>'nome' else nome end,
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  categoria_id = case when categoria_id is null then dados->>'categoria_id' else categoria_id end,
  categoria_nome = case when categoria_nome is null then dados->>'categoria_nome' else categoria_nome end,
  centro_custo = case when centro_custo is null then dados->>'centro_custo' else centro_custo end,
  ciclo_dias = case when ciclo_dias is null then dados->>'ciclo_dias' else ciclo_dias end,
  modo_estimativa = case when modo_estimativa is null then dados->>'modo_estimativa' else modo_estimativa end,
  observacoes = case when observacoes is null then dados->>'observacoes' else observacoes end,
  ordem = case when ordem is null then dados->>'ordem' else ordem end,
  usa_dias_uteis = case when usa_dias_uteis is null then dados->>'usa_dias_uteis' else usa_dias_uteis end,
  valor_entrada = case when valor_entrada is null then case when dados->>'valor_entrada' ~ '^-?[0-9]' then (dados->>'valor_entrada')::numeric else null end else valor_entrada end
where dados is not null and dados <> '{}'::jsonb;

update public.budget_modelo
  set dados = dados - array['nome', 'ativo', 'categoria_id', 'categoria_nome', 'centro_custo', 'ciclo_dias', 'modo_estimativa', 'observacoes', 'ordem', 'usa_dias_uteis', 'valor_entrada']
where dados is not null and dados <> '{}'::jsonb;


-- === budget_competencia (5 colunas) ===
alter table public.budget_competencia add column if not exists modelo_id text;
alter table public.budget_competencia add column if not exists competencia text;
alter table public.budget_competencia add column if not exists status text;
alter table public.budget_competencia add column if not exists linhas jsonb;
alter table public.budget_competencia add column if not exists total numeric;

update public.budget_competencia set
  modelo_id = case when modelo_id is null then dados->>'modelo_id' else modelo_id end,
  competencia = case when competencia is null then dados->>'competencia' else competencia end,
  status = case when status is null then dados->>'status' else status end,
  linhas = case when linhas is null then (dados->'linhas') else linhas end,
  total = case when total is null then case when dados->>'total' ~ '^-?[0-9]' then (dados->>'total')::numeric else null end else total end
where dados is not null and dados <> '{}'::jsonb;

update public.budget_competencia
  set dados = dados - array['modelo_id', 'competencia', 'status', 'linhas', 'total']
where dados is not null and dados <> '{}'::jsonb;


-- === perfil_de_acesso (6 colunas) ===
alter table public.perfil_de_acesso add column if not exists nome text;
alter table public.perfil_de_acesso add column if not exists descricao text;
alter table public.perfil_de_acesso add column if not exists ativo boolean;
alter table public.perfil_de_acesso add column if not exists cor text;
alter table public.perfil_de_acesso add column if not exists menu_compacto boolean;
alter table public.perfil_de_acesso add column if not exists permissoes jsonb;

update public.perfil_de_acesso set
  nome = case when nome is null then dados->>'nome' else nome end,
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end,
  cor = case when cor is null then dados->>'cor' else cor end,
  menu_compacto = case when menu_compacto is null then case when lower(dados->>'menu_compacto') in ('true', 'false') then (dados->>'menu_compacto')::boolean else null end else menu_compacto end,
  permissoes = case when permissoes is null then (dados->'permissoes') else permissoes end
where dados is not null and dados <> '{}'::jsonb;

update public.perfil_de_acesso
  set dados = dados - array['nome', 'descricao', 'ativo', 'cor', 'menu_compacto', 'permissoes']
where dados is not null and dados <> '{}'::jsonb;


-- === status_pedido_compra (6 colunas) ===
alter table public.status_pedido_compra add column if not exists nome text;
alter table public.status_pedido_compra add column if not exists codigo text;
alter table public.status_pedido_compra add column if not exists cor text;
alter table public.status_pedido_compra add column if not exists descricao text;
alter table public.status_pedido_compra add column if not exists ordem text;
alter table public.status_pedido_compra add column if not exists ativo boolean;

update public.status_pedido_compra set
  nome = case when nome is null then dados->>'nome' else nome end,
  codigo = case when codigo is null then dados->>'codigo' else codigo end,
  cor = case when cor is null then dados->>'cor' else cor end,
  descricao = case when descricao is null then dados->>'descricao' else descricao end,
  ordem = case when ordem is null then dados->>'ordem' else ordem end,
  ativo = case when ativo is null then case when lower(dados->>'ativo') in ('true', 'false') then (dados->>'ativo')::boolean else null end else ativo end
where dados is not null and dados <> '{}'::jsonb;

update public.status_pedido_compra
  set dados = dados - array['nome', 'codigo', 'cor', 'descricao', 'ordem', 'ativo']
where dados is not null and dados <> '{}'::jsonb;


-- === configuracoes_estoque (6 colunas) ===
alter table public.configuracoes_estoque add column if not exists alerta_estoque_minimo text;
alter table public.configuracoes_estoque add column if not exists alerta_validade_proxima text;
alter table public.configuracoes_estoque add column if not exists contagem_cega_recepcao text;
alter table public.configuracoes_estoque add column if not exists dias_alerta_validade text;
alter table public.configuracoes_estoque add column if not exists dias_reposicao_automatica text;
alter table public.configuracoes_estoque add column if not exists permitir_venda_estoque_negativo text;

update public.configuracoes_estoque set
  alerta_estoque_minimo = case when alerta_estoque_minimo is null then dados->>'alerta_estoque_minimo' else alerta_estoque_minimo end,
  alerta_validade_proxima = case when alerta_validade_proxima is null then dados->>'alerta_validade_proxima' else alerta_validade_proxima end,
  contagem_cega_recepcao = case when contagem_cega_recepcao is null then dados->>'contagem_cega_recepcao' else contagem_cega_recepcao end,
  dias_alerta_validade = case when dias_alerta_validade is null then dados->>'dias_alerta_validade' else dias_alerta_validade end,
  dias_reposicao_automatica = case when dias_reposicao_automatica is null then dados->>'dias_reposicao_automatica' else dias_reposicao_automatica end,
  permitir_venda_estoque_negativo = case when permitir_venda_estoque_negativo is null then dados->>'permitir_venda_estoque_negativo' else permitir_venda_estoque_negativo end
where dados is not null and dados <> '{}'::jsonb;

update public.configuracoes_estoque
  set dados = dados - array['alerta_estoque_minimo', 'alerta_validade_proxima', 'contagem_cega_recepcao', 'dias_alerta_validade', 'dias_reposicao_automatica', 'permitir_venda_estoque_negativo']
where dados is not null and dados <> '{}'::jsonb;


-- === configuracoes_venda (12 colunas) ===
alter table public.configuracoes_venda add column if not exists auto_delivery_balcao text;
alter table public.configuracoes_venda add column if not exists bloquear_venda_preco_zero text;
alter table public.configuracoes_venda add column if not exists casas_decimais_quantidade text;
alter table public.configuracoes_venda add column if not exists empresa_id text;
alter table public.configuracoes_venda add column if not exists exibir_estoque_pdv text;
alter table public.configuracoes_venda add column if not exists fluxo_venda_padrao text;
alter table public.configuracoes_venda add column if not exists kpi_lucro_break_even_diario text;
alter table public.configuracoes_venda add column if not exists kpi_lucro_meta_mensal text;
alter table public.configuracoes_venda add column if not exists kpi_venda_meta_mensal text;
alter table public.configuracoes_venda add column if not exists kpi_venda_minima_diaria text;
alter table public.configuracoes_venda add column if not exists organization_id text;
alter table public.configuracoes_venda add column if not exists vender_sem_estoque text;

update public.configuracoes_venda set
  auto_delivery_balcao = case when auto_delivery_balcao is null then dados->>'auto_delivery_balcao' else auto_delivery_balcao end,
  bloquear_venda_preco_zero = case when bloquear_venda_preco_zero is null then dados->>'bloquear_venda_preco_zero' else bloquear_venda_preco_zero end,
  casas_decimais_quantidade = case when casas_decimais_quantidade is null then dados->>'casas_decimais_quantidade' else casas_decimais_quantidade end,
  empresa_id = case when empresa_id is null then dados->>'empresa_id' else empresa_id end,
  exibir_estoque_pdv = case when exibir_estoque_pdv is null then dados->>'exibir_estoque_pdv' else exibir_estoque_pdv end,
  fluxo_venda_padrao = case when fluxo_venda_padrao is null then dados->>'fluxo_venda_padrao' else fluxo_venda_padrao end,
  kpi_lucro_break_even_diario = case when kpi_lucro_break_even_diario is null then dados->>'kpi_lucro_break_even_diario' else kpi_lucro_break_even_diario end,
  kpi_lucro_meta_mensal = case when kpi_lucro_meta_mensal is null then dados->>'kpi_lucro_meta_mensal' else kpi_lucro_meta_mensal end,
  kpi_venda_meta_mensal = case when kpi_venda_meta_mensal is null then dados->>'kpi_venda_meta_mensal' else kpi_venda_meta_mensal end,
  kpi_venda_minima_diaria = case when kpi_venda_minima_diaria is null then dados->>'kpi_venda_minima_diaria' else kpi_venda_minima_diaria end,
  organization_id = case when organization_id is null then dados->>'organization_id' else organization_id end,
  vender_sem_estoque = case when vender_sem_estoque is null then dados->>'vender_sem_estoque' else vender_sem_estoque end
where dados is not null and dados <> '{}'::jsonb;

update public.configuracoes_venda
  set dados = dados - array['auto_delivery_balcao', 'bloquear_venda_preco_zero', 'casas_decimais_quantidade', 'empresa_id', 'exibir_estoque_pdv', 'fluxo_venda_padrao', 'kpi_lucro_break_even_diario', 'kpi_lucro_meta_mensal', 'kpi_venda_meta_mensal', 'kpi_venda_minima_diaria', 'organization_id', 'vender_sem_estoque']
where dados is not null and dados <> '{}'::jsonb;


-- === target_flare (12 colunas) ===
alter table public.target_flare add column if not exists briefing text;
alter table public.target_flare add column if not exists status text;
alter table public.target_flare add column if not exists file_path text;
alter table public.target_flare add column if not exists flare_line text;
alter table public.target_flare add column if not exists flare_column text;
alter table public.target_flare add column if not exists confidence text;
alter table public.target_flare add column if not exists route text;
alter table public.target_flare add column if not exists component_name text;
alter table public.target_flare add column if not exists action_briefing text;
alter table public.target_flare add column if not exists context_image_url text;
alter table public.target_flare add column if not exists resolution_precision text;
alter table public.target_flare add column if not exists source_location_raw text;

update public.target_flare set
  briefing = case when briefing is null then dados->>'briefing' else briefing end,
  status = case when status is null then dados->>'status' else status end,
  file_path = case when file_path is null then dados->>'file_path' else file_path end,
  flare_line = case when flare_line is null then dados->>'flare_line' else flare_line end,
  flare_column = case when flare_column is null then dados->>'flare_column' else flare_column end,
  confidence = case when confidence is null then dados->>'confidence' else confidence end,
  route = case when route is null then dados->>'route' else route end,
  component_name = case when component_name is null then dados->>'component_name' else component_name end,
  action_briefing = case when action_briefing is null then dados->>'action_briefing' else action_briefing end,
  context_image_url = case when context_image_url is null then dados->>'context_image_url' else context_image_url end,
  resolution_precision = case when resolution_precision is null then dados->>'resolution_precision' else resolution_precision end,
  source_location_raw = case when source_location_raw is null then dados->>'source_location_raw' else source_location_raw end
where dados is not null and dados <> '{}'::jsonb;

update public.target_flare
  set dados = dados - array['briefing', 'status', 'file_path', 'flare_line', 'flare_column', 'confidence', 'route', 'component_name', 'action_briefing', 'context_image_url', 'resolution_precision', 'source_location_raw']
where dados is not null and dados <> '{}'::jsonb;


-- Total: 501 colunas em 48 tabelas.