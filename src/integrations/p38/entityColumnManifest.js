/**
 * Colunas físicas por entidade — fonte única para entityTableMap e migrations.
 * Campos em META (id, created_at, updated_at, created_by) não entram aqui.
 */

export const PRODUTO_COLUMNS = [
  'nome', 'codigo_interno', 'codigo_barras', 'campo_hierarquico_1', 'campo_hierarquico_2',
  'campo_hierarquico_3', 'campo_hierarquico_4', 'campo_hierarquico_5', 'categoria_id',
  'categoria_nome', 'area_id', 'area_codigo', 'marca', 'imagem_url', 'tags', 'tipo', 'abcd',
  'preco_livre', 'casas_decimais', 'valor_compra', 'preco_venda_padrao', 'preco_venda_tipo',
  'preco_venda_percentual', 'preco_custo_calculado', 'estoque_atual', 'estoque_minimo',
  'estoque_ideal', 'estoque_maximo', 'estoque_avariado', 'unidade_principal', 'unidade_vitrine',
  'unidades_por_pacote', 'unidades_alternativas', 'fornecedor_padrao_id', 'fornecedor_padrao_codigo',
  'custo_frete_padrao', 'custo_outros_padrao', 'custo_imposto1_padrao', 'custo_imposto2_padrao',
  'desconto_compra_padrao', 'controla_serial', 'controla_lote', 'controla_validade', 'peso_kg',
  'volume_cm3', 'dimensoes_cm', 'ativo', 'tempo_reposicao_dias', 'venda_media_dia',
  'metas_estoque_atualizado_em', 'metas_estoque_dias_com_estoque', 'metas_estoque_unidade_compra',
  'metas_estoque_outliers_descartados', 'metas_estoque_quantidade_limpa_90d', 'estoque_trava_manual',
  'metas_estoque_versao', 'metas_estoque_lead_time_dias', 'linha_id',
];

export const LINHA_COLUMNS = [
  'codigo', 'nome', 'tipo', 'eixo_a_rotulo', 'eixo_b_rotulo', 'chave_agrupamento', 'ordem', 'ativo', 'notas',
];

export const TERCEIRO_COLUMNS = [
  'codigo_interno', 'nome', 'cpf_cnpj', 'email', 'telefone', 'endereco', 'bairro', 'cidade',
  'estado', 'cep', 'tipo', 'perfil', 'data_nascimento', 'observacoes', 'ativo',
];

export const LANCAMENTO_FINANCEIRO_COLUMNS = [
  'tipo', 'descricao', 'terceiro_id', 'terceiro_nome', 'valor', 'valor_liquido', 'data_vencimento',
  'data_pagamento', 'data_liquidacao_prevista', 'data_liquidacao_efetiva', 'data_lancamento',
  'status', 'status_conciliacao', 'categoria', 'categoria_id', 'centro_custo', 'centro_custo_id',
  'conta_financeira_id',
  'conta_financeira_nome', 'forma_pagamento', 'forma_pagamento_id', 'forma_pagamento_tipo',
  'turno_caixa_id', 'grupo_lancamento_id', 'is_recorrente', 'is_custo_mercadoria',
  'frequencia_recorrencia', 'data_fim_recorrencia', 'numero_parcelas_total', 'parcela_atual',
  'pedido_compra_vinculado_id', 'pedido_compra_vinculado_numero', 'referencia_tipo',
  'referencia_id', 'referencia_numero', 'conciliacao_grupo_id', 'codigo_lancamento', 'tags',
  'observacoes',
];

export const PEDIDO_VENDA_COLUMNS = [
  'numero', 'cliente_id', 'cliente_nome', 'status', 'total', 'itens', 'pagamentos',
  'tipo', 'subtotal', 'valor_desconto', 'valor_frete', 'data_entrega', 'metodo_entrega',
  'observacoes', 'tabela_preco_id', 'turno_caixa_id', 'vendedor_id', 'vendedor_nome',
  'orcamento_origem_id', 'senha_atendimento',
];

export const PEDIDO_COMPRA_COLUMNS = [
  'numero', 'fornecedor_id', 'fornecedor_nome', 'data_emissao', 'data_prevista_entrega',
  'status', 'status_aprovacao_financeira', 'status_embarque', 'percentual_valor_embarcado', 'status_recebimento_geral',
  'itens', 'valor_total', 'valor_frete', 'valor_desconto', 'forma_pagamento_compra',
  'observacoes', 'historico', 'tags', 'nfe_emitida',
  'conta_pagamento_id', 'tem_divergencias', 'conferencia_id', 'data_aprovacao_financeira',
  'data_despacho', 'data_chegada', 'data_conclusao', 'motivo_rejeicao_financeira',
  'status_conferencia_pedido', 'solicitacao_edicao_data', 'solicitacao_edicao_motivo',
  'solicitacao_edicao_solicitante', 'solicitacao_cancelamento_data', 'solicitacao_cancelamento_motivo',
  'manifesto_entrada_id',
];

