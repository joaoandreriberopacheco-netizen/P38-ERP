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

## Pedidos antigos — como ficam

| Situação | O que o app faz |
|----------|------------------|
| **Só JSON** (nunca teve `pedido_compra_item`) | Ao **abrir** o pedido, `ensurePedidoCompraItensCanonico` tenta **criar** linhas SQL a partir do JSON (uma vez). Listagens e relatórios passam a hidratar do SQL depois do backfill. |
| **JSON e SQL** | **SQL manda.** O JSON do cabeçalho deixa de ser lido para itens quando existem linhas SQL. |
| **JSON e SQL diferentes** (ex.: acordo antigo só no JSON) | A tela mostrava o SQL “velho”. Reparo por pedido abaixo ou lote. |
| **Salvar pedido no formulário** | Continua a usar `savePedidoCompraItem` — grava SQL e recalcula totais no cabeçalho (sem depender de editar `itens` no JSON). |

Não é obrigatório migrar tudo num dia: pedidos **só lidos** com JSON puro ainda funcionam até alguém abrir/salvar ou correr o backfill.

### Backfill em lote (só quem não tem SQL)

Pedidos com itens no JSON mas **zero** linhas em `pedido_compra_item`:

```bash
npx vite-node scripts/backfill-pedido-compra-item-legado-lote.mjs
npx vite-node scripts/backfill-pedido-compra-item-legado-lote.mjs --apply
npx vite-node scripts/backfill-pedido-compra-item-legado-lote.mjs --limit=200 --apply
```

### Reparo JSON ≠ SQL (um pedido)

Quando o cabeçalho já foi atualizado (ex.: acordo) mas o SQL ficou para trás:

```bash
npx vite-node scripts/sincronizar-pedido-compra-item-de-json.mjs --numero=R64-JEC --apply
```
