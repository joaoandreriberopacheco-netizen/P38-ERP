# Relatório PDF — sazonalidade de vendas (6 meses)

Estudo **offline** (não aparece no ERP).

## Regras

- Mês civil em **3 partes iguais** (~um terço dos dias cada).
- Contam **segunda a sábado**; **domingo não entra** no total nem nas partes.
- Página 2 remove **dias úteis** outlier (valor diário &gt; Q3+1,5×IQR no mês).
- Meses sem snapshot mensal: pedidos por `data_venda` (deduplicados por `id` na paginação) ou `dashboard_kpi_diario` quando existir.
- Tabelas incluem **m.c.** (lucro ÷ receita líquida) e **markup** (lucro ÷ custo) por mês, mais linha **Média da janela** (ponderada).

## Gerar

```bash
npm run vendas-sazonalidade:pdf
```

Requer credenciais Supabase (service role) e Playwright Chromium (`npx playwright install chromium` na primeira vez).

## JSON (debug)

```bash
npm run vendas-sazonalidade:json
```

Saída: `docs/exports/P38-vendas-sazonalidade-6m-<data-corte>.pdf` (2 páginas: completo + orgânico).