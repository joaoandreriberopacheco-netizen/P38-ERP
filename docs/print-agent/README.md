# P38 Print Agent — impressão térmica na loja

Programa **no PC do caixa** (Amazonas) que liga o sistema na nuvem à impressora térmica na rede local.

## Por que existe

A nuvem **não alcança** IP `192.168.x.x` da impressora. O agente corre **no PC da loja** e imprime localmente (porta 9100, ESC/POS).

Com fila remota, alguém em **São Paulo** (ou noutro sítio) pode aprovar pagamento e o cupom **sai na loja** quando o PC do caixa estiver online com o agente a correr.

## Instalação (PC Windows da loja)

### 1. Node.js 22

Instalar [Node.js LTS](https://nodejs.org/) no PC do caixa.

### 2. Clonar / copiar o repositório ou só a pasta `packages/p38-print-agent`

Na raiz do projeto P38-ERP:

```bash
npm ci
npm run print-agent:setup
```

Anote o **token** que aparece no ecrã.

### 3. Configurar variáveis (opcional — ou editar `~/.p38-print-agent/config.json`)

```bash
set P38_SUPABASE_URL=https://SEU_PROJETO.supabase.co
set P38_SUPABASE_ANON_KEY=eyJ...
set P38_PRINTER_HOST=192.168.1.100
set P38_PRINTER_PORT=9100
```

### 4. Ligar agente no sistema (browser, uma vez)

1. Abra o comprovante de uma venda
2. Informe o **IP da impressora**
3. Cole o **token** do passo 2
4. Clique **Ligar agente**

### 5. Iniciar o agente (sempre que a loja abrir)

```bash
npm run print-agent:start
```

Ou no Windows: duplo clique em `packages/p38-print-agent/iniciar-agente.bat`

Deve aparecer: `[p38-print-agent] http://127.0.0.1:3920/health`

## Como imprimir

| Situação | O que acontece |
|---|---|
| PC do caixa + agente a correr | Botão **Térmica** → impressão **imediata** |
| Longe da loja, agente online na loja | **Térmica** → fila remota → cupom sai na loja |
| Sem agente | Use **Imprimir** (browser) no formato **80mm** |

## Endpoints locais

| Método | URL | Uso |
|---|---|---|
| GET | `http://127.0.0.1:3920/health` | O sistema verifica se o agente está activo |
| POST | `http://127.0.0.1:3920/print/cupom` | Impressão local (JWT do utilizador) |

## Supabase (deploy)

Após merge na `main`, correr migração + Edge Function:

- Migração `074_agente_impressao_fila.sql` (tabelas `agente_impressao`, `fila_impressao_termica`)
- Edge Function `print-agent` (registo, fila, poll)

O workflow **Supabase Deploy** dispara automaticamente em push para `main` quando `supabase/**` muda.

## Resolução de problemas

| Problema | Verificar |
|---|---|
| "Sem agente no PC" | Agente não está a correr — `npm run print-agent:start` |
| "Falha ao conectar impressora" | IP errado, impressora desligada, firewall porta 9100 |
| Remoto não imprime | PC da loja offline ou token/agente_id incorrectos |
| Browser bloqueia localhost | Chrome recente: agente responde com CORS + `Access-Control-Allow-Private-Network` |

## Ficheiros principais

- `packages/p38-print-agent/` — agente Node.js
- `supabase/functions/print-agent/` — API fila remota
- `src/lib/p38PrintAgent.js` — integração no comprovante
