# Catálogo B2B Tintão — deploy isolado (Vercel)

Site estático **separado do P38 ERP**. Só o HTML do catálogo Formigres — sem login, sem rotas do ERP.

## Link público

**https://catalogo-tintao-formigres.vercel.app/**

Regenerar conteúdo:

```bash
npm run catalogo:publicar-tintao
```

Isto grava `deploy/catalogo-tintao/index.html`.

## Criar projecto Vercel (uma vez)

1. [vercel.com/new](https://vercel.com/new) → importar repo **P38-ERP**
2. **Root Directory:** `deploy/catalogo-tintao`
3. **Framework Preset:** Other (site estático, sem build)
4. **Build Command:** deixar vazio
5. **Output Directory:** `.` (raiz da pasta)
6. Nome sugerido: `catalogo-tintao-formigres`
7. Copiar **Project ID** → GitHub Secret `VERCEL_CATALOGO_TINTAO_PROJECT_ID`
   - Projecto criado: `catalogo-tintao-formigres`
   - ID: `prj_ruX5PmXVYsT3kfcBbD8SliMyiLnr`
8. `VERCEL_TOKEN` e `VERCEL_ORG_ID` são os mesmos do deploy principal P38

Push na `main` que altere `deploy/catalogo-tintao/**` dispara o workflow **Vercel Deploy — Catálogo Tintão**.

## Porquê isolado

O catálogo partilhado no WhatsApp **não** deve expor `p-38erp.vercel.app` (ERP completo). Este projecto serve só o HTML do pedido B2B.

Rodapé no site: **Powered by P38 sistemas**.
