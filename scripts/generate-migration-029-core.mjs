#!/usr/bin/env node
/**
 * Gera supabase/migrations/029_promote_core_entities_from_dados.sql
 * Promove campos de `dados` jsonb → colunas dedicadas no núcleo operacional.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.resolve(ROOT, 'supabase/migrations/029_promote_core_entities_from_dados.sql');

const SKIP_FIELDS = new Set(['created_by_id', 'is_sample']);

const TYPE_OVERRIDES = {
  ativo: 'boolean',
  ativa: 'boolean',
  preco_venda_tipo: 'text',
  preco_livre: 'boolean',
  metas_estoque_unidade_compra: 'text',
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
  estoque_trava_manual: 'boolean',
  tags: 'jsonb',
  unidades_alternativas: 'jsonb',
  dimensoes_cm: 'jsonb',
  cancelamentos_rastro: 'jsonb',
  vendas_ids: 'jsonb',
  movimentos_ids: 'jsonb',
  despesas_ids: 'jsonb',
  historico_ajustes: 'jsonb',
  data_nascimento: 'date',
  data_vencimento: 'date',
  data_pagamento: 'date',
  data_liquidacao_prevista: 'date',
  data_liquidacao_efetiva: 'date',
  data_fim_recorrencia: 'date',
  data_lancamento: 'date',
  data_entrega: 'date',
  data_abertura: 'timestamptz',
  data_fechamento: 'timestamptz',
  metas_estoque_atualizado_em: 'timestamptz',
  casas_decimais: 'integer',
  tempo_reposicao_dias: 'integer',
  parcela_atual: 'integer',
  numero_parcelas_total: 'integer',
  prazo_recebimento_dias: 'integer',
  parcelas_max: 'integer',
  metas_estoque_dias_com_estoque: 'integer',
  metas_estoque_outliers_descartados: 'integer',
  metas_estoque_versao: 'text',
  metas_estoque_lead_time_dias: 'integer',
};

const CORE = {
  produto: [
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
    'metas_estoque_versao', 'metas_estoque_lead_time_dias',
  ],
  terceiro: [
    'codigo_interno', 'nome', 'cpf_cnpj', 'email', 'telefone', 'endereco', 'bairro', 'cidade',
    'estado', 'cep', 'tipo', 'perfil', 'data_nascimento', 'observacoes', 'ativo',
  ],
  lancamento_financeiro: [
    'tipo', 'descricao', 'terceiro_id', 'terceiro_nome', 'valor', 'valor_liquido', 'data_vencimento',
    'data_pagamento', 'data_liquidacao_prevista', 'data_liquidacao_efetiva', 'data_lancamento',
    'status', 'status_conciliacao', 'categoria', 'categoria_id', 'conta_financeira_id',
    'conta_financeira_nome', 'forma_pagamento', 'forma_pagamento_id', 'forma_pagamento_tipo',
    'turno_caixa_id', 'grupo_lancamento_id', 'is_recorrente', 'is_custo_mercadoria',
    'frequencia_recorrencia', 'data_fim_recorrencia', 'numero_parcelas_total', 'parcela_atual',
    'pedido_compra_vinculado_id', 'pedido_compra_vinculado_numero', 'referencia_tipo',
    'referencia_id', 'referencia_numero', 'conciliacao_grupo_id', 'codigo_lancamento', 'tags',
  ],
  turno_caixa: [
    'numero', 'status', 'data_abertura', 'data_fechamento', 'usuario_abertura_id',
    'usuario_abertura_nome', 'usuario_fechamento_id', 'usuario_fechamento_nome',
    'conta_caixa_pdv_id', 'conta_caixa_pdv_nome', 'saldo_inicial', 'saldo_final', 'total_vendas',
    'total_despesas', 'total_reforcos', 'total_sangrias', 'recebimentos_dinheiro',
    'recebimentos_pix', 'recebimentos_credito', 'recebimentos_debito', 'recebimentos_vale_troca',
    'dinheiro_conferido', 'diferenca', 'vendas_ids', 'movimentos_ids', 'despesas_ids',
    'cancelamentos_rastro', 'observacoes',
  ],
  movimentos_caixa: [
    'numero', 'tipo', 'valor', 'valor_original', 'status_registro', 'conta_id', 'turno_caixa_id',
    'usuario_responsavel_id', 'usuario_responsavel_nome', 'observacao', 'observacao_original',
    'motivo_ajuste', 'editado_por_nome', 'editado_em', 'cancelado_em', 'cancelado_por_nome',
    'historico_ajustes',
  ],
  formas_de_pagamento: [
    'nome', 'tipo', 'ativo', 'valor_taxa', 'tipo_taxa', 'prazo_recebimento_dias', 'parcelas_max',
    'adquirente', 'conta_destino_id', 'conta_destino_nome',
  ],
  contas_financeiras: [
    'nome', 'tipo', 'ativo', 'saldo_atual', 'saldo_inicial', 'banco', 'agencia', 'conta', 'cor',
    'is_caixa_pdv', 'is_caixa_geral', 'usuario_atribuido_id', 'usuario_atribuido_nome', 'observacoes',
  ],
  pedido_venda: [
    'tipo', 'subtotal', 'valor_desconto', 'valor_frete', 'data_entrega', 'metodo_entrega',
    'observacoes', 'tabela_preco_id', 'turno_caixa_id', 'vendedor_id', 'vendedor_nome',
    'orcamento_origem_id', 'senha_atendimento',
  ],
};

function inferType(field) {
  if (TYPE_OVERRIDES[field]) return TYPE_OVERRIDES[field];
  const f = field.toLowerCase();
  if (f.startsWith('is_') || f === 'ativo' || f === 'ativa') return 'boolean';
  if (f.startsWith('data_')) return 'date';
  if (f.endsWith('_ids') || f.endsWith('_rastro') || f === 'tags') return 'jsonb';
  if (f.endsWith('_tipo') || f.endsWith('_nome') || f === 'categoria' || f === 'abcd') return 'text';
  if (
    f.startsWith('valor') || f.startsWith('total') || f.startsWith('saldo') ||
    (f.startsWith('preco') && !f.endsWith('_tipo')) || f.startsWith('quantidade') || f.startsWith('custo') ||
    f.startsWith('peso') || f.startsWith('estoque') || f.startsWith('recebimentos') ||
    f === 'diferenca' || f === 'dinheiro_conferido' || f === 'subtotal' ||
    f === 'venda_media_dia' || f.startsWith('metas_estoque_quantidade')
  ) return 'numeric';
  return 'text';
}

function assignment(field, type) {
  if (type === 'jsonb') return `${field} = coalesce(${field}, dados->'${field}')`;
  if (type === 'boolean') {
    return `${field} = coalesce(${field}, case when lower(dados->>'${field}') in ('true', 'false') then (dados->>'${field}')::boolean else null end)`;
  }
  if (type === 'date') {
    return `${field} = coalesce(${field}, case when dados->>'${field}' ~ '^\\d{4}-\\d{2}-\\d{2}' then left(dados->>'${field}', 10)::date else null end)`;
  }
  if (type === 'timestamptz') {
    return `${field} = coalesce(${field}, case when dados->>'${field}' ~ '^\\d{4}-\\d{2}-\\d{2}' then (dados->>'${field}')::timestamptz else null end)`;
  }
  if (type === 'integer' || type === 'numeric') {
    return `${field} = coalesce(${field}, case when dados->>'${field}' ~ '^-?[0-9]' then (dados->>'${field}')::${type} else null end)`;
  }
  return `${field} = coalesce(${field}, dados->>'${field}')`;
}

const lines = [];
lines.push('-- 029_promote_core_entities_from_dados.sql');
lines.push('-- Gerado por scripts/generate-migration-029-core.mjs');
lines.push('-- Promove campos do núcleo de `dados` jsonb para colunas SQL consultáveis.');
lines.push('-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE + limpeza de chaves em dados.');
lines.push('');

const INDEX_FIELDS = {
  produto: ['nome', 'codigo_interno', 'categoria_id', 'ativo', 'estoque_atual'],
  terceiro: ['nome', 'tipo', 'ativo', 'cpf_cnpj'],
  lancamento_financeiro: ['status', 'data_vencimento', 'tipo', 'conta_financeira_id', 'terceiro_id'],
  turno_caixa: ['status', 'numero'],
  movimentos_caixa: ['turno_caixa_id', 'tipo'],
  pedido_venda: ['vendedor_id', 'turno_caixa_id', 'data_entrega'],
};

let total = 0;
for (const [table, fields] of Object.entries(CORE)) {
  const candidates = fields.filter((f) => !SKIP_FIELDS.has(f));
  lines.push(`-- === ${table} (${candidates.length} colunas) ===`);
  for (const field of candidates) {
    lines.push(`alter table public.${table} add column if not exists ${field} ${inferType(field)};`);
  }
  lines.push('');
  lines.push(`update public.${table} set`);
  lines.push('  ' + candidates.map((f) => assignment(f, inferType(f))).join(',\n  '));
  lines.push("where dados is not null and dados <> '{}'::jsonb;");
  lines.push('');
  const quoted = candidates.map((k) => `'${k}'`).join(', ');
  lines.push(`update public.${table}`);
  lines.push(`  set dados = dados - array[${quoted}]`);
  lines.push("where dados is not null and dados <> '{}'::jsonb;");
  lines.push('');
  for (const f of INDEX_FIELDS[table] || []) {
    if (candidates.includes(f)) {
      lines.push(`create index if not exists idx_${table}_${f} on public.${table} (${f});`);
    }
  }
  lines.push('');
  total += candidates.length;
}

lines.push(`-- Total promovido: ${total} colunas em ${Object.keys(CORE).length} tabelas.`);

await writeFile(OUTPUT, lines.join('\n'));
console.log(`OK — ${path.relative(ROOT, OUTPUT)} (${total} colunas)`);
