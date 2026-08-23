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
| `npm run pulse:shipping:tablet` | Shipping em emulação **tablet** (iPad touch, menu de baixo) |
| `npm run pulse:shipping:tablet:paisagem` | Tablet + **Modo Paisagem** gravado no `localStorage` |
| `npm run pulse:shipping -- --module vendas` | Só módulo vendas |
| `npm run pulse:shipping -- --id pedidos-compra` | Um processo |
| `npm run pulse:shipping -- --piloto` | 3 processos piloto (legado) |
| `npm run pulse:shipping:critico` | **Anti-submarino** — fluxos compostos ([`shipping-critico.json`](./shipping-critico.json)) |

Relatório: `docs/pulse/shipping-report.json`

### Camadas de defesa (porque um bug pode “passar de submarino”)

| Camada | O que vê | O que **não** vê |
|--------|----------|------------------|
| **Build** | Erros de compilação | `ReferenceError` só quando um ramo monta (ex.: pedido **salvo** + aba Logística) |
| **Pulso rotas + comboio** | Página abre, shell existe | Abas internas, formulários fullscreen, estado “depois de gravar” |
| **Shipping lista** | FAB novo pedido → voltar | Abas do detalhe com pedido já persistido |
| **Shipping crítico** | Fluxos compostos + fixture `pulse-fixture-pedido` | Tudo o que ainda não está no manifesto crítico |

**Regra:** quando um fluxo depende de **estado** (salvo, aprovado, com embarque), acrescentar sensor + passo em `shipping-critico.json` (ou `PULSE_SHIPPING_EXTRA` no gerador). O CI em cada push corre `pulse:predeploy` + `pulse:shipping:critico`.

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
- **O quê:** `npm run pulse:diario` — refresh → trem → shipping; se falhar, **auto-reparo seguro** (regenera roteiro e repete uma vez)
- **Notificação João André:** comentário numa issue GitHub (`pulse-diario`) e/ou **WhatsApp** (recomendado)
- **Telegram (opcional):** secrets `PULSE_NOTIFY_TELEGRAM_BOT_TOKEN` + `PULSE_NOTIFY_TELEGRAM_CHAT_ID`
- **Manual:** GitHub → Actions → **Pulso diário** → Run workflow

Mensagens possíveis:

| Estado | O que recebes |
|--------|----------------|
| ✅ Tudo OK | "Nada a rever hoje" |
| ⚙️ Corrigido | "Encontrámos X, regenerámos roteiro, agora verde — confirma" |
| ⚠️ Revisão | "Partiu em /FluxoCaixa (sensor X) — não corrigimos código sozinhos" |

**Auto-reparo hoje:** só manifestos desactualizados (refresh + retry). Crash de código ou botão removido → aviso para ti rever; não altera `src/` automaticamente.

Relatórios: artefacto `pulse-diario-reports` (7 dias).

### WhatsApp (CallMeBot — uso pessoal)

Configuração única (~2 min):

1. No telemóvel, adiciona o contacto **+34 684 71 39 62** (CallMeBot).
2. Envia no WhatsApp: `I allow callmebot to send me messages`
3. O bot responde com a tua **apikey** — copia.
4. GitHub → repo → **Settings → Secrets → Actions**, cria:
   - `PULSE_NOTIFY_WHATSAPP_PHONE` — teu número internacional **sem** `+` (ex. Brasil `5511999999999`)
   - `PULSE_NOTIFY_CALLMEBOT_APIKEY` — apikey que o bot enviou

Na manhã seguinte à 1.ª corrida agendada, recebes a mensagem do Pulso no WhatsApp.

Issue GitHub: inscreve-te na issue `pulse-diario` se quiseres email em paralelo.

**Teste de notificação:** Actions → Pulso diário → Run workflow → activar **「TESTE: quebrar Gestão de vendas de propósito」**. Não afecta produção (só o build desse job). Recebes WhatsApp/issue a pedir revisão de `/VendasGestao`.

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
