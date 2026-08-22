# Deploy Vercel via GitHub Actions

O workflow **Vercel Deploy** (`.github/workflows/vercel-deploy.yml`) faz build com variáveis do Supabase e publica em produção.

## Secrets (GitHub → Settings → Secrets → Actions)

| Secret | Onde obter |
|--------|------------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel → Settings → General (Team ID ou User ID) |
| `VERCEL_PROJECT_ID` | Projecto → Settings → General → Project ID |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zhonvxkkqabfdyehyxpu.supabase.co` (P38) — **canónico Next.js** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `VITE_SUPABASE_*` | Fallback legado (dev Vite); o workflow aceita se `NEXT_PUBLIC_*` não existir |

Opcional: `VITE_P38_USE_SUPABASE_AUTH` = `true` quando login Supabase estiver activo.

## Disparar

- **Automático:** qualquer push na `main` (workflow corre sempre)
- **Manual:** Actions → **Vercel Deploy** → Run workflow

## Porque não usar só o deploy Git da Vercel

O `vercel.json` desactiva deploys automáticos do Git (`git.deploymentEnabled: false`) e inclui `ignoreCommand` como rede de segurança. O deploy canónico é **só** via GitHub Actions, que embute URL e anon key no bundle.

Se um build nativo Vercel correr sem env vars, o Vite **falha** em produção (plugin `p38-require-supabase-env`) em vez de publicar um bundle quebrado.

Se precisares de build nativo Vercel (raro): mensagem de commit com `[vercel-native-build]` e env vars definidas no painel Vercel → Settings → Environment Variables.
