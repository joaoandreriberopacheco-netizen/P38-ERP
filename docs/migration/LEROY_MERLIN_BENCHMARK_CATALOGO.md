# Benchmark catálogo — Leroy Merlin vs P38

Objetivo: o agente (ou tu) **ganha contexto no site da Leroy Merlin**, vê **como eles agrupam** produtos, e **compara** com os nossos SKUs (`categoria_atual` ERP + `linha` portal inferida).

## Exemplo que motivou isto

| Produto | Nosso ERP | Inferência antiga | Leroy Merlin |
|---------|-----------|-------------------|--------------|
| BARRA ROSCADA ZINCADA | A - Materiais Básicos / J - Ferramentas | LINHA **FERRAGEM** | **Ferragens → Fixação → Barras Roscadas** (junto aos parafusos) |

Correcção portal: **LINHA PARAFUSO**, produto compra **BARRA ROSCADA ZINCADA**.

## Árvore LM — Fixação (referência)

```
Ferragens
└── Ferragens para Fixação e Montagem
    ├── Parafusos
    ├── Barras Roscadas
    ├── Buchas de Parafuso
    ├── Porcas e Arruelas
    ├── Pregos
    └── Chumbadores / Parabolt
```

URLs úteis (BR):

- https://www.leroymerlin.com.br/barras-roscadas
- https://www.leroymerlin.com.br/ferragens/ferragens-para-fixacao-e-montagem

## Comandos

```bash
# 1. Export actual com categoria_atual + hierarquia inferida
npm run export:sku-hierarquia-estudo -- --format=both

# 2. Benchmark vs referência LM (gera CSV comparativo)
npm run benchmark:leroy-merlin

# 3. Só divergências (nossa LINHA ≠ família LM sugerida)
npm run benchmark:leroy-merlin -- --only-divergencias
```

**Saída:** `docs/exports/P38-leroy-merlin-benchmark.csv`

## Colunas do benchmark

| Coluna | Significado |
|--------|-------------|
| `categoria_atual` | Gaveta ERP hoje (A, C, G…) |
| `linha_nossa` | LINHA portal inferida |
| `lm_departamento` | Departamento LM (ex. Ferragens) |
| `lm_caminho` | Breadcrumb LM sugerido |
| `lm_familia` | Família LM (ex. Barras Roscadas) |
| `linha_portal_sugerida` | LINHA que bate com LM |
| `divergencia_linha` | **SIM** = revisar regra |
| `lm_url_pesquisa` | Link para o agente abrir no browser |

## Workflow step-by-step (agente ou humano)

1. Correr os dois comandos acima.
2. No Excel, filtrar `divergencia_linha = SIM`.
3. Por linha, abrir `lm_url_pesquisa` e confirmar o **breadcrumb** real no site.
4. Se LM agrupa diferente → ajustar `scripts/lib/inferenciaLinhaPorTipo.mjs` ou `leroyMerlinReferencia.mjs`.
5. Regenerar export e benchmark até a lista de divergências encolher.

## Onde vive a lógica

| Ficheiro | Papel |
|----------|--------|
| `scripts/lib/leroyMerlinReferencia.mjs` | Regras LM + LINHA portal sugerida |
| `scripts/benchmark-leroy-merlin-estudo.mjs` | Gera CSV comparativo |
| `scripts/lib/inferenciaLinhaPorTipo.mjs` | Inferência portal (THINNER, PARAFUSO, …) |

## Limitações

- **Não faz scrape** automático do site LM (timeout/bloqueio frequente). A referência é **manual + URLs de pesquisa** para visita guiada.
- Regras LM cobrem primeiro **fixação, hidráulica, tintas** — expandir família a família.
- `categoria_atual` (ERP) **não manda** na LINHA portal — serve só para comparar camadas.
