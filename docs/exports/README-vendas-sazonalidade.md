# Relatório PDF — sazonalidade de vendas (6 meses)

Estudo **offline** (não aparece no ERP).

## Gerar

```bash
node scripts/gerar-pdf-vendas-sazonalidade-6m.mjs
```

Requer credenciais Supabase no ambiente (service role) e Playwright Chromium (`npx playwright install chromium` na primeira vez).

## Conteúdo do PDF (2 páginas)

1. **Visão completa** — % do faturamento em 4 partes iguais do mês (P1→P4), gráficos empilhados por mês + tabela + média.
2. **Média orgânica** — mesma leitura após remover **dias** com valor de venda acima de Q3+1,5×IQR no mês + lista de dias excluídos.

## JSON (debug)

```bash
node scripts/analisar-vendas-sazonalidade-6m.mjs
```

Saída em `docs/exports/P38-vendas-sazonalidade-6m-<data-corte>.pdf`.