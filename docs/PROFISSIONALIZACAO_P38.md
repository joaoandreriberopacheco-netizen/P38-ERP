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
| 1.5 | Landing pública `/landing.html` | ✅ |
| 1.6 | Domínio próprio (`app.tuamarca.com.br`) | ⏳ manual — Vercel → Settings → Domains |
| 1.7 | Renomear repositório GitHub para `p38-erp` | ⏳ manual — GitHub → Settings → Repository name |

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

## Próxima acção recomendada (manual, 30 min)

1. GitHub → renomear repo para `p38-erp`
2. Vercel → domínio customizado (opcional)
3. Partilhar `https://p-38erp.vercel.app/landing.html` em vez do URL cru do app

---

*Atualizar este ficheiro quando marcares tarefas manuais como concluídas.*
