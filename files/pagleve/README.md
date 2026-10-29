# PagLeve — catálogo virtual (PDF fábrica × PRE_OS)

**Regra:** entram no site **só** produtos que aparecem nos **PDFs de fábrica** (relatório 510 por marca) **e** têm **preço no PRE_OS**.  
Está no PRE_OS mas **não** está em Incopisos / Formigres / Carmelo Fior / Arielle / Rochaprime → **fora do catálogo**.

| Fonte | Ficheiro em `fonte/` | Papel |
|--------|----------------------|--------|
| **PDF fábrica (510)** | `formigres_*.pdf`, `rochaprime_*.pdf`, `carmelo_fior_*.pdf`, `arielle_*.pdf`, `incopisos_*.pdf` | **Quem entra** — código loja + origem + descrição |
| **PRE_OS** | `PRE_OS_0973.pdf` | **Preço/m²** (e confirma venda); estoque ignorado → disponível |

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

