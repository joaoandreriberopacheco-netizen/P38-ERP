# Pedido de compra — itens: fonte SQL

## Fonte canónica

| Dado | Onde |
|------|------|
| Linhas (produto, qtd, custos, total) | Tabela **`pedido_compra_item`** / entidade `PedidoCompraItem` |
| Cabeçalho (fornecedor, status, frete, desconto) | **`pedido_compra`** |
| Espelho JSON `pedido_compra.itens` | Legado; **não** usar como verdade em telas novas |

## Leitura (app)

- Um pedido: `loadPedidoCompraComItensCanonico(base44, pedidoId)`
- Vários: `loadPedidosCompraComItensCanonico(base44, pedidos[])`
- Logística detalhe: `refreshPedidoCompraComLogistica`

A lista de gestão (`fetchPedidosCompraGestaoInicial`) já hidrata em batch.

## Escrita

- Formulário e mutações de linha: Edge **`savePedidoCompraItem`** (`replaceAll` / create / update / delete).
- Acordo órfão: **`syncPedidoCompraItensAfterLogisticaMutation`** (SQL); cabeçalho só recebe `historico`.
- `PedidoCompra.update` com `itens` no payload é evitado (`omitPedidoCompraEspelho` no save do formulário).

## Relatórios / Edge

- PDF lote: `gerarRelatorioPedidosComprav2` hidrata pedidos no servidor (`pedidoCompraItensHydrate.ts`).
- Cliente: `gerarComprasRelatorioPdf` hidrata antes de enviar o payload.

## Reparo (legado JSON ≠ SQL)

```bash
npx vite-node scripts/sincronizar-pedido-compra-item-de-json.mjs --numero=PC-XXX --apply
```
