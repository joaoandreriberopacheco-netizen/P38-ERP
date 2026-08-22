/**
 * Mapeamento Entidade (PascalCase Base44) → tabela `public.*` no Supabase.
 */
import {
  PRODUTO_COLUMNS,
  TERCEIRO_COLUMNS,
  LANCAMENTO_FINANCEIRO_COLUMNS,
  PEDIDO_VENDA_COLUMNS,
  PEDIDO_COMPRA_COLUMNS,
  EMBARQUE_COLUMNS,
  MOVIMENTACAO_ESTOQUE_COLUMNS,
  TURNO_CAIXA_COLUMNS,
  MOVIMENTOS_CAIXA_COLUMNS,
  FORMAS_DE_PAGAMENTO_COLUMNS,
  CONTAS_FINANCEIRAS_COLUMNS,
  TABELA_PRECO_COLUMNS,
  CATEGORIA_FINANCEIRA_COLUMNS,
  PEDIDO_VENDA_ITEM_COLUMNS,
  PEDIDO_COMPRA_ITEM_COLUMNS,
  EMBARQUE_ITEM_COLUMNS,
  AGENDA_LOGISTICA_COLUMNS,
  TABLE_PROMOTION_MANIFEST,
} from './entityColumnManifest.ts';

export const ENTITY_TO_TABLE = {
  LancamentoFinanceiro: {
    table: 'lancamento_financeiro',
    mode: 'columns',
    columns: LANCAMENTO_FINANCEIRO_COLUMNS,
  },
  Terceiro: { table: 'terceiro', mode: 'columns', columns: TERCEIRO_COLUMNS },
  Produto: { table: 'produto', mode: 'columns', columns: PRODUTO_COLUMNS },
  PedidoVenda: { table: 'pedido_venda', mode: 'columns', columns: PEDIDO_VENDA_COLUMNS },
  PedidoCompra: { table: 'pedido_compra', mode: 'columns', columns: PEDIDO_COMPRA_COLUMNS },
  PedidoVendaItem: { table: 'pedido_venda_item', mode: 'columns', columns: PEDIDO_VENDA_ITEM_COLUMNS },
  PedidoCompraItem: { table: 'pedido_compra_item', mode: 'columns', columns: PEDIDO_COMPRA_ITEM_COLUMNS },
  MovimentacaoEstoque: {
    table: 'movimentacao_estoque',
    mode: 'columns',
    columns: MOVIMENTACAO_ESTOQUE_COLUMNS,
  },
  ContasFinanceiras: {
    table: 'contas_financeiras',
    mode: 'columns',
    columns: CONTAS_FINANCEIRAS_COLUMNS,
  },
  FormasDePagamento: {
    table: 'formas_de_pagamento',
    mode: 'columns',
    columns: FORMAS_DE_PAGAMENTO_COLUMNS,
  },
  TabelaPreco: { table: 'tabela_preco', mode: 'columns', columns: TABELA_PRECO_COLUMNS },
  TurnoCaixa: { table: 'turno_caixa', mode: 'columns', columns: TURNO_CAIXA_COLUMNS },
  Embarque: { table: 'embarque', mode: 'columns', columns: EMBARQUE_COLUMNS },
  EmbarqueItem: { table: 'embarque_item', mode: 'columns', columns: EMBARQUE_ITEM_COLUMNS },
  ContaRecorrente: { table: 'conta_recorrente', mode: 'columns' },
  ContaPrevista: { table: 'conta_prevista', mode: 'columns' },
  CategoriaProduto: { table: 'categoria_produto', mode: 'columns' },
  CategoriaFinanceira: {
    table: 'categoria_financeira',
    mode: 'columns',
    columns: CATEGORIA_FINANCEIRA_COLUMNS,
  },
  AgendaLogistica: {
    table: 'agenda_logistica',
    mode: 'columns',
    columns: AGENDA_LOGISTICA_COLUMNS,
  },
  MovimentosCaixa: {
    table: 'movimentos_caixa',
    mode: 'columns',
    columns: MOVIMENTOS_CAIXA_COLUMNS,
  },
  TargetFlare: {
    table: 'target_flare',
    mode: 'columns',
    columns: TABLE_PROMOTION_MANIFEST.target_flare,
  },
  CatalogoInterface: { table: 'catalogo_interface', mode: 'columns' },
  PagamentoCartaoDetalhe: { table: 'pagamento_cartao_detalhe', mode: 'jsonb' },

  // Alias para código antigo: `base44.entities.Categoria` → categoria_produto.
  Categoria: { table: 'categoria_produto', mode: 'columns' },

  // === Estendidas — promovidas para 'columns' por migrations 007 + 009 ===
  AnexoDocumento: {
    table: 'anexo_documento',
    mode: 'columns',
    columns: [
      'descricao',
      'mime_type',
      'nome_arquivo',
      'origem',
      'referencia_id',
      'referencia_numero',
      'referencia_tipo',
      'tamanho_bytes',
      'tipo_documento',
      'url_drive'
    ]
  },
  Area: {
    table: 'area',
    mode: 'columns',
    columns: ['ativo', 'codigo', 'descricao', 'nome']
  },
  AutorizacaoEstorno: {
    table: 'autorizacao_estorno',
    mode: 'columns',
    columns: [
      'caixa_operador_id',
      'caixa_operador_nome',
      'cliente_nome',
      'devolucao_id',
      'devolucao_numero',
      'forma_reembolso',
      'gerente_aprovador_id',
      'gerente_aprovador_nome',
      'motivo',
      'numero',
      'pedido_origem_numero',
      'status',
      'turno_caixa_destino_id',
      'turno_caixa_destino_numero',
      'valor_autorizado'
    ]
  },
  ComprovanteTemplate: {
    table: 'comprovante_template',
    mode: 'columns',
    columns: ['descricao', 'html_template', 'is_default', 'nome', 'tipo']
  },
  ConferenciaCompra: {
    table: 'conferencia_compra',
    mode: 'columns',
    columns: [
      'assinatura_url',
      'conferente_id',
      'conferente_nome',
      'data_conclusao',
      'interveniente_id',
      'interveniente_nome',
      'itens_conferidos',
      'observacoes_gerais',
      'pedido_compra_id',
      'pedido_numero',
      'senha_confirmacao',
      'status',
      'tipo',
      'total_divergencias',
      'total_itens_ok'
    ]
  },
  ConferenciaEstoque: {
    table: 'conferencia_estoque',
    mode: 'columns',
    columns: [
      'ajuste_aplicado',
      'data_fim',
      'data_inicio',
      'itens_conferidos',
      'responsavel_id',
      'responsavel_nome',
      'status'
    ]
  },
  ConfigAutoAtendimento: {
    table: 'config_auto_atendimento',
    mode: 'columns',
    columns: ['ativo', 'subtitulo_boas_vindas', 'titulo_boas_vindas']
  },
  ConsumoInterno: {
    table: 'consumo_interno',
    mode: 'columns',
    columns: ['numero']
  },
  Cotacao: {
    table: 'cotacao',
    mode: 'columns',
    columns: ['data_abertura', 'fornecedores', 'itens', 'numero', 'respostas', 'status', 'titulo']
  },
  DestinacaoConsumoInterno: {
    table: 'destinacao_consumo_interno',
    mode: 'columns',
    columns: ['ativo', 'nome']
  },
  DevolucaoTroca: {
    table: 'devolucao_troca',
    mode: 'columns',
    columns: [
      'cliente_id',
      'cliente_nome',
      'forma_reembolso',
      'fotos_mercadoria',
      'itens_devolvidos',
      'motivo',
      'numero',
      'operador_id',
      'operador_nome',
      'pedido_origem_id',
      'pedido_origem_numero',
      'aguarda_substituto',
      'pedido_substituto_id',
      'pedido_substituto_numero',
      'status',
      'tipo',
      'vale_compra_codigo',
      'vale_compra_id',
      'valor_total_devolvido'
    ]
  },
  DivergenciaCompra: {
    table: 'divergencia_compra',
    mode: 'columns',
    columns: [
      'acao_tomada',
      'conferencia_id',
      'data_resolucao',
      'descricao',
      'fotos_urls',
      'pedido_compra_id',
      'produto_id',
      'produto_nome',
      'quantidade_avariada',
      'quantidade_esperada',
      'quantidade_recebida',
      'resolucao',
      'responsavel_resolucao_id',
      'responsavel_resolucao_nome',
      'status',
      'tipo'
    ]
  },
  EventoEditorLayout: {
    table: 'evento_editor_layout',
    mode: 'columns',
    columns: ['dados_evento', 'descricao_acao', 'sequencia_blocos', 'template_layout_id', 'tipo_evento']
  },
  EventosLogisticos: {
    table: 'eventos_logisticos',
    mode: 'columns',
    columns: [
      'causa_atraso',
      'contagem_volumes_ok',
      'data_hora_conclusao',
      'data_prevista',
      'foto_avarias_url',
      'itens_recebidos',
      'numero',
      'observacoes_discrepancia',
      'pedidos_compra_ids',
      'responsavel_id',
      'responsavel_nome',
      'status',
      'sugestao_melhoria',
      'teve_atraso',
      'teve_avarias',
      'tipo',
      'titulo',
      'veredito_conformidade'
    ]
  },
  ImportacaoLog: {
    table: 'importacao_log',
    mode: 'columns',
    columns: [
      'data_desfeita',
      'quantidade_itens',
      'snapshot_dados',
      'status',
      'tipo_importacao',
      'usuario_desfez',
      'usuario_responsavel'
    ]
  },
  Interveniente: {
    table: 'interveniente',
    mode: 'columns',
    columns: ['ativo']
  },
  LayoutTemplate: {
    table: 'layout_template',
    mode: 'columns',
    columns: ['blocks_config', 'categoria', 'descricao', 'is_default', 'nome', 'tipo']
  },
  LoteEstoque: {
    table: 'lote_estoque',
    mode: 'columns',
    columns: [
      'data_entrada_no_lote',
      'data_validade',
      'numero_lote',
      'numeros_serie',
      'produto_id',
      'produto_nome',
      'quantidade_atual',
      'status'
    ]
  },
  ManifestoEntrada: {
    table: 'manifesto_entrada',
    mode: 'columns',
    columns: [
      'conferente_id',
      'conferente_nome',
      'data_conferencia',
      'itens_conferidos',
      'status',
      'status_codigo_conferencia_itens',
      'volumes'
    ]
  },
  Maquininha: {
    table: 'maquininha',
    mode: 'columns',
    columns: ['ativo']
  },
  OrdemSeparacao: {
    table: 'ordem_separacao',
    mode: 'columns',
    columns: ['pedido_venda_id']
  },
  ProtocoloEntrega: {
    table: 'protocolo_entrega',
    mode: 'columns',
    columns: ['pedido_venda_id']
  },
  RascunhoPedidoVenda: {
    table: 'rascunho_pedido_venda',
    mode: 'columns',
    columns: ['data_retorno', 'motivo_retorno', 'status']
  },
  ResponsavelConsumoInterno: {
    table: 'responsavel_consumo_interno',
    mode: 'columns',
    columns: ['ativo', 'nome']
  },
  Supermanifesto: {
    table: 'supermanifesto',
    mode: 'columns',
    columns: [
      'conferente_volumes_foto',
      'conferente_volumes_id',
      'conferente_volumes_nome',
      'conferente_volumes_senha_hash',
      'data_conferencia_volumes',
      'observacoes_consolidadas',
      'ocorrencias_conferencia',
      'pedidos_vinculados',
      'peso_total_bruto_kg',
      'reabertura_data',
      'reabertura_foto',
      'reabertura_responsavel',
      'reabertura_senha_hash',
      'status',
      'status_codigo_conferencia_volumes',
      'tem_divergencias',
      'volumes_conferidos'
    ]
  },
  Tarefa: {
    table: 'tarefa',
    mode: 'columns',
    columns: [
      'data_conclusao',
      'data_vencimento',
      'descricao',
      'prioridade',
      'referencia_id',
      'referencia_numero',
      'referencia_tipo',
      'responsavel_id',
      'responsavel_nome',
      'status',
      'tipo',
      'titulo',
      'valor_pendente'
    ]
  },
  TransicaoPedidoCompra: {
    table: 'transicao_pedido_compra',
    mode: 'columns',
    columns: [
      'codigo_operacao',
      'data_transicao',
      'observacao',
      'pedido_id',
      'pedido_numero',
      'responsavel_email',
      'responsavel_id',
      'responsavel_nome',
      'status_anterior',
      'status_novo',
      'tipo_autenticacao'
    ]
  },
  Transportadora: {
    table: 'transportadora',
    mode: 'columns',
    columns: ['ativo', 'nome', 'saida_referencia']
  },
  // `User` (PascalCase histórico do Base44). `Usuario` é alias.
  User: {
    table: 'usuario',
    mode: 'columns',
    columns: [
      'caixas_pdv_autorizados_ids',
      'email',
      'full_name',
      'role',
      'nickname',
      'perfil',
      'perfil_acesso_id',
      'perfil_acesso_nome',
      'tabela_preco_id',
      'tabela_preco_nome'
    ]
  },
  Usuario: {
    table: 'usuario',
    mode: 'columns',
    columns: [
      'caixas_pdv_autorizados_ids',
      'email',
      'full_name',
      'role',
      'nickname',
      'perfil',
      'perfil_acesso_id',
      'perfil_acesso_nome',
      'tabela_preco_id',
      'tabela_preco_nome'
    ]
  },
  ValeCompra: {
    table: 'vale_compra',
    mode: 'columns',
    columns: [
      'cliente_id',
      'cliente_nome',
      'codigo',
      'historico_uso',
      'origem_tipo',
      'pedido_origem_id',
      'pedido_origem_numero',
      'status',
      'valor_disponivel',
      'valor_original'
    ]
  },
  VendaPerdida: {
    table: 'venda_perdida',
    mode: 'columns',
    columns: ['data_registro', 'motivo', 'origem', 'produto_nome', 'quantidade_desejada', 'vendedor_id']
  },

  // === Estendidas que ainda não tiveram campos descobertos no código ===
  // Mantêm `dados jsonb` por enquanto; se o app exercitá-las, basta rodar o
  // gerador (`scripts/infer-entity-fields.mjs` + `scripts/generate-migration-009.mjs`)
  // e promover por migration adicional.
  AvisosAuto: { table: 'avisos_auto', mode: 'jsonb' },
  Campanha: { table: 'campanha', mode: 'jsonb' },
  ConfiguracoesEstoque: { table: 'configuracoes_estoque', mode: 'jsonb' },
  ConfiguracoesVenda: { table: 'configuracoes_venda', mode: 'jsonb' },
  DadosEmpresa: { table: 'dados_empresa', mode: 'jsonb' },
  EventoLogisticoSandbox: { table: 'evento_logistico_sandbox', mode: 'jsonb' },
  PerfilDeAcesso: { table: 'perfil_de_acesso', mode: 'jsonb', columns: ['nome'] },
  PoliticasDesconto: { table: 'politicas_desconto', mode: 'jsonb' },
  StatusPedidoCompra: { table: 'status_pedido_compra', mode: 'jsonb' },

  FolhaPrevisaoModelo: { table: 'folha_previsao_modelo', mode: 'jsonb' },
  FolhaPrevisaoCompetencia: { table: 'folha_previsao_competencia', mode: 'jsonb' },
  AgefinSerieModelo: { table: 'agefin_serie_modelo', mode: 'jsonb' },
  AgefinSerieCompetencia: { table: 'agefin_serie_competencia', mode: 'jsonb' },
  BudgetModelo: { table: 'budget_modelo', mode: 'jsonb' },
  BudgetCompetencia: { table: 'budget_competencia', mode: 'jsonb' },
  FolhaCentroCusto: { table: 'folha_centro_custo', mode: 'jsonb' },
  AgendaItem: { table: 'agenda_item', mode: 'jsonb' },
};

/**
 * Resolve uma entrada do mapa para o formato canônico { table, mode, columns }.
 * Aceita string (legado) ou objeto. Retorna null quando a entidade não está mapeada.
 */
export function resolveEntityMapping(entityName: string) {
  const raw = ENTITY_TO_TABLE[entityName as keyof typeof ENTITY_TO_TABLE];
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { table: raw, mode: 'columns' as const, columns: null as string[] | null };
  }
  return {
    table: raw.table,
    mode: (raw.mode || 'columns') as 'columns' | 'jsonb',
    columns: Array.isArray(raw.columns) ? raw.columns : null,
  };
}

export function isEntityLinkedToSupabase(entityName: string) {
  return Boolean(ENTITY_TO_TABLE[entityName as keyof typeof ENTITY_TO_TABLE]);
}
