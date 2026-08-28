# Ver mudanças no Vercel antes de produção

Guia prático para o João André — **sem precisar ser programador**.

---

## Ideia em uma frase

| O quê | Analogia |
|-------|----------|
| **`main`** | Loja aberta ao público — [p-38erp.vercel.app](https://p-38erp.vercel.app) |
| **Branch + PR** | Rascunho numa sala de prova — URL temporária só para ti |
| **Merge na `main`** | Publicar o rascunho na loja |

Enquanto testas no preview, **a produção não muda**.

---

## Fluxo recomendado (Preview por PR)

Já está configurado no GitHub Actions (`Vercel Preview`).

### Passos

1. **Criar uma branch** com um nome descritivo, por exemplo:
   - `preview/ajuste-caixa-mobile`
   - `preview/novo-relatorio-vendas`

2. **Fazer as alterações** (tu no Cursor, ou pedir ao agente).

3. **Abrir um Pull Request (PR)** no GitHub apontando para `main`.
   - GitHub → repositório P38-ERP → *Compare & pull request*.

4. **Esperar ~3–5 minutos** — o workflow **Vercel Preview** corre automaticamente.

5. **Abrir o link** que aparece:
   - Comentário no PR com título *Preview Vercel (antes do deploy em produção)*
   - Ou GitHub Actions → run do workflow → resumo com link clicável

6. **Testar no telemóvel** com essa URL (login, PDV, o ecrã que mudou).

7. **Só depois de aprovares** → *Merge* no PR → aí sim a `main` dispara o deploy de **produção**.

### O que pedir ao agente no Cursor

> "Faz esta alteração numa branch de preview e abre PR para eu testar no Vercel antes de ir para produção."

O agente deve:
- **não** commitar direto na `main` nesse caso;
- criar branch `preview/...` ou `cursor/...`;
- abrir PR para `main`;
- indicar-te o link do preview quando o CI terminar.

---

## Opção alternativa — branch `staging` fixa

Para um ambiente **sempre ligado** (tipo "homologação"), podes ter um segundo projecto Vercel cuja branch de produção é `staging`, não `main`.

| | Preview por PR | Staging fixo |
|--|----------------|--------------|
| URL | Nova a cada PR | Fixa (ex. `p38-staging.vercel.app`) |
| Quando usar | Mudança pontual | Várias mudanças seguidas, equipa a testar sempre no mesmo sítio |
| Config | Já activo | Manual no painel Vercel (~15 min) — ver [`STAGING_SETUP.md`](./STAGING_SETUP.md) |

---

## O que cada peça faz

```
Tu / Agente
    │
    ▼
Branch (cópia do código) ──► PR para main
    │
    ▼
GitHub Actions "Vercel Preview"
    │
    ▼
URL temporária (ex. p38-erp-abc123.vercel.app)  ◄── testas aqui
    │
    ▼ (só quando fazes Merge)
GitHub Actions "Vercel Deploy"
    │
    ▼
p-38erp.vercel.app  ◄── produção
```

---

## Checklist rápido antes do merge

- [ ] Login funciona no preview
- [ ] O ecrã que mudou está correcto no telemóvel
- [ ] Não há erro óbvio ao gravar / consultar dados
- [ ] Produção (`p-38erp.vercel.app`) ainda é a versão antiga (confirmar que não misturaste URLs)

---

## Atenção — base de dados

O preview usa **os mesmos secrets Supabase** que produção (por agora). Isso significa:

- Ver dados reais no preview é normal.
- **Evitar** apagar ou alterar dados de produção durante testes destrutivos.
- Para testes pesados no futuro: projecto Supabase separado de teste (ver nota em [`STAGING_SETUP.md`](./STAGING_SETUP.md)).

---

## Resumo para não quebrar o sistema

1. **Mudança arriscada?** → branch + PR + preview primeiro.
2. **Correcção pequena e urgente?** → ainda podes ir directo à `main` (como hoje), mas com mais risco.
3. **Produção só muda** quando há merge (ou push directo) na `main`.

---

## Referências técnicas

| Ficheiro | Função |
|----------|--------|
| [`.github/workflows/vercel-preview.yml`](../.github/workflows/vercel-preview.yml) | Gera preview em PRs |
| [`.github/workflows/vercel-deploy.yml`](../.github/workflows/vercel-deploy.yml) | Deploy produção na `main` |
| [`STAGING_SETUP.md`](./STAGING_SETUP.md) | Ambiente staging opcional |
