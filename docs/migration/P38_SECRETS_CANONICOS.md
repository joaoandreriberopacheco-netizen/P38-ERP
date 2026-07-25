# P38 — Secrets canónicos (checklist pré-decolagem)

João, este documento é o **mapa único** das chaves de ligação. Depois de configurado, o sistema deve funcionar como **avião comercial**: decola uma vez, só pousa — sem “pane” por secret errado ou projecto Supabase diferente.

## Modo de trabalho: só Cursor Cloud

**Não precisas de `.env.local` na tua máquina.** Trabalhas no **Cursor Cloud Agent**.

### Opção A — ficheiro mestre (recomendado para ti)

Cola **todas** as chaves num só ficheiro; o código distribui automaticamente:

```bash
npm run secrets:init          # cria secrets/p38-chaves.txt
# edita secrets/p38-chaves.txt — cola os valores
npm run secrets:check -- --context=cloud-agent
```

Ver [`secrets/README.md`](../../secrets/README.md). O ficheiro **não vai para o Git** e **sobrepõe** secrets antigos do painel Cursor.

### Opção B — painel Cursor (alternativa)

1. Abre o **Cursor** → **Dashboard** → **Cloud Agents**
2. Entra no ambiente **`varejosync`** (repositório P38)
3. Secção **Secrets** — adiciona cada variável com o **nome exacto** da tabela abaixo
4. **Grava** e abre uma **nova sessão** Cloud Agent

URL do ambiente (referência):  
https://cursor.com/dashboard/cloud-agents/environments/e/334db7fa-cbaa-49eb-9dd0-1c1b7a206ced

### Secrets obrigatórios no Cloud Agent

| Secret | Valor (exemplo / onde obter) |
|--------|------------------------------|
| `VITE_SUPABASE_URL` | `https://zhonvxkkqabfdyehyxpu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → **anon public** |
| `DATABASE_URL` | Supabase → Database → connection string (pooler `:6543`) |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens (`sbp_…`) |

Opcionais mas úteis no Cloud:

| Secret | Para quê |
|--------|----------|
| `VITE_BASE44_APP_ID` + `BASE44_ACCESS_TOKEN` | Auditoria Base44, flares, scripts legado |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts admin (nunca no frontend) |

### Validar no Cloud (pede ao agente ou corre na sessão)

```bash
npm run secrets:check -- --context=cloud-agent
```

Se aparecer **✓ Pronto**, o ambiente Cloud está configurado. Se falhar, corrige os secrets no painel — **não** copies para ficheiros no repo.

### O que NÃO fazer no Cloud

- **Não** uses o secret `supabase` (minúsculas) — é ambíguo; usa `DATABASE_URL` e `SUPABASE_ACCESS_TOKEN` separados
- **Não** coles tokens no chat com o agente
- **Não** cries `.env.local` no repositório — o Cloud Agent lê os Secrets do painel

---

## Regra de ouro (três sítios)

| Onde | O quê | Quem configura |
|------|--------|----------------|
| **Cursor Cloud Agent → Secrets** | O agente corre scripts, migrações, auditoria | **Tu (João)** — trabalho diário |
| **GitHub Actions → Secrets** | Deploy automático (push na `main`) | Tu — uma vez, espelha o Cloud |
| **Vercel → env produção** | O que o site em produção precisa | Automático via GitHub Actions |

Antes de qualquer deploy: `npm run secrets:check`

---

## Tabela canónica

| Nome canónico | Para quê | Onde colocar | Pode ir no frontend? |
|---------------|----------|--------------|----------------------|
| `VITE_SUPABASE_URL` | URL do projecto Supabase | **Cloud Agent**, GitHub, Vercel | Sim (público) |
| `VITE_SUPABASE_ANON_KEY` | Chave anon (leitura com RLS) | **Cloud Agent**, GitHub, Vercel | Sim (pública por desenho) |
| `VITE_P38_PROVIDER` | `supabase` em produção | Vercel | Sim |
| `VITE_P38_BYPASS_BASE44` | `true` em produção | Vercel | Sim |
| `VITE_P38_USE_SUPABASE_AUTH` | `true` — login interno P38 | Vercel | Sim |
| `DATABASE_URL` | Migrações SQL (`npm run db:apply-migrations`) | GitHub Actions, Cloud Agent | **Nunca** |
| `SUPABASE_ACCESS_TOKEN` | PAT — deploy Edge Functions | GitHub Actions, Cloud Agent | **Nunca** |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts admin / futuro proxy estável | GitHub (opcional), Vercel serverless | **Nunca** |
| `P38_AUTH_URL` | URL da função `p38-auth` (proxy Vercel) | Vercel (opcional — deriva da URL) | **Nunca** |
| `VERCEL_TOKEN` | Deploy Vercel | GitHub Actions | **Nunca** |
| `VERCEL_ORG_ID` | ID da conta Vercel | GitHub Actions | **Nunca** |
| `VERCEL_PROJECT_ID` | ID do projecto `p-38erp` | GitHub Actions | **Nunca** |

**Project ref P38 actual:** `zhonvxkkqabfdyehyxpu`  
(URL: `https://zhonvxkkqabfdyehyxpu.supabase.co`)

---

## Onde obter cada valor (Supabase Dashboard)

1. **Project URL + anon key**  
   Supabase → Project Settings → **API**  
   - Project URL → `VITE_SUPABASE_URL`  
   - `anon` `public` → `VITE_SUPABASE_ANON_KEY`

2. **Connection string (Postgres)**  
   Supabase → Project Settings → **Database** → Connection string → **URI** (pooler recomendado)  
   → `DATABASE_URL`

