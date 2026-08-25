# Catálogo Formigres — demonstração P38

Site estático **separado** do ERP e do catálogo Tintão. Linha completa Formigres (~1 500 modelos) para mostrar à fábrica o conceito de app B2B.

## Link público

**https://catalogo-formigres-p38.vercel.app/**

Visual alinhado ao site [formigres.com.br](https://www.formigres.com.br/) — vermelho #da1c24, fontes Montserrat/Inter, logo oficial.

## Regenerar

```bash
npm run catalogo:publicar-formigres
```

Isto corre classificação (snapshot + preços Tintão onde existir) e gera `deploy/catalogo-formigres/index.html`.

## Preços

- **~174 modelos** têm preço de referência (cruzamento com listas Tintão).
- **Restantes** aparecem como “—” (consultar distribuidor).
- Banner no site explica isto.

## Deploy Vercel

Projecto isolado `catalogo-formigres-p38` (ID: `prj_FIL3vda5AshbjOZJOX39d9sQWs3b`). Secret GitHub: `VERCEL_CATALOGO_FORMIGRES_PROJECT_ID`.

Rodapé: **Powered by P38 sistemas**.
