# PagLeve — raio-x (estoque SIAH)

Arquivos gerados na análise **formato a formato**, com fabricante só quando há **URL no site** (ou indicação documentada).

| Arquivo | Conteúdo |
|---------|----------|
| `raio-x-pagleve-site-verificado.xlsx` | Planilha principal (328 itens) — abrir no Excel |
| `raio-x-pagleve-site-verificado.csv` | Mesma planilha em CSV |
| `pagleve-fabricantes-sites-oficiais.md` | Sites oficiais e regras de busca |
| `pagleve-orfaos-descricao-por-formato.md` | Órfãos com descrição ERP para pesquisa |

Atualizar: correr `node scripts/catalogo/pagleve-match-por-formato.mjs` e `node scripts/catalogo/pagleve-aplicar-regras-joao.mjs`, depois copiar de `/opt/cursor/artifacts/` para esta pasta.

## Catálogo web (estilo premium, como Tintão)

Depois de atualizar o CSV:

```bash
npm run catalogo:publicar-pagleve
```

Publicação: projecto Vercel isolado em `deploy/catalogo-pagleve/` — ver README dessa pasta.
