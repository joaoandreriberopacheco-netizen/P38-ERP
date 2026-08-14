# Relatório Técnico de Migração Base44 → Supabase/PostgreSQL

**Data:** 2026-07-14 · **App ID:** 68a91b1a009497f8d44af37e · **Timezone:** America/Rio_Branco (UTC-5)

---

## 1. Resumo Executivo

| Métrica | Valor |
|---|---|
| Total de entidades | 72 (incluindo User built-in) |
| Entidades com dados de negócio críticos | ~45 |
| Entidades de configuração/lookup | ~15 |
| Entidades temporárias/cache (não migrar) | ~6 |
| Funções de backend | 80 |
| Automações ativas | 12 (9 entity triggers + 3 scheduled) |
| Automações inativas | 1 |
| Campos built-in (todas entidades) | `id` (TEXT PK), `created_date` (TIMESTAMPTZ), `updated_date` (TIMESTAMPTZ), `created_by_id` (TEXT) |

---

## 2. Catálogo de Entidades

### 2.1 Entidades Centrais (Núcleo de Negócio)

#### Produto
**Nome amigável:** Catálogo de Produtos e Serviços
**Migra:** Sim (crítico, migrar primeiro)

| Campo | Tipo PG | Obrigatório | Default | Notas |
|---|---|---|---|---|
| codigo_interno | TEXT UNIQUE | Não | — | Sequencial numérico gerado por função |
| codigo_barras | TEXT | Não | — | EAN/UPC |
| campo_hierarquico_1..5 | TEXT | campo_1: Sim | — | Concatena para formar `nome` |
| nome | TEXT | Não | — | **Calculado**: concatenação dos hierárquicos |
| categoria_id | TEXT → CategoriaProduto.id | Não | — | FK |
| categoria_nome | TEXT | Não | — | Cache |
| area_id | TEXT → Area.id | Não | — | FK |
| area_codigo | TEXT | Não | — | Cache |
| marca | TEXT | Não | — | |
| imagem_url | TEXT | Não | — | URL storage |
| tags | TEXT[] | Não | — | Array livre |
| tipo | TEXT CHECK IN('Produto','Serviço') | Sim | 'Produto' | Enum |
| abcd | TEXT CHECK IN('A','B','C','D') | Não | — | Classificação ABCD |
| preco_livre | BOOLEAN | Não | false | |
| casas_decimais | INT | Não | 0 | |
| valor_compra | NUMERIC(15,4) | Não | 0 | |
| custo_frete_padrao | NUMERIC(15,4) | Não | 0 | |
| custo_imposto1_padrao | NUMERIC(15,4) | Não | 0 | |
| custo_imposto2_padrao | NUMERIC(15,4) | Não | 0 | |
| custo_outros_padrao | NUMERIC(15,4) | Não | 0 | |
| desconto_compra_padrao | NUMERIC(15,4) | Não | 0 | |
| preco_venda_padrao | NUMERIC(15,4) | Sim | — | |
| preco_venda_tipo | TEXT CHECK IN('numerico','percentual') | Não | 'percentual' | |
| preco_venda_percentual | NUMERIC(8,2) | Não | 40 | |
| preco_custo_calculado | NUMERIC(15,4) | Não | 0 | **Calculado** |
| fornecedor_padrao_id | TEXT → Terceiro.id | Não | — | FK |
| fornecedor_padrao_codigo | TEXT | Não | — | Cache |
| dimensoes_cm | TEXT | Não | — | "AxLxP" |
| volume_cm3 | NUMERIC | Não | — | **Calculado** de dimensoes_cm |
| peso_kg | NUMERIC | Não | — | |
| tempo_reposicao_dias | INT | Não | — | |
| estoque_atual | NUMERIC(15,4) | Não | 0 | **Calculado** por trigger/função |
| estoque_minimo | NUMERIC(15,4) | Não | 0 | |
| estoque_ideal | NUMERIC(15,4) | Não | 0 | |
| estoque_maximo | NUMERIC(15,4) | Não | 0 | |
| estoque_avariado | NUMERIC(15,4) | Não | 0 | |
| unidade_principal | TEXT | Não | 'UN' | Unidade base (fator 1) |
| unidade_vitrine | TEXT | Não | '' | Sigla vitrine PDV |
| unidades_por_pacote | NUMERIC(10,4) | Não | 1 | |
| unidades_alternativas | JSONB | Não | '[]' | **Array de objetos**: {id, unidade, fator_conversao, preco_venda, ativo} |
| controla_serial | BOOLEAN | Não | false | |
| controla_lote | BOOLEAN | Não | false | |
| controla_validade | BOOLEAN | Não | false | |
| ativo | BOOLEAN | Não | true | |

**Índices recomendados:** `CREATE UNIQUE INDEX ON produto(codigo_interno); CREATE INDEX ON produto(categoria_id); CREATE INDEX ON produto(area_id); CREATE INDEX ON produto(fornecedor_padrao_id); CREATE INDEX ON produto(nome);`

**Payload exemplo (anonimizado):**
```json
{
  "id": "a1b2c3d4", "codigo_interno": "001", "codigo_barras": "7891234567890",
  "campo_hierarquico_1": "Placa Dry Wall", "campo_hierarquico_2": "Standard",
  "campo_hierarquico_3": "12.5mm", "campo_hierarquico_4": "1200x2400mm",
  "campo_hierarquico_5": "Knauf", "nome": "Placa Dry Wall Standard 12.5mm 1200x2400mm Knauf",
  "tipo": "Produto", "abcd": "A", "valor_compra": 42.50,
  "preco_venda_padrao": 59.90, "preco_custo_calculado": 48.30,
  "estoque_atual": 120, "estoque_minimo": 20, "estoque_ideal": 50,
  "unidade_principal": "UN", "unidades_alternativas": [{"id":"u1","unidade":"CX","fator_conversao":10,"preco_venda":599.00,"ativo":true}],
  "ativo": true
}
```

---

#### Terceiro
**Nome amigável:** Clientes e Fornecedores

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| codigo_interno | TEXT UNIQUE | Não | — | Auto-gerado (CLI-00001, FOR-00001) |
| nome | TEXT | Sim | — | |
| cpf_cnpj | TEXT | Não | — | |
| email | TEXT | Não | — | |
| telefone | TEXT | Não | — | |
| endereco / bairro / cidade / estado / cep | TEXT | Não | — | |
| tipo | TEXT CHECK IN('Cliente','Fornecedor','Ambos') | Sim | — | |
| perfil | TEXT CHECK IN('Pessoa Física','Profissional/Instalador','Empresa/Loja','Construtora/Obra') | Não | — | |
| data_nascimento | DATE | Não | — | |
| observacoes | TEXT | Não | — | |
| ativo | BOOLEAN | Não | true | |

**Payload exemplo:**
```json
{"id":"t1","codigo_interno":"CLI-00001","nome":"Comércio XYZ Ltda","cpf_cnpj":"12.345.678/0001-90","tipo":"Cliente","perfil":"Empresa/Loja","cidade":"Tabatinga","estado":"AM","ativo":true}
```

---

#### PedidoVenda
**Nome amigável:** Pedidos de Venda / PDV / Orçamentos

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| numero | TEXT UNIQUE | Não | — | Auto-gerado |
| senha_atendimento | TEXT | Não | — | Numérica gerada por função |
| cliente_id | TEXT → Terceiro.id | Não | — | FK |
| cliente_nome | TEXT | Não | — | Cache |
| vendedor_id | TEXT → User.id | Não | — | FK |
| vendedor_nome | TEXT | Não | — | Cache |
| tabela_preco_id | TEXT → TabelaPreco.id | Não | — | FK |
| tipo | TEXT CHECK IN('PDV','Pedido','Orçamento') | Não | — | |
| status | TEXT CHECK IN('Orçamento','Aguardando Caixa','Financeiro OK','Em Separação','Em Rota de Entrega','Pedido Concluído','Cancelado') | Não | 'Orçamento' | |
| orcamento_origem_id | TEXT | Não | — | Self-ref |
| metodo_entrega | TEXT CHECK IN('Delivery','Retirada') | Não | — | |
| turno_caixa_id | TEXT → TurnoCaixa.id | Não | — | FK |
| itens | JSONB NOT NULL | Sim | '[]' | **Array de objetos** aninhado |
| subtotal | NUMERIC(15,2) | Não | — | |
| valor_desconto | NUMERIC(15,2) | Não | 0 | |
| valor_frete | NUMERIC(15,2) | Não | 0 | |
| valor_total | NUMERIC(15,2) | Sim | — | |
| pagamentos | JSONB | Não | '[]' | **Array de objetos** aninhado |
| data_entrega | DATE | Não | — | |
| observacoes | TEXT | Não | — | |

**⚠️ Risco:** `itens[]` e `pagamentos[]` são JSONB aninhado. Existe também entidade canônica `PedidoVendaItem` que deve substituir o array — migrar ambas e manter sincronia.

---

