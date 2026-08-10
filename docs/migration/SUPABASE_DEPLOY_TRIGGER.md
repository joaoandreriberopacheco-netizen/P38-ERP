# Gatilho de deploy Supabase (migrações + Edge Functions)

Permite ao **Cloud Agent**, ao **GitHub Actions** ou a ti aplicar alterações no Supabase sem copiar SQL manualmente no Dashboard.

## O que faz

| Comando | Acção |
|---------|--------|
| `npm run db:apply-migrations` | Aplica só migrações **novas** (`020_*.sql`, etc.) |
| `npm run supabase:deploy:functions` | Deploy de todas as Edge Functions |
| `npm run supabase:deploy` | Migrações + Functions (deploy completo) |

O histórico fica na tabela `public._p38_schema_migrations` — cada ficheiro `NNN_*.sql` só corre **uma vez**.

## Secrets necessários

### Para o Cloud Agent (Cursor → Secrets do repositório)

| Secret | Obrigatório | Onde obter |
|--------|-------------|------------|
| `DATABASE_URL` | Sim (migrações) | Supabase → Project Settings → Database → **Connection string** (pooler `:6543`) |
| `SUPABASE_ACCESS_TOKEN` | Sim (functions) | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `VITE_SUPABASE_URL` | Recomendado | `https://[PROJECT_REF].supabase.co` |
| `SUPABASE_PROJECT_REF` | Opcional | Só se não tiveres `VITE_SUPABASE_URL` |

Também úteis para o app (já documentados noutros sítios):

- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (só servidor/scripts — nunca no frontend)

### Para GitHub Actions

Os mesmos secrets em **Settings → Secrets and variables → Actions**.

## Como disparar

### 1. Agente Cloud (automático)

Com os secrets configurados, pede ao agente:

> "Corre `npm run supabase:deploy`"

Ou só migrações / só functions:

```bash
npm run db:apply-migrations
npm run supabase:deploy:functions
```

### 2. GitHub Actions (manual)

1. **Actions** → **Supabase Deploy** → **Run workflow**
2. Opções: migrações ✅, functions ✅, dry-run ❌

### 3. GitHub Actions (automático no push)

Quando fizeres merge na `main` com alterações em:

- `supabase/migrations/**`
- `supabase/functions/**`

o workflow **Supabase Deploy** corre sozinho (se os secrets estiverem definidos).

### 4. Agente dispara o workflow via CLI

```bash
gh workflow run supabase-deploy.yml -f migrations=true -f functions=true
```

## Migrações já aplicadas à mão?

Se correste SQL no Dashboard antes deste sistema, regista no histórico para não repetir:

```sql
insert into public._p38_schema_migrations (filename) values
  ('001_p38_core_homologation.sql'),
  ('017_functions_estoque_sequenciais.sql')
  -- ... até à última que já aplicaste
on conflict do nothing;
```

## Edge Functions — secrets de runtime

O deploy publica o código; no **Supabase Dashboard → Edge Functions → Secrets** define também:

| Secret | Função |
|--------|--------|
| `GEMINI_API_KEY` ou `GOOGLE_API_KEY` | OCR/importador (`p38-core` → InvokeLLM via Gemini) |
| `GEMINI_MODEL` | Opcional — default `gemini-3.6-flash` (PDF/imagem) / `gemini-3.5-flash-lite` (texto) |
| `RESEND_API_KEY` | `gerenciar-pin` (email PIN) |
| `SUPABASE_SERVICE_ROLE_KEY` | Todas (já injectada pelo Supabase em runtime) |

**OCR / importar pedido:**

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → criar/copiar chave Gemini
2. Supabase → **Edge Functions** → **Secrets** → `GEMINI_API_KEY` = a chave
3. `npm run supabase:deploy:functions` (ou redeploy só `p38-core`)

## Verificação rápida

```bash
npm run supabase:deploy:check   # diagnóstico (não altera nada)
```

```bash
# Listar migrações pendentes (sem alterar)
DATABASE_URL="..." npm run db:apply-migrations -- --dry-run

# Deploy completo
DATABASE_URL="..." SUPABASE_ACCESS_TOKEN="..." npm run supabase:deploy
```

### Erros comuns

| Sintoma | Solução |
|---------|---------|
| `SUPABASE_ACCESS_TOKEN em falta` | Criar PAT em [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) e gravar em **Cursor Cloud Secrets** + **GitHub Actions** |
| `password authentication failed` | Copiar de novo a connection string em **Project Settings → Database** (a password pode ter sido resetada) |
| `GEMINI_API_KEY não configurado` / OCR falha após upload | Gravar `GEMINI_API_KEY` em **Edge Functions → Secrets** e redeploy `p38-core` |
| `503` / pico de demanda no Gemini | Aguardar 30–60s e repetir; `p38-core` já faz até 4 tentativas com backoff |
| `PROJECT_REF` em falta | Adicionar `VITE_SUPABASE_URL=https://[ref].supabase.co` nos secrets |

Após deploy, no SQL Editor:

```sql
select * from public._p38_schema_migrations order by filename;
```
