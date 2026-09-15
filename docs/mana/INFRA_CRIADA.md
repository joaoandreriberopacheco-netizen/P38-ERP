# Maná ERP — infraestrutura criada

Laboratório separado do P38 (produção). **Dados fictícios**; equipa não usa este ambiente.

## Identificadores (sem passwords)

| Peça | Valor |
|------|--------|
| **Nome** | Maná ERP |
| **Supabase project ref** | `xmjppfivqyaqxwxdrorn` |
| **Supabase URL** | `https://xmjppfivqyaqxwxdrorn.supabase.co` |
| **Região** | `ca-central-1` (igual P38) |
| **Vercel project** | `mana-erp` |
| **Vercel project id** | `prj_LST1epyoPpdBeboVAEHUhAS5WcK6` |
| **Repo GitHub (alvo)** | `joaoandreriberopacheco-netizen/mana-erp` *(criar manualmente — ver abaixo)* |

## Base de dados

- Schema **clonado do P38 produção** (estrutura igual, **sem dados reais**).
- **73 migrações** registadas em `_p38_schema_migrations` (paridade com P38 no corte).
- Password da base: gravada nos **Cursor Cloud Secrets** do ambiente Maná (ver checklist).

## Vercel

Variáveis já configuradas no projecto `mana-erp`:

- `VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` → URL Maná
- `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon Maná
- `VITE_P38_PROVIDER=supabase`
- `VITE_P38_BYPASS_BASE44=true`
- `VITE_P38_USE_SUPABASE_AUTH=true`
- `NEXT_PUBLIC_P38_ENV=mana`

## GitHub — passo manual (João, 2 min)

O token do agente **não tem permissão** para criar repositórios. Faz uma vez:

1. https://github.com/new  
2. Nome: **`mana-erp`**  
3. **Private**  
4. **Não** inicializar com README (repo vazio)  
5. Depois diz ao agente: *"repo mana-erp criado, faz push inicial"*

Ou no browser: **Import repository** → source `P38-ERP` → novo nome `mana-erp`.

## Secrets Cursor Cloud — ambiente Maná

Criar **ambiente Cloud Agent separado** (ou secrets com prefixo) — **nunca** misturar com produção:

| Nome | Origem |
|------|--------|
| `VITE_SUPABASE_URL` | `https://xmjppfivqyaqxwxdrorn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Mana ERP → Settings → API → anon |
| `DATABASE_URL` | Supabase → Mana ERP → Database → pooler :6543 |
| `SUPABASE_ACCESS_TOKEN` | Mesmo PAT da conta (serve para deploy functions Maná) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Mana ERP → API → service_role |
| `VERCEL_TOKEN` | Igual (conta Vercel) |
| `VERCEL_ORG_ID` | Igual |
| `VERCEL_PROJECT_ID` | `prj_LST1epyoPpdBeboVAEHUhAS5WcK6` |

**Não copiar** `DATABASE_URL` nem `anon key` do P38 produção para o ambiente Maná.

## Governança (resumo)

| Tipo | Onde |
|------|------|
| Bug operacional (equipa bloqueada) | Agente **P38** → repo `P38-ERP` |
| Experiência / funcionalidade nova | Agente **Maná** → repo `mana-erp` |
| Sync P38 → Maná | Agente Maná, semanal ou quando pedires |
| Promoção Maná → P38 | Só com *"aprovo promoção para o P38"* |

Ver `GOVERNANCA_AGENTES.md` e `SYNC_LOG.md` (no repo mana-erp após push).

## Baseline (corte)

| Campo | Valor |
|-------|--------|
| Data | 2026-08-16 |
| P38 Supabase ref | `zhonvxkkqabfdyehyxpu` |
| Migrações até | `068_lancamento_transferencia_conta_destino.sql` |
| Maná nasceu com schema clone P38 | sim |
