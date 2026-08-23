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
| **Logística** (9) | `SugestoesCompra`, `Cotacoes`, `ConferenciaEntrada`, `ConferenciaEstoque`, `Armazenagem`, `InterfaceSeparador`, `ItinerarioFluvial`, `Expedicao`, `ImportacaoProdutos` |
| **Financeiro** (6) | `FluxoCaixa`, `ContasFinanceiras`, `AprovacoesFinanceiras`, `CaixasAtivos`, `Agefin`, `ExtratoConta` |
| **Gestão** (6) | `Dashboard`, `PainelGerente`, `Produtos`, `Relatorios`, `RelatorioMargem`, `RelatorioPerformance` |

```bash
npm run pulse:lote2    # só lote 2
npm run pulse:all      # lote 1 + lote 2 (41 rotas)
```

## Corredor vertical (comboio)

Metáfora: em vez da bola a rolar na horizontal (abrir 36 páginas reais), o **comboio** passa **uma vez** na linha `/pulse/corredor`. Cada **estação** deixa a sua **saca de cartas** (marcadores `data-pulse-sensor`); o script recolhe tudo e gera relatório.

| Comando | O que faz |
|---------|-----------|
| `npm run pulse:corridor` | Comboio — 1 visita Playwright, recolhe 36 sacas |
| `npm run pulse:sensors` | Modo lento — visita cada página real (opcional) |
| `npm run pulse:predeploy` | Rotas (41) + corredor comboio |

Relatório: `docs/pulse/corridor-report.json` (gerado em cada corrida; não versionado).

## Shipping (dry run — operação requisitada)

Simula processos de negócio **sem gravar** (cancelar / voltar). Manifesto: [`shipping-geral.json`](./shipping-geral.json) (**36 processos**, gerado com `pulse:generate-sensors`).

| Comando | O que faz |
|---------|-----------|
| `npm run pulse:shipping` | **36 dry runs** (todos os ecrãs) |
| `npm run pulse:shipping -- --module vendas` | Só módulo vendas |
| `npm run pulse:shipping -- --id pedidos-compra` | Um processo |
| `npm run pulse:shipping -- --piloto` | 3 processos piloto (legado) |

Relatório: `docs/pulse/shipping-report.json`

## Sensores UI (pré-deploy)

Função automática — **não é uma página do P38**. Corre antes do deploy e verifica se o pulso chega a botões/ecrãs críticos.

| Manifesto | Âmbito |
|-----------|--------|
| [`sensors-lote1.json`](./sensors-lote1.json) | Piloto: PedidosCompra + PDV |
| [`sensors-geral.json`](./sensors-geral.json) | **Geral:** 36 ecrãs (lote 1 + lote 2), shell automático + 1 controlo por página |

```bash
npm run pulse:refresh-roteiro   # regenerar manifestos (sensores + corredor + shipping)
npm run pulse:generate-sensors   # alias legado — igual ao refresh
npm run pulse:sensors            # trem (36 ecrãs) — usa manifesto já gerado
npm run pulse:shipping           # shipping (36 dry runs) — usa manifesto já gerado
npm run pulse:corridor           # comboio (rápido)
npm run pulse:predeploy          # refresh + rotas (41) + corredor
```

**Refresh periódico (trem/shipping):** o refresh automático no meio dos scripts está **comentado** por defeito. Job agendado: workflow [`.github/workflows/pulse-diario.yml`](../../.github/workflows/pulse-diario.yml) (05:00 Tabatinga) ou `npm run pulse:diario`.

Cada elemento tem `data-pulse-sensor="id"` no código. O shell `.shell` é injetado automaticamente em `P38LazyPage`. O CI faz build com bypass auth local para abrir páginas autenticadas sem login real.

## CI

O workflow `.github/workflows/ci.yml` corre `npm run pulse:predeploy` (41 rotas + corredor comboio) em cada push.

### Debugger automático diário

Workflow `.github/workflows/pulse-diario.yml`:

- **Quando:** todos os dias às **05:00 Tabatinga** (10:00 UTC)
- **O quê:** `pulse:refresh-roteiro` → `pulse:sensors` (trem) → `pulse:shipping` (36 dry runs)
- **Manual:** GitHub → Actions → **Pulso diário** → Run workflow
- **Local:** `npm run pulse:diario` (mesma sequência, após `npm run build`)
- **Relatório:** artefacto `pulse-diario-reports` (7 dias); falha envia alerta Actions

Isto funciona como debugger overnight: se alguém mergeou algo que parte um ecrã ou fluxo, acordas com o GitHub vermelho em vez de um utilizador a descobrir no balcão.

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
