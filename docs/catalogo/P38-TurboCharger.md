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

### Listas (dropdowns — uma aba horizontal)

| Coluna na aba `Listas` | Conteúdo |
|------------------------|----------|
| A — ETAPA | Etapas ordenadas |
| B — CATEGORIA | Categorias (lista plana v0) |
| C — SUBCATEGORIA | Subcategorias |
| D — LINHA | Linhas (solo / mix / portfolio no futuro) |
| E — PRODUTO COMPRA | comp1 |
| F — EIXO A | comp2 |
| G — EIXO B | comp3 |

Validação na `Fact_Catalogo_4x3`:

- **ETAPA** → lista fixa (`Listas!$A$2:$A$n`).
- **CATEGORIA → EIXO B** → dropdowns **dependentes** (OFFSET + MATCH + COUNTIF) sobre blocos **Cascata** na mesma aba (colunas I em diante): só aparecem valores válidos para ETAPA / caminho já escolhido.

Chave composta entre níveis: `etapa · categoria · sub · …` ( separador **` · `** — ponto médio, igual à legenda do catálogo ).

Para **novos** pares pai→filho: acrescente linhas no bloco cascata correspondente (mesma chave pai repetida, novo valor na coluna «Valor permitido») ou regenere com `npm run turbocharger:generate`.

Na fact sheet: sete dropdowns encadeados (4 + 3) mais nome vitrine e colunas calculadas.

### Fact — o que a UI monta

| Aba | Conteúdo |
|-----|----------|
| `Fact_Catalogo_4x3` | Uma linha por SKU: `codigo_interno`, FKs/códigos 4+3, `novo_sku`, `sku_atual` (SKU antigo do cadastro), códigos/legenda |

### Snapshot operacional (Supabase → Excel)

| Aba | Conteúdo |
|-----|----------|
| `SKU_Completo` | Join por `codigo_interno`: nome cadastro, preços, estoque, fornecedor, unidade, ativo, … **Refresh na exportação**; edição humana opcional só em colunas marcadas |

### Apoio

| Aba | Conteúdo |
|-----|----------|
| `README` | Versão, data, comandos de publicar / export completo, regras de dropdown |

---

## Fluxo de revisão (editar → anexar → aplicar)

1. **Editar** no Excel: classificação 4×3, `novo_sku`, etc.  
2. **Observações (revisão)** — coluna no fim da `Fact_Catalogo_4x3` (fundo âmbar claro): suas notas («mover para linha X», «confirmar com fornecedor», …). **Não publica** no catálogo; serve para quando **anexar** o ficheiro e pedir para **aplicar** as mudanças.  
3. **Regenerar** com `npm run turbocharger:generate` **mantém** o texto das observações já gravado no TurboCharger anterior (por `codigo_interno`).  
4. **Publicar / aplicar** (próximo passo no repo): importar a Fact e materializar alterações — observações entram só como guia, salvo combinarmos regras explícitas.

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

## Design (importador em massa)

Mesma linguagem visual do **Exportar Produtos** (`ImportacaoProdutos` → `ExportarPlanilha.jsx`):

- Cabeçalho linha 1: fundo `#1F2937`, texto branco, negrito, filtro automático  
- Células **editáveis** (Fact + Dim): fundo `#F9FAFB`  
- Células **Supabase / calculado** (`SKU_Completo`): fundo azul `#E0F2FE`, texto itálico  
- Abas **Dim_***: fundo verde suave — listas para dropdowns  
- **Fact_Catalogo_4x3**: validação tipo lista apontando para cada aba Dim  

## Comandos

```bash
npm run turbocharger:generate          # gera docs/exports/P38-TurboCharger.xlsx (seed do 4×3)
npm run turbocharger:generate:full     # + preenche SKU_Completo via DATABASE_URL
```

## Estado

- **Ficheiro:** `docs/exports/P38-TurboCharger.xlsx` (gerado pelo script)  
- **App:** ainda lê `P38-catalogo-4x3` / JSON — ligar ao TurboCharger num passo seguinte
