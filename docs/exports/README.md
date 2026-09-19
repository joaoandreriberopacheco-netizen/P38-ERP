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

## Estudo hierarquia — blocos A (Edificações) e B (Instalações / hidráulica)

Excel para revisão do estudo **sem UI**. Organiza o catálogo core em dois macro-blocos.

| Ficheiro | Descrição |
|----------|-----------|
| [P38-sku-hierarquia-ab.xlsx](./P38-sku-hierarquia-ab.xlsx) | **Resumo** + folha **A — Edificações** + **B — Instalações (hidráulica)** + legenda |
| [P38-sku-hierarquia-core.xlsx](./P38-sku-hierarquia-core.xlsx) | Catálogo completo delimitado (etapa → core → linha → produto compra) |

Regenerar:

```bash
npm run export:sku-hierarquia-core -- --skip-regen   # se CSV estudo já existir
npm run export:sku-hierarquia-ab
```

**A — Edificações:** etapas 1 (alvenaria), 2 (cobertura), 4 (revestimentos), 6 (acabamento seco).

**B — Hidráulica:** sub-ramos 01 Soldável · 02 Esgoto · 03 Roscável · 04 Captação · 05 Componentes.

**B — Elétrica (até caixa de espera):** 06 Padrão · 07 Infra · 08 Quadro · 09 Caixas de espera. Tomada/lâmpada → folha **C prévia**.

Fora deste export (próximos passos): banheiro (torneira/louça), transversal.

---

## Benchmark elétrica vs Leroy Merlin (mix básico)

Compara folha **B — Elétrica** com matriz núcleo LM (disjuntores, quadros, fios, eletroduto, caixinhas).

| Ficheiro | Descrição |
|----------|-----------|
| [P38-eletrica-benchmark-lm.xlsx](./P38-eletrica-benchmark-lm.xlsx) | Resumo · Matriz · **Falta cadastrar** · Já temos · Inventário P38 |

Regenerar (após `export:sku-hierarquia-ab`):

```bash
npm run benchmark:leroy-eletrica
```
