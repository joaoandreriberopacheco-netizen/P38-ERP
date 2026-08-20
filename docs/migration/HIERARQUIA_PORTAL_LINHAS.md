# Hierarquia portal P38 — LINHAs mestre

Modelo alvo do catálogo portal (pós-migração h1–h5 legado).

**Leitura de negócio:** [`MODELO_AGRUPAMENTO_P38.md`](MODELO_AGRUPAMENTO_P38.md) — solo vs composto, mix/portfolio/solo, diferença vs Leroy Merlin.

```
LINHA → produto compra → eixo A → eixo B → novo SKU
```

## Fonte canónica

| Ficheiro | Papel |
|----------|--------|
| [`src/data/hierarquiaPortalLinhas.json`](../src/data/hierarquiaPortalLinhas.json) | Lista mestre de LINHAs + princípios |
| [`scripts/lib/hierarquiaPortalLinhas.mjs`](../scripts/lib/hierarquiaPortalLinhas.mjs) | Loader Node (export, benchmark) |
| [`scripts/lib/inferencia*.mjs`](../scripts/lib/) | Regras que **atribuem** cada SKU a uma LINHA |

## Princípios (lente de aprendizado)

1. **LINHA = família do produto** — THINNER, PARAFUSO, ESGOTO… — **não** a categoria ERP (`categoria_atual`).
2. **Sem LINHA TUBO genérica** — tubo vai para ESGOTO / SOLDÁVEL / ROSCÁVEL / ELETRODUTO.
3. **Peças avulsas** (joelho, luva, tee, cap…) na **LINHA da conexão**.
4. **Químicos de pintura** — mesma LINHA por tipo; **produto compra** distingue marca/receita (ex.: thinner 237 ≠ 2750).
5. **Fixação** (LM: Ferragens > Fixação) → **PARAFUSO** ou **PREGO** — barra roscada, bucha, porca; **FERRAGEM** fica para fechaduras, dobradiças, discos.

## Tipos de LINHA

| `tipo` | Significado |
|--------|-------------|
| `portfolio` | Árvore com produtos compra + eixos (cerâmica, tintas, thinner…) |
| `mix` | Produto compra + eixos variáveis |
| `solo` | LINHA = SKU único (prego, OUTROS) |

## Grupos lógicos (`grupo` no JSON)

- `materiais_construcao`, `revestimentos`, `hidraulica`, `hidraulica_eletrica`, `pintura`, `fixacao`, `eletrica`, `ferragens`, `ferramentas_acabamento`, `fallback`

## Comandos de validação

```bash
npm run export:sku-hierarquia-estudo -- --format=both
npm run benchmark:leroy-merlin
npm run benchmark:leroy-merlin -- --only-divergencias
npm run build
```

Benchmark LM: [`LEROY_MERLIN_BENCHMARK_CATALOGO.md`](LEROY_MERLIN_BENCHMARK_CATALOGO.md)

## Export com camada CORE (pathway obra)

Estudo Excel delimitado — **5 camadas + 3 identificadores**:

```text
etapa → core → linha(·N|·C|·R) → produto_compra → eixo_a → eixo_b
codigo_interno | novo_sku | sku_atual
```

- **Subfolha Etapas:** categorias ERP renomeadas por etapa
- **Legenda linha:** `·N` núcleo, `·C` complemento, `·R` receita pronta (ex.: aditivo → `PINTURA E QUÍMICOS·C`)
- **Sem** `categoria_atual`, `papel_core` nem `h1–h3` na folha principal

```bash
npm run export:sku-hierarquia-core
```

Saída: `docs/exports/P38-sku-hierarquia-core.xlsx`

| Ficheiro | Papel |
|----------|--------|
| [`scripts/lib/inferenciaCoreObra.mjs`](../../scripts/lib/inferenciaCoreObra.mjs) | Inferência `core` |
| [`scripts/lib/etapaCategoriaMap.mjs`](../../scripts/lib/etapaCategoriaMap.mjs) | Etapas + glitch linha |
| [`src/data/etapaCategoriaMap.json`](../../src/data/etapaCategoriaMap.json) | Mapa categorias ERP → etapa |

## Cerâmica piloto

As LINHAs `CERAMICA_BOLD` e `CERAMICA_RETIF` vêm também do manifest Excel (`portal-excel-manifest.snapshot.json`). O loader **mescla** manifest + mestre para os ~174 SKUs do piloto.

## Evolução

Ao acrescentar LINHA nova:

1. Editar `src/data/hierarquiaPortalLinhas.json`
2. Acrescentar regra em `inferenciaLinhaPorTipo.mjs` ou `inferenciaHierarquiaEstudo.mjs`
3. Regenerar export + benchmark
