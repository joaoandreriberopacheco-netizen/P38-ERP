# Login interno P38 (utilizador + senha)

Modelo de autenticação para produção no Vercel com `VITE_P38_PROVIDER=supabase`:

- **Ecrã de login:** utilizador + senha (sem email obrigatório).
- **Email técnico** em `auth.users`: `<login>@login.p38.internal` (nunca mostrado ao utilizador).
- **Sessão persistente** no aparelho (`persistSession` no cliente Supabase).
- **Só admin** cria utilizadores em Configurações → Usuários.
- **Primeira vez:** admin activa o sistema; novos utilizadores activam em `/ativar-acesso`.

## Fluxo operacional

### 1. Preparar base de dados

```bash
npm run db:apply-migrations
```

Aplica `027_usuario_login_interno.sql` (colunas `login`, `auth_ativado` em `public.usuario`).

Garanta que existe um registo admin em `public.usuario` com `role = admin` e `login` ou `nickname` definido (ex.: `admin`).

### 2. Deploy da Edge Function

```bash
# Requer SUPABASE_ACCESS_TOKEN e project ref alinhado (ver scripts/supabase-env.mjs)
npm run supabase:deploy:functions
```

A função `p38-auth` expõe:

| `op` | Quem | Descrição |
|------|------|-----------|
| `status` | público | `{ needsBootstrap, authUserCount }` |
| `bootstrap` | público (só se 0 users auth) | Admin define 1.ª senha |
| `activate` | público | Utilizador define senha (`must_activate`) |
| `request_password_reset` | público | Envia link de recovery para email cadastrado |
| `create_user` | admin autenticado | Cria `usuario` + credencial pendente |

### 3. Primeira activação (admin)

1. Abrir `https://<app>/ativar-acesso?mode=bootstrap` (redirect automático se não existir nenhum user em auth).
2. Informar **utilizador** do admin (ex.: `admin`) e **senha** (mín. 6 caracteres).
3. Entrar em `/login` com o mesmo utilizador e senha.

### 4. Criar utilizador (admin)

1. Configurações → Usuários → **Novo utilizador**.
2. Preencher login, nome e perfil de acesso.
3. Informar ao colaborador: abrir `/ativar-acesso`, usar o **mesmo login** e definir a senha.

### 5. Login diário

`/login` → utilizador + senha → fica logado no dispositivo.

**Esqueci a senha:** `/esqueci-senha` → informa o utilizador → link enviado para o **email cadastrado** em `public.usuario` (coluna `email` ou `dados.email`). Conclusão em `/redefinir-senha`.

Auditar emails cadastrados:

```bash
DATABASE_URL=... npm run usuario:audit-emails
npm run usuario:audit-emails -- --only=joaoandreriberopacheco
```

No Supabase → **Authentication → URL Configuration**, incluir `https://p-38erp.vercel.app/redefinir-senha` (e previews) em **Redirect URLs**.

## Variáveis de ambiente (Vercel)

| Variável | Obrigatório |
|----------|-------------|
| `VITE_P38_PROVIDER` | `supabase` |
| `VITE_SUPABASE_URL` | Sim |
| `VITE_SUPABASE_ANON_KEY` | Sim |
| `VITE_P38_USE_SUPABASE_AUTH` | `true` (default com provider supabase) |
| `VITE_P38_ENABLE_GOOGLE_LOGIN` | Opcional (`true` só após Google no painel Supabase) |

## Ficheiros principais

| Caminho | Papel |
|---------|--------|
| `src/lib/p38InternalAuth.js` | Normalização login ↔ email técnico |
| `src/functions/p38Auth.js` | Cliente da Edge Function |
| `src/components/auth/LoginPage.jsx` | Login utilizador + senha |
| `src/components/auth/EsqueciSenhaPage.jsx` | Pedido de reset por email |
| `src/components/auth/RedefinirSenhaPage.jsx` | Nova senha após link do email |
| `src/components/auth/AtivarAcessoPage.jsx` | Bootstrap + activação |
| `supabase/functions/p38-auth/` | API server-side (service role) |
| `supabase/migrations/027_usuario_login_interno.sql` | Colunas `login`, `auth_ativado` |

## Script legado de provisionamento por email

`npm run usuario:provision-auth` continua disponível para contas com email real. O fluxo recomendado pós-migração é **login interno** + painel admin, não convites por email.

## Resolução de problemas

| Sintoma | Verificar |
|---------|-----------|
| "Configuração em falta" no build | Env Supabase no workflow Vercel |
| Bootstrap diz utilizador não encontrado | `public.usuario` com admin e `login`/`nickname` |
| Activar diz conta não encontrada (mas utilizador existe) | Correr `npm run usuario:provision-login-auth` ou admin recriar em Configurações → Usuários |
| `create_user` 403 | Sessão admin; `role=admin` em metadata ou `usuario` |
| Função indisponível | `npm run supabase:deploy:functions` e `verify_jwt = false` em `p38-auth` |
| Login inválido | Utilizador normalizado (minúsculas, sem espaços) |
| Esqueci senha não chega | `npm run usuario:audit-emails` — email em `usuario.email` |
| Reset diz link inválido | Redirect URL `/redefinir-senha` no Supabase Auth |