#### PedidoVendaItem (Canônico)
**Nome amigável:** Itens de Pedido de Venda (linha canônica)

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| pedido_venda_id | TEXT → PedidoVenda.id | Sim | — | FK |
| pedido_venda_numero | TEXT | Não | — | Cache |
| produto_id | TEXT → Produto.id | Sim | — | FK |
| produto_nome | TEXT | Não | — | Cache |
| produto_unidade_id | TEXT | Sim | — | FK para Produto.unidades[].id |
| unidade_sigla | TEXT | Não | — | Cache |
| fator_aplicado | NUMERIC(15,4) | Não | 1 | |
| fator_preco_aplicado | NUMERIC(15,4) | Não | 1 | |
| quantidade_comercial | NUMERIC(15,4) | Sim | — | |
| quantidade_base | NUMERIC(15,4) | Sim | — | **Calculado**: comercial × fator |
| preco_unitario_fator1 | NUMERIC(15,4) | Sim | — | **Fonte canônica** R$/unid base |
| preco_unitario_comercial | NUMERIC(15,4) | Não | — | |
| desconto_unitario_fator1 | NUMERIC(15,4) | Não | 0 | |
| preco_final_unitario_fator1 | NUMERIC(15,4) | Não | — | **Calculado** |
| tabela_preco_id | TEXT | Não | — | FK |
| tabela_preco_multiplicador | NUMERIC(15,4) | Não | 1 | |
| total | NUMERIC(15,2) | Não | — | **Calculado** |
| ordem | INT | Não | 0 | |
| observacoes | TEXT | Não | — | |

---

#### PedidoCompra
**Nome amigável:** Pedidos de Compra

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| numero | TEXT UNIQUE | Não | — | Auto-gerado PC-00001 |
| fornecedor_id | TEXT → Terceiro.id | Sim | — | FK |
| fornecedor_nome | TEXT | Não | — | Cache |
| data_emissao | DATE | Não | — | |
| data_prevista_entrega | DATE | Não | — | **Calculado** dos embarques |
| status | TEXT CHECK IN('Rascunho','Aguardando Aprovação Financeira','Aprovado') | Não | 'Rascunho' | |
| status_embarque | TEXT CHECK IN('Nenhum','Parcial','Total') | Não | 'Nenhum' | **Calculado** |
| percentual_valor_embarcado | NUMERIC(5,2) | Não | 0 | **Calculado** |
| status_recebimento_geral | TEXT CHECK IN('Nenhum','Pendente','Recebido Parcial','Concluído com Divergência','Concluído OK') | Não | 'Nenhum' | **Calculado** |
| itens | JSONB NOT NULL | Sim | '[]' | Array legado |
| valor_total | NUMERIC(15,2) | Não | — | |
| observacoes | TEXT | Não | — | |
| historico | TEXT | Não | — | |
| tags | TEXT[] | Não | — | |
| nfe_emitida | BOOLEAN | Não | false | |
| conta_pagamento_id | TEXT → ContasFinanceiras.id | Não | — | FK |
| tem_divergencias | BOOLEAN | Não | false | |
| conferencia_id | TEXT | Não | — | |
| data_aprovacao_financeira | TIMESTAMPTZ | Não | — | |
| data_despacho / data_chegada / data_conclusao | TIMESTAMPTZ | Não | — | |
| motivo_rejeicao_financeira | TEXT | Não | — | |
| solicitacao_cancelamento_* | TEXT/TIMESTAMPTZ | Não | — | 3 campos de auditoria |
| solicitacao_edicao_* | TEXT/TIMESTAMPTZ | Não | — | 3 campos de auditoria |
| aprovacao_reabertura_financeiro | BOOLEAN | Não | false | |
| status_aprovacao_financeira | TEXT | Não | — | |
| status_conferencia_pedido | TEXT CHECK IN('Não Iniciada','Parcialmente Conferido','Conferido OK','Conferido com Divergência') | Não | 'Não Iniciada' | |

**⚠️ Risco:** Possui tanto `itens[]` JSONB legado quanto entidade canônica `PedidoCompraItem`.

---

#### PedidoCompraItem (Canônico)

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| pedido_compra_id | TEXT → PedidoCompra.id | Sim | — | FK |
| pedido_compra_numero | TEXT | Não | — | |
| produto_id | TEXT → Produto.id | Sim | — | FK |
| produto_nome | TEXT | Não | — | |
| produto_unidade_id | TEXT | Sim | — | FK |
| unidade_sigla | TEXT | Não | — | |
| fator_aplicado | NUMERIC(15,4) | Não | 1 | |
| fator_preco_aplicado | NUMERIC(15,4) | Não | 1 | |
| quantidade_comercial | NUMERIC(15,4) | Sim | — | |
| quantidade_base | NUMERIC(15,4) | Sim | — | **Calculado** |
| custo_unitario_fator1 | NUMERIC(15,4) | Sim | — | **Fonte canônica** |
| custo_unitario_comercial | NUMERIC(15,4) | Não | — | |
| frete_unitario_fator1 | NUMERIC(15,4) | Não | 0 | |
| outros_unitario_fator1 | NUMERIC(15,4) | Não | 0 | |
| desconto_unitario_fator1 | NUMERIC(15,4) | Não | 0 | |
| custo_total_unitario_fator1 | NUMERIC(15,4) | Não | — | **Calculado** |
| total | NUMERIC(15,2) | Não | — | **Calculado** |
| quantidade_vinculada | NUMERIC(15,4) | Não | 0 | |
| ordem | INT | Não | 0 | |
| observacoes | TEXT | Não | — | |
| status_recebimento | TEXT CHECK IN('Pendente','Recebido Parcial','Recebido OK','Com Divergencia') | Não | 'Pendente' | |

---

#### MovimentacaoEstoque
**Nome amigável:** Movimentações de Estoque (entradas/saídas)

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| produto_id | TEXT → Produto.id | Sim | — | FK |
| produto_nome | TEXT | Não | — | Cache |
| tipo | TEXT CHECK IN('Entrada','Saída') | Sim | — | |
| motivo | TEXT CHECK IN('Compra','Venda','Ajuste de Inventário','Consumo Interno','Perda','Doação','Transferência','Devolução') | Não | — | |
| quantidade | NUMERIC(15,4) | Sim | — | |
| custo_unitario | NUMERIC(15,4) | Não | — | |
| referencia_tipo | TEXT | Não | — | PedidoCompra, PedidoVenda, etc. |
| referencia_id | TEXT | Não | — | FK polimórfica |
| referencia_numero | TEXT | Não | — | |
| observacoes | TEXT | Não | — | |
| usuario_responsavel | TEXT | Não | — | |
| numero_lote | TEXT | Não | — | |
| data_validade | DATE | Não | — | |
| numeros_serie | TEXT[] | Não | — | Array de strings |

**Trigger ativo:** `sincronizarEstoquePorMovimentacao` → recalcula `Produto.estoque_atual` em create/update/delete.

---

#### LancamentoFinanceiro
**Nome amigável:** Lançamentos Financeiros (receitas e despesas)

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| tipo | TEXT CHECK IN('Receita','Despesa') | Sim | — | |
| descricao | TEXT | Sim | — | |
| terceiro_id | TEXT → Terceiro.id | Não | — | FK |
| terceiro_nome | TEXT | Não | — | Cache |
| valor | NUMERIC(15,2) | Sim | — | |
| valor_liquido | NUMERIC(15,2) | Não | — | Após taxas |
| data_vencimento | DATE | Sim | — | |
| data_pagamento | DATE | Não | — | |
| data_lancamento | TEXT (ISO8601) | Não | — | Editável, ordenação fluxo |
| codigo_lancamento | TEXT | Não | — | AAAAMMDDHHMMSS ordenação |
| data_liquidacao_prevista | DATE | Não | — | |
| data_liquidacao_efetiva | DATE | Não | — | |
| status | TEXT CHECK IN('Em Aberto','Pago','Vencido','Cancelado') | Não | 'Em Aberto' | Atualizado por função agendada |
| status_conciliacao | TEXT CHECK IN('N/A','Pendente','Conciliado','Ajustado','Discrepância') | Não | 'N/A' | |
| forma_pagamento | TEXT | Não | — | Cache |
| forma_pagamento_id | TEXT → FormasDePagamento.id | Não | — | FK |
| forma_pagamento_tipo | TEXT CHECK IN('Dinheiro','PIX','Cartão Débito','Cartão Crédito','Boleto','Transferência') | Não | — | |
| categoria | TEXT | Não | — | Cache |
| categoria_id | TEXT → CategoriaFinanceira.id | Não | — | FK |
| tags | TEXT[] | Não | — | |
| conta_financeira_id | TEXT → ContasFinanceiras.id | Sim | — | FK |
| conta_financeira_nome | TEXT | Não | — | Cache |
| turno_caixa_id | TEXT → TurnoCaixa.id | Não | — | FK |
| referencia_id | TEXT | Não | — | FK polimórfica |
| referencia_tipo | TEXT CHECK IN('PedidoVenda','PedidoCompra','Agendamento','Conciliacao','Manual') | Não | — | |
| referencia_numero | TEXT | Não | — | |
| conciliacao_grupo_id | TEXT | Não | — | |
| observacoes | TEXT | Não | — | |
| is_recorrente | BOOLEAN | Não | false | |
| frequencia_recorrencia | TEXT CHECK IN('Semanal','Mensal','Bimestral','Trimestral','Semestral','Anual','Parcelado') | Não | — | |
| numero_parcelas_total | INT | Não | — | |
| parcela_atual | INT | Não | — | |
| grupo_lancamento_id | TEXT | Não | — | Self-ref (agrupamento recorrência) |
| data_fim_recorrencia | DATE | Não | — | |
| is_custo_mercadoria | BOOLEAN | Não | false | |
| pedido_compra_vinculado_id | TEXT → PedidoCompra.id | Não | — | FK |
| pedido_compra_vinculado_numero | TEXT | Não | — | Cache |

