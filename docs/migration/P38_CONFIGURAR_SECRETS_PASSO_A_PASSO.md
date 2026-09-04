# P38 — Configurar secrets passo a passo (avião comercial)

Guia para **configurar uma vez** e o sistema continuar a funcionar sem depender de ficheiros locais nem de colar passwords no chat.

**Projecto P38 no Supabase:** `zhonvxkkqabfdyehyxpu`  
**Site em produção:** https://p-38erp.vercel.app  
**Repositório:** `joaoandreriberopacheco-netizen/P38-ERP`

---

## Visão geral (2 sítios, mesmos nomes)

| Sítio | Para quê | Quem usa depois |
|-------|----------|-----------------|
| **GitHub → Secrets** | Deploy automático + continuidade da empresa | Qualquer pessoa com acesso ao repo |
| **Cursor → Cloud Agents → Secrets** | Tu trabalhares com o agente no Cloud | Quem desenvolve no Cursor Cloud |

Gravas **os mesmos nomes e valores** nos dois sítios. O GitHub é a fonte de verdade da produção.

---

## PARTE 1 — Obter os valores no Supabase

Abre o painel Supabase (conta onde está o projecto P38).

### 1.1 `VITE_SUPABASE_URL`

1. Entra em: https://supabase.com/dashboard/project/zhonvxkkqabfdyehyxpu/settings/api  
2. Secção **Project URL**  
3. Copia o valor (deve ser exactamente):

```
https://zhonvxkkqabfdyehyxpu.supabase.co
```

**Dá acesso a:** o site e os scripts saberem **qual** projecto Supabase usar.

---

### 1.2 `VITE_SUPABASE_ANON_KEY`

1. Na **mesma página** (API Settings)  
2. Secção **Project API keys**  
3. Linha **`anon`** · **`public`**  
4. Clica **Reveal** (ou ícone de copiar) e copia a chave inteira (começa por `eyJ...`)

**Dá acesso a:** login dos utilizadores e leitura/gravação de dados no browser (com as regras de segurança da base).

---

### 1.3 `DATABASE_URL`

1. Entra em: https://supabase.com/dashboard/project/zhonvxkkqabfdyehyxpu/settings/database  
2. Secção **Connection string**  
3. Escolhe o separador **URI**  
4. Modo: **Transaction pooler** (porta **6543**) — recomendado  
5. Clica **Copy** na connection string completa  

Confirma que a URL contém:
- Utilizador: `postgres.zhonvxkkqabfdyehyxpu` (tem de ter **zhonvxkkqabfdyehyxpu**)
- Porta: `6543`
- Começa por `postgresql://`

**Dá acesso a:** aplicar migrações SQL e scripts que ligam directamente à base de dados.

---

### 1.4 `SUPABASE_ACCESS_TOKEN`

1. Entra em: https://supabase.com/dashboard/account/tokens  
2. Clica **Generate new token**  
3. Dá um nome (ex.: `P38-deploy`)  
4. Copia o token (começa por `sbp_...`) — **só aparece uma vez**

**Dá acesso a:** publicar Edge Functions (incluindo login interno `p38-auth`).

---

## PARTE 2 — Obter os valores no Vercel

### 2.1 `VERCEL_TOKEN`

1. Entra em: https://vercel.com/account/tokens  
2. **Create Token**  
3. Nome (ex.: `P38-github-deploy`)  
4. Copia o token

**Dá acesso a:** o GitHub Actions publicar o site em produção.

---

### 2.2 `VERCEL_ORG_ID`

1. Entra em: https://vercel.com/account  
2. **Settings** → **General**  
3. Copia o **Team ID** ou **User ID** (depende se o projecto está na conta pessoal ou equipa)

**Dá acesso a:** identificar a tua conta Vercel no deploy automático.

---

### 2.3 `VERCEL_PROJECT_ID`

1. Entra no projecto do site P38 na Vercel (nome habitual: `p-38erp` ou `varejosync`)  
2. **Settings** → **General**  
3. Copia o **Project ID**

**Dá acesso a:** o deploy ir para o projecto correcto (não criar um site novo por engano).

---

## PARTE 3 — Gravar no GitHub (produção / continuidade)

