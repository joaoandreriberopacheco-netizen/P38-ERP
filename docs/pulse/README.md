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
