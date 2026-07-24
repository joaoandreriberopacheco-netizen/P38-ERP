# Migração Base44 → Supabase via GitHub

Este repositório suporta **duas abordagens**. Escolhe **uma** conforme onde queres correr a lógica e que segredos queres guardar.

**Critério de dados:** o script em massa é para **sincronizar entidades escolhidas**; nem tudo precisa de vir do Base44. Ver **[README.md](./README.md)** (secção *Política: peças vs carga* — peças vitais migrar de propósito; carga de produtos pode ser XLSX no Supabase). Usa `--only=Entidade1,Entidade2` para migrações parciais.

## Abordagem A — GitHub Actions + script Node (recomendada aqui)

O workflow lê entidades pelo SDK Base44 e grava em **PostgreSQL** (Supabase) com `pg`, usando o mapa `src/integrations/p38/entityTableMap.js`.

- **Workflow:** [.github/workflows/migrate-base44-supabase.yml](../../.github/workflows/migrate-base44-supabase.yml)
- **Script:** `scripts/migrate-base44-to-supabase.mjs`
- **Comando local:** `npm run migrate:base44-to-supabase` (opção `--dry-run`)

### Pré-requisitos

1. **Schema já criado no Supabase** — aplica as migrations do repositório (ex.: `supabase/migrations/`) antes de encher dados.
2. **Connection string Postgres** que o Node consiga usar (em redes só IPv4, costuma ser necessário o **Transaction pooler** do dashboard, não o host `db.*` só IPv6).

### Secrets no GitHub (Settings → Secrets and variables → Actions)

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `DATABASE_URL` | Sim | URI `postgresql://…` do Supabase (idealmente **pooler**; na password, `#` → `%23`) |
| `VITE_BASE44_APP_ID` | Sim | App ID usado no `createClient` |
| `BASE44_API_KEY` | Pelo menos um * | Header `api_key` (ex.: P38 / documentação REST) |
| `BASE44_ACCESS_TOKEN` | Pelo menos um * | JWT com leitura às entidades (alternativa ou complemento à API key) |
| `VITE_BASE44_BACKEND_URL` | Recomendado P38 | Ex.: `https://p38.base44.app` (sem `/api`) |

\* Um dos dois (ou ambos, se o backend aceitar).

Opcionais (ver comentários no workflow e no cabeçalho do script): `MIGRATE_DNS_SERVERS`, `MIGRATE_PG_HOST`, `MIGRATE_PG_SSL_INSECURE`, `MIGRATE_ONLY_ENTITIES`, `MIGRATE_ROWS_PER_COMMIT`.

### Como executar

1. **Actions** → **Migrate Base44 to Supabase** → **Run workflow**.
2. Primeiro **dry_run: true** (só contagens).
3. Depois **dry_run: false** para `UPSERT` em massa (o script usa `ON CONFLICT (id) DO UPDATE`; podes voltar a correr para sincronizar).

### Modo resync (sincronização repetida)

O mesmo comando / workflow **corre outra vez** quando quiseres: cada registo vindo do Base44 é **actualizado ou inserido** no Supabase pela chave `id`. Não precisas de “modo especial” — o script já é idempotente para inserts/updates.

| Comportamento | Detalhe |
|---------------|---------|
| **Incluído no resync** | Novos registos no Base44; alterações a campos em registos existentes (pelo que a API devolver na listagem). |
| **Não incluído** | Registos **apagados no Base44** continuam no Supabase (não há `DELETE`). Para espelho exacto seria preciso lógica extra (soft-delete ou comparar conjuntos de ids). |
| **JWT (`BASE44_ACCESS_TOKEN`)** | Expira; para corridas frequentes prefere **`BASE44_API_KEY`** nos secrets ou renova o token. |
| **Limite** | Por defeito até **10 000** linhas por entidade por corrida; entidades maiores exigem subir `--limit` ou várias passagens (ver script). |

**GitHub Actions**

- **Só manual:** Actions → **Migrate Base44 to Supabase** → **Run workflow** com `dry_run: false` para migrar ou resync. Uma corrida de cada vez (`concurrency`).

**Local**

```bash
npm run migrate:base44-to-supabase
```

### Utilizadores (entidade `User` + login Supabase)

A tabela `public.usuario` deve vir da entidade **`User`** do Base44 (email, nome, perfil de acesso). Registos só com metadados de plataforma (`_app_role`, `app_id`, sem email) são ignorados na migração.

| Comando | O que faz |
|---------|-----------|
| `npm run usuario:resync` | Apaga linhas erradas de plataforma, migra `Usuario` do Base44, preenche colunas `email`/`full_name` |
| `npm run usuario:provision-auth` | Cria convites em `auth.users` (ou actualiza metadata) a partir dos emails em `public.usuario` |

**GitHub Actions:** **Migrate Base44 to Supabase** → marcar **resync_usuarios: true** e **dry_run: false**. Requer `SUPABASE_SERVICE_ROLE_KEY` nos secrets para provisionar auth.

Secrets adicionais para auth: `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → API → service_role).

#### Login com Google (OAuth)

Ver guia completo: [`docs/migration/SUPABASE_GOOGLE_LOGIN.md`](SUPABASE_GOOGLE_LOGIN.md)

Resumo: activar Google em [Supabase → Providers → Google](https://supabase.com/dashboard/project/zhonvxkkqabfdyehyxpu/auth/providers?provider=Google) com Client ID/Secret do Google Cloud. Depois `VITE_P38_ENABLE_GOOGLE_LOGIN=true` nos secrets e redeploy.

### Notas

- Este fluxo **não** mete `SUPABASE_SERVICE_KEY` no GitHub: a escrita é **direta no Postgres**, não pela API REST do Supabase.
- O SDK em script Node pode usar `headers.api_key`; não é obrigatório usar apenas Backend Functions Base44 para leitura.

---

## Abordagem B — Backend Function Base44 (Deno)

Útil se quiseres **não** armazenar `DATABASE_URL` no GitHub e correr a migração **dentro** da infra Base44.

- Padrão: `createClientFromRequest` + `base44.asServiceRole.entities.*` para leitura; escrita no Supabase via cliente oficial com variáveis do dashboard Base44.
- Configura **SUPABASE_URL** e **SUPABASE_SERVICE_KEY** (ou equivalente) em **Dashboard → Code → Environment Variables** da app Base44, não só nos secrets do GitHub.

Podes combinar com um workflow que **só** chama HTTP a essa função (com auth), mas a lógica de cópia fica na função.

---

## Referências no código

- Mapa entidade → tabela: `src/integrations/p38/entityTableMap.js`
- Normalização de payload para colunas Supabase: `src/integrations/p38/supabaseEntityLayer.js` (`prepareWritePayload`)
