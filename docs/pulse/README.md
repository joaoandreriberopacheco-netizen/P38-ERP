# Pulso — testador de cabo código → interface

> Metáfora: como o testador RJ45, o **Pulso** envia um sinal automático pelo caminho completo (código → build → rota → ecrã). Cada **LED** acende ou falha. **Verde** no fim = página passou no teste.

**Não confundir com Flare** — o Pulso é varredura automática (CI/deploy), não fila manual de bugs.

## Comandos

| Comando | Modo | LEDs testados |
|---------|------|---------------|
| `npm run pulse` | Rápido (default) | 1–4 |
| `npm run pulse:slow` | Lento | 1–8 |
| `npm run pulse -- --route /Compras` | Uma rota | conforme modo |
| `npm run pulse -- --batch lote1` | Lote do manifesto | conforme modo |
| `npm run pulse:lote2` | Lote 2 (vendas, logística, relatórios) | LEDs 1–4 |
| `npm run pulse:all` | Lote 1 + lote 2 | LEDs 1–4 |

## Os 8 LEDs

| LED | Nome | O que verifica |
|-----|------|----------------|
| 1 | Compila | Output `.next` existe (build OK) |
| 2 | Imports | Ficheiro `src/pages/{page}.jsx` existe e exporta componente |
| 3 | Rota | `pageName` registado em `pageRegistry.generated.js` |
| 4 | Bundle | HTTP GET devolve status &lt; 500 e corpo não vazio |
| 5 | Dados | Variáveis Supabase configuradas; resposta não é erro de provider |
| 6 | Render | HTML sem padrões de crash (`Application error`, etc.) |
| 7 | Interação | Presença de elementos interativos básicos no HTML |
| 8 | Console | HTML sem erros embutidos / hydration failure |

**Modo rápido** para no LED 4. **Modo lento** continua até o LED 8.

## Lote 1 (rotas críticas)

Definido em [`routes-lote1.json`](./routes-lote1.json):

- Públicas: `/login`, `/auth/callback`, `/ativar-acesso`, `/landing.html`
- Core operacional: `/`, `/Compras`, `/PedidosCompra`, `/Estoque`, `/Financeiro`, `/PDV`, `/Configuracoes`, `/PlanejamentoFinanceiro`

## Lote 2 (módulos por área de negócio)

Definido em [`routes-lote2.json`](./routes-lote2.json) — **30 rotas**:

| Módulo | Rotas |
|--------|-------|
| **Vendas** (8) | `PDVVendedor`, `PDVCaixa`, `AutoAtendimento`, `TurnosFechados`, `VendasGestao`, `VendasPerdidas`, `ControleEntregas`, `DevolucaoTroca` |
| **Logística** (10) | `SugestoesCompra`, `Cotacoes`, `ConferenciaEntrada`, `ConferenciaEstoque`, `Armazenagem`, `InterfaceSeparador`, `ItinerarioFluvial`, `Expedicao`, `HubLogistico`, `ImportacaoProdutos` |
| **Financeiro** (6) | `FluxoCaixa`, `ContasFinanceiras`, `AprovacoesFinanceiras`, `CaixasAtivos`, `Agefin`, `ExtratoConta` |
| **Gestão** (6) | `Dashboard`, `PainelGerente`, `Produtos`, `Relatorios`, `RelatorioMargem`, `RelatorioPerformance` |

```bash
npm run pulse:lote2    # só lote 2
npm run pulse:all      # lote 1 + lote 2 (42 rotas)
```

## CI

O workflow `.github/workflows/ci.yml` corre `npm run pulse` após o build Next.

## Saída exemplo

```text
PULSE /Compras
  LED 1 Compila        ✅
  LED 2 Imports        ✅
  LED 3 Rota           ✅
  LED 4 Bundle         ✅
  VERDE                🟢

PULSE /PedidosCompra
  LED 1 Compila        ✅
  LED 2 Imports        ✅
  LED 3 Rota           ✅
  LED 4 Bundle         ❌  HTTP 500
  VERDE                ❌  parou no LED 4
```

## Variáveis de ambiente

| Variável | Default | Uso |
|----------|---------|-----|
| `PULSE_PORT` | `3099` | Porta do `next start` temporário |
| `SMOKE_PORT` | (alias) | Compatível com smoke:http |

Placeholder Supabase (CI): igual ao smoke HTTP existente.
