# P38 Print Agent — impressão térmica na loja

Programa **no PC do caixa** (Amazonas) que liga o sistema na nuvem à impressora térmica na rede local.

## Por que existe

A nuvem **não alcança** IP `192.168.x.x` da impressora. O agente corre **no PC da loja** e imprime localmente (porta 9100, ESC/POS).

Com fila remota, alguém em **São Paulo** (ou noutro sítio) pode aprovar pagamento e o cupom **sai na loja** quando o PC do caixa estiver online com o agente a correr.

## Download do agente (`.exe` para a loja)

**Link directo (GitHub Actions):**  
https://github.com/joaoandreriberopacheco-netizen/P38-ERP/actions/workflows/print-agent-windows.yml

1. Abra o link acima  
2. Clique no **último run** com ✓ verde (workflow *Print Agent Windows*)  
3. Role até **Artifacts** → descarregue **`p38-print-agent-windows`** (ficheiro `.zip`)  
4. Descompacte numa pasta no PC do caixa, por exemplo: `C:\P38-Agente\`

Conteúdo da pasta:

| Ficheiro | Função |
|---|---|
| `P38-Instalar-Agente.exe` | Instalação (uma vez) |
| `P38-Iniciar-Agente.exe` | Agente (ou arranque automático) |
| `LEIA-ME.txt` | Instruções rápidas |

> Se ainda não existir artefacto verde, o build automático pode estar a correr — volte ao link em alguns minutos ou peça ajuda para gerar o `.zip`.

---

**Opção recomendada: ficheiros `.exe`** (não precisa instalar Node.js)

1. Descarregar a pasta `release/` do artefacto **p38-print-agent-windows** (GitHub Actions → workflow *Print Agent Windows* → último run → Artifacts).
2. Copiar para o PC do caixa (ex.: `C:\P38-Agente\`).
3. **Primeira vez:** duplo clique em **`P38-Instalar-Agente.exe`**
   - Pede URL Supabase, chave anon, IP da impressora
   - Mostra o **TOKEN** — copiar
4. No browser (P38): Comprovante → IP → colar TOKEN → **Ligar agente**
5. **Todos os dias:** o agente pode **abrir sozinho** ao ligar o PC (o instalador pergunta — padrão **Sim**). A janela fica aberta; não fechar.

Ou manualmente: **`P38-Iniciar-Agente.exe`**

Para **gerar os .exe** a partir do código (desenvolvimento):

```bash
npm run print-agent:build-win
```

Saída: `packages/p38-print-agent/release/`

---

## Instalação (PC Windows da loja) — com Node.js

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

### 5. Agente ao ligar o PC (arranque automático)

No **`P38-Instalar-Agente.exe`**, a última pergunta é:

> *Iniciar agente automaticamente quando o Windows ligar? (S/n)*

- **Enter** ou **S** → o agente abre **sozinho** cada vez que o PC liga (pasta Iniciar do Windows).
- **n** → só arranca manualmente (atalho ou `P38-Iniciar-Agente.exe`).

### 6. Iniciar manualmente (se precisar)

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
