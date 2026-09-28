# Relatório saldo pós-embarque (fornecedor) — estilo órfãos Tintão

Documento para o **fornecedor** ver o que ainda falta **repor** após embarque/recepção, com **proporção face ao pedido original** (razoabilidade — saldo típico de cerâmica, não inventado).

## O que mostra

Por **fornecedor** → **pedido**:

1. **Pedido original** — emissão, valor total, **% do saldo pendente sobre o pedido**
2. **Despacho principal** — primeiro split embarcado (ex. `EXC-FQZ-A`), data, transportadora, status recepção
3. **Tabelas por formato** (como PDF órfãos Tintão) — colunas:
   - Pedido / Embarcado / Recebido / **Avaria (cx)**
   - **% modelo** (avaria ÷ caixas pedidas daquele item)
   - **% pedido** (mesma avaria ÷ total de caixas do pedido — ex. 200+200+200=600, 15 avaria → 2,5% no rodapé)
   - Valor a repor

No **rodapé de cada pedido** e no **total geral**: soma de caixas pedidas, caixas com avaria e **percentual proporcional** (ex. 1000 cx nos pedidos, 40 avaria → 4%).

Por defeito entram só saldos **pós-embarque** (avaria, divergência, Necessidade). Não entra «falta embarcar» sem despacho.

**Tintão (`--fornecedor=tint`):** por defeito entram **todos** os pedidos com saldo pendente **com emissão a partir de 20/07/2026**, agrupados como **Tintão** (Nova Cidade, Televendas, etc.). Use `--so-pos-embarque` para voltar ao recorte só avaria na recepção.

## Gerar

```bash
npm run compras:relatorio-pendente-fornecedor
npm run compras:relatorio-pendente-fornecedor -- --fornecedor=tintão
npm run compras:relatorio-pendente-fornecedor -- --desde=2026-07-20 --pdf
npm run compras:relatorio-pendente-fornecedor -- --incluir-aguardando-embarque
```

Com `--fornecedor=tint…` a saída vai para **`docs/exports/Tintao/`** (PDF/HTML/JSON). Outros fornecedores: `docs/imports-local/pendente-embarque-fornecedor/`.

Referência visual: `scripts/tintao-orfaos-pdf-export.mjs` e PDFs órfãos Tintão (set/2026).

## Dados

- **Supabase Postgres** — `DATABASE_URL` (Cursor Cloud / GitHub Actions). Ver `docs/migration/P38_SECRETS_CANONICOS.md`.
- Script: `scripts/gerar-relatorio-pendente-embarque-fornecedor.mjs` (sem Base44).
- Linhas de embarque: `embarque_item` + espelho `rebuildEmbarqueItensMirror` (mesma leitura que a app).

## Teste

```bash
npm run compras:relatorio-pendente-fornecedor:test
```

Código: `src/lib/relatorioPendenteEmbarqueFornecedor.js`
