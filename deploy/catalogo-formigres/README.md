# Catálogo Formigres — demonstração P38

Site estático **separado** do ERP. Linha completa Formigres (~1 500 modelos) — demonstração B2B.

## Link de acesso (caminho secreto)

O catálogo **não** abre na raiz do domínio. Só funciona com o link completo que inclui um código no caminho (ex.: `https://p38-fg-catalogo-2be33ba9.vercel.app/fg-…/`).

- O código actual está em `access-slug.json` (e nos `rewrites` de `vercel.json`).
- **Partilhe só o link completo** com quem deve ver preços e pedido B2B.
- Quem tiver só o domínio (`…vercel.app/`) vê página de “acesso restrito”.

### Trocar o link (invalidar o anterior)

Na máquina ou no Cloud Agent:

```bash
npm run catalogo:rotacionar-acesso-formigres -- --yes
```

Confirme o URL no output, faça commit de `access-slug.json` + `vercel.json` e push na `main` (ou merge do PR). Após o deploy Vercel, o slug antigo deixa de abrir o catálogo.

Visual alinhado ao site [formigres.com.br](https://www.formigres.com.br/) — vermelho #da1c24, fontes Montserrat/Inter, logo oficial.

## Regenerar conteúdo (produtos/preços)

```bash
npm run catalogo:publicar-formigres
```

Isto corre classificação do snapshot e gera `deploy/catalogo-formigres/catalogo.html`. A página `index.html` na raiz continua a ser só o aviso de acesso restrito.

## Preços

- Por formato e linha (Cerâmica / Premium / RT), aplicados automaticamente na classificação.

## Deploy Vercel

Projecto Vercel `p38-fg-catalogo-2be33ba9` (antes `catalogo-formigres-p38`; ID: `prj_FIL3vda5AshbjOZJOX39d9sQWs3b`). Secret GitHub: `VERCEL_CATALOGO_FORMIGRES_PROJECT_ID`. Opcional: `CATALOGO_FORMIGRES_PUBLIC_URL` ao regenerar HTML.

Rodapé: **Powered by P38 sistemas**.
