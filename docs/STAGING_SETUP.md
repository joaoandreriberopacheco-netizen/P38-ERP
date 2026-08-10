# Staging — ambiente de homologação (Fase 2)

Objectivo: testar alterações **antes** de `main` → produção.

## Opção A — Branch `staging` (recomendada)

| Peça | Configuração |
|------|----------------|
| **Branch Git** | `staging` (criada no repo) |
| **CI** | Workflow `CI` corre em push à `staging` |
| **Vercel** | Projecto separado **ou** Preview Deployment ligado à branch `staging` |

### Vercel — projecto staging (manual, ~15 min)

1. Vercel → **Add New Project** → importar **P38-ERP**
2. **Production Branch:** `staging` (não `main`)
3. Copiar env vars de produção com projecto Supabase **de teste** (recomendado) ou o mesmo (cuidado)
4. URL típica: `p38-staging.vercel.app`

### Secrets GitHub (opcional)

Duplicar com prefixo se quiseres deploy automático só staging:

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`

*(Workflow dedicado pode ser adicionado depois — hoje CI valida build na branch.)*

## Opção B — Preview por PR

Cada PR no GitHub gera URL preview Vercel — útil para correções pontuais.

## Checklist antes de merge staging → main

- [ ] Login OK
- [ ] PDV smoke (criar venda teste)
- [ ] Conferência / compras crítico para a alteração
- [ ] Sem erros novos no Sentry (se activo)

## Variável de ambiente

Gravar em staging:

```
NEXT_PUBLIC_P38_ENV=staging
```

Aparece no Sentry e facilita filtrar erros.