3. **Personal Access Token (deploy functions)**  
   https://supabase.com/dashboard/account/tokens  
   → `SUPABASE_ACCESS_TOKEN` (começa por `sbp_`)

4. **Service role** (só scripts / serverless — não no bundle React)  
   Supabase → API → `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

---

## DATABASE_URL — o problema mais comum (e por que “no chat funciona”)

A connection string do Supabase **pooler** tem o project ref no **utilizador**, não no hostname:

```
postgresql://postgres.zhonvxkkqabfdyehyxpu:SENHA@aws-0-....pooler.supabase.com:6543/postgres
              ^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^
              fixo     ESTE é o project ref P38
```

### Sintoma que já aconteceu contigo

- O `secrets:check` diz “password authentication failed”
- Tu copias a URL no chat → **funciona**
- Parece que a senha está certa, mas o Cloud “não vê”

### Causa real (diagnosticada)

O secret **guardado no Cursor Cloud** muitas vezes é de **outro projecto Supabase** (ref diferente no utilizador `postgres.XXXX`). Quando colas no chat, colas a URL **correcta do P38** — por isso funciona na hora, mas o secret antigo continua errado na próxima sessão.

**Project ref P38 canónico:** `zhonvxkkqabfdyehyxpu`  
Se o utilizador na URL for `postgres.OUTRO_REF`, está no projecto errado.

### Como corrigir (uma vez)

1. Supabase → projecto **P38** (`zhonvxkkqabfdyehyxpu`) → Database → Connection string → **URI** (pooler, porta 6543)
2. Cursor → Cloud Agents → `varejosync` → Secrets:
   - **Apagar** `DATABASE_URL` e o legado `supabase`
   - **Criar** só `DATABASE_URL` com a URI nova (sem aspas, sem espaços)
3. Abrir **nova sessão** Cloud Agent
4. `npm run secrets:check -- --context=cloud-agent` — deve mostrar `projecto: zhonvxkkqabfdyehyxpu` e ligação OK

**Nunca colar a connection string no chat** — só gravar no painel Secrets.

---

## Aliases legados (evitar)

O script `npm run secrets:check` aceita estes nomes antigos mas **avisa**:

| Alias (não usar) | Use em vez disso |
|------------------|------------------|
| `SUPABASE_TOKEN` | `SUPABASE_ACCESS_TOKEN` |
| `SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_URL` | `VITE_SUPABASE_URL` |
| `supabase` (minúsculas, Cloud) | `SUPABASE_ACCESS_TOKEN` **ou** `DATABASE_URL` — **nunca os dois no mesmo secret** |

---

## Checklist por cenário

### Cursor Cloud Agent (o teu dia-a-dia)

```bash
npm run secrets:check -- --context=cloud-agent
```

Precisa de: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`.

Configuração: **Cursor Dashboard → Cloud Agents → varejosync → Secrets** (não `.env.local`).

### Deploy produção (GitHub → Vercel + Supabase)

```bash
npm run secrets:check -- --context=github
```

Precisa de: `VERCEL_*`, `VITE_SUPABASE_*`, `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`.  
Os mesmos valores do Cloud Agent devem estar em **GitHub → Settings → Secrets → Actions**.

### Desenvolvimento local (opcional — outros devs)

```bash
npm run secrets:check -- --context=local
```

Só relevante se alguém correr o repo no PC. **Tu não precisas disto** no fluxo Cloud.

---

## Fluxo visual

```mermaid
flowchart LR
  subgraph cloud [Cursor Cloud Agent]
    CS[Secrets no painel Cursor]
    AG[Agente corre scripts]
  end

  subgraph github [GitHub Secrets]
    DB[DATABASE_URL]
    PAT[SUPABASE_ACCESS_TOKEN]
    VITE[VITE_SUPABASE_URL + ANON_KEY]
    VERCEL[VERCEL_TOKEN + IDs]
  end

  subgraph ci [GitHub Actions]
    MIG[db:apply-migrations]
    FUN[supabase:deploy:functions]
    VDEP[vercel deploy]
  end

  subgraph vercel [Vercel produção]
    APP[Bundle React]
    PROXY[api/auth-p38.js]
  end

  subgraph supa [Supabase P38]
    PG[(Postgres)]
    EF[p38-auth Edge Function]
  end

  DB --> MIG --> PG
  PAT --> FUN --> EF
  VITE --> VDEP --> APP
  VERCEL --> VDEP
  VDEP --> PROXY
  PROXY --> EF
  APP --> PG
  CS --> AG
  AG --> MIG
  AG --> FUN
```

---

## Comandos úteis

| Comando | Função |
|---------|--------|
| `npm run secrets:check` | Validação completa |
| `npm run supabase:align:check` | Confirma DATABASE_URL = mesmo projecto que VITE_SUPABASE_URL |
| `npm run supabase:deploy:check` | Diagnóstico deploy Supabase |
| `npm run build` | Bundle OK com credenciais |

---

## Segurança

- Se um token foi partilhado no chat ou commitado: **revogar** no Supabase/Vercel e criar novo.
- `SUPABASE_SERVICE_ROLE_KEY` ignora RLS — só em serverless/scripts, nunca `VITE_*`.
- O `.env.example` é só **referência de nomes** — no Cloud, preenches os Secrets no painel Cursor.

## Documentos relacionados

- [SUPABASE_DEPLOY_TRIGGER.md](./SUPABASE_DEPLOY_TRIGGER.md) — deploy migrações + functions
- [VERCEL_DEPLOY_GITHUB.md](./VERCEL_DEPLOY_GITHUB.md) — pipeline Vercel
- [SUPABASE_LOGIN_INTERNO.md](./SUPABASE_LOGIN_INTERNO.md) — auth utilizador + senha
