# Exportações do catálogo

## LINHAS mestre — aprovação (próximo passo BD)

Tabela **LINHA** + tipo (solo/mix/portfolio) antes de SQL. Marque **STATUS** na folha.

| Ficheiro | Descrição |
|----------|-----------|
| [P38-linhas-mestre-aprovacao.xlsx](./P38-linhas-mestre-aprovacao.xlsx) | **15 linhas enxutas** (chave comum h2, ex. SOLDÁVEL) + mapa h1+h2→LINHA + exemplo SOLDÁVEL |

Regenerar: `npm run export:linhas-mestre`

**Download directo:**  
https://github.com/joaoandreriberopacheco-netizen/varejosync/raw/main/docs/exports/P38-linhas-mestre-aprovacao.xlsx

---

## Análise LINHA de compra (modelo completo — referência)

Modelo: **LINHA** → **produto de compra** → **eixos A×B** + marca.  
Ex.: h1=JOELHO + h2=SOLDÁVEL → LINHA **CONEXÃO SOLDÁVEL**, produto de compra **JOELHO 90° SOLDÁVEL**, eixo B = medida.

| Ficheiro | Descrição |
|----------|-----------|
| [P38-analise-linhas-compra.xlsx](./P38-analise-linhas-compra.xlsx) | 5 abas: resumo linhas, produtos de compra, mapa h1→LINHA, detalhe SKUs |

Regenerar: `npm run export:analise-linhas`

**Download directo:**  
https://github.com/joaoandreriberopacheco-netizen/varejosync/raw/main/docs/exports/P38-analise-linhas-compra.xlsx

---

## Inventário h1 por categoria (cadastro actual)

| Ficheiro | Descrição |
|----------|-----------|
| [P38-linhas-catalogo-por-categoria.xlsx](./P38-linhas-catalogo-por-categoria.xlsx) | campo hierárquico 1 por categoria (legado) |
| [P38-linhas-catalogo-por-categoria.csv](./P38-linhas-catalogo-por-categoria.csv) | Mesmo em CSV |

Regenerar: `npm run export:linhas-categoria`