1. Abre: https://github.com/joaoandreriberopacheco-netizen/P38-ERP/settings/secrets/actions  
2. Para **cada** linha da tabela abaixo:
   - Clica **New repository secret**
   - **Name:** nome exacto (copiar da coluna)
   - **Secret:** colar o valor que obtiveste nas Partes 1 e 2
   - Clica **Add secret**

| Name (exacto) | Valor vem de |
|---------------|--------------|
| `VITE_SUPABASE_URL` | Parte 1.1 |
| `VITE_SUPABASE_ANON_KEY` | Parte 1.2 |
| `DATABASE_URL` | Parte 1.3 |
| `SUPABASE_ACCESS_TOKEN` | Parte 1.4 |
| `VERCEL_TOKEN` | Parte 2.1 |
| `VERCEL_ORG_ID` | Parte 2.2 |
| `VERCEL_PROJECT_ID` | Parte 2.3 |

**Opcional** (só se quiseres login Google no futuro):

| Name | Valor |
|------|--------|
| `VITE_P38_USE_SUPABASE_AUTH` | `true` |
| `VITE_P38_ENABLE_GOOGLE_LOGIN` | deixar vazio ou `true` |

Quando terminares, deves ver **7 secrets** (ou 9 com os opcionais) na lista do GitHub.

---

## PARTE 4 — Gravar no Cursor Cloud (trabalho com o agente)

1. Abre: https://cursor.com/dashboard/cloud-agents/environments/e/334db7fa-cbaa-49eb-9dd0-1c1b7a206ced  
2. Secção **Secrets**  
3. Adiciona **os mesmos 7 secrets** com os **mesmos nomes** e **mesmos valores** da Parte 3  

**Importante:**
- Usa nomes **exactos** (`DATABASE_URL`, não `database_url`)
- **Não** cries um secret chamado `supabase` (minúsculas)
- Depois de gravar tudo, **abre uma nova sessão** Cloud Agent

---

## PARTE 5 — Auditar (confirmar que está certo)

Na sessão Cloud Agent (nova), pede:

```bash
npm run secrets:audit
```

O relatório diz, para cada chave:
- ✓ **presente e funciona** — e o que essa chave permite fazer
- ✗ **em falta** — qual secret falta gravar

Quando tudo estiver verde:

```
✓ Avião pronto para decolar
```

---

## PARTE 6 — Confirmar deploy automático (opcional mas recomendado)

1. GitHub → **Actions** → workflow **Vercel Deploy** → **Run workflow**  
2. Espera ficar verde  
3. Abre https://p-38erp.vercel.app e faz login

Se o workflow passar, a produção está ligada aos secrets do GitHub.

---

## Resumo — o que cada secret faz

| Secret | O que permite |
|--------|----------------|
| `VITE_SUPABASE_URL` | Site aponta para o Supabase P38 |
| `VITE_SUPABASE_ANON_KEY` | Utilizadores fazem login e usam o ERP |
| `DATABASE_URL` | Migrações e scripts tocam na base de dados |
| `SUPABASE_ACCESS_TOKEN` | Publicar funções de autenticação no Supabase |
| `VERCEL_TOKEN` | GitHub publica o site |
| `VERCEL_ORG_ID` | Deploy na conta Vercel correcta |
| `VERCEL_PROJECT_ID` | Deploy no projecto `p-38erp` correcto |

---

## Regras de ouro

1. **Nunca** colar passwords no chat com o agente  
2. **Nunca** commitar secrets no Git (só no painel GitHub e Cursor)  
3. GitHub e Cursor Cloud devem ter **os mesmos nomes**  
4. Depois de alterar secrets no Cursor, **nova sessão** Cloud Agent  
5. Para validar: `npm run secrets:audit`

---

## Documentos relacionados

- [P38_CONTINUIDADE_OPERACIONAL.md](./P38_CONTINUIDADE_OPERACIONAL.md) — o sistema continua sem ti  
- [P38_SECRETS_CANONICOS.md](./P38_SECRETS_CANONICOS.md) — referência técnica dos nomes  
- [SUPABASE_LOGIN_INTERNO.md](./SUPABASE_LOGIN_INTERNO.md) — utilizadores e senhas do ERP