**Trigger ativo (inativo):** `sincronizarDelecaoLancamentos` (PAUSADO).
**Função agendada:** `atualizarStatusLancamentos` → marca "Vencido" diariamente às 11:00.

**Payload exemplo:**
```json
{"id":"lf1","tipo":"Receita","descricao":"Venda PV-00123","terceiro_id":"t1","terceiro_nome":"Cliente XYZ","valor":150.00,"valor_liquido":145.50,"data_vencimento":"2026-07-14","status":"Pago","forma_pagamento_tipo":"PIX","conta_financeira_id":"cf1","conta_financeira_nome":"Caixa Loja 1","referencia_tipo":"PedidoVenda","referencia_id":"pv1","referencia_numero":"PV-00123"}
```

---

#### ContasFinanceiras
**Nome amigável:** Contas Financeiras (caixas, bancos, carteiras)

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| nome | TEXT | Sim | — | |
| tipo | TEXT CHECK IN('Caixa Físico','Conta Bancária','Carteira Digital','Poupança','Investimento') | Sim | — | |
| is_caixa_geral | BOOLEAN | Não | false | Único true no sistema |
| is_caixa_pdv | BOOLEAN | Não | false | |
| usuario_atribuido_id | TEXT → User.id | Não | — | FK |
| usuario_atribuido_nome | TEXT | Não | — | Cache |
| banco / agencia / conta | TEXT | Não | — | |
| saldo_inicial | NUMERIC(15,2) | Não | 0 | |
| saldo_atual | NUMERIC(15,2) | Não | 0 | **Calculado** por função |
| cor | TEXT | Não | '#10B981' | |
| observacoes | TEXT | Não | — | |
| ativo | BOOLEAN | Não | true | |

---

#### TurnoCaixa
**Nome amigável:** Turnos de Caixa PDV

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| numero | TEXT UNIQUE | Não | — | TC-00001 |
| conta_caixa_pdv_id | TEXT → ContasFinanceiras.id | Sim | — | FK |
| conta_caixa_pdv_nome | TEXT | Não | — | |
| usuario_abertura_id | TEXT → User.id | Não | — | FK |
| usuario_abertura_nome | TEXT | Não | — | |
| data_abertura | TIMESTAMPTZ | Sim | — | |
| saldo_inicial | NUMERIC(15,2) | Sim | — | |
| data_fechamento | TIMESTAMPTZ | Não | — | |
| usuario_fechamento_id | TEXT → User.id | Não | — | |
| usuario_fechamento_nome | TEXT | Não | — | |
| saldo_final | NUMERIC(15,2) | Não | — | |
| total_vendas / total_reforcos / total_sangrias / total_despesas | NUMERIC(15,2) | Não | 0 | **Calculados** |
| recebimentos_dinheiro / pix / credito / debito / vale_troca | NUMERIC(15,2) | Não | 0 | **Calculados** |
| dinheiro_conferido | NUMERIC(15,2) | Não | — | |
| diferenca | NUMERIC(15,2) | Não | 0 | **Calculado** |
| status | TEXT CHECK IN('Aberto','Fechado') | Não | 'Aberto' | |
| vendas_ids / movimentos_ids / despesas_ids | TEXT[] | Não | — | Arrays de FKs |
| cancelamentos_rastro | JSONB | Não | — | **Array de objetos** (auditoria antifraude) |
| observacoes | TEXT | Não | — | |

---

#### FormasDePagamento
**Nome amigável:** Formas de Pagamento

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| nome | TEXT | Sim | — | |
| tipo | TEXT CHECK IN('Dinheiro','PIX','Cartão Débito','Cartão Crédito','Boleto','Transferência') | Sim | — | |
| conta_destino_id | TEXT → ContasFinanceiras.id | Sim | — | FK |
| conta_destino_nome | TEXT | Não | — | Cache |
| prazo_recebimento_dias | INT | Não | 0 | |
| tipo_taxa | TEXT CHECK IN('Percentual','Fixo') | Não | 'Percentual' | |
| valor_taxa | NUMERIC(8,4) | Não | 0 | |
| parcelas_max | INT | Não | 1 | |
| adquirente | TEXT | Não | — | |
| ativo | BOOLEAN | Não | true | |

---

### 2.2 Entidades de Logística e Recebimento

#### Embarque
**Nome amigável:** Embarques Logísticos

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| pedido_compra_id | TEXT → PedidoCompra.id | Sim | — | FK |
| pedido_compra_numero | TEXT | Não | — | |
| fornecedor_id | TEXT → Terceiro.id | Não | — | FK |
| fornecedor_nome | TEXT | Não | — | |
| numero | TEXT | Sim | — | Sequencial dentro do pedido |
| tipo | TEXT CHECK IN('Embarque','Necessidade') | Sim | 'Embarque' | |
| status | TEXT CHECK IN('Pendente','Despachado','Concluído') | Não | 'Pendente' | |
| status_recebimento | TEXT CHECK IN('Pendente','Recebido Parcial','Recebido OK','Com Divergência') | Não | 'Pendente' | |
| data_embarque / eta | TIMESTAMPTZ | Não | — | |
| transportadora_id | TEXT → Transportadora.id | Não | — | FK |
| transportadora_nome | TEXT | Não | — | |
| supermanifesto_id | TEXT → Supermanifesto.id | Não | — | FK |
| manifesto_entrada_id | TEXT → ManifestoEntrada.id | Não | — | FK |
| evento_logistico_id | TEXT → EventosLogisticos.id | Não | — | FK |
| volumes | TEXT | Não | — | Resumo livre |
| volumes_detalhados | JSONB | Não | '[]' | **Array de objetos** |
| peso_kg | NUMERIC | Não | 0 | |
| observacoes | TEXT | Não | — | |
| itens | JSONB | Não | '[]' | **Array de objetos legado** — ver EmbarqueItem canônico |

#### EmbarqueItem (Canônico)

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| embarque_id | TEXT → Embarque.id | Sim | — | FK |
| embarque_numero | TEXT | Não | — | |
| pedido_compra_id | TEXT → PedidoCompra.id | Não | — | FK denormalizado |
| pedido_compra_item_id | TEXT → PedidoCompraItem.id | Não | — | FK |
| produto_id | TEXT → Produto.id | Sim | — | FK |
| produto_nome | TEXT | Não | — | |
| produto_unidade_id | TEXT | Não | — | |
| unidade_sigla | TEXT | Não | — | |
| fator_aplicado | NUMERIC(15,4) | Não | 1 | |
| quantidade_pedida_comercial / _base | NUMERIC(15,4) | Não | — | |
| quantidade_embarcada_comercial / _base | NUMERIC(15,4) | Sim | — | |
| quantidade_recebida_comercial / _base | NUMERIC(15,4) | Não | 0 | |
| divergencia_tipo | TEXT CHECK IN('Nenhuma','Quantidade A Menor','Produto Diferente - Aceite','Produto Diferente - Rejeitado','Produto Novo Recebido') | Não | 'Nenhuma' | |
| produto_id_recebido_diferente | TEXT | Não | — | |
| produto_nome_recebido_diferente | TEXT | Não | — | |
| acordo_financeiro_lancamento_id | TEXT | Não | — | FK LancamentoFinanceiro |
| ordem | INT | Não | 0 | |
| observacoes | TEXT | Não | — | |

#### Supermanifesto
**Nome amigável:** Supermanifestos (consolidação de cargas)

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| numero | TEXT UNIQUE | Não | — | SM-00001 |
| transportadora_id | TEXT → Terceiro.id | Sim | — | FK |
| transportadora_nome | TEXT | Não | — | |
| eta | TIMESTAMPTZ | Sim | — | |
| status | TEXT CHECK IN('Pendente','Em Trânsito','Recebido','Cancelado') | Não | 'Pendente' | |
| peso_total_bruto_kg | NUMERIC | Não | 0 | **Calculado** |
| valor_total_estimado | NUMERIC | Não | 0 | **Calculado** |
| quantidade_volumes_estimada | NUMERIC | Não | 0 | **Calculado** |
| pedidos_vinculados | JSONB | Não | — | **Array de objetos aninhado** (com sub-array itens_vinculados) |
| volumes | JSONB | Não | — | **Array de objetos** |
| observacoes_consolidadas | TEXT | Não | — | **Calculado** |
| observacoes | TEXT | Não | — | |
| codigo_conferencia_volumes | TEXT | Não | — | Alfanumérico único |
| status_codigo_conferencia_volumes | TEXT CHECK IN('Pendente Geração','Gerado','Em Uso','Concluído','Expirado') | Não | 'Pendente Geração' | |
| volumes_conferidos | JSONB | Não | — | **Array de objetos** |
| ocorrencias_conferencia | JSONB | Não | — | **Array de objetos com sub-array midias[]** |
| data_conferencia_volumes | TIMESTAMPTZ | Não | — | |
| conferente_volumes_id / _nome | TEXT | Não | — | |
| conferente_volumes_senha_hash | TEXT | Não | — | ⚠️ Hash de senha |
| conferente_volumes_foto | TEXT | Não | — | URL |
| tem_divergencias | BOOLEAN | Não | false | |
| relatorio_conferencia_url | TEXT | Não | — | |

