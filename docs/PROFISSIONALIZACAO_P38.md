# Profissionalização P38 — plano executável

Checklist para o P38 deixar de parecer “app de garagem”.  
**Excluído deste plano (decisão do dono):** CNPJ / entidade jurídica, termos de uso e política de privacidade.

---

## Fase 1 — Parece empresa

| # | Tarefa | Estado |
|---|--------|--------|
| 1.1 | README profissional (produto, stack, links) | ✅ |
| 1.2 | `package.json` → nome `p38-erp`, versão `1.0.0` | ✅ |
| 1.3 | Limpar artefactos temporários da raiz (`_mcp_*`) | ✅ |
| 1.4 | `.gitignore` para impedir lixo de agente | ✅ |
| 1.5 | Landing pública `/landing.html` | ✅ em produção após deploy |
| 1.6 | Domínio próprio | ⏸️ **adiado** (decisão do dono) |
| 1.7 | Renomear repositório GitHub → `p38-erp` | ⏳ **2 min no browser** — ver [`RENOMEAR_REPOSITORIO.md`](./RENOMEAR_REPOSITORIO.md) |

---

## Fase 2 — Parece produto

| # | Tarefa | Estado |
|---|--------|--------|
| 2.1 | Legado Vite/Base44 documentado em `legacy/` | ✅ |
| 2.2 | `CHANGELOG.md` + versão semântica | ✅ |
| 2.3 | Versão visível no app (Home build stamp) | ✅ |
| 2.4 | CI GitHub Actions (`build` + smoke estrutural) | ✅ |
| 2.5 | Monitorização de erros (Sentry ou similar) | ⏳ criar conta + `SENTRY_DSN` no Vercel |
| 2.6 | Ambiente staging (`staging` branch ou projecto Vercel separado) | ⏳ ver secção abaixo |
| 2.7 | Remover `@base44/sdk` das deps de produção | ⏳ fase posterior (ainda há shim) |

### Staging (quando quiseres)

1. Criar projecto Supabase **separado** (ou branch DB se usares branching pago).
2. Duplicar secrets no GitHub com prefixo `STAGING_` ou segundo workflow.
3. Projecto Vercel `p38-staging` → branch `staging` ou preview deployments.
4. URL tipo `staging.p38erp.vercel.app` — testar antes de `main`.

---

## Fase 3 — Parece negócio

| # | Tarefa | Estado |
|---|--------|--------|
| 3.1 | Documentar módulos e perfis (`P38_MODULOS_E_PERFIS.md`) | ✅ |
| 3.2 | Template de case study | ✅ |
| 3.3 | 1 utilizador piloto externo (outro negócio) | ⏳ negócio |
| 3.4 | RLS multi-tenant (`empresa_id`) se venderes a mais clientes | ⏳ engenharia |
| 3.5 | Conversa com parceiro (software house / distribuidor) | ⏳ negócio |

---

## Comandos úteis

```bash
npm run smoke:structure   # valida estrutura mínima do repo
npm run build               # gate de produção (Next)
npm run secrets:audit       # secrets configurados
```

---

## Estado do deploy (2026-08-06)

- PR **#423** merged na `main` ✅
- CI + Vercel Deploy disparam automaticamente no push
- Landing: `https://p-38erp.vercel.app/landing.html`

## Próxima acção (só tu, ~2 min)

1. Renomear repo → [`RENOMEAR_REPOSITORIO.md`](./RENOMEAR_REPOSITORIO.md)
2. Partilhar a landing em conversas com parceiros (em vez do URL cru do app)

---

*Atualizar este ficheiro quando marcares tarefas manuais como concluídas.*
