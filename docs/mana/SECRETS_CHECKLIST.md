# Maná ERP — checklist secrets (Cursor Cloud)

Gravar num **ambiente Cloud Agent separado** chamado `Mana ERP` (não misturar com P38 produção).

## Obrigatórios

| Secret | Onde obter |
|--------|------------|
| `VITE_SUPABASE_URL` | `https://xmjppfivqyaqxwxdrorn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | [Supabase Mana → API](https://supabase.com/dashboard/project/xmjppfivqyaqxwxdrorn/settings/api) → anon public |
| `DATABASE_URL` | [Supabase Mana → Database](https://supabase.com/dashboard/project/xmjppfivqyaqxwxdrorn/settings/database) → URI pooler :6543 |
| `SUPABASE_ACCESS_TOKEN` | Mesmo PAT da conta (dashboard account tokens) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Mana → API → service_role |
| `VERCEL_TOKEN` | Igual ao P38 |
| `VERCEL_ORG_ID` | Igual ao P38 |
| `VERCEL_PROJECT_ID` | `prj_LST1epyoPpdBeboVAEHUhAS5WcK6` |

## Password da base Maná

Foi gerada na criação do projecto. Se não tiveres guardada:

1. Supabase → Mana ERP → Database → **Reset database password**
2. Actualiza `DATABASE_URL` nos secrets com a nova password

## Validar

```bash
npm run secrets:audit
```

(Depois de configurar o ambiente Cloud Maná com estes secrets.)

## Nunca gravar no Maná

- `DATABASE_URL` do P38 produção (`zhonvxkkqabfdyehyxpu`)
- `VITE_SUPABASE_ANON_KEY` do P38 produção
