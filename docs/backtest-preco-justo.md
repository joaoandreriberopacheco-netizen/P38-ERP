# Backtest — Política de Preço Justo

Script isolado em Python para simular markup global de **40%** sobre o custo real das vendas faturadas (últimos 60 dias por defeito).

## Instalação

```bash
pip install -r scripts/requirements-backtest-preco-justo.txt
```

## Execução

```bash
export DATABASE_URL="postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres"
python scripts/backtest_preco_justo.py
```

Opções úteis:

| Flag | Descrição |
|------|-----------|
| `--dias 60` | Janela de vendas faturadas |
| `--output ./saida/` | Pasta dos ficheiros gerados |
| `--flex-margem-max 25` | Margem real máxima para promoção flexível a Destino |
| `--flex-peso-min 1.5` | Peso mínimo no faturamento (%) para promoção flexível |

## Saídas

1. **`.xlsx`** — abas Metadados, Visão Executiva e Detalhe por Produto
2. **`.html`** — visor interativo com gráficos e sliders what-if (markup Destino/Rotina → recalcula Conveniência)

## Classificação (3 grupos)

| Grupo | Markup simulado | Critério |
|-------|-----------------|----------|
| **Destino (KVI)** | 20% fixo | Palavras-chave (cimento, areia, ferro…) **ou** regra flexível |
| **Rotina / Subsidiadores** | 40% fixo | Porcelanato, piso, cerâmica, argamassa |
| **Conveniência** | Calculado | Fecha a conta global em 40% |

### Regra flexível (Destino)

Quando poucos itens batem por palavra-chave, o script **promove** produtos para Destino se:

- margem real histórica ≤ `--flex-margem-max` (default 25%), **e**
- peso no faturamento ≥ `--flex-peso-min` (default 1,5% do total), **ou**
- margem muito baixa (~25%) com peso alto (≥ 3% do faturamento)

Isto captura KVIs “escondidos” — itens de margem baixa que pesam muito no faturamento, mesmo sem nome óbvio.

## Custo real

Por linha de venda: `custo_unitario_momento` (snapshot na venda), com fallback para `preco_custo_calculado` ou soma compra + frete + impostos do cadastro.

## Vendas elegíveis

Status: `Financeiro OK`, `Pedido Concluído`, `Em Separação`, `Em Rota de Entrega` (exclui `Cancelado`).
