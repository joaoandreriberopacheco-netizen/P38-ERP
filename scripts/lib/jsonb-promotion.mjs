/** Utilitários partilhados para gerar SQL de promoção dados jsonb → colunas. */

export const SKIP_FIELDS = new Set(['created_by_id', 'is_sample']);

export const TYPE_OVERRIDES = {
  ativo: 'boolean',
  ativa: 'boolean',
  preco_livre: 'boolean',
  preco_venda_tipo: 'text',
  metas_estoque_unidade_compra: 'text',
  metas_estoque_versao: 'text',
  forma_pagamento: 'text',
  forma_pagamento_tipo: 'text',
  categoria: 'text',
  abcd: 'text',
  tipo: 'text',
  tipo_taxa: 'text',
  status_registro: 'text',
  divergencia_tipo: 'text',
  controla_serial: 'boolean',
  controla_lote: 'boolean',
  controla_validade: 'boolean',
  is_caixa_geral: 'boolean',
  is_caixa_pdv: 'boolean',
  is_recorrente: 'boolean',
  is_custo_mercadoria: 'boolean',
  is_default: 'boolean',
  nfe_emitida: 'boolean',
  tem_divergencias: 'boolean',
  valor_desatualizado: 'boolean',
  tem_anexo: 'boolean',
  tem_boleto: 'boolean',
  tem_comprovante: 'boolean',
  estoque_trava_manual: 'boolean',
  tags: 'jsonb',
  unidades_alternativas: 'jsonb',
  dimensoes_cm: 'jsonb',
  cancelamentos_rastro: 'jsonb',
  vendas_ids: 'jsonb',
  movimentos_ids: 'jsonb',
  despesas_ids: 'jsonb',
  historico_ajustes: 'jsonb',
  historico_uso: 'jsonb',
  itens: 'jsonb',
  pagamentos: 'jsonb',
  itens_conferidos: 'jsonb',
  itens_devolvidos: 'jsonb',
  itens_recebidos: 'jsonb',
  fornecedores: 'jsonb',
  respostas: 'jsonb',
  pedidos_compra_ids: 'jsonb',
  pedidos_vinculados: 'jsonb',
  ocorrencias_conferencia: 'jsonb',
  fotos_urls: 'jsonb',
  fotos_mercadoria: 'jsonb',
  volumes: 'jsonb',
  volumes_conferidos: 'jsonb',
  volumes_detalhados: 'jsonb',
  blocks_config: 'jsonb',
  sequencia_blocos: 'jsonb',
  dados_evento: 'jsonb',
  snapshot_dados: 'jsonb',
  caixas_pdv_autorizados_ids: 'jsonb',
  numeros_serie: 'jsonb',
  rubricas: 'jsonb',
  movimentos: 'jsonb',
  permissoes: 'jsonb',
  linhas: 'jsonb',
  folha_centros_custo: 'jsonb',
  competencia: 'text',
  situacao: 'text',
  situacao_mes: 'text',
  modo_estimativa: 'text',
  classificacao_despesa: 'text',
  tipo_vinculo: 'text',
  retirada_frequencia: 'text',
  resolution_precision: 'text',
  source_location_raw: 'text',
  context_image_url: 'text',
  codigo: 'text',
  cor: 'text',
  menu_compacto: 'boolean',
  volume_cm3: 'text',
  desconto_compra_padrao: 'text',
  unidades_por_pacote: 'text',
  fator_conversao: 'numeric',
  fator_aplicado: 'numeric',
  data_nascimento: 'date',
  data_vencimento: 'date',
  data_pagamento: 'date',
  data_liquidacao_prevista: 'date',
  data_liquidacao_efetiva: 'date',
  data_fim_recorrencia: 'date',
  data_lancamento: 'date',
  data_entrega: 'date',
  data_emissao: 'date',
  data_conclusao: 'date',
  data_chegada: 'date',
  data_despacho: 'date',
  data_aprovacao_financeira: 'timestamptz',
  data_rejeicao_financeira: 'timestamptz',
  data_abertura: 'timestamptz',
  data_fechamento: 'timestamptz',
  data_conversao: 'timestamptz',
  data_inicio_processamento: 'timestamptz',
  data_confirmacao: 'timestamptz',
  data_conferencia: 'timestamptz',
  data_conclusao_timestamptz: 'timestamptz',
  data_resolucao: 'timestamptz',
  data_abertura_cotacao: 'timestamptz',
  data_desfeita: 'timestamptz',
  data_retorno: 'timestamptz',
  data_hora_conclusao: 'timestamptz',
  data_conferencia_volumes: 'timestamptz',
  data_transicao: 'timestamptz',
  solicitacao_edicao_data: 'timestamptz',
  solicitacao_cancelamento_data: 'timestamptz',
  editado_em: 'timestamptz',
  cancelado_em: 'timestamptz',
  metas_estoque_atualizado_em: 'timestamptz',
  eta: 'timestamptz',
  data_embarque: 'timestamptz',
  data_emissao_date: 'date',
  casas_decimais: 'integer',
  tempo_reposicao_dias: 'integer',
  parcela_atual: 'integer',
  numero_parcelas_total: 'integer',
  prazo_recebimento_dias: 'integer',
  parcelas_max: 'integer',
  dia_vencimento: 'integer',
  parcela_numero: 'integer',
  parcela_total: 'integer',
  quantidade_itens: 'integer',
  contagem_volumes_ok: 'integer',
};

