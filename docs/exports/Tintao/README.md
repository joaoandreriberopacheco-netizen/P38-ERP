# Tintão — exportações pontuais

Relatório **saldo pós-embarque** (avaria / divergência / reposição) para partilha com o fornecedor — estilo órfãos, com % sobre o pedido original.

| Ficheiro | Descrição |
|----------|-----------|
| `pendente-embarque-tint-YYYY-MM-DD.pdf` | PDF pontual (pedido, despacho principal, linhas pendentes) |
| `pendente-embarque-tint-YYYY-MM-DD.html` | Mesmo conteúdo (impressão / revisão) |
| `pendente-embarque-tint-YYYY-MM-DD.json` | Dados brutos do relatório |

Regenerar (Supabase, filtro fornecedor Tintão):

```bash
npm run compras:relatorio-pendente-fornecedor -- --fornecedor=tint --desde=2026-07-20 --pdf
```

Com `--fornecedor=tint…` a saída vai **directo para esta pasta** (`docs/exports/Tintao/`).

Doc: [`../../compras/relatorio-pendente-embarque-fornecedor.md`](../../compras/relatorio-pendente-embarque-fornecedor.md)