export const EMBARQUE_COLUMNS = [
  'pedido_compra_id', 'pedido_compra_numero', 'numero', 'tipo', 'status', 'status_recebimento',
  'data_embarque', 'eta', 'fornecedor_id', 'fornecedor_nome', 'transportadora_id',
  'transportadora_nome', 'supermanifesto_id', 'manifesto_entrada_id', 'evento_logistico_id',
  'volumes', 'volumes_detalhados', 'peso_kg', 'observacoes', 'itens',
];

export const MOVIMENTACAO_ESTOQUE_COLUMNS = [
  'produto_id', 'produto_nome', 'tipo', 'quantidade', 'quantidade_base', 'quantidade_comercial',
  'origem_tipo', 'origem_id', 'motivo', 'unidade_medida', 'unidade_sigla', 'produto_unidade_id',
  'fator_conversao', 'custo_unitario', 'documento_referencia', 'referencia_tipo', 'referencia_id',
  'referencia_numero', 'observacoes', 'usuario_responsavel', 'numero_lote', 'data_validade',
  'numeros_serie',
];

export const TURNO_CAIXA_COLUMNS = [
  'numero', 'status', 'data_abertura', 'data_fechamento', 'usuario_abertura_id',
  'usuario_abertura_nome', 'usuario_fechamento_id', 'usuario_fechamento_nome',
  'conta_caixa_pdv_id', 'conta_caixa_pdv_nome', 'saldo_inicial', 'saldo_final', 'total_vendas',
  'total_despesas', 'total_reforcos', 'total_sangrias', 'recebimentos_dinheiro',
  'recebimentos_pix', 'recebimentos_credito', 'recebimentos_debito', 'recebimentos_vale_troca',
  'dinheiro_conferido', 'diferenca', 'vendas_ids', 'movimentos_ids', 'despesas_ids',
  'cancelamentos_rastro', 'observacoes',
];

export const MOVIMENTOS_CAIXA_COLUMNS = [
  'numero', 'tipo', 'valor', 'valor_original', 'status_registro', 'conta_id', 'turno_caixa_id',
  'usuario_responsavel_id', 'usuario_responsavel_nome', 'observacao', 'observacao_original',
  'motivo_ajuste', 'editado_por_nome', 'editado_em', 'cancelado_em', 'cancelado_por_nome',
  'historico_ajustes',
];

export const FORMAS_DE_PAGAMENTO_COLUMNS = [
  'nome', 'tipo', 'ativo', 'valor_taxa', 'tipo_taxa', 'prazo_recebimento_dias', 'parcelas_max',
  'adquirente', 'conta_destino_id', 'conta_destino_nome',
];

export const CONTAS_FINANCEIRAS_COLUMNS = [
  'nome', 'tipo', 'ativo', 'saldo_atual', 'saldo_inicial', 'banco', 'agencia', 'conta', 'cor',
  'is_caixa_pdv', 'is_caixa_geral', 'usuario_atribuido_id', 'usuario_atribuido_nome', 'observacoes',
];

export const TABELA_PRECO_COLUMNS = [
  'nome_tabela', 'fator_ajuste', 'is_default', 'percentual_desconto_maximo', 'ativo',
];

export const CATEGORIA_FINANCEIRA_COLUMNS = ['nome', 'tipo', 'ativa'];

export const RASCUNHO_PEDIDO_VENDA_COLUMNS = [
  'status', 'data_retorno', 'motivo_retorno', 'tipo', 'cliente_id', 'cliente_nome',
  'vendedor_id', 'vendedor_nome', 'tabela_preco_id', 'subtotal', 'valor_desconto', 'valor_frete',
  'valor_total', 'metodo_entrega', 'observacoes', 'senha_atendimento', 'itens',
  'pedido_venda_final_id', 'data_inicio_processamento', 'data_conversao', 'operador_processamento',
];

