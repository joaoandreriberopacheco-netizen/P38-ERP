# PagLeve — raio-x (estoque SIAH)

Arquivos gerados na análise **formato a formato**, com fabricante só quando há **URL no site** (ou indicação documentada).

| Arquivo | Conteúdo |
|---------|----------|
| `raio-x-pagleve-site-verificado.xlsx` | Planilha principal (328 itens) — abrir no Excel |
| `raio-x-pagleve-site-verificado.csv` | Mesma planilha em CSV |
| `pagleve-fabricantes-sites-oficiais.md` | Sites oficiais e regras de busca |
| `pagleve-orfaos-descricao-por-formato.md` | Órfãos com descrição ERP para pesquisa |

Atualizar match no site (ordem por fabricante que o João indicou):

```bash
npm run catalogo:match-pagleve-indicacoes   # regras + busca só nos 56 “indicação João”
# ou match completo por formato:
npm run catalogo:match-pagleve
```

## Catálogo web (estilo premium, como Tintão)

Depois de atualizar o CSV:

```bash
npm run catalogo:publicar-pagleve
```

Usa o **mesmo layout do Tintão** (Libre Franklin, carrinho de caixas, **campo Desconto** no topo, árvore **Bold** e **Retificada** com acabamentos — **polida/polido é textura dentro de Retificada**, não terceira linha).

**Preços:** coluna **Preço Varejo** do relatório SIAH que o fornecedor mandou (scans em `fornecedor-siah-scans/` → `precos-siah-fornecedor.csv`).

```bash
npm run catalogo:extrair-precos-pagleve   # OCR dos scans (tesseract)
npm run catalogo:publicar-pagleve         # regras + match indicações + classificar + preços + HTML
```

Publicação: projecto Vercel isolado em `deploy/catalogo-pagleve/` — ver README dessa pasta.
