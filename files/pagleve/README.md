# PagLeve — catálogo virtual (PRE_OS × marca 510)

Base **canónica** = cruzamento entre:

| Fonte | Ficheiro em `fonte/` | Papel |
|--------|----------------------|--------|
| **Preços / lista vendável** | `PRE_OS_0973.pdf` | Só entra no site quem está aqui; **preço/m²** e código loja (5 dígitos). Estoque físico ignorado → **disponível**. |
| **Origem por fabricante** | `formigres_*.pdf`, `rochaprime_*.pdf`, `carmelo_fior_*.pdf`, `arielle_*.pdf`, `incopisos_*.pdf` | Relatório ERP **510** — EAN + descrição + marca; cruzamento pelo **mesmo código loja**. |

Gerar / atualizar base:

```bash
npm run catalogo:montar-base-pagleve
```

Saídas principais:

| Ficheiro | Conteúdo |
|----------|----------|
| `pagleve-base-cruzada.csv` | Lista-mãe do catálogo (substitui o raio-x antigo de ~328 itens) |
| `precos-pre-os.json` | Preços por código loja (usado na classificação) |
| `pagleve-base-meta.json` | Resumo (cruzados vs só PRE_OS) |

Publicar catálogo web (match de fichas + fotos + HTML + deploy Vercel via push em `deploy/catalogo-pagleve/`):

```bash
npm run catalogo:publicar-pagleve
```

**Arielle:** marca no PDF 510; no catálogo grupo **Carmelo Fior**, filtro de marca **Arielle**; fichas buscam no site Carmelo/Arielle.

---

## Legado (referência)

| Arquivo | Conteúdo |
|---------|----------|
| `raio-x-pagleve-site-verificado.xlsx` | Planilha antiga (328 itens) — **não** é mais a lista-mãe |
| `precos-siah-fornecedor.csv` | OCR scans WhatsApp — substituído por `precos-pre-os.json` quando existir |

