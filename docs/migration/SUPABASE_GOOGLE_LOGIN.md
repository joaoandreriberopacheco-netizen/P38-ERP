# Login com Google (Supabase)

O botão **Continuar com Google** no `/login` só aparece quando `VITE_P38_ENABLE_GOOGLE_LOGIN=true` no deploy (evita o erro JSON *"provider is not enabled"*).

## O que o erro significa

```json
{"msg":"Unsupported provider: provider is not enabled"}
```

O código da app está certo — falta **activar o Google no painel Supabase** e criar credenciais no Google Cloud.

## Passo a passo (manual)

### 1. Google Cloud Console

1. Abre [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create Credentials** → **OAuth client ID** → tipo **Web application**
3. **Authorized redirect URIs** — adiciona exactamente:
   ```
   https://zhonvxkkqabfdyehyxpu.supabase.co/auth/v1/callback
   ```
4. Guarda o **Client ID** e o **Client Secret**

### 2. Supabase

1. Abre [Supabase → Authentication → Google](https://supabase.com/dashboard/project/zhonvxkkqabfdyehyxpu/auth/providers?provider=Google)
2. Liga **Enable Sign in with Google**
3. Cola **Client ID** e **Client Secret**
4. Em **Authentication → URL Configuration**:
   - **Site URL:** `https://p-38erp.vercel.app`
   - **Redirect URLs:** `https://p-38erp.vercel.app/auth/callback`

### 3. Mostrar o botão no site

Nos secrets do GitHub / Cursor Cloud, adiciona:

| Secret | Valor |
|--------|--------|
| `VITE_P38_ENABLE_GOOGLE_LOGIN` | `true` |

Faz push na `main` (ou redeploy) para o botão Google voltar a aparecer.

## Automático (script)

Se já tiveres `SUPABASE_ACCESS_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` nos secrets:

```bash
node scripts/enable-supabase-google-auth.mjs
```

## Depois do login

O email Google tem de existir em `public.usuario` (ex.: `comprascl@gmail.com`) para carregar perfil e permissões.
