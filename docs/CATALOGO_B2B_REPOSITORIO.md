# Catálogo B2B — repositório dedicado

O código do **Catálogo B2B white-label** está a ser separado do P38-ERP para não misturar ERP com catálogos comerciais.

## Repositório

| | |
|--|--|
| **Nome** | `p38-catalogo-b2b` (público) |
| **URL dedicado** | https://github.com/joaoandreriberopacheco-netizen/p38-catalogo-b2b *(criar repo vazio — ver abaixo)* |
| **Código já no GitHub** | Branch [`p38-catalogo-b2b`](https://github.com/joaoandreriberopacheco-netizen/P38-ERP/tree/p38-catalogo-b2b) no P38-ERP |
| **Local** | pasta `p38-catalogo-b2b/` (gitignored no P38-ERP) |

## Criar repo dedicado (1 passo teu + 1 comando)

1. https://github.com/new → `p38-catalogo-b2b` · **público** · **vazio** (sem README)
2. Na pasta local: `cd p38-catalogo-b2b && npm run repo:publicar`

Links Vercel **não mudam** até migrar origem Git (`docs/MIGRACAO_VERCEL.md` no branch).

## Links dos catálogos (não mudam)

| Catálogo | URL |
|----------|-----|
| Tintão / Formigres | https://catalogo-tintao-formigres.vercel.app/ |
| Formigres demo | https://catalogo-formigres-p38.vercel.app/ |
| Arielle | https://catalogo-arielle-p38.vercel.app/ |
| Portfolio Ecuaceramica | https://catalogo-demo-p38.vercel.app/ |

Os projectos Vercel **continuam ligados ao P38-ERP** até migrar a origem Git. Os URLs públicos permanecem iguais.

## Criar o repo no GitHub (uma vez)

1. https://github.com/new → nome `p38-catalogo-b2b`, **público**, sem README
2. `cd p38-catalogo-b2b && npm run repo:publicar`

O código já está no branch [`p38-catalogo-b2b`](https://github.com/joaoandreriberopacheco-netizen/P38-ERP/tree/p38-catalogo-b2b) do P38-ERP.

## Depois da migração

Ver `p38-catalogo-b2b/docs/MIGRACAO_VERCEL.md` — liga cada projecto Vercel ao repo novo (mesmos aliases).

Comandos `npm run catalogo:*` passam a correr no repo `p38-catalogo-b2b`.
