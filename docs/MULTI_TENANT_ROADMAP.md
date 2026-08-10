# Multi-tenant — roadmap (Fase 3)

Hoje o P38 é **single-tenant** (uma operação, RLS desactivado por decisão de migração — ver `008_disable_rls_single_tenant.sql`).

## Objectivo

Permitir **2+ empresas** no mesmo Supabase com dados isolados — para piloto externo e SaaS futuro.

## Fase 3a — Fundação (feito no Git)

- Tabela `empresa` + registo bootstrap `principal`
- Coluna `usuario.empresa_id` (opcional, nullable)
- Migração: `054_tenant_empresa_foundation.sql`

**Deploy:** `npm run supabase:deploy` ou GitHub Actions Supabase Deploy.

## Fase 3b — Piloto (1 cliente)

1. `INSERT INTO empresa (nome, slug) VALUES ('Loja Piloto', 'piloto-x')`
2. Convidar utilizador (`convidar-usuarios` / Supabase Auth)
3. `UPDATE usuario SET empresa_id = ... WHERE email = ...`
4. Validar que vê só os seus dados (ainda **sem** RLS — confiança operacional)

## Fase 3c — Isolamento técnico

| Passo | Trabalho |
|-------|----------|
| `empresa_id` em tabelas críticas | produto, pedido_venda, lancamento_financeiro, … |
| Backfill | empresa_id = bootstrap para dados actuais |
| RLS policies | `empresa_id = auth.jwt() -> empresa_id` ou join via usuario |
| Edge Functions | Filtrar por tenant em handlers partilhados |

## Fase 3d — Comercial

- Preço por módulo (Caixa / Supply / Financeiro / Gestão)
- Onboarding: [`PILOTO_EXTERNO_CHECKLIST.md`](./PILOTO_EXTERNO_CHECKLIST.md)

## O que NÃO fazer depressa

- Activar RLS em produção sem backfill completo
- Partilhar um login entre duas empresas
- Misturar dados de piloto com operação principal sem `empresa_id`
