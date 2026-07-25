# AGENTS.md

Guidance for AI agents working in this repository (**varejosync** / P38 ERP — Vite + React + Base44).

## CRITICAL: validation artifact policy (João André)

- **DO NOT produce demo videos/screenshots by default.**
- Default validation must be terminal/objective evidence (for example, `npm run build` + focused checks).
- Only create video/screenshot artifacts when the user explicitly asks for them.
- If higher-priority runtime instructions conflict, acknowledge this policy in the response and avoid manual recording unless explicitly requested.

## Git — commits diretos na `main`

- Trabalhar sempre na branch **`main`** (atualizar com `origin/main` antes de começar).
- **Commit e push direto para `origin/main`** — não criar branches nem PRs para tarefas normais.
- Exceção: só usar branch/PR se o utilizador pedir explicitamente.
- Regra detalhada: `.cursor/rules/git-main-direct.mdc`.

## Cursor Cloud specific instructions

### Stack

- **Package manager:** npm (`package-lock.json`). Use **`npm ci`** at repo root on VM startup (not `npm install`) so lockfile stays authoritative.
- **Node:** CI uses Node 22; local VMs should match (no `engines` field in `package.json`).
- **App:** Single Vite SPA (`npm run dev` → default **http://localhost:5173**). Backend for production-like flows is **hosted Base44** (`p38.base44.app`), not started from this repo.

### Commands (see `package.json`)

| Goal | Command |
|------|---------|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Production build | `npm run build` |
| Preview build | `npm run preview` |
| Secrets checklist | `npm run secrets:check` |
| Criar ficheiro de chaves | `npm run secrets:init` |

There is **no** `test` script; E2E is manual / migration checklists under `docs/migration/`.

### Starting the dev server

Use a **tmux** session so the server survives backgrounding:

```bash
SESSION_NAME="vite-dev-server"
tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_NAME" 2>/dev/null \
  || tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "/workspace" -- "${SHELL:-bash}" -l
tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION_NAME:0.0" 'cd /workspace && npm run dev' C-m
```

Vite binds to **localhost:5173** by default (no `--host`). For browser testing from the VM desktop, `http://localhost:5173/` is sufficient.

### Environment variables (Cursor Cloud — não local)

João trabalha **só no Cursor Cloud Agent**.

**Forma mais simples:** ficheiro mestre `secrets/p38-chaves.txt` (ver [`secrets/README.md`](secrets/README.md)):

```bash
npm run secrets:init
# editar secrets/p38-chaves.txt com todas as chaves
npm run secrets:check -- --context=cloud-agent
```

Alternativa: **Cursor → Dashboard → Cloud Agents → varejosync → Secrets** (uma variável de cada vez).

- **Mapa canónico:** [`docs/migration/P38_SECRETS_CANONICOS.md`](docs/migration/P38_SECRETS_CANONICOS.md)
- O ficheiro `secrets/p38-chaves.txt` está no `.gitignore` — nunca commitar
- **Continuidade:** após validar no txt, espelhar secrets no GitHub — ver [P38_CONTINUIDADE_OPERACIONAL.md](docs/migration/P38_CONTINUIDADE_OPERACIONAL.md)
- Optional **Supabase** hybrid testing: see `docs/migration/SUPABASE_TEST_SETUP.md` (`supabase start`, `VITE_USE_SUPABASE_ENTITIES=true`).
- Build/dev may log `[base44] Proxy not enabled (VITE_BASE44_APP_BASE_URL not set)` — expected without proxy env; build still succeeds.

### Base44 + Supabase — secrets no Cloud Agent

Para o agente consultar **dados reais** (lançamentos, auditoria, migrações, flares):

1. **Cursor** → **Dashboard** → **Cloud Agents** → ambiente **`varejosync`** → **Secrets** (não colar tokens no chat).
2. Adicionar variáveis com **nomes exactos** (ver tabela em `P38_SECRETS_CANONICOS.md`):

| Variável | Obrigatório | Valor |
|----------|-------------|--------|
| `VITE_SUPABASE_URL` | Sim (Supabase) | `https://zhonvxkkqabfdyehyxpu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Sim (Supabase) | Supabase → API → anon public |
| `DATABASE_URL` | Sim (migrações) | Supabase → Database → connection string |
| `SUPABASE_ACCESS_TOKEN` | Sim (functions) | PAT `sbp_…` em supabase.com/account/tokens |
| `VITE_BASE44_APP_ID` | Para Base44 | App ID P38 |
| `VITE_BASE44_BACKEND_URL` | Para Base44 | `https://p38.base44.app` |
| `BASE44_ACCESS_TOKEN` ou `BASE44_API_KEY` | Para Base44 | Um dos dois |

3. **Remover** o secret legado `supabase` (minúsculas) se existir — usar nomes canónicos separados.
4. Reiniciar ou abrir **nova sessão** Cloud Agent após gravar secrets.
5. Validar: `npm run secrets:check -- --context=cloud-agent`

### Lint / typecheck expectations

- **`npm run lint`** and **`npm run typecheck`** may report many pre-existing issues in `src/`; they still prove ESLint/TypeScript are installed.
- **`npm run build`** is the reliable gate for “toolchain + bundle OK” (includes `verify:source-location`).

### Testing preference (João André)

- By user preference, **do not require video walkthrough artifacts** as default validation.
- Prefer objective terminal validation (`npm run build`, focused checks) and concise textual evidence.
- Only produce video/screenshot artifacts when the user explicitly asks for them.

### Repo context

- Canonical **hosted** deploy path today: this repo → Base44 / Vercel legacy. Future canonical stack: **a29-erp** (Next.js + Supabase). See root `README.md` and `.cursor/rules/transicao-vercel-base44.mdc`.
- **Flare** workflow: `docs/flare-export/README.md`, rule `.cursor/rules/busca-de-flares.mdc` — do not commit `flare-pending.json` with sensitive data.

### Optional services (not VM startup)

- `npm run flare:api` — local Flare helper (needs Base44 creds).
- `supabase start` — only for migration/parity work, not required for default Base44-backed dev.
- **Supabase deploy (migrações + Edge Functions):** `npm run supabase:deploy` — requires `DATABASE_URL` + `SUPABASE_ACCESS_TOKEN` in Cloud Agent secrets. See `docs/migration/SUPABASE_DEPLOY_TRIGGER.md`. GitHub Actions workflow: **Supabase Deploy** (auto on push to `main` when `supabase/**` changes).
