# Dashboard e Margem — mês fechado vs mês corrente

Documento para a equipa: como o P38 trata **resultado histórico** (mês encerrado) e **gestão ao vivo** (mês corrente).

## Regra de negócio

| Período | Comportamento | Pergunta que responde |
|---------|---------------|------------------------|
| **Mês corrente** | Dinâmico — custos do cadastro **de hoje** | “Como está a margem **agora**, se eu precificar com os custos atuais?” |
| **Mês fechado** | Congelado — não recalcula quando o catálogo muda | “Quanto **lucrei de facto** naquele mês?” |

**Receita** vem sempre do pedido (valor na venda) — é estática.  
**Custo** no mês corrente acompanha o catálogo; no mês fechado usa o custo gravado na linha (`custo_unitario_momento`).

### Exemplo

- Venda: R$ 150 · Custo na venda: R$ 100 → **lucro R$ 50**
- Seis meses depois o cadastro passa a custo R$ 160:
  - **Mês fechado:** continua a mostrar **+R$ 50** (verdade histórica)
  - **Lógica antiga (só cadastro atual):** mostraria **−R$ 10** — injusto para quem analisa o passado

## Onde isto aparece na aplicação

### Dashboard (aba Vendas)

1. **Até ontem** — job noturno grava `dashboard_kpi_mensal` (snapshot).
2. **Hoje** — o browser soma só o delta do dia com a mesma fórmula.
3. **Mês passado** — lê o snapshot com `frozen: true`; o job **não reescreve**.

Comando do job (também em GitHub Actions, ~05:10 UTC):

```bash
npm run dashboard:kpi-margem-fechar
```

### Relatório de Margem

- Cabeçalho indica o modo:
  - *“mês corrente · custos de hoje”*
  - *“mês fechado · custo na venda”*
- **Markup %** = lucro ÷ custo × 100 (mesma definição nos dois).

## Dados técnicos (referência rápida)

| Campo / tabela | Função |
|----------------|--------|
| `pedido_venda_item.custo_unitario_momento` | Custo na hora da venda (mês fechado) |
| `produto.preco_custo_calculado` | Custo do cadastro hoje (mês corrente) |
| `dashboard_kpi_mensal.payload.frozen` | `true` = mês selado, não recalcular |
| `payload.costBasis` | `cadastro_atual` ou `momento_venda` |
| `sourceVersion: relatorio_margem_v1` | Motor alinhado ao Relatório de Margem |

Migrações: `085_dashboard_kpi_margem_job.sql`, `086_dashboard_kpi_margem_mes_congelado.sql`.

## Validação

Paridade dashboard ↔ Relatório de Margem (mês corrente):

```bash
npx vite-node scripts/validate-dashboard-margem-setembro.mjs 2026-09 2026-09-09
```

Esperado: `diff.lucro: 0`, `ok: true`.

## O que **não** fazemos

- Não reabrimos meses fechados quando o fornecedor sobe preço (salvo `--force` manual no job, só para correção excepcional).
- Não misturar “margem de gestão” (hoje) com “DRE do mês X” (fechado) no mesmo número sem aviso no UI.

## Analogia

- **Mês corrente** = folha de cálculo aberta.
- **Mês fechado** = PDF arquivado — o que estava certo em setembro continua certo em março.
