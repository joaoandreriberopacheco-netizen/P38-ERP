# P38 Catálogo B2B

Catálogos **white-label** para lojistas — HTML estático partilhável (WhatsApp, e-mail), com carrinho, PDF, regime Suframa e tour de onboarding.

Repositório **público** e **separado do [P38-ERP](https://github.com/joaoandreriberopacheco-netizen/P38-ERP)** para não misturar ERP com catálogo comercial.

## Sites em produção (links actuais — não mudam ao criar este repo)

| Catálogo | URL |
|----------|-----|
| Tintão / Formigres (cliente) | https://catalogo-tintao-formigres.vercel.app/ |
| Formigres (demo) | https://catalogo-formigres-p38.vercel.app/ |
| Arielle | https://catalogo-arielle-p38.vercel.app/ |
| Portfolio Ecuaceramica | https://catalogo-demo-p38.vercel.app/ |

> **Nota:** Os projectos Vercel continuam ligados ao P38-ERP até migrar a origem Git (ver [`docs/MIGRACAO_VERCEL.md`](docs/MIGRACAO_VERCEL.md)). Os **URLs públicos permanecem iguais**.

## Estrutura

```
scripts/catalogo/   # geradores, snapshots, classificação, testes
scripts/lib/        # embalagem, preços, Suframa, tour, scrapers
deploy/catalogo-*/  # index.html + vercel.json (site estático)
docs/imports-local/ # dados locais (gitignored — snapshots, classificações)
```

## Desenvolvimento

```bash
npm ci
npm run catalogo:publicar-ecuaceramica   # exemplo portfolio
npm run catalogo:publicar-tintao         # só regenera HTML (precisa classificação local)
```

Dados de classificação ficam em `docs/imports-local/` (não vão para o Git). Copie do ambiente onde já corre o pipeline ou regenere com `catalogo:snapshot-*` + `catalogo:classificar-*`.

## Comandos principais

| Objetivo | Comando |
|----------|---------|
| Portfolio Ecuaceramica (completo) | `npm run catalogo:publicar-ecuaceramica` |
| Tintão (HTML) | `npm run catalogo:publicar-tintao` |
| Formigres demo | `npm run catalogo:publicar-formigres` |
| Arielle | `npm run catalogo:publicar-arielle` |
| Testes embalagem/preços/PEI EC | `npm run catalogo:test-ecuaceramica-*` |

## Deploy

Cada pasta em `deploy/catalogo-*` é um projecto Vercel isolado (sem build — só `index.html`).

Workflows GitHub Actions em `.github/workflows/vercel-deploy-catalogo-*.yml` (secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_*_PROJECT_ID`).

## Powered by

**P38 sistemas** — ERP vertical para varejo e distribuição.
