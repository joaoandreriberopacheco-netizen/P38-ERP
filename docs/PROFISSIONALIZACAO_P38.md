# Profissionalização P38 — plano executável

Checklist para o P38 deixar de parecer “app de garagem”.  
**Excluído:** CNPJ, termos de privacidade, domínio customizado (adiado).

---

## Fase 1 — Parece empresa ✅

| # | Tarefa | Estado |
|---|--------|--------|
| 1.1 | README profissional | ✅ |
| 1.2 | `p38-erp` v1.x | ✅ |
| 1.3 | Limpeza raiz `_mcp_*` | ✅ |
| 1.4 | `.gitignore` agente | ✅ |
| 1.5 | Landing `/landing.html` | ✅ |
| 1.6 | Domínio próprio | ⏸️ adiado |
| 1.7 | Repo `P38-ERP` | ✅ |

---

## Fase 2 — Parece produto ✅

| # | Tarefa | Estado |
|---|--------|--------|
| 2.1 | Legado em `legacy/` | ✅ |
| 2.2 | `CHANGELOG.md` + semver | ✅ v1.1.0 |
| 2.3 | Versão no app (build stamp) | ✅ |
| 2.4 | CI build + smoke | ✅ |
| 2.5 | Sentry opcional | ✅ código — activar DSN: [`SENTRY_SETUP.md`](./SENTRY_SETUP.md) |
| 2.6 | Staging | ✅ branch + doc [`STAGING_SETUP.md`](./STAGING_SETUP.md) |
| 2.7 | `@base44/sdk` fora do bundle prod | ✅ devDependency + shim Next |
| 2.8 | Smoke HTTP `/login` + `/landing.html` | ✅ `npm run smoke:http` |

---

## Fase 3 — Parece negócio (fundação técnica ✅ / negócio contigo)

| # | Tarefa | Estado |
|---|--------|--------|
| 3.1 | Módulos e perfis | ✅ [`P38_MODULOS_E_PERFIS.md`](./P38_MODULOS_E_PERFIS.md) |
| 3.2 | Template case study | ✅ |
| 3.3 | Piloto externo | 📋 [`PILOTO_EXTERNO_CHECKLIST.md`](./PILOTO_EXTERNO_CHECKLIST.md) |
| 3.4 | Multi-tenant | ✅ migração `054` + [`MULTI_TENANT_ROADMAP.md`](./MULTI_TENANT_ROADMAP.md) |
| 3.5 | Parceiro | 📋 [`marketing/PARCEIRO_ROTEIRO.md`](./marketing/PARCEIRO_ROTEIRO.md) |

**Deploy migração 054:** push `supabase/**` → workflow Supabase Deploy, ou `npm run supabase:deploy`.

---

## Comandos

```bash
npm run smoke:structure
npm run smoke:http      # após build
npm run build
npm run secrets:audit
```

---

## Só negócio (não automatizável)

1. Activar Sentry (criar conta + DSN no Vercel)
2. Configurar projecto Vercel staging (opcional)
3. Convidar 1 piloto externo
4. Conversa com parceiro usando roteiro de 5 min

---

*Última actualização: Fase 2–3 técnicas concluídas em v1.1.0.*