export const PEDIDO_VENDA_ITEM_COLUMNS = [
  'pedido_venda_id', 'pedido_venda_numero', 'produto_id', 'produto_nome', 'produto_unidade_id',
  'unidade_sigla', 'fator_aplicado', 'quantidade_comercial', 'quantidade_base',
  'preco_unitario_fator1', 'preco_unitario_comercial', 'desconto_unitario_fator1',
  'preco_final_unitario_fator1', 'custo_unitario_momento', 'total', 'ordem', 'observacoes',
];

export const PEDIDO_COMPRA_ITEM_COLUMNS = [
  'pedido_compra_id', 'pedido_compra_numero', 'produto_id', 'produto_nome', 'produto_unidade_id',
  'unidade_sigla', 'fator_aplicado', 'quantidade_comercial', 'quantidade_base',
  'quantidade_vinculada', 'custo_unitario_fator1', 'custo_total_unitario_fator1', 'total', 'ordem',
  'observacoes',
];

export const EMBARQUE_ITEM_COLUMNS = [
  'embarque_id', 'embarque_numero', 'pedido_compra_id', 'pedido_compra_item_id', 'produto_id',
  'produto_nome', 'unidade_sigla', 'quantidade_pedida_comercial', 'quantidade_embarcada_comercial',
  'quantidade_recebida_comercial', 'divergencia_tipo', 'produto_id_recebido_diferente',
  'produto_nome_recebido_diferente', 'acordo_financeiro_lancamento_id', 'ordem', 'observacoes',
];

export const DADOS_EMPRESA_COLUMNS = [
  'razao_social', 'nome_fantasia', 'cnpj', 'inscricao_estadual', 'inscricao_municipal',
  'email', 'telefone', 'site', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
  'cep', 'logo_url', 'situacao_cadastral', 'atividade_principal', 'natureza_juridica', 'porte',
  'data_abertura', 'mensagem_rodape', 'folha_centros_custo',
];

export const CONFERENCIA_ESTOQUE_COLUMNS = [
  'nome_conferencia', 'tipo_conferencia', 'observacoes', 'ajuste_aplicado', 'data_fim',
  'data_inicio', 'itens_conferidos', 'responsavel_id', 'responsavel_nome', 'status',
];

export const CONSUMO_INTERNO_COLUMNS = [
  'numero', 'status', 'destinacao', 'responsavel_recebimento', 'usuario_solicitante_id',
  'usuario_solicitante_nome', 'turno_caixa_id', 'turno_caixa_numero', 'quantidade_total_itens',
  'valor_total', 'observacoes', 'tags', 'itens', 'data_confirmacao', 'assinatura_recolhedor_url',
  'assinatura_recolhedor_nome',
];

export const EVENTO_LOGISTICO_SANDBOX_COLUMNS = [
  'codigo', 'nome', 'tipo_registro', 'status_operacao', 'transportadora_id', 'transportadora_nome',
  'embarcacao_nome', 'embarcacao_template_id', 'rota_nome', 'rota_template_id', 'data_referencia',
  'data_saida_origem', 'data_retorno_origem', 'data_chegada_manaus', 'previsao_chegada',
  'previsao_retorno', 'proxima_chegada_manaus', 'data_chegada_destino', 'dias_atraso',
  'ocupacao_percentual', 'chave_relacional_futura', 'observacoes',
];

export const ANEXO_DOCUMENTO_EXTRA_COLUMNS = ['url_thumbnail', 'drive_file_id'];