export function inferType(field) {
  if (TYPE_OVERRIDES[field]) return TYPE_OVERRIDES[field];
  const f = field.toLowerCase();
  if (f.startsWith('is_') || f === 'ativo' || f === 'ativa' || f.endsWith('_default') || f.endsWith('_ativado') || f.startsWith('auth_')) return 'boolean';
  if (f.startsWith('data_') && !f.includes('movimento')) return f.includes('hora') || f.includes('conclusao') || f.includes('embarque') || f.includes('aprovacao') || f.includes('rejeicao') || f.includes('transicao') || f.includes('desfeita') || f.includes('retorno') || f.includes('edicao') || f.includes('cancelamento') || f.includes('conferencia') || f.includes('conversao') || f.includes('processamento') || f.includes('confirmacao') ? 'timestamptz' : 'date';
  if (f === 'eta' || f === 'editado_em' || f === 'cancelado_em') return 'timestamptz';
  if (f.endsWith('_ids') || f.endsWith('_rastro') || f === 'tags' || f.endsWith('_serie') || f.startsWith('itens') || f === 'pagamentos' || f === 'volumes' || f.endsWith('_urls') || f.endsWith('_mercadoria')) return 'jsonb';
  if (f.endsWith('_tipo') || f.endsWith('_nome') || f === 'categoria' || f === 'abcd' || f === 'perfil') return 'text';
  if (
    f.startsWith('valor') || f.startsWith('total') || f.startsWith('saldo') ||
    (f.startsWith('preco') && !f.endsWith('_tipo')) || f.startsWith('quantidade') || f.startsWith('custo') ||
    f.startsWith('peso') || f.startsWith('estoque') || f.startsWith('recebimentos') ||
    f === 'diferenca' || f === 'dinheiro_conferido' || f === 'subtotal' ||
    f === 'fator_ajuste' || f === 'percentual_desconto_maximo' || f === 'percentual_valor_embarcado' ||
    f.startsWith('metas_estoque_quantidade') || f === 'venda_media_dia'
  ) return 'numeric';
  return 'text';
}

function typedExtract(field, type) {
  if (type === 'jsonb') return `(dados->'${field}')`;
  if (type === 'boolean') {
    return `case when lower(dados->>'${field}') in ('true', 'false') then (dados->>'${field}')::boolean else null end`;
  }
  if (type === 'date') {
    return `case when dados->>'${field}' ~ '^\\d{4}-\\d{2}-\\d{2}' then left(dados->>'${field}', 10)::date else null end`;
  }
  if (type === 'timestamptz') {
    return `case when dados->>'${field}' ~ '^\\d{4}-\\d{2}-\\d{2}' then (dados->>'${field}')::timestamptz else null end`;
  }
  if (type === 'integer' || type === 'numeric') {
    return `case when dados->>'${field}' ~ '^-?[0-9]' then (dados->>'${field}')::${type} else null end`;
  }
  return `dados->>'${field}'`;
}

export function assignment(field, type) {
  const extract = typedExtract(field, type);
  return `${field} = case when ${field} is null then ${extract} else ${field} end`;
}

export function generateTablePromotion(table, fields, { indexFields = [] } = {}) {
  const candidates = fields.filter((f) => !SKIP_FIELDS.has(f));
  const lines = [];
  lines.push(`-- === ${table} (${candidates.length} colunas) ===`);
  for (const field of candidates) {
    lines.push(`alter table public.${table} add column if not exists ${field} ${inferType(field)};`);
  }
  lines.push('');
  if (candidates.length > 0) {
    lines.push(`update public.${table} set`);
    lines.push('  ' + candidates.map((f) => assignment(f, inferType(f))).join(',\n  '));
    lines.push("where dados is not null and dados <> '{}'::jsonb;");
    lines.push('');
    const quoted = candidates.map((k) => `'${k}'`).join(', ');
    lines.push(`update public.${table}`);
    lines.push(`  set dados = dados - array[${quoted}]`);
    lines.push("where dados is not null and dados <> '{}'::jsonb;");
    lines.push('');
    for (const f of indexFields) {
      if (candidates.includes(f)) {
        lines.push(`create index if not exists idx_${table}_${f} on public.${table} (${f});`);
      }
    }
    lines.push('');
  }
  return { lines, count: candidates.length };
}
