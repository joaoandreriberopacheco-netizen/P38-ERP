# P38 — Continuidade operacional (avião comercial)

João, esta página responde à pergunta: **se eu deixar de estar aqui, o sistema continua?**

## Resposta curta

| Peça | Continua sem ti? | Condição |
|------|------------------|----------|
| **App em produção** (`p-38erp.vercel.app`) | **Sim** | Secrets no **GitHub** + **Vercel** (não só no teu Cursor) |
| **Base de dados** (Supabase) | **Sim** | Projecto com acesso de **equipa/empresa**, não só conta pessoal |
| **Deploy automático** (push na `main`) | **Sim** | GitHub Actions com secrets completos |
| **Ficheiro `secrets/p38-chaves.txt`** | **Não** | É só para ti no Cloud — não vai para o Git, não é herança |
| **Colar chaves no chat** | **Não** | Morre contigo — nunca foi continuidade |

O **avião comercial** é: produção voa sozinha; o ficheiro txt é a **ferramenta de manutenção** no hangar, não o motor do avião.

---

## As três camadas (do mais importante ao menos)

### 1. Produção — tem de viver sem ninguém abrir o Cursor

Isto é o que a equipa usa no dia-a-dia (vendas, stock, login):

```
Utilizador → Vercel (site) → Supabase (dados)
```

**Não depende de:**
- João estar online
- `p38-chaves.txt`
- Cursor Cloud Agent
- Colar passwords no chat

**Depende de:**
- **GitHub** → Settings → Secrets → Actions (lista em `P38_SECRETS_CANONICOS.md`)
- **Vercel** → env vars de produção (sincronizadas pelo workflow em cada deploy)
- **Supabase** → projecto `zhonvxkkqabfdyehyxpu` acessível por quem ficar responsável

### 2. Deploy automático — push na `main` e pronto

Quando alguém faz merge na `main`:
- GitHub Actions faz build + deploy Vercel
- Se mudar `supabase/**`, corre migrações + Edge Functions

A equipa técnica futura só precisa de **acesso ao GitHub** com os secrets já lá gravados.

### 3. Manutenção no Cloud — só para quem desenvolve

`secrets/p38-chaves.txt` e o painel Cursor são para **configurar e corrigir** — não para o negócio correr.

Fluxo correcto:
1. Preenches `p38-chaves.txt` para validar (`npm run secrets:check`)
2. **Copias os mesmos valores** para GitHub Secrets (fonte de verdade da produção)
3. O ficheiro txt fica opcional no teu dia-a-dia no Cloud

---

## Checklist “decolou de vez” (continuidade real)

Marca quando estiver feito — isto é o que protege a empresa:

- [ ] **GitHub Secrets** completos (`VITE_SUPABASE_*`, `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_*`)
- [ ] **Vercel** com env de produção (workflow já sincroniza em cada deploy)
- [ ] **Supabase** — projecto P38 com pelo menos **2 pessoas** com acesso admin (ou conta da empresa)
- [ ] **Cofre de passwords da empresa** (Bitwarden, 1Password, etc.) com:
  - URLs de login (GitHub, Vercel, Supabase, Cursor)
  - Lista de secrets canónicos (nomes, não valores no Git)
  - Quem é o responsável técnico de backup
- [ ] **Documentação no repo** — `P38_SECRETS_CANONICOS.md`, este ficheiro, `SUPABASE_LOGIN_INTERNO.md`
- [ ] **Teste de sobrevivência** — outra pessoa (ou contador de confiança) consegue abrir o site e fazer login **sem te ligar**

---

## O que NÃO deixar só contigo

| Risco | O que fazer |
|-------|-------------|
| Conta Supabase só no teu email pessoal | Adicionar membro da equipa ou email da empresa |
| GitHub/Vercel só no teu nome | Transferir para org/equipa ou documentar sucessor |
| Secrets só no Cursor Cloud | Espelhar no GitHub Secrets |
| Passwords só na cabeça ou no chat | Cofre da empresa + doc com **nomes** das chaves |
| `p38-chaves.txt` como única cópia | É cópia de trabalho — GitHub é a autoridade |

---

## Para quem ficar depois (guia de 5 minutos)

1. Site em produção: https://p-38erp.vercel.app
2. Dados: Supabase projecto `zhonvxkkqabfdyehyxpu`
3. Código: repositório `varejosync` no GitHub
4. Secrets: GitHub → Settings → Secrets → Actions (ver `P38_SECRETS_CANONICOS.md`)
5. Validar: `npm run secrets:check -- --context=github` (com secrets configurados)
6. Login interno P38: ver `SUPABASE_LOGIN_INTERNO.md`
7. Problema de deploy: ver `VERCEL_DEPLOY_GITHUB.md` e `SUPABASE_DEPLOY_TRIGGER.md`

**Não precisam do João** se os itens acima estiverem feitos.

---

## Relação com o ficheiro `p38-chaves.txt`

Podes preencher o ficheiro **sem medo** — desde que percebas:

- É para **facilitar o teu trabalho** no Cursor Cloud hoje
- **Não substitui** GitHub Secrets para continuidade
- Depois de validar, **replica** os valores no GitHub (passo obrigatório para “avião comercial”)

Ordem recomendada:
```
p38-chaves.txt  →  secrets:check OK  →  copiar para GitHub Secrets  →  decolou
```

---

## Documentos relacionados

- [P38_SECRETS_CANONICOS.md](./P38_SECRETS_CANONICOS.md) — nomes e onde colocar cada chave
- [secrets/README.md](../../secrets/README.md) — ficheiro mestre no Cloud
- [CUTOVER_RUNBOOK.md](./CUTOVER_RUNBOOK.md) — virada de produção
- [SUPABASE_LOGIN_INTERNO.md](./SUPABASE_LOGIN_INTERNO.md) — utilizadores e admin