/** Tabelas restantes → colunas (inclui re-promoção do núcleo e estendidas). */
export const TABLE_PROMOTION_MANIFEST = {
  // re-promoção idempotente (limpa dados duplicado)
  produto: PRODUTO_COLUMNS,
  linha: LINHA_COLUMNS,
  terceiro: TERCEIRO_COLUMNS,
  lancamento_financeiro: LANCAMENTO_FINANCEIRO_COLUMNS,
  turno_caixa: TURNO_CAIXA_COLUMNS,
  movimentos_caixa: MOVIMENTOS_CAIXA_COLUMNS,
  formas_de_pagamento: FORMAS_DE_PAGAMENTO_COLUMNS,
  contas_financeiras: CONTAS_FINANCEIRAS_COLUMNS,
  pedido_venda: PEDIDO_VENDA_COLUMNS,
  pedido_compra: PEDIDO_COMPRA_COLUMNS,
  embarque: EMBARQUE_COLUMNS,
  movimentacao_estoque: MOVIMENTACAO_ESTOQUE_COLUMNS,
  tabela_preco: TABELA_PRECO_COLUMNS,
  categoria_financeira: CATEGORIA_FINANCEIRA_COLUMNS,
  rascunho_pedido_venda: RASCUNHO_PEDIDO_VENDA_COLUMNS,
  dados_empresa: DADOS_EMPRESA_COLUMNS,
  conferencia_estoque: CONFERENCIA_ESTOQUE_COLUMNS,
  consumo_interno: CONSUMO_INTERNO_COLUMNS,
  evento_logistico_sandbox: EVENTO_LOGISTICO_SANDBOX_COLUMNS,
  anexo_documento: [
    'descricao', 'mime_type', 'nome_arquivo', 'origem', 'referencia_id', 'referencia_numero',
    'referencia_tipo', 'tamanho_bytes', 'tipo_documento', 'url_drive', ...ANEXO_DOCUMENTO_EXTRA_COLUMNS,
  ],
  area: ['ativo', 'codigo', 'descricao', 'nome'],
  autorizacao_estorno: [
    'caixa_operador_id', 'caixa_operador_nome', 'cliente_nome', 'devolucao_id', 'devolucao_numero',
    'forma_reembolso', 'gerente_aprovador_id', 'gerente_aprovador_nome', 'motivo', 'numero',
    'pedido_origem_numero', 'status', 'turno_caixa_destino_id', 'turno_caixa_destino_numero',
    'valor_autorizado',
  ],
  comprovante_template: ['descricao', 'html_template', 'is_default', 'nome', 'tipo'],
  conferencia_compra: [
    'assinatura_url', 'conferente_id', 'conferente_nome', 'data_conclusao', 'interveniente_id',
    'interveniente_nome', 'itens_conferidos', 'observacoes_gerais', 'pedido_compra_id',
    'pedido_numero', 'senha_confirmacao', 'status', 'tipo', 'total_divergencias', 'total_itens_ok',
  ],
  config_auto_atendimento: ['ativo', 'subtitulo_boas_vindas', 'titulo_boas_vindas'],
  cotacao: ['data_abertura', 'fornecedores', 'itens', 'numero', 'respostas', 'status', 'titulo'],
  destinacao_consumo_interno: ['ativo', 'nome'],
  devolucao_troca: [
    'cliente_id', 'cliente_nome', 'forma_reembolso', 'fotos_mercadoria', 'itens_devolvidos',
    'motivo', 'numero', 'operador_id', 'operador_nome', 'pedido_origem_id', 'pedido_origem_numero',
    'aguarda_substituto', 'pedido_substituto_id', 'pedido_substituto_numero', 'status', 'tipo',
    'vale_compra_codigo', 'vale_compra_id', 'valor_total_devolvido',
  ],
  divergencia_compra: [
    'acao_tomada', 'conferencia_id', 'data_resolucao', 'descricao', 'fotos_urls', 'pedido_compra_id',
    'produto_id', 'produto_nome', 'quantidade_avariada', 'quantidade_esperada', 'quantidade_recebida',
    'resolucao', 'responsavel_resolucao_id', 'responsavel_resolucao_nome', 'status', 'tipo',
  ],
  evento_editor_layout: ['dados_evento', 'descricao_acao', 'sequencia_blocos', 'template_layout_id', 'tipo_evento'],
  eventos_logisticos: [
    'causa_atraso', 'contagem_volumes_ok', 'data_hora_conclusao', 'data_prevista', 'foto_avarias_url',
    'itens_recebidos', 'numero', 'observacoes_discrepancia', 'pedidos_compra_ids', 'responsavel_id',
    'responsavel_nome', 'status', 'sugestao_melhoria', 'teve_atraso', 'teve_avarias', 'tipo', 'titulo',
    'veredito_conformidade',
  ],
  importacao_log: [
    'data_desfeita', 'quantidade_itens', 'snapshot_dados', 'status', 'tipo_importacao',
    'usuario_desfez', 'usuario_responsavel',
  ],
  interveniente: ['ativo'],
  layout_template: ['blocks_config', 'categoria', 'descricao', 'is_default', 'nome', 'tipo'],
  lote_estoque: [
    'data_entrada_no_lote', 'data_validade', 'numero_lote', 'numeros_serie', 'produto_id',
    'produto_nome', 'quantidade_atual', 'status',
  ],
  manifesto_entrada: [
    'conferente_id', 'conferente_nome', 'data_conferencia', 'itens_conferidos', 'status',
    'status_codigo_conferencia_itens', 'volumes',
  ],
  maquininha: ['ativo'],
  ordem_separacao: ['pedido_venda_id'],
  protocolo_entrega: ['pedido_venda_id'],
  responsavel_consumo_interno: ['ativo', 'nome'],
  supermanifesto: [
    'conferente_volumes_foto', 'conferente_volumes_id', 'conferente_volumes_nome',
    'conferente_volumes_senha_hash', 'data_conferencia_volumes', 'observacoes_consolidadas',
    'ocorrencias_conferencia', 'pedidos_vinculados', 'peso_total_bruto_kg', 'reabertura_data',
    'reabertura_foto', 'reabertura_responsavel', 'reabertura_senha_hash', 'status',
    'status_codigo_conferencia_volumes', 'tem_divergencias', 'volumes_conferidos',
  ],
  tarefa: [
    'data_conclusao', 'data_vencimento', 'descricao', 'prioridade', 'referencia_id',
    'referencia_numero', 'referencia_tipo', 'responsavel_id', 'responsavel_nome', 'status', 'tipo',
    'titulo', 'valor_pendente',
  ],
  transicao_pedido_compra: [
    'codigo_operacao', 'data_transicao', 'observacao', 'pedido_id', 'pedido_numero',
    'responsavel_email', 'responsavel_id', 'responsavel_nome', 'status_anterior', 'status_novo',
    'tipo_autenticacao',
  ],
  transportadora: ['ativo', 'nome', 'saida_referencia', 'cnpj', 'contato', 'email', 'telefone', 'observacoes'],
  usuario: [
    'caixas_pdv_autorizados_ids', 'email', 'full_name', 'role', 'login', 'auth_ativado', 'nickname',
    'perfil', 'perfil_acesso_id', 'perfil_acesso_nome', 'tabela_preco_id', 'tabela_preco_nome',
  ],
  vale_compra: [
    'cliente_id', 'cliente_nome', 'codigo', 'historico_uso', 'origem_tipo', 'pedido_origem_id',
    'pedido_origem_numero', 'status', 'valor_disponivel', 'valor_original', 'data_expiracao', 'observacoes',
  ],
  venda_perdida: ['data_registro', 'motivo', 'origem', 'produto_nome', 'quantidade_desejada', 'vendedor_id'],
  folha_previsao_modelo: [
    'nome', 'descricao', 'ativo', 'colaborador_id', 'colaborador_nome', 'centro_custo', 'centro_custo_id',
    'classificacao_despesa', 'custo_direto', 'data_desligamento', 'decimo_mes_parcela_1',
    'decimo_mes_parcela_2', 'decimo_percentual_parcela', 'decimo_terceiro_ativo', 'dia_vencimento',
    'ferias_programadas', 'retirada_frequencia', 'retirada_valor_fixo', 'rubricas', 'situacao',
    'tipo_vinculo', 'valor_rescisao_previsto',
  ],
  folha_previsao_competencia: [
    'modelo_id', 'modelo_nome', 'competencia', 'colaborador_id', 'colaborador_nome', 'dia_vencimento',
    'grupo_lancamento_id', 'movimentos', 'observacoes', 'rubricas', 'situacao_mes', 'status', 'tipo_vinculo',
  ],
  folha_centro_custo: ['nome', 'ativo', 'ordem'],
  budget_modelo: [
    'nome', 'ativo', 'categoria_id', 'categoria_nome', 'centro_custo', 'centro_custo_id', 'ciclo_dias',
    'modo_estimativa', 'observacoes', 'ordem', 'usa_dias_uteis', 'valor_entrada',
  ],
  budget_competencia: ['modelo_id', 'competencia', 'status', 'linhas', 'total'],
  perfil_de_acesso: ['nome', 'descricao', 'ativo', 'cor', 'menu_compacto', 'permissoes'],
  status_pedido_compra: ['nome', 'codigo', 'cor', 'descricao', 'ordem', 'ativo'],
  configuracoes_estoque: [
    'alerta_estoque_minimo', 'alerta_validade_proxima', 'contagem_cega_recepcao', 'dias_alerta_validade',
    'dias_reposicao_automatica', 'permitir_venda_estoque_negativo',
  ],
  configuracoes_venda: [
    'auto_delivery_balcao', 'bloquear_venda_preco_zero', 'casas_decimais_quantidade', 'empresa_id',
    'exibir_estoque_pdv', 'fluxo_venda_padrao', 'kpi_lucro_break_even_diario', 'kpi_lucro_meta_mensal',
    'kpi_venda_meta_mensal', 'kpi_venda_minima_diaria', 'organization_id', 'vender_sem_estoque',
  ],
  target_flare: [
    'briefing', 'status', 'file_path', 'flare_line', 'flare_column', 'confidence', 'route',
    'component_name', 'action_briefing', 'context_image_url', 'resolution_precision', 'source_location_raw',
  ],
};
