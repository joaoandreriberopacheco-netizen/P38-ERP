# Catálogo B2B — repositório dedicado

O código do **Catálogo B2B white-label** está a ser separado do P38-ERP para não misturar ERP com catálogos comerciais.

## Repositório

| | |
|--|--|
| **Nome** | `p38-catalogo-b2b` (público) |
| **URL** | https://github.com/joaoandreriberopacheco-netizen/p38-catalogo-b2b |
| **Código preparado** | pasta `p38-catalogo-b2b/` na raiz do workspace (gitignored aqui) |

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
2. No terminal:

```bash
cd p38-catalogo-b2b
git push -u origin main
```

(O commit inicial já está feito localmente.)

## Depois da migração

Ver `p38-catalogo-b2b/docs/MIGRACAO_VERCEL.md` — liga cada projecto Vercel ao repo novo (mesmos aliases).

Comandos `npm run catalogo:*` passam a correr no repo `p38-catalogo-b2b`.
