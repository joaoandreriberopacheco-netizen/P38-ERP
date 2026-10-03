# Modelo de agrupamento P38 (portal)

Referência de **como o P38 pensa o catálogo** — distinto da árvore da Leroy Merlin.

## Leroy Merlin vs P38

| | **Leroy Merlin** | **P38 portal** |
|---|------------------|----------------|
| Lógica | Navegação de loja (departamento → categoria → família) | **Composição de SKU** + agrupamento operacional |
| Unidade | Onde o site coloca o produto | **LINHA** → como encomendas e geres stock |
| Exemplo | Ferragens > Fixação > Barras Roscadas | LINHA **PARAFUSO** → produto compra **BARRA ROSCADA ZINCADA** → eixos |
| Papel | Benchmark de mercado (referência) | **Modelo alvo** do cadastro |

A LM responde: *"onde o cliente procura no site?"*  
O P38 responde: *"como este SKU se compõe e em que família de compra vive?"*

---

## Estrutura do modelo P38

```
LINHA  (mix | portfolio | solo)
  └── produto compra  (só em compostos)
        └── eixo A
              └── eixo B   →  novo SKU
```

**Fórmula do SKU composto:**

```
novo SKU = produto compra + eixo A + eixo B
```

Máximo **dois eixos**. Nem todo SKU precisa dos dois.

---

## Produto **solo** vs **composto**

| | **Solo** | **Composto** |
|---|----------|--------------|
| Ideia | O item **é** a família; pouca ou nenhuma decomposição | SKU **montado** a partir de partes nomeadas |
| Composição | LINHA (± eixos simples) | produto compra + eixo A + eixo B |
| Exemplo | PREGO, alguns itens em OUTROS | THINNER LUKSNOVA 237 900ML |
| No export | `tipo: solo` na LINHA → produto compra vazio | produto compra preenchido |

**Solo** = "já sei o que é só pelo tipo; não preciso de árvore de produto compra."  
**Composto** = "preciso de produto compra + variações (medida, cor, decorado…) para formar o SKU."

---

## LINHA: o agrupamento central

**LINHA** = família de produto (tipo), **não** categoria ERP.

Cada LINHA tem um **`tipo`** que define **como ela se comporta**:

| `tipo` da LINHA | Comportamento | Quando usar |
|-----------------|---------------|-------------|
| **`portfolio`** | Várias **produtos compra** sob a mesma família; árvore rica | Cerâmica, tintas, thinner, torneiras |
| **`mix`** | Produtos compra + eixos, estrutura mais directa | Hidráulica (ESGOTO, SOLDÁVEL), parafusos, cimento |
| **`solo`** | A LINHA **é** o produto; SKU ≈ família | Prego, OUTROS / a classificar |

A LINHA **também** é mix, portfolio ou solo — o mesmo vocabulário aplica-se ao **agrupamento** e ao **formato do SKU**.

---

## Exemplos por tipo de LINHA

### LINHA `portfolio` — THINNER

- **Uma LINHA** para todos os thinners (família química)
- **Produtos compra** distintos: THINNER LUKSNOVA 237, THINNER ANJO 2750…
- **Eixo A** = embalagem (900ML, 5L…)
- Mesma lógica: TINTA, VERNIZ, CERÂMICA BOLD

### LINHA `mix` — ESGOTO

- Tubos **e** peças (joelho, luva, tee, cap) na **mesma LINHA**
- **Produto compra** = tipo de peça (TUBO ESGOTO, TE ESGOTO, JOELHO ESGOTO…)
- **Eixos** = diâmetro, redução, etc.
- **Não existe** LINHA "TUBO" genérica

### LINHA `mix` — PARAFUSO

- Família **fixação**: parafuso, barra roscada, bucha, porca
- Produto compra distingue o tipo de fixação
- Eixos = medida, rosca, acabamento

### LINHA `solo` — PREGO

- LINHA = prego
- Variações nos eixos ou no próprio nome; sem árvore de produto compra

---

## Regras de agrupamento (lente P38)

1. **LINHA = tipo de produto**, não gaveta ERP (`categoria_atual`).
2. **Compostos** usam produto compra + até 2 eixos.
3. **Solos** ficam em LINHA `solo` ou com mínima decomposição.
4. **Tubo e peça** → LINHA do **sistema** (ESGOTO, SOLDÁVEL, ROSCÁVEL, ELETRODUTO).
5. **Químicos** → LINHA por **tipo** (THINNER ≠ TINTA); marca/receita no **produto compra**.
6. **LM** serve para **validar** famílias de mercado; o P38 pode ser **mais fino** (ex.: ARGAMASSA separada de CIMENTO).

---

## Onde vive no repo

| Artefacto | Conteúdo |
|-----------|----------|
| [`src/data/hierarquiaPortalLinhas.json`](../src/data/hierarquiaPortalLinhas.json) | LINHAs mestre + `tipo` + `grupo` |
| [`scripts/lib/inferencia*.mjs`](../../scripts/lib/) | Atribui cada SKU legado → LINHA + composição |
| [`HIERARQUIA_PORTAL_LINHAS.md`](HIERARQUIA_PORTAL_LINHAS.md) | Comandos e evolução técnica |
| [`LEROY_MERLIN_BENCHMARK_CATALOGO.md`](LEROY_MERLIN_BENCHMARK_CATALOGO.md) | Comparação com LM (referência externa) |

---

## Perguntas ao classificar um SKU

1. É **solo** ou **composto**?
2. Se composto: qual **produto compra**? quais **eixos** (0, 1 ou 2)?
3. Em que **LINHA** (família)? Qual o **`tipo`** dela — portfolio, mix ou solo?
4. Agrupa com **sistema** (esgoto/soldável) ou com **tipo químico** (thinner) ou **fixação** (parafuso)?