**Trigger ativo:** `atualizarTotaisSupermanifesto` em create/update de ManifestoEntrada e Supermanifesto.

#### ManifestoEntrada
**Nome amigável:** Manifestos de Entrada

| Campo | Tipo PG | Obrigatório | Default |
|---|---|---|---|
| numero | TEXT | Não | — | ME-00001 |
| supermanifesto_id | TEXT → Supermanifesto.id | Não | — | FK |
| pedido_compra_id | TEXT → PedidoCompra.id | Sim | — | FK |
| pedido_numero | TEXT | Não | — | |
| fornecedor_id | TEXT → Terceiro.id | Sim | — | FK |
| fornecedor_nome | TEXT | Não | — | |
| data_recebimento | TIMESTAMPTZ | Não | — | |
| status | TEXT CHECK IN('Aguardando Conferência','Em Conferência','Conferido','Com Divergências','Finalizado') | Não | 'Aguardando Conferência' | |
| itens_esperados | JSONB | Não | — | **Array de objetos** |
| volumes | JSONB | Não | — | **Array de objetos** |
| observacoes | TEXT | Não | — | |
| conferente_id / _nome | TEXT | Não | — | |
| data_conclusao | TIMESTAMPTZ | Não | — | |
| codigo_conferencia_itens | TEXT | Não | — | Alfanumérico único |
| status_codigo_conferencia_itens | TEXT CHECK IN('Pendente Geração','Gerado','Em Uso','Concluído','Expirado') | Não | 'Pendente Geração' | |

#### Transportadora / RotaLogisticaTemplate / EmbarcacaoTemplate / Veiculo / EventosLogisticos
**Nome amigável:** Cadastros de Logística

| Entidade | Campos-chave | Obrigatórios |
|---|---|---|
| Transportadora | nome, cnpj, telefone, saida_referencia(DATE), ativo | nome |
| RotaLogisticaTemplate | nome, tipo_rota(Fluvial/Rodoviária), origem, destino, duracao_ida/retorno_dias, ativa | nome, tipo_rota, origem, destino |
| EmbarcacaoTemplate | nome, transportadora, rota_template_id→FK, capacidade_carga, dias_ciclo_total, ativa, cor_indicador(cinza/verde/vermelho) | nome, capacidade_carga |
| Veiculo | placa UNIQUE, tipo(Caminhão/Van/Utilitário/Moto), modelo, capacidades, motorista_padrao_id→FK, ativo | placa, tipo, capacidade_peso_kg |
| EventosLogisticos | nome, transportadora, tipo_veiculo, datas saida/chegada, status, lancamento_financeiro_id→FK + caches | nome, data_previsao_chegada |

#### EventoLogisticoSandbox
**Nome amigável:** Sandbox Logística (viagens simuladas)
**⚠️ Não migrar** — ambiente de simulação/teste.

---

### 2.3 Entidades de Conferência e Auditoria de Estoque

#### ConferenciaEstoque
| Campo | Tipo | Obrigatório |
|---|---|---|
| nome_conferencia | TEXT | Sim |
| tipo_conferencia | TEXT CHECK IN('Inventário Geral','Cíclico','Específico') | Sim (default 'Cíclico') |
| responsavel_id | TEXT → User.id | Sim |
| data_inicio / data_fim | TIMESTAMPTZ | Não |
| status | TEXT CHECK IN('Rascunho','Em Andamento','Aguardando Auditoria','Concluída','Cancelada') | Não ('Rascunho') |
| ajuste_aplicado | BOOLEAN | false |
| itens_conferidos | JSONB (array de {produto_id, produto_nome, quantidade_contada}) | — |

#### ConferenciaItem (Canônico)
| Campo | Tipo | Obrigatório |
|---|---|---|
| conferencia_id | TEXT → ConferenciaEstoque.id | Sim |
| produto_id | TEXT → Produto.id | Sim |
| produto_unidade_id | TEXT | Não |
| fator_aplicado | NUMERIC | 1 |
| quantidade_sistema_base | NUMERIC | Não |
| quantidade_contada_comercial / _base | NUMERIC | Sim |
| divergencia_base | NUMERIC | Não |
| divergencia_sinal | TEXT CHECK IN('zero','positivo','negativo') | 'zero' |
| ordem | INT | 0 |

#### ConferenciaCompra / DivergenciaCompra
| Entidade | Campos-chave |
|---|---|
| ConferenciaCompra | pedido_compra_id→FK, tipo(Cega/com Nota), status, conferente_id→FK, itens_conferidos JSONB, interveniente_id→FK, assinatura_url |
| DivergenciaCompra | pedido_compra_id→FK, conferencia_id→FK, produto_id→FK, tipo(Falta/Avaria/+/Diferente), qtd esperada/recebida, status, fotos_urls TEXT[], acao_tomada |

---

### 2.4 Entidades Financeiras Auxiliares

#### ContaPrevista
| Campo | Tipo | Obrigatório |
|---|---|---|
| descricao | TEXT | Sim |
| terceiro_id | TEXT → Terceiro.id | Sim |
| categoria_financeira_id | TEXT → CategoriaFinanceira.id | Sim |
| valor | NUMERIC(15,2) | Sim |
| data_vencimento | DATE | Sim |
| natureza | TEXT CHECK IN('Parcelado','Único','Recorrente') | Sim |
| conta_recorrente_id | TEXT → ContaRecorrente.id | Não |
| parcela_numero / parcela_total | INT | Não |
| boleto_url | TEXT | Não |
| status | TEXT CHECK IN('Pendente','Boleto Anexado','Pago','Cancelado') | 'Pendente' |
| status_visual | TEXT CHECK IN('pendente','boleto_anexado','vencido','pago') | 'pendente' |

**Trigger ativo:** `sincronizarContaPrevia` → quando status→'Pago', cria LancamentoFinanceiro.

#### ContaRecorrente
| Campo | Tipo | Obrigatório |
|---|---|---|
| nome_despesa | TEXT | Sim |
| terceiro_id | TEXT → Terceiro.id | Sim |
| categoria_financeira_id | TEXT → CategoriaFinanceira.id | Sim |
| valor_previsto | NUMERIC(15,2) | Sim |
| frequencia | TEXT CHECK IN('Mensal','Bimestral','Trimestral','Semestral','Anual') | Sim |
| dia_vencimento | INT | Sim |
| ativa | BOOLEAN | true |
| data_fim | DATE | Não |

**Trigger ativo:** `sincronizarExclusaoContaRecorrente` → em delete, remove ContasPrevistas e LancamentosFinanceiros vinculados.
**Função agendada:** `gerarContasPrevistasRecorrentes` → 1º do mês, gera 3 meses à frente.

#### MovimentosCaixa
| Campo | Tipo | Obrigatório |
|---|---|---|
| numero | TEXT UNIQUE | Não |
| tipo | TEXT CHECK IN('Reforço','Sangria') | Sim |
| valor | NUMERIC(15,2) | Sim |
| conta_id | TEXT → ContasFinanceiras.id | Sim |
| turno_caixa_id | TEXT → TurnoCaixa.id | Não |
| usuario_responsavel_id | TEXT → User.id | Sim |
| status_registro | TEXT CHECK IN('Ativo','Editado','Cancelado') | 'Ativo' |
| valor_original / observacao_original | NUMERIC/TEXT | Não |
| historico_ajustes | JSONB (array de objetos) | Não |

#### PagamentoCartaoDetalhe
| Campo | Tipo | Obrigatório |
|---|---|---|
| pedido_venda_id | TEXT → PedidoVenda.id | Sim |
| maquininha_id | TEXT → Maquininha.id | Sim |
| bandeira | TEXT CHECK IN('Visa','Mastercard','Elo','Amex','Hipercard','Outra') | Sim |
| modalidade | TEXT CHECK IN('Débito','Crédito à Vista','Crédito Parcelado') | Sim |
| parcelas | INT | 1 |
| valor_bruto | NUMERIC(15,2) | Sim |
| taxa_total_percentual / valor_taxa_total / valor_liquido_recebido | NUMERIC | Não |
| data_venda / data_liquidacao_prevista | DATE | Não |
| conta_destino_id | TEXT → ContasFinanceiras.id | Não |
| lancamento_financeiro_id / lancamento_taxa_id | TEXT → LancamentoFinanceiro.id | Não |
| status_conciliacao | TEXT CHECK IN('Pendente','Lançado','Conciliado','Erro') | 'Pendente' |

**Função agendada:** `gerarLancamentosCartao` → diariamente 05:00 UTC, processa pendentes.
**Função agendada:** `processarLiquidacaoCartaoCredito` → diariamente 13:00 UTC (08:00 local), marca "Pago".

#### CategoriaFinanceira
| nome TEXT (Sim) | tipo TEXT CHECK IN('Receita','Despesa') (Sim) | ativa BOOLEAN (true) |

