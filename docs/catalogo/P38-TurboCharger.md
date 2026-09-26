# P38 · TurboCharger

**Nome canónico** do workbook Excel que será a **base de catálogo** (interface **Catálogo 4×3** alimentada **exclusivamente por Excel** nesta fase).

**Ficheiro alvo (export):** `docs/exports/P38-TurboCharger.xlsx`  
*(caracteres especiais no título da janela Excel: «P38 · TurboCharger»; no disco preferir hífen.)*

---

## Papel no ecossistema

| Camada | O quê |
|--------|--------|
| **TurboCharger** | Estrutura relacional 4×3, dropdowns, fact SKU — **fonte da UI 4×3** |
| **Supabase `produto`** | Cadastro operacional (preço, estoque, etc.) — **empresta dados na exportação**, não governa a árvore em live |
| **App** | Lê TurboCharger **publicado** (manifest/build), limitado ao Excel |

---

## Abas previstas (interligadas)

### Caminho «4» — classificação (listas suspensas)

| Aba | Conteúdo |
|-----|----------|
| `Dim_Etapa` | Etapas ordenadas |
| `Dim_Categoria` | FK etapa |
| `Dim_Sub` | FK categoria |
| `Dim_Linha` | FK sub; tipo LINHA (solo / mix / portfolio) quando aplicável |

Validação de dados: cada nível filho referencia a aba pai.

### «3» — elementos da descrição / grade

| Aba | Conteúdo |
|-----|----------|
| `Dim_ProdutoCompra` | comp1 por LINHA |
| `Dim_EixoA` / `Dim_EixoB` (ou `Dim_Componentes`) | comp2 / comp3 dependentes de comp1 |

Na fact sheet: três dropdowns (comp1 → comp2 → comp3).

### Fact — o que a UI monta

| Aba | Conteúdo |
|-----|----------|
| `Fact_Catalogo_4x3` | Uma linha por SKU: `codigo_interno`, FKs/códigos 4+3, `novo_sku`, flags catálogo |

### Snapshot operacional (Supabase → Excel)

| Aba | Conteúdo |
|-----|----------|
| `SKU_Completo` | Join por `codigo_interno`: nome cadastro, preços, estoque, fornecedor, unidade, ativo, … **Refresh na exportação**; edição humana opcional só em colunas marcadas |

### Apoio

| Aba | Conteúdo |
|-----|----------|
| `README` | Versão, data, comandos de publicar / export completo, regras de dropdown |

---

## Fluxos (futuros)

1. **Editar** TurboCharger (dims + fact) no Excel.  
2. **Publicar** → gera artefacto que o app consome (equivalente evoluído do `catalogo4x3Skus.generated.json`).  
3. **Export completo** → preenche/atualiza `SKU_Completo` a partir do Supabase antes de abrir o ficheiro.

---

## Migração desde o que existe

| Legado | TurboCharger |
|--------|----------------|
| `P38-sku-hierarquia-core.xlsx` | Alimenta ou funde-se nas `Dim_*` |
| `P38-catalogo-4x3.xlsx` | Vira `Fact_Catalogo_4x3` + dims explícitas |
| `export:catalogo-skus` | Lógica da aba `SKU_Completo` |

---

## Estado

- **Nome aprovado:** P38 · TurboCharger  
- **Implementação:** plano; workbook modelo e scripts de publish/export por fazer quando autorizado.
