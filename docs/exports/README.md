# Exportações do catálogo

## Excel mestre (João) — cerâmica CERAM

| Ficheiro | Descrição |
|----------|-----------|
| [../P38-catalogo-skus-completo.xlsx](../P38-catalogo-skus-completo.xlsx) | Mestre com colunas LINHA, produto_compra, ex_a, ex_b (upload GitHub) |

Laboratório modelo — **piloto cerâmica** (só **CERÂMICA BOLD** + **CERÂMICA RETIF**, prefixo `CERAM`, sem zumbis).

Próximo piloto mix (ainda não activo): conexões **ESGOTO** e **SOLDÁVEL**.

Regras por **LINHA** (defaults): **12 posições**, massa crítica **16 cx**, **saldável** se ≥ **9** linhas com massa. Cada **produto compra** pode **sobrescrever** (null = herda).

---

## Catálogo completo — export automático Supabase

| Ficheiro | Colunas |
|----------|---------|
| [P38-catalogo-skus-completo.xlsx](./P38-catalogo-skus-completo.xlsx) | categoria · codigo interno · h1–h5 · descrição completa (sku) · estoque atual |

Regenerar: `npm run export:catalogo-skus`

---

## LINHAS mestre — aprovação (próximo passo BD)

Tabela **LINHA** + tipo (solo/mix/portfolio) antes de SQL. Marque **STATUS** na folha.

| Ficheiro | Descrição |
|----------|-----------|
| [P38-linhas-mestre-aprovacao.xlsx](./P38-linhas-mestre-aprovacao.xlsx) | Lista de linhas para aprovar + mapa h1→LINHA + amostra SKUs |

Regenerar: `npm run export:linhas-mestre`

**Download directo:**  
https://github.com/joaoandreriberopacheco-netizen/P38-ERP/raw/main/docs/exports/P38-linhas-mestre-aprovacao.xlsx

---

## Análise LINHA de compra (modelo completo — referência)

Modelo: **LINHA** → **produto de compra** → **eixos A×B** + marca.  
Ex.: h1=JOELHO + h2=SOLDÁVEL → LINHA **CONEXÃO SOLDÁVEL**, produto de compra **JOELHO 90° SOLDÁVEL**, eixo B = medida.

| Ficheiro | Descrição |
|----------|-----------|
| [P38-analise-linhas-compra.xlsx](./P38-analise-linhas-compra.xlsx) | 5 abas: resumo linhas, produtos de compra, mapa h1→LINHA, detalhe SKUs |

Regenerar: `npm run export:analise-linhas`

**Download directo:**  
https://github.com/joaoandreriberopacheco-netizen/P38-ERP/raw/main/docs/exports/P38-analise-linhas-compra.xlsx

---

## Inventário h1 por categoria (cadastro actual)

| Ficheiro | Descrição |
|----------|-----------|
| [P38-linhas-catalogo-por-categoria.xlsx](./P38-linhas-catalogo-por-categoria.xlsx) | campo hierárquico 1 por categoria (legado) |
| [P38-linhas-catalogo-por-categoria.csv](./P38-linhas-catalogo-por-categoria.csv) | Mesmo em CSV |

Regenerar: `npm run export:linhas-categoria`

---

## Catálogo modelo 3×3 — monitor Smart Supply

Excel canónico para **drill-down 3×3** (categorias + componentes SKU). Tags ficam para fase posterior.

| Ficheiro | Descrição |
|----------|-----------|
| [P38-catalogo-3x3.xlsx](./P38-catalogo-3x3.xlsx) | README · Categorias 3× · Componentes ×3 · Catálogo 3×3 · Pivot metadados |

**Download directo:**  
https://github.com/joaoandreriberopacheco-netizen/P38-ERP/raw/main/docs/exports/P38-catalogo-3x3.xlsx

Regenerar:

```bash
npm run export:catalogo-3x3
```

Modelo:

- **Cat1 → Cat2 → Cat3** — ex.: `A. Edificações > 01. Alvenaria > a. Armaduras`
- **Comp1 | Comp2 | Comp3** — ex.: `Estribo | 7×17 | (vazio)`

---

## Estudo hierarquia — Excel unificado (legado multi-aba)

Um único ficheiro com **aba README** (índice) e todas as folhas do estudo A/B/C, catálogo core e benchmark Leroy Merlin.

| Ficheiro | Descrição |
|----------|-----------|
| [P38-sku-hierarquia-unificado.xlsx](./P38-sku-hierarquia-unificado.xlsx) | README + Resumo + A/B/C + Catálogo core + Benchmark elétrica + legendas |

**Download directo:**  
https://github.com/joaoandreriberopacheco-netizen/P38-ERP/raw/main/docs/exports/P38-sku-hierarquia-unificado.xlsx

Fontes (mantidas em `docs/exports/` para regenerar):

- `P38-sku-hierarquia-ab.xlsx`
- `P38-sku-hierarquia-core.xlsx`
- `P38-eletrica-benchmark-lm.xlsx`

Regenerar:

```bash
npm run export:sku-hierarquia-unificado
```
