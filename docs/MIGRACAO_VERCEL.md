# Migrar deploy Vercel para este repositório (sem mudar links)

Os URLs públicos (`catalogo-tintao-formigres.vercel.app`, etc.) **não mudam** quando altera a origem Git no Vercel — só muda de onde o CI lê o código.

## Estado actual (transição)

| Origem Git | Deploy |
|------------|--------|
| **P38-ERP** `main` | Vercel continua a publicar os catálogos (workflows activos) |
| **p38-catalogo-b2b** | Repo canónico do catálogo; deploy aqui quando quiser |

## Quando migrar (passo a passo)

Para **cada** projecto Vercel (`catalogo-tintao-formigres`, `catalogo-formigres-p38`, …):

1. [vercel.com](https://vercel.com) → projecto → **Settings** → **Git**
2. **Disconnect** repositório P38-ERP
3. **Connect** repositório `joaoandreriberopacheco-netizen/p38-catalogo-b2b`
4. **Root Directory:** `deploy/catalogo-tintao` (ou `catalogo-formigres`, `catalogo-arielle`, `catalogo-ecuaceramica`)
5. **Framework:** Other · Build Command vazio · Output `.`
6. Gravar secrets no GitHub **deste repo** (mesmos nomes que no P38-ERP):
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_CATALOGO_TINTAO_PROJECT_ID` (etc.)

7. Push em `main` que altere `deploy/catalogo-tintao/**` → workflow publica

O **alias de produção** (ex. `catalogo-tintao-formigres.vercel.app`) mantém-se — é o mesmo project ID Vercel.

## Desactivar workflows duplicados no P38-ERP

Depois de todos os catálogos migrarem, pode remover ou desactivar no P38-ERP:

- `.github/workflows/vercel-deploy-catalogo-*.yml`

Opcional: remover `scripts/catalogo/` e `deploy/catalogo-*` do P38-ERP num commit posterior (só quando tiver a certeza que nada depende deles no ERP).
