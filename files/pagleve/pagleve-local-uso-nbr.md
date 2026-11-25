# PagLeve — local de uso (NBR como eixo comum)

**Escopo:** cerâmica apenas (não porcelanato). **Não altera preços.**

## Regra operacional

1. O catálogo PagLeve **normaliza sempre** o local de uso para o código **NBR de referência**: **LA, LB, LC, LD, LE** (e, quando aplicável, extensões documentadas por fabricante que também recebem código canónico ou alias — ver abaixo).
2. Cada fabricante expõe **a sua própria nomenclatura** no site/API; a tradução para NBR é **obrigatória** na classificação e na UI.
3. Gravar **dois níveis** por item quando houver enrichment:
   - `local_uso_fonte` — literal do fabricante (sigla + texto curto, se existir).
   - `local_uso_nbr` — código canónico (LA–LE ou mapeamento explícito da tabela abaixo).

Objetivo: filtros e árvore do catálogo falarem uma **única língua** (NBR), sem perder rastreio ao site oficial.

## Padrão NBR (referência)

| Código | Uso resumido (referência de mercado / ABNT) |
|--------|---------------------------------------------|
| **LA** | Paredes (não piso), salvo indicação explícita do fabricante para parede externa coberta |
| **LB** | Piso residencial interno, baixo tráfego, sem acesso a áreas externas |
| **LC** | Residencial interno amplo e/ou comercial interno, tráfego médio |
| **LD** | Alto tráfego; residencial/comercial; interno e, conforme fabricante, também externo |
| **LE** | Topo de uso: altíssimo tráfego e/ou externo plano (conforme texto do fabricante) |

> **PEI (SIAH/ERP)** não substitui local de uso NBR — são eixos independentes.

## Tradução por fabricante → NBR (cerâmica)

| Fabricante | Campo / rótulo no site | Códigos na fonte | Normalização PagLeve |
|------------|------------------------|------------------|----------------------|
| **Formigres** | `referencia` (API catálogo) | LA, LB, LC, LD, LE | **Copiar 1:1** para `local_uso_nbr` (sem glossário público longo na amostra) |
| **Carmelo Fior** | Atributo **Local de uso** | LA–LE + **LCI**, **LEI** | LA–LE → mesmo código; **LCI** → tratar como **LB** (residencial interno restrito); **LEI** → **LD** ou **LE** conforme texto (interno+externo molhado/tráfego pesado → preferir **LE** se externo severo) |
| **Grupo Rocha** | **Locais de Uso (LU)** no filtro/ficha | LA–LE + **LS** | LA–LE: mapear por **rótulo de tráfego** (LA sem tráfego → **LA** parede ou contexto ficha; LB pouco → **LB**; LC médio → **LC**; LD alto → **LD**; LE altíssimo → **LE**). **LS — Uso externo** → **`local_uso_nbr`: LE** (alias documentado `local_uso_fonte: LS`) |
| **Incopisos** | **Local de Uso** / filtro `local-de-uso` | LA–LE + **LF** | LA–LE → 1:1; **LF** (comercial interno baixo/médio) → **`local_uso_nbr`: LC** ou subtag comercial `LF` mantida em `local_uso_fonte` |
| **Lume** | **Indicação de uso** (códigos **L\***) | LX, LW, LQ, LZ, LH, LM, LP (tabela oficial no site) | Ver tabela Lume abaixo — **não** expor L\* como NBR na UI |

### Lume — códigos L\* → NBR

| Lume | Significado oficial (resumo) | `local_uso_nbr` sugerido |
|------|------------------------------|--------------------------|
| **LX** | Revestimento de paredes (int./ext. até 3 m) | **LA** |
| **LW** | Áreas internas residenciais, sem acesso externo | **LB** |
| **LQ** | Residencial/comercial/público, tráfego moderado, sem exigência antiderrapante | **LC** |
| **LZ** | Tráfego moderado residencial/comercial | **LC** |
| **LH** | Alto tráfego interno e externo | **LD** |
| **LM** | Externo com exigência de antiderrapante | **LE** |
| **LP** | Externo sem exigência de antiderrapante | **LE** |

Filtro de catálogo Lume **Áreas Internas / Áreas Externas** é eixo de navegação — **não** substitui `local_uso_nbr`.

## Extensões fora do conjunto LA–LE (manter na fonte)

| Código fonte | Fabricante | Regra |
|--------------|------------|--------|
| **LF** | Incopisos | `local_uso_fonte: LF`; NBR operacional **LC** (comercial interno) salvo revisão manual |
| **LCI** | Carmelo | `local_uso_fonte: LCI`; NBR **LB** |
| **LEI** | Carmelo | `local_uso_fonte: LEI`; NBR **LE** (ou **LD** se só interno+externo “normal”) |
| **LS** | Grupo Rocha | `local_uso_fonte: LS`; NBR **LE** (uso externo) |

## Ordem de aplicação no pipeline (quando João autorizar enrichment)

1. Confirmar **cerâmica** (excluir porcelanato).
2. Ler código/texto do fabricante → preencher `local_uso_fonte`.
3. Aplicar tabela acima → `local_uso_nbr`.
4. UI, filtros e sibling-match de **preços** continuam independentes — **esta regra não mexe em preços**.

## Documentação relacionada

- Observação multi-marca (textura + LU): store do agente `pagleve-manufacturer-labels-ceramics-only.md`
- Match no site / ordem de portais: `pagleve-fabricantes-sites-oficiais.md`
- Preços (bloqueado nesta fase): `pagleve-precos-sibling-match.md`

*Registado a partir da validação cruzada Formigres, Carmelo Fior, Grupo Rocha, Incopisos e Lume (nov/2026).*