#### Maquininha
**Nome amigável:** Maquininhas de Cartão
| Campo | Tipo |
|---|---|
| nome | TEXT (Sim) |
| adquirente | TEXT |
| conta_destino_id | TEXT → ContasFinanceiras.id |
| prazos débito/crédito | INT (defaults: 1, 30, 30) |
| taxa_juros_cliente_mensal | NUMERIC (default 1.81) |
| bandeiras | JSONB — **Array de objetos com sub-array faixas_parcelamento** |
| ativo | BOOLEAN (true) |

**⚠️ Risco:** Estrutura JSONB profundamente aninhada em `bandeiras[]`.

---

### 2.5 Entidades de Vendas Auxiliares

#### RascunhoPedidoVenda
**Nome amigável:** Rascunhos de Venda (pré-processamento)
**⚠️ Considerar não migrar** — dados temporários. Migrar apenas se houver rascunhos ativos.

| Campo | Tipo |
|---|---|
| senha_atendimento | TEXT (Sim) — formato AAMMDD#### |
| cliente_id / vendedor_id / tabela_preco_id | TEXT FKs |
| tipo | TEXT CHECK IN('PDV','Pedido','Orçamento') |
| status | TEXT CHECK IN('Criado','Em Edição','Aguardando Caixa','Em Processamento','Retornado para Edição','Convertido','Cancelado','Expirado') (default 'Criado') |
| itens / pagamentos | JSONB |
| subtotal / valor_desconto / valor_frete / valor_total | NUMERIC |
| pedido_venda_final_id | TEXT → PedidoVenda.id |
| data_inicio_processamento / data_conversao | TIMESTAMPTZ |

#### ValeCompra
| Campo | Tipo | Obrigatório |
|---|---|---|
| codigo | TEXT UNIQUE | Não (VC-00001) |
| valor_original / valor_disponivel | NUMERIC(15,2) | Sim valor_original |
| cliente_id | TEXT → Terceiro.id | Não |
| cliente_nome | TEXT | Sim |
| origem_tipo | TEXT CHECK IN('Devolução','Troca','Cancelamento','Cortesia') | Sim |
| pedido_origem_id | TEXT → PedidoVenda.id | Não |
| status | TEXT CHECK IN('Ativo','Utilizado','Utilizado Parcialmente','Expirado','Cancelado') | 'Ativo' |
| data_expiracao | DATE | Não |
| historico_uso | JSONB (array de objetos) | Não |

#### DevolucaoTroca
| Campo | Tipo | Obrigatório |
|---|---|---|
| numero | TEXT | Não (DT-00001) |
| pedido_origem_id | TEXT → PedidoVenda.id | Sim |
| cliente_id | TEXT → Terceiro.id | Não |
| itens_devolvidos | JSONB (array de objetos) | Não |
| valor_total_devolvido | NUMERIC(15,2) | Sim |
| forma_reembolso | TEXT CHECK IN('Vale Troca','Dinheiro','PIX','Estorno Cartão') | Sim |
| vale_compra_id | TEXT → ValeCompra.id | Não |
| status | TEXT CHECK IN('Processada','Cancelada') | 'Processada' |
| turno_caixa_id / conta_financeira_id | TEXT FKs | Não |

#### AutorizacaoEstorno
| Campo | Tipo | Obrigatório |
|---|---|---|
| numero | TEXT | Não (AE-00001) |
| devolucao_id | TEXT → DevolucaoTroca.id | Sim |
| valor_autorizado | NUMERIC(15,2) | Sim |
| forma_reembolso | TEXT CHECK IN('Dinheiro') | Sim ('Dinheiro') |
| turno_caixa_destino_id | TEXT → TurnoCaixa.id | Sim |
| gerente_aprovador_id | TEXT → User.id | Sim |
| status | TEXT CHECK IN('Pendente','Processado','Cancelado') | 'Pendente' |
| data_expiracao | TIMESTAMPTZ | Não |

#### OrdemSeparacao
| pedido_venda_id (FK, Sim) | status (Pendente→Em Separação→Separado→Conferido→Cancelado) | itens JSONB | estoquista_id (FK) |

#### AgendaLogistica
| pedido_venda_id (FK, Sim) | cliente_id (FK, Sim) | endereco_entrega (Sim) | data_agendada (Sim) | turno_entrega (enum) | status (6 valores) | motorista_id | veiculo_placa | comprovante_entrega_url |

#### ProtocoloEntrega
| pedido_venda_id (FK, Sim) | tipo_entrega (Retirada/Delivery, Sim) | data_hora_entrega (TIMESTAMPTZ, Sim) | assinatura_url | foto_comprovante_url |

---

### 2.6 Entidades de Configuração / Lookup

| Entidade | Nome Amigável | Campos-chave | Obrigatórios |
|---|---|---|---|
| TabelaPreco | Tabelas de Preço | nome_tabela, fator_ajuste, is_default, percentual_desconto_maximo, ativo | nome_tabela, fator_ajuste |
| CategoriaProduto | Categorias de Produto | nome, descricao, organization_id, empresa_id, ativa | nome |
| Categoria | Categorias (legado) | nome, descricao, ativa | nome |
| Area | Áreas/Setores | codigo, nome, descricao, ativo | codigo, nome |
| Colaborador | Colaboradores | nome, email, cargo, perfil(6 valores), ativo, limite_desconto, acesso_config | nome, email, perfil |
| Interveniente | Intervenientes (PIN) | full_name, pin, description, active, allowed_operations TEXT[] | full_name, pin |
| PerfilDeAcesso | Perfis de Acesso | nome, descricao, cor, menu_compacto, permissoes JSONB, ativo | nome |
| PoliticasDesconto | Políticas de Desconto | nome, percentual_maximo_vendedor(5), percentual_maximo_gerente(15), ativo | nome |
| Campanha | Campanhas Promocionais | nome_campanha, tipo(4 valores), data_inicio, data_fim, produtos_ids TEXT[], valores | nome_campanha, tipo, data_inicio, data_fim |
| ConfiguracoesVenda | Config. de Venda | vender_sem_estoque, bloquear_venda_preco_zero, fluxo_venda_padrao(3), exibir_estoque_pdv, casas_decimais_quantidade | — |
| ConfiguracoesEstoque | Config. de Estoque | permitir_estoque_negativo, alerta_estoque_minimo, dias_previsao_reposicao | — |
| ConfiguracoesSeguranca | Config. de Segurança | exigir_senha_forte, tamanho_minimo_senha, habilitar_2fa, tempo_sessao_minutos, max_tentativas_login, tempo_bloqueio_minutos | — |
| ConfiguracaoAprendizado | Config. de Aprendizado | chave, valor(JSON), tipo(4 valores), protegido, data_atualizacao | chave, valor, tipo |
| DadosEmpresa | Dados da Empresa | razao_social, nome_fantasia, cnpj, endereco completo, logo_url, mensagem_rodape | razao_social |
| PerfilEmpresa | Perfil Empresarial | tipo(Microempresa/Média/Supermercado), configuracoes JSONB | tipo |
| StatusPedidoCompra | Status de Pedido de Compra | nome, codigo UNIQUE, descricao, cor, ordem, ativo | nome, codigo |
| ResponsavelConsumoInterno | Responsáveis por Consumo | nome, ativo | nome |
| DestinacaoConsumoInterno | Destinações de Consumo | nome, ativo | nome |

---

### 2.7 Entidades de Folha de Pagamento

#### FolhaPrevisaoModelo (Template)
| Campo | Tipo |
|---|---|
| nome | TEXT (Sim) |
| colaborador_id | TEXT → Colaborador.id |
| tipo_vinculo | TEXT CHECK IN('funcionario','socio') |
| retirada_frequencia | TEXT CHECK IN('semanal','mensal') |
| retirada_valor_fixo | NUMERIC |
| dia_vencimento | INT (Sim, default 5) |
| situacao | TEXT CHECK IN('ativo','desligado') |
| decimo_terceiro_ativo | BOOLEAN (true) |
| ferias_programadas | JSONB (array de objetos) |
| rubricas | JSONB (array de objetos com categoria_financeira_id FK) |

#### FolhaPrevisaoCompetencia
| colaborador_id (FK, Sim) | competencia YYYY-MM (Sim) | dia_vencimento (Sim) | status(rascunho/fechado) | rubricas JSONB | movimentos JSONB (array com sub-objetos) | grupo_lancamento_id |

#### ConsumoInterno
| numero (CI-00001) | status(Rascunho/Confirmado) | turno_caixa_id→FK | itens JSONB | valor_total | assinatura_recolhedor_url |

---

### 2.8 Entidades de Documentos / Templates

#### AnexoDocumento
| referencia_tipo (enum 6 valores, Sim) | referencia_id (Sim) | referencia_numero | tipo_documento (enum) | nome_arquivo (Sim) | url_drive (Sim) | drive_file_id | url_thumbnail | origem (upload_manual/compartilhamento_web) |

#### ComprovanteTemplate
| nome (Sim) | tipo (enum 7 valores, Sim) | html_template (Sim, TEXT grande) | is_default | blocks_config | html_content | css_content (legado) |

#### LayoutTemplate
| nome (Sim) | categoria (enum 6 valores, Sim) | tipo | blocks_config (JSON string) | is_default | versao | tags TEXT[] |

