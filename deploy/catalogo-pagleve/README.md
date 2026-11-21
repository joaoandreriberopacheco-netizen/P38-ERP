# Catálogo PagLeve — deploy isolado (Vercel)

Site estático **separado do P38 ERP**. Estoque Novo Aleixo (raio-x verificado) — visual premium inspirado na marca Pague Leve. Sem login, sem rotas do ERP.

## Link público

**https://catalogo-pague-leve.vercel.app/**

## Acesso temporário (sem login) — 24 horas

Para partilhar o catálogo com alguém por **24 h** (ou outra duração), sem senha nem cadastro:

```bash
npm run catalogo:link-temporario-pagleve
# ou: npm run catalogo:link-temporario-pagleve -- --hours 48
```

O comando imprime um **URL completo** (`…/acesso/…`). Envie só esse link. Passado o prazo, o link deixa de abrir sozinho.

**Uma vez por ambiente:** o segredo `CATALOGO_PAGLEVE_CONVITE_SECRET` tem de estar no projecto Vercel (o script grava uma cópia local em `files/pagleve/catalogo-convite-secret.local` — não commitar). Na primeira geração, copie o valor para o painel Vercel → Settings → Environment Variables.

O link fixo da raiz (`/`) continua disponível para uso interno; o acesso temporário é um caminho à parte.

Regenerar conteúdo:

```bash
npm run catalogo:publicar-pagleve
```

Lê `files/pagleve/raio-x-pagleve-site-verificado.csv` e grava `deploy/catalogo-pagleve/index.html`.

## Criar projecto Vercel (uma vez)

1. [vercel.com/new](https://vercel.com/new) → importar repo **P38-ERP** (só para criar o projecto isolado; deploy contínuo = GitHub Actions, igual ao Tintão)
2. **Root Directory:** `deploy/catalogo-pagleve`
3. **Framework Preset:** Other (site estático, sem build)
4. **Build Command:** deixar vazio
5. **Output Directory:** `.` (raiz da pasta)
6. Nome sugerido: `catalogo-pague-leve`
7. Copiar **Project ID** → GitHub Secret `VERCEL_CATALOGO_PAGLEVE_PROJECT_ID` (opcional se existir `vercel.project-id` no repo)
   - Projecto criado: `catalogo-pague-leve`
   - ID canónico: `deploy/catalogo-pagleve/vercel.project-id` (`prj_503sAOxx6FvbOxgRue0cKmeTYpXx`)
8. `VERCEL_TOKEN` e `VERCEL_ORG_ID` são os **mesmos** do deploy principal P38

Push na `main` que altere `deploy/catalogo-pagleve/**` dispara o workflow **Vercel Deploy — Catálogo PagLeve** (ou **Run workflow** manual em Actions).

_Conteúdo publicado no repositório: 228 referências (commit de catálogo 2026-11-21)._

## Porquê isolado

O link partilhado (WhatsApp / Instagram) **não** deve expor `p-38erp.vercel.app`. Este projecto serve só o HTML do catálogo de estoque.

Instagram oficial: https://www.instagram.com/paguelevepisoseporcelanatos/

Rodapé no site: **Powered by P38 sistemas**.
