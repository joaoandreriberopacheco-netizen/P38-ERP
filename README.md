# P38 ERP

**ERP vertical para varejo e distribuição** — operação no telemóvel, pulso do negócio em qualquer lugar.

| | |
|--|--|
| **Repositório** | [github.com/joaoandreriberopacheco-netizen/P38-ERP](https://github.com/joaoandreriberopacheco-netizen/P38-ERP) |
| **Produção** | [p-38erp.vercel.app](https://p-38erp.vercel.app) |
| **Apresentação** | [/landing.html](https://p-38erp.vercel.app/landing.html) |
| **Stack** | Next.js 15 · Supabase (Postgres) · Vercel |

---

## O que é

Sistema integrado para quem **opera e manda** no mesmo negócio:

- **Vendas** — PDV, caixa, vendedor, auto-atendimento, turnos
- **Compras** — cotações, pedidos, sugestão de compra, conferência na entrada
- **Estoque** — armazenagem, auditoria, separação, metas de reabastecimento
- **Financeiro** — fluxo de caixa, aprovações, planejamento, margem
- **Logística** — entregas, expedição, itinerário fluvial
- **Gestão** — relatórios, painel gerente, IEP/ABC

Desenhado **mobile-first** para vendedor, conferente e dono que acumula várias funções.

---

## Arquitectura

```
Utilizador → Vercel (Next.js) → Supabase (dados + Edge Functions)
```

| Camada | Local |
|--------|--------|
| Frontend (produção) | `app/` — Next.js App Router |
| Páginas partilhadas | `src/pages/` — lazy-loaded pelo Next |
| Backend | `supabase/migrations/` + `supabase/functions/` |
| Legado Vite/Base44 | `legacy/` — só desenvolvimento local, não produção |

---

## Desenvolvimento

```bash
npm ci
npm run dev          # Next.js — http://localhost:3000
npm run build        # Build de produção (validação local)
npm run secrets:audit
```

Variáveis: copiar `.env.example` → `.env.local`. Guia completo em [`docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md`](docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md).

| Comando | Uso |
|---------|-----|
| `npm run dev` | Servidor Next local |
| `npm run build` | Build + verificação de toolchain |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run supabase:deploy` | Migrações + Edge Functions (CI ou local com secrets) |

---

## Deploy

Push na `main` → GitHub Actions **Vercel Deploy** (build com secrets) + **Supabase Deploy** (quando `supabase/**` muda).

- Secrets canónicos: [`docs/migration/P38_SECRETS_CANONICOS.md`](docs/migration/P38_SECRETS_CANONICOS.md)
- Continuidade operacional: [`docs/migration/P38_CONTINUIDADE_OPERACIONAL.md`](docs/migration/P38_CONTINUIDADE_OPERACIONAL.md)

---

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [`docs/PROFISSIONALIZACAO_P38.md`](docs/PROFISSIONALIZACAO_P38.md) | Plano de maturidade do produto |
| [`docs/P38_MODULOS_E_PERFIS.md`](docs/P38_MODULOS_E_PERFIS.md) | Módulos e perfis de utilizador |
| [`docs/p38-mobile-rollout.md`](docs/p38-mobile-rollout.md) | Padrões mobile |
| [`AGENTS.md`](AGENTS.md) | Guia para agentes de IA / desenvolvimento |

---

## Repositório relacionado

O monorepo **a29-erp** mantém snapshot de referência em `legacy/varejosync/`. Espelho opcional: `npm run mirror:pack` — ver [`mirror/README.md`](mirror/README.md).

---

*P38 — o varejo não vive no escritório.*