---

### 2.9 Entidades de UI / Ferramentas Internas

#### CatalogoInterface
**Nome amigável:** Catálogo da Interface (tree grid)
| stable_code TEXT UNIQUE (Sim) | parent_id (self-ref) | kind (7 valores, Sim) | titulo (Sim) | page_key | rota | nome_componente | lifecycle_status (3 valores, Sim) | metadados JSONB |

#### TargetFlare
**Nome amigável:** Alvos do Modo Flare
**⚠️ Não migrar** — ferramenta de desenvolvimento interno.

#### EstoqueDiario
**Nome amigável:** Snapshots Diários de Estoque
**⚠️ Não migrar** — cache recalculável. Migrar apenas se precisar histórico.

#### ImportacaoLog
**Nome amigável:** Log de Importações
**⚠️ Não migrar** — logs temporários.

---

### 2.10 User (Built-in)

| Campo | Tipo | Notas |
|---|---|---|
| nickname | TEXT | Apelido curto |
| perfil | TEXT CHECK IN('Admin','Gerente','Vendedor','Operador de Caixa','Estoquista','Financeiro') | Legado |
| perfil_acesso_id | TEXT → PerfilDeAcesso.id | FK |
| perfil_acesso_nome | TEXT | Cache |
| override_permissoes | JSONB | Overrides individuais |
| caixas_pdv_autorizados_ids | TEXT[] | FKs ContasFinanceiras |
| tabela_preco_id | TEXT → TabelaPreco.id | FK |
| tabela_preco_nome | TEXT | Cache |
| pin_hash | TEXT | ⚠️ SHA-256, nunca exportar |
| pin_definido | BOOLEAN | false |

**⚠️ Users não podem ser criados via API — usa-se convite.** Migrar via `auth.users` do Supabase.

---

## 3. Relacionamentos Entre Entidades

### 3.1 Mapa de Relacionamentos

```
Terceiro (1) ──< (N) PedidoVenda          [cliente_id]
Terceiro (1) ──< (N) PedidoCompra         [fornecedor_id]
Terceiro (1) ──< (N) LancamentoFinanceiro  [terceiro_id]
Terceiro (1) ──< (N) ContaPrevista         [terceiro_id]
Terceiro (1) ──< (N) ContaRecorrente       [terceiro_id]
Terceiro (1) ──< (N) Embarque              [fornecedor_id]
Terceiro (1) ──< (N) Supermanifesto        [transportadora_id]

Produto (1) ──< (N) MovimentacaoEstoque    [produto_id]
Produto (1) ──< (N) PedidoVendaItem        [produto_id]
Produto (1) ──< (N) PedidoCompraItem       [produto_id]
Produto (1) ──< (N) EmbarqueItem           [produto_id]
Produto (1) ──< (N) ConferenciaItem        [produto_id]
Produto (1) ──< (N) EstoqueDiario          [produto_id]

PedidoVenda (1) ──< (N) PedidoVendaItem    [pedido_venda_id]
PedidoVenda (1) ──< (N) PagamentoCartaoDetalhe [pedido_venda_id]
PedidoVenda (1) ──< (N) AgendaLogistica     [pedido_venda_id]
PedidoVenda (1) ──< (N) ProtocoloEntrega    [pedido_venda_id]
PedidoVenda (1) ──< (N) OrdemSeparacao      [pedido_venda_id]
PedidoVenda (1) ──< (N) DevolucaoTroca       [pedido_origem_id]
PedidoVenda (1) ──< (N) RascunhoPedidoVenda [pedido_venda_final_id]
PedidoVenda (1) ──< (N) ValeCompra          [pedido_origem_id]

PedidoCompra (1) ──< (N) PedidoCompraItem   [pedido_compra_id]
PedidoCompra (1) ──< (N) Embarque           [pedido_compra_id]
PedidoCompra (1) ──< (N) ManifestoEntrada   [pedido_compra_id]
PedidoCompra (1) ──< (N) ConferenciaCompra   [pedido_compra_id]
PedidoCompra (1) ──< (N) DivergenciaCompra   [pedido_compra_id]
PedidoCompra (1) ──< (N) LancamentoFinanceiro [pedido_compra_vinculado_id]

Embarque (1) ──< (N) EmbarqueItem           [embarque_id]
Supermanifesto (1) ──< (N) ManifestoEntrada  [supermanifesto_id]
Supermanifesto (1) ──< (N) Embarque          [supermanifesto_id]

ConferenciaEstoque (1) ──< (N) ConferenciaItem [conferencia_id]

ContaRecorrente (1) ──< (N) ContaPrevista   [conta_recorrente_id]
ContaPrevista (1) ──< (1) LancamentoFinanceiro [sincronização trigger]

ContasFinanceiras (1) ──< (N) LancamentoFinanceiro [conta_financeira_id]
ContasFinanceiras (1) ──< (N) MovimentosCaixa     [conta_id]
ContasFinanceiras (1) ──< (N) TurnoCaixa           [conta_caixa_pdv_id]
ContasFinanceiras (1) ──< (N) FormasDePagamento    [conta_destino_id]
ContasFinanceiras (1) ──< (N) Maquininha            [conta_destino_id]

TurnoCaixa (1) ──< (N) LancamentoFinanceiro [turno_caixa_id]
TurnoCaixa (1) ──< (N) MovimentosCaixa     [turno_caixa_id]
TurnoCaixa (1) ──< (N) PedidoVenda         [turno_caixa_id]
TurnoCaixa (1) ──< (N) DevolucaoTroca      [turno_caixa_id]

DevolucaoTroca (1) ──< (1) AutorizacaoEstorno [devolucao_id]
DevolucaoTroca (1) ──< (1) ValeCompra         [vale_compra_id]

Colaborador (1) ──< (N) FolhaPrevisaoModelo     [colaborador_id]
FolhaPrevisaoModelo (1) ──< (N) FolhaPrevisaoCompetencia [modelo_id]

CatalogoInterface (1) ──< (N) CatalogoInterface [parent_id — self-ref]

LancamentoFinanceiro (self-ref) ── grupo_lancamento_id (agrupamento de parcelas/recorrência)
```

### 3.2 Relacionamentos Polimórficos (FKs não tipadas)

| Campo | Entidade Origem | Entidades Destino Possíveis |
|---|---|---|
| referencia_id | LancamentoFinanceiro | PedidoVenda, PedidoCompra, AgendaLogistica, Conciliacao, Manual |
| referencia_id | MovimentacaoEstoque | PedidoCompra, PedidoVenda, ConferenciaEstoque |
| referencia_id | AnexoDocumento | LancamentoFinanceiro, PedidoVenda, PedidoCompra, AgendaLogistica, ManifestoEntrada |
| referencia_id | Tarefa | PedidoVenda, PedidoCompra, MovimentacaoEstoque, AgendaLogistica, EventoLogistico, LancamentoFinanceiro |

**⚠️ Risco:** Estes FKs polimórficos não podem ser FK constraints no Postgres. Implementar como CHECK com `referencia_tipo` + índice composto, ou usar UUID genérico sem constraint.

---

## 4. Funções de Backend e Automações

### 4.1 Automações Ativas (12)

| # | Nome | Tipo | Entidade/Agenda | Função | Efeito |
|---|---|---|---|---|---|
| 1 | Sincronizar estoque por movimentação | Entity (create/update/delete) | MovimentacaoEstoque | sincronizarEstoquePorMovimentacao | Recalcula Produto.estoque_atual |
| 2 | Sincronizar ContaPrevista → LancamentoFinanceiro | Entity (update) | ContaPrevista | sincronizarContaPrevia | Cria LancamentoFinanceiro quando status→'Pago' |
| 3 | Excluir vínculos ao apagar conta recorrente | Entity (delete) | ContaRecorrente | sincronizarExclusaoContaRecorrente | Remove ContasPrevistas + Lancamentos vinculados |
| 4 | Automação Aprovação Financeira | Entity (update) | PedidoCompra | automacaoAprovacaoFinanceira | Gerencia status de aprovação financeira |
| 5 | Trigger Totais Supermanifesto (Manifesto) | Entity (create/update/delete) | ManifestoEntrada | atualizarTotaisSupermanifesto | Recalcula totais do Supermanifesto pai |
| 6 | Atualizar Totais Supermanifesto | Entity (create/update) | Supermanifesto | atualizarTotaisSupermanifesto | Recalcula peso/valor/volumes |
| 7 | Flare: Export para GitHub | Entity (create/update) | TargetFlare | exportFlareToGithub | Exporta flares para GitHub repo |
| 8 | Gerar Lançamentos Cartão - Meia-noite | Scheduled (daily 05:00 UTC) | — | gerarLancamentosCartao | Processa PagamentoCartaoDetalhe pendentes |
| 9 | Gerar Lançamentos de Cartão | Scheduled (daily 05:00 UTC) | — | gerarLancamentosCartao | **⚠️ DUPLICADA** de #8 |
| 10 | Liquidar cartão débito/crédito | Scheduled (daily 13:00 UTC / 08:00 local) | — | processarLiquidacaoCartaoCredito | Marca LancamentoFinanceiro cartão como 'Pago' |
| 11 | Gerar ContasPrevistas Recorrentes | Scheduled (cron 0 6 1 * *) | — | gerarContasPrevistasRecorrentes | Gera 3 meses de ContasPrevistas |
| 12 | Atualizar viagens transportadoras | Scheduled (monthly day 1 00:10) | — | atualizarViagensTransportadoras | Sincroniza dados de viagens |
| 13 | Atualizar Status Lançamentos Vencidos | Scheduled (daily 11:00) | — | atualizarStatusLancamentos | Marca LancamentoFinanceiro vencidos |

