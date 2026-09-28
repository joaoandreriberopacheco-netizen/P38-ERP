# Relatório pendente por embarque (fornecedor)

Visão para partilhar com o fornecedor: **por cada embarque**, o que ainda está pendente em pedidos de compra **com emissão a partir de 20/07/2026**, com **% do valor (e da quantidade base) em relação ao pedido inteiro**.

Usa a mesma regra da UI (**Consulta / Saldo a embarcar**): `materializePedidosCompraView` + `buildConsultaItensEmbarque` (modo `pendente`).

## Gerar

```bash
npm run compras:relatorio-pendente-fornecedor
npm run compras:relatorio-pendente-fornecedor -- --fornecedor=tintão
npm run compras:relatorio-pendente-fornecedor -- --desde=2026-07-20
```

Saída em `docs/imports-local/pendente-embarque-fornecedor/` (`.html` + `.json`).

## Credenciais

- **Postgres** (`DATABASE_URL`) — preferido no Cloud Agent  
- ou **Base44** (`VITE_BASE44_APP_ID` + `BASE44_ACCESS_TOKEN`)

## Teste local (sem BD)

```bash
npm run compras:relatorio-pendente-fornecedor:test
```

## Motivos no relatório

| Rótulo | Significado |
|--------|-------------|
| Saldo não recebido (avaria / divergência) | Embarcado − recebido neste split, com recepção já iniciada ou status de divergência |
| Reposição pós-recepção (Necessidade) | Card / split Necessidade |
| Aguardando embarque / despacho | Pedido aprovado ainda sem despacho completo |

Código: `src/lib/relatorioPendenteEmbarqueFornecedor.js`, script `scripts/gerar-relatorio-pendente-embarque-fornecedor.mjs`.
