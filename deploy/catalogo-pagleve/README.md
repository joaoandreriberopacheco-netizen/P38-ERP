# Catálogo PagLeve — deploy isolado (Vercel)

Site estático **separado do P38 ERP**. Estoque Novo Aleixo (raio-x verificado) — visual premium inspirado na marca Pague Leve. Sem login, sem rotas do ERP.

## Link público

**https://catalogo-pague-leve.vercel.app/**

Regenerar conteúdo:

```bash
npm run catalogo:publicar-pagleve
```

Lê `files/pagleve/raio-x-pagleve-site-verificado.csv` e grava `deploy/catalogo-pagleve/index.html`.

## Criar projecto Vercel (uma vez)

1. [vercel.com/new](https://vercel.com/new) → importar repo **P38-ERP** (opcional; o deploy **oficial** é pelo GitHub Actions, como no Tintão — **não** é obrigatório ligar Git na Vercel)
2. **Root Directory:** `deploy/catalogo-pagleve`
3. **Framework Preset:** Other (site estático, sem build)
4. **Build Command:** deixar vazio
5. **Output Directory:** `.` (raiz da pasta)
6. Nome sugerido: `catalogo-pague-leve`
7. Copiar **Project ID** → GitHub Secret `VERCEL_CATALOGO_PAGLEVE_PROJECT_ID`
   - Projecto criado: `catalogo-pague-leve`
   - ID: `prj_503sAOxx6FvbOxgRue0cKmeTYpXx`
8. `VERCEL_TOKEN` e `VERCEL_ORG_ID` são os **mesmos** do deploy principal P38

Push na `main` que altere `deploy/catalogo-pagleve/**` dispara o workflow **Vercel Deploy — Catálogo PagLeve** (ou **Run workflow** manual em Actions).

## Porquê isolado

O link partilhado (WhatsApp / Instagram) **não** deve expor `p-38erp.vercel.app`. Este projecto serve só o HTML do catálogo de estoque.

Instagram oficial: https://www.instagram.com/paguelevepisoseporcelanatos/

Rodapé no site: **Powered by P38 sistemas**.