### 4.2 Automação Inativa (1)

| Nome | Tipo | Entidade | Função | Status |
|---|---|---|---|---|
| Sincronizar deleção de movimentos de caixa | Entity (delete) | LancamentoFinanceiro | sincronizarDelecaoLancamentos | **PAUSADA** — não migrar |

### 4.3 Funções de Backend Críticas (escrevem dados)

| Função | Entidades Escritas | Efeito |
|---|---|---|
| processarVendaCaixa | LancamentoFinanceiro, MovimentacaoEstoque, PedidoVenda, TurnoCaixa, PagamentoCartaoDetalhe | Processa venda PDV completa |
| sincronizarEstoquePorMovimentacao | Produto | Recalcula estoque_atual |
| processarLiquidacaoCartaoCredito | LancamentoFinanceiro | Marca pagamentos cartão como 'Pago' |
| gerarLancamentosCartao | LancamentoFinanceiro | Gera lançamentos de receita + taxa |
| gerarContasPrevistasRecorrentes | ContaPrevista | Gera 3 meses à frente |
| sincronizarContaPrevia | LancamentoFinanceiro | Cria lançamento ao pagar conta prevista |
| sincronizarExclusaoContaRecorrente | ContaPrevista, LancamentoFinanceiro | Cascade delete |
| gerarNumeroSequencial | — (utilitário) | Gera números PC-00001, PV-00001, etc. |
| cancelarLancamentoFinanceiro | LancamentoFinanceiro, ContasFinanceiras | Cancela + reverte saldo |
| auditarSaldosContas | ContasFinanceiras | Recalcula saldo_atual de todas contas |
| enviarFinanceiroLote | LancamentoFinanceiro | Marca lote como pago |
| atualizarStatusLancamentos | LancamentoFinanceiro | Atualiza vencidos |
| recalcularEstoqueProduto | Produto | Recalcula estoque |
| atualizarTotaisSupermanifesto | Supermanifesto | Recalcula agregados |
| automacaoAprovacaoFinanceira | PedidoCompra | Gerencia status de aprovação |
| gerenciarPin | User, Interveniente | Hash/valida PINs (SHA-256) |
| savePedidoVendaItem | PedidoVendaItem | Persiste item canônico |
| savePedidoCompraItem | PedidoCompraItem | Persiste item canônico |
| saveEmbarqueItem | EmbarqueItem | Persiste item canônico |
| saveConferenciaItem | ConferenciaItem | Persiste item canônico |
| gerarLancamentosCartao | LancamentoFinanceiro, PagamentoCartaoDetalhe | Processa cartões pendentes |

### 4.4 Funções de Leitura/Relatório

| Função | Efeito |
|---|---|
| gerarExtratoFluxoCaixa | Extrato por período/conta |
| gerarRelatorioMargem | Margem bruta por produto |
| gerarRelatorioPedidosCompra | Relatório consolidado |
| gerarRelatorioPedidosComprav2 | v2 do relatório |
| gerarRelatorioConsolidadoCompra | Consolidação de compra |
| gerarRelatorioContasAbertas | Contas em aberto |
| gerarRelatorioPendencias | Pendências |
| gerarRelatorioSupermanifesto | Relatório de supermanifesto |
| gerarRelatorioPrecificacao | Relatório de precificação |
| gerarRelatorioPedido | Relatório de pedido individual |
| gerarRelatorioConferencia | Relatório de conferência |
| calcularIEP | Índice de Eficiência de Pedidos |
| gerarExtratoFluxoCaixa | Extrato do fluxo |
| listarAnexos | Lista anexos por referência |
| listarCatalogoInterface | Lista catálogo UI |

### 4.5 Funções de Integração Externa

| Função | Integração | Segredos |
|---|---|---|
| exportFlareToGithub | GitHub connector | FLARE_GITHUB_OWNER, FLARE_GITHUB_REPO, FLARE_GITHUB_BRANCH |
| uploadAnexoDrive | Google Drive connector | OAuth (googledrive) |
| convidarUsuarios | Core.SendEmail | — |
| importarProdutos | Core.ExtractDataFromUploadedFile | — |
| importarPedidosCompra | Core.ExtractDataFromUploadedFile | — |
| commitMigrationManifests | GitHub connector | GITHUB_TOKEN |
| syncCodebaseToGithub | GitHub connector | GITHUB_TOKEN |

---

## 5. Regras de Negócio Implícitas

### 5.1 Transições de Status

**PedidoVenda.status:**
```
Orçamento → Aguardando Caixa → Financeiro OK → Em Separação → Em Rota de Entrega → Pedido Concluído
                    ↓                                                                 ↓
               Cancelado ←──────────────────────────────────────────────────────── Cancelado
```

**PedidoCompra.status:**
```
Rascunho → Aguardando Aprovação Financeira → Aprovado
              ↓ (rejeitado)                        ↓ (solicitação)
         motivo_rejeicao               solicitacao_cancelamento / solicitacao_edicao
```

**LancamentoFinanceiro.status:**
```
Em Aberto → Pago (data_pagamento preenchida)
Em Aberto → Vencido (atualizado por função agendada se data_vencimento < hoje)
Pago → Cancelado (reverte saldo via cancelarLancamentoFinanceiro)
```

**ContaPrevista.status:**
```
Pendente → Boleto Anexado → Pago → (cria LancamentoFinanceiro via trigger)
                             ↘ Cancelado
```

### 5.2 Validações de Negócio

| Regra | Implementação |
|---|---|
| Apenas 1 ContasFinanceiras com is_caixa_geral=true | Lógica de app (não há constraint no schema) |
| Apenas 1 TabelaPreco com is_default=true | Lógica de app |
| PIN deve ter 4-6 dígitos | Função `gerenciarPin` |
| Desconto > percentual_maximo_vendedor requer autenticação gerente | `PoliticasDesconto` + `Interveniente` |
| Venda sem estoque só se ConfiguracoesVenda.vender_sem_estoque=true | Lógica de app |
| Venda preço zero bloqueada se ConfiguracoesVenda.bloquear_venda_preco_zero=true | Lógica de app |
| Estoque negativo só se ConfiguracoesEstoque.permitir_estoque_negativo=true | Lógica de app |
| RascunhoPedidoVenda.status='Em Processamento' = selo frio anti-duplo-processamento | Lógica de app |
| ValeCompra valor_disponível decrementa em uso | Lógica de app |
| numero_parcelas_total e parcela_atual devem ser coerentes com frequencia_recorrencia='Parcelado' | Lógica de app |

### 5.3 Campos Calculados (não persistir diretamente — recalcular)

| Entidade | Campo | Fonte |
|---|---|---|
| Produto | estoque_atual | Soma de MovimentacaoEstoque (Entrada - Saída) |
| Produto | preco_custo_calculado | valor_compra + frete + impostos - descontos |
| Produto | volume_cm3 | Parsed de dimensoes_cm |
| Produto | nome | Concatenação campo_hierarquico_1..5 |
| PedidoCompra | data_prevista_entrega | ETA consolidada dos embarques ativos |
| PedidoCompra | status_embarque / percentual_valor_embarcado / status_recebimento_geral | Agregado dos embarques |
| TurnoCaixa | total_vendas / reforcos / sangrias / despesas / diferenca | Soma de lançamentos vinculados |
| ContasFinanceiras | saldo_atual | Soma de lançamentos pagos |
| Supermanifesto | peso_total / valor_total / quantidade_volumes | Agregado de pedidos vinculados |
| LancamentoFinanceiro | valor_liquido | valor - taxas |
| PagamentoCartaoDetalhe | taxa_total_percentual / valor_taxa_total / valor_liquido | Calculado de taxas da maquininha |

---

## 6. Itens com Risco de Migração

### 6.1 Alto Risco

| Item | Entidades | Risco | Mitigação |
|---|---|---|---|
| Arrays JSONB aninhados | PedidoVenda.itens, PedidoCompra.itens, Embarque.itens, Supermanifesto.pedidos_vinculados | Dados duplicados com entidades canônicas (PedidoVendaItem, etc.) | Migrar canônicas primeiro, depois arrays como fallback |
| FKs polimórficas | LancamentoFinanceiro.referencia_id, MovimentacaoEstoque.referencia_id, AnexoDocumento.referencia_id | Não há constraint possível no Postgres | CHECK com referencia_tipo + índice composto |
| Hashes de PIN | User.pin_hash, Interveniente.pin, Supermanifesto.conferente_volumes_senha_hash | Algoritmo de hash deve ser idêntico | Portar `gerenciarPin` exatamente (SHA-256) |
| Estrutura JSONB profunda | Maquininha.bandeiras[].faixas_parcelamento[], FolhaPrevisaoCompetencia.movimentos[], FolhaPrevisaoModelo.rubricas[], TurnoCaixa.cancelamentos_rastro[] | Perda de dados se schema JSON não for validado | Validar JSON antes de insert |
| Sincronia de saldos | ContasFinanceiras.saldo_atual, Produto.estoque_atual | Podem divergir se triggers migrarem desordenadamente | Executar `auditarSaldosContas` + `recalcularEstoqueProduto` após migração |
| Dependência circular | PedidoVenda.orcamento_origem_id (self-ref), LancamentoFinanceiro.grupo_lancamento_id (self-ref), CatalogoInterface.parent_id (self-ref) | Ordem de inserção importa | Inserir NULL primeiro, atualizar depois |
| User entity | User | Não pode ser criado via API no Base44 | Migrar via `auth.users` do Supabase + `user_metadata` |

