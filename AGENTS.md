# AGENTS.md

Guidance for AI agents working in this repository (**P38-ERP** — Vite/React UI + Supabase, produção Next.js).

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

### Canal de performance (trabalho paralelo — não mergear sem aprovação)

Otimizações de cache/performance vão na branch `cursor/canal-performance-anotacoes-2ef5` (PR [#614](https://github.com/joaoandreriberopacheco-netizen/P38-ERP/pull/614)). **Trabalho normal:** só `main`. **Sync:** cada push na `main` atualiza o canal via workflow `sync-main-to-canal-performance`. Ver `docs/canal-performance-anotacoes.md` na branch do canal.

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
| Auditar acessos (recomendado) | `npm run secrets:audit` |

### Pulso (testador automático — não confundir com Flare)

Doc completa: [`docs/pulse/README.md`](docs/pulse/README.md).

Três níveis (metáfora comboio):

| Nível | Comando | O que verifica |
|-------|---------|----------------|
| Comboio | `npm run pulse:corridor` | 36 sensores numa passagem (`/pulse/corredor`) |
| Trem | `npm run pulse:sensors` | Abre cada ecrã real (Playwright) |
| Shipping | `npm run pulse:shipping` | Dry run de processos (clicar/digitar sem gravar) |

| Goal | Command |
|------|---------|
| Regenerar roteiro (manifestos) | `npm run pulse:refresh-roteiro` |
| Pré-deploy CI | `npm run pulse:predeploy:ci` (comboio ~20s; build já feito no passo anterior) |
| Gerar sensores/shipping JSON | `npm run pulse:generate-sensors` |

**Refresh do roteiro no trem/shipping — comentado por defeito.** Em `scripts/pulse-sensors.mjs` e `scripts/pulse-shipping.mjs`, o bloco `refreshPulseRoteiro()` fica comentado no meio do script para corridas mais rápidas. Não descomentar salvo job periódico ou pedido explícito.

Para corrida periódica (cron / GitHub Actions scheduled), usar **uma** destas opções:

```bash
# Opção A — duas linhas no pipeline (recomendado; não mexe no código)
npm run pulse:refresh-roteiro && npm run pulse:sensors
npm run pulse:refresh-roteiro && npm run pulse:shipping

# Opção B — descomentar import + refreshPulseRoteiro() nos dois scripts
```

O CI em push corre `pulse:predeploy:ci` (comboio) + `pulse:shipping:critico`. O `pulse:predeploy` completo (refresh + 41 rotas + comboio) fica para validação manual ou `pulse:diario`. Sensores UI usam `data-pulse-sensor` no JSX; mapa de controlos em `scripts/generate-pulse-sensors-geral.mjs` (`CONTROLS`, `SHIPPING_OVERRIDES`).

**Debugger diário (trem + shipping):** workflow `.github/workflows/pulse-diario.yml` — 05:00 Tabatinga, `npm run pulse:diario`. Notifica João André via **WhatsApp** (CallMeBot: `PULSE_NOTIFY_WHATSAPP_PHONE` + `PULSE_NOTIFY_CALLMEBOT_APIKEY`), issue GitHub ou Telegram. Auto-reparo: só refresh de manifestos + retry.

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

### Environment variables (Cursor Cloud)

**Guia passo a passo:** [`docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md`](docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md)

Gravar secrets em **GitHub Actions** (produção) e **Cursor Cloud** (agente) — mesmos nomes, mesmos valores.

**Auditar:** `npm run secrets:audit`

- **Referência:** [`docs/migration/P38_SECRETS_CANONICOS.md`](docs/migration/P38_SECRETS_CANONICOS.md)
- **Continuidade:** [`docs/migration/P38_CONTINUIDADE_OPERACIONAL.md`](docs/migration/P38_CONTINUIDADE_OPERACIONAL.md)
- Optional **Supabase** hybrid testing: see `docs/migration/SUPABASE_TEST_SETUP.md` (`supabase start`, `VITE_USE_SUPABASE_ENTITIES=true`).
- Build/dev may log `[base44] Proxy not enabled (VITE_BASE44_APP_BASE_URL not set)` — expected without proxy env; build still succeeds.

### Base44 + Supabase — secrets no Cloud Agent

Ver guia passo a passo. Mínimo Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`.

Opcional Base44 (auditoria/flares): `VITE_BASE44_APP_ID`, `VITE_BASE44_BACKEND_URL`, `BASE44_ACCESS_TOKEN` ou `BASE44_API_KEY`.

Após gravar secrets no Cursor: **nova sessão** → `npm run secrets:audit`

### Lint / typecheck expectations

- **`npm run lint`** and **`npm run typecheck`** may report many pre-existing issues in `src/`; they still prove ESLint/TypeScript are installed.
- **`npm run build`** is the reliable gate for “toolchain + bundle OK” (includes `verify:source-location`).

### Testing preference (João André)

- By user preference, **do not require video walkthrough artifacts** as default validation.
- Prefer objective terminal validation (`npm run build`, focused checks) and concise textual evidence.
- Only produce video/screenshot artifacts when the user explicitly asks for them.

### Repo context

- Canonical **hosted** deploy path today: this repo → Base44 / Vercel legacy. Future canonical stack: **a29-erp** (Next.js + Supabase). See root `README.md` and `.cursor/rules/transicao-vercel-base44.mdc`.
- **Mobile visual north star (finance/ops):** Planejamento financeiro dark — palette/feeling approved by João André; see `.cursor/rules/p38-mobile-referencia-planejamento.mdc` and `docs/p38-mobile-rollout.md` §0.
- **Flare** workflow: `docs/flare-export/README.md`, rule `.cursor/rules/busca-de-flares.mdc` — do not commit `flare-pending.json` with sensitive data.

### Optional services (not VM startup)

- `npm run flare:api` — local Flare helper (needs Base44 creds).
- `supabase start` — only for migration/parity work, not required for default Base44-backed dev.
- **Supabase deploy (migrações + Edge Functions):** `npm run supabase:deploy` — requires `DATABASE_URL` + `SUPABASE_ACCESS_TOKEN` in Cloud Agent secrets. See `docs/migration/SUPABASE_DEPLOY_TRIGGER.md`. GitHub Actions workflow: **Supabase Deploy** (auto on push to `main` when `supabase/**` changes).