### 6.2 Risco Médio

| Item | Descrição |
|---|---|
| Automação duplicada | `gerarLancamentosCartao` tem 2 automações agendadas idênticas (IDs 69be3ff0 e 69be3ecd) |
| Campos legados | Produto: unidade_comercial_id, unidade_apresentacao_default, unidade_show_comercial, unidade_show_logistica (marcados como legado) |
| LayoutTemplate.blocks_config | String JSON (não JSONB) — precisa parse e re-insert |
| ComprovanteTemplate | 3 campos de template: html_template (canônico), html_content + css_content (legado) |
| Timezone | America/Rio_Branco (UTC-5) — todos os horários agendados são UTC convertidos |

---

## 7. Ordem Recomendada de Migração

### Fase 0 — Pré-migração (Schema DDL)
```
1. Criar todas as tabelas com constraints (sem FKs ainda)
2. Criar enums CHECK constraints
3. Criar índices
```

### Fase 1 — Configuração Base (sem dependências)
```
1.  DadosEmpresa
2.  PerfilEmpresa
3.  ConfiguracoesSeguranca
4.  ConfiguracoesEstoque
5.  ConfiguracoesVenda
6.  ConfiguracaoAprendizado
7.  PerfilDeAcesso
8.  StatusPedidoCompra
9.  Categoria / CategoriaProduto / Area
10. CategoriaFinanceira
11. ResponsavelConsumoInterno
12. DestinacaoConsumoInterno
13. PoliticasDesconto
14. TabelaPreco
15. RotaLogisticaTemplate
16. Transportadora
17. EmbarcacaoTemplate
18. Veiculo
19. ComprovanteTemplate
20. LayoutTemplate
21. Interveniente
22. Colaborador
```

### Fase 2 — Cadastros Principais
```
23. User (via auth.users do Supabase)
24. Terceiro
25. Produto
26. ContasFinanceiras
27. FormasDePagamento
28. Maquininha
```

### Fase 3 — Operações (depende de Fase 2)
```
29.  TabelaPreco (se não migrou na Fase 1)
30.  Campanha
31.  TurnoCaixa
32.  Cotacao
33.  PedidoCompra
34.  PedidoCompraItem (canônico)
35.  ContaRecorrente
36.  ContaPrevista
37.  Supermanifesto
38.  Embarque
39.  EmbarqueItem (canônico)
40.  ManifestoEntrada
41.  EventosLogisticos
42.  MovimentacaoEstoque
43.  ConferenciaEstoque
44.  ConferenciaItem (canônico)
45.  ConferenciaCompra
46.  DivergenciaCompra
47.  LancamentoFinanceiro
48.  MovimentosCaixa
49.  PagamentoCartaoDetalhe
50.  RascunhoPedidoVenda
51.  PedidoVenda
52.  PedidoVendaItem (canônico)
53.  ValeCompra
54.  DevolucaoTroca
55.  AutorizacaoEstorno
56.  OrdemSeparacao
57.  AgendaLogistica
58.  ProtocoloEntrega
59.  ConsumoInterno
60.  VendaPerdida
61.  Tarefa
62.  AgendaItem
```

### Fase 4 — Folha de Pagamento
```
63. FolhaPrevisaoModelo
64. FolhaPrevisaoCompetencia
```

### Fase 5 — Documentos / UI
```
65. AnexoDocumento
66. CatalogoInterface
67. ImportacaoLog (opcional)
```

### Fase 6 — Pós-migração
```
68. Adicionar FK constraints (ALTER TABLE ADD CONSTRAINT)
69. Criar triggers PostgreSQL equivalentes às automações
70. Configurar pg_cron para funções agendadas
71. Executar recálculos: auditarSaldosContas, recalcularEstoqueProduto
72. Validar contagens: comparar totais por entidade
```

---

## 8. Dados que NÃO Devem Ser Migrados

| Entidade | Motivo |
|---|---|
| TargetFlare | Ferramenta de desenvolvimento interno (bugs/melhorias de UI) |
| EventoLogisticoSandbox | Ambiente de simulação/teste de logística |
| EstoqueDiario | Cache recalculável — snapshots podem ser regenerados |
| ImportacaoLog | Logs temporários de importação (apenas snapshot para desfazer) |
| RascunhoPedidoVenda (status='Convertido' ou 'Expirado' ou 'Cancelado') | Rascunhos já processados não têm valor |
| Logs de auditoria internos | TurnoCaixa.cancelamentos_rastro, MovimentosCaixa.historico_ajustes — avaliar caso a caso |

---

## 9. Equivalência de Automações no Supabase

| Automação Base44 | Equivalente Supabase |
|---|---|
| Entity trigger (create/update/delete) | `CREATE TRIGGER ... AFTER INSERT OR UPDATE OR DELETE ON table FOR EACH ROW EXECUTE FUNCTION fn();` |
| Scheduled (daily/monthly) | `SELECT cron.schedule('name', 'cron_expr', $$ SELECT net.http_post(url, body) $$);` |
| Trigger conditions (changed_fields) | `WHEN (OLD.field IS DISTINCT FROM NEW.field)` na cláusula do trigger |
| payload_too_large | Não aplicável — trigger Postgres tem acesso direto à row completa |

---

## 10. Checklist Final — Pronto para Migrar

### Schema DDL
- [ ] Todas as 72 tabelas criadas com tipos corretos
- [ ] CHECK constraints para todos os enums (46 campos enum identificados)
- [ ] UNIQUE constraints para: Produto.codigo_interno, Terceiro.codigo_interno, PedidoVenda.numero, PedidoCompra.numero, TurnoCaixa.numero, MovimentosCaixa.numero, Veiculo.placa, CatalogoInterface.stable_code, StatusPedidoCompra.codigo, ValeCompra.codigo
- [ ] Índices em todos os campos FK (foreign key)
- [ ] Índices em campos de busca frequente (nome, status, data_vencimento, codigo_lancamento)
- [ ] JSONB columns para arrays de objetos (unidades_alternativas, itens, pagamentos, bandeiras, rubricas, etc.)
- [ ] TEXT[] para arrays simples (tags, fotos_urls, numeros_serie, vendas_ids)

### Migração de Dados
- [ ] Ordem de migração seguida (Fase 1 → 6)
- [ ] FKs adicionadas APÓS inserção de dados (Fase 6)
- [ ] Self-references inseridas com NULL, atualizadas depois
- [ ] Campos calculados preenchidos com NULL/0 inicialmente
- [ ] Função `auditarSaldosContas` executada pós-migração
- [ ] Função `recalcularEstoqueProduto` executada para todos os produtos
- [ ] Contagem de registros comparada entre Base44 e Supabase por entidade
- [ ] Payloads de teste validados para entidades principais (Produto, PedidoVenda, LancamentoFinanceiro, PedidoCompra)

### Automações
- [ ] 6 triggers PostgreSQL criados (estoque, conta_prevista, conta_recorrente, supermanifesto×2, aprovação_financeira)
- [ ] 5 jobs pg_cron criados (liquidacao_cartao, gerar_lancamentos_cartao [ÚNICO], contas_previstas, viagens, status_vencidos)
- [ ] Automação duplicada de gerarLancamentosCartao resolvida (criar apenas 1)
- [ ] Automação inativa (sincronizarDelecaoLancamentos) NÃO migrada
- [ ] Automação de Flare → GitHub NÃO migrada (TargetFlare não migra)

### Funções
- [ ] `gerarNumeroSequencial` migrada primeiro (utilitário usado por muitas funções)
- [ ] `gerenciarPin` migrada com algoritmo SHA-256 idêntico
- [ ] `processarVendaCaixa` migrada e testada com cenário completo
- [ ] `sincronizarEstoquePorMovimentacao` convertida para trigger PL/pgSQL
- [ ] Integrações externas (GitHub, Google Drive, SendEmail, ExtractData) substituídas por equivalentes Supabase
- [ ] Segredos configurados no Supabase Vault (GITHUB_TOKEN, FLARE_GITHUB_*)

### Validação
- [ ] Usuários de teste criados no auth.users do Supabase
- [ ] Fluxo de venda PDV completo testado (criar → processar → estoque → financeiro)
- [ ] Fluxo de compra completo testado (criar → embarque → recebimento → estoque → financeiro)
- [ ] Fluxo de devolução/troca testado
- [ ] Fluxo de folha de pagamento testado
- [ ] Relatórios gerados e comparados com Base44
- [ ] Snapshot de validação: comparar totais financeiros, saldos de estoque, e contagens de registros