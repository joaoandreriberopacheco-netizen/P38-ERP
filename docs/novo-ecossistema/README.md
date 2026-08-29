# Novo Ecosistema — catálogo + Smart Supply (preview Compras)

Documento de **intenção** para agentes e equipa. Resume o que foi decidido nas conversas de desenho deste preview (branch `cursor/catalogo-smart-supply-ui-3291`, PR #596).

## Porquê existe

João André pediu **um lugar único em Compras** para experimentar o futuro catálogo e a visão Smart Supply **sem bagunçar** Produtos, Sugestões nem o portal cerâmica antigo. O objectivo é validar **navegação mobile**, **leitura da informação crucial** (LINHA, tipo, estoque/alerta) e a **hierarquia de SKUs** antes de ligar à produção.

## Onde vive no menu (canónico)

```
Compras
└── Novo Ecosistema          ← grupo expandível (única entrada)
    ├── Novo Catálogo        → /CatalogoNovo
    └── Smart Supply         → /SmartSupplyNovo
```

**Não** voltar a pôr atalhos soltos em Produtos, Compras (header), Sugestões ou portal clássico. O portal `HierarquiaPortal` e `ModeloCatalogo` são **legado piloto cerâmica** — mantêm-se por URL/permissão, mas o produto novo concentra-se aqui.

## Dois ecrãs, uma intenção

| Ecrã | Rota | Job do utilizador |
|------|------|-------------------|
| **Novo Catálogo** | `CatalogoNovo` | **Explorar** compras: abas **Solo / Mix / Portfolio** (comportamentos separados) + **Pathway** (árvore da obra) ou **Plano SKU** (grade linear). |
| **Smart Supply** | `SmartSupplyNovo` | **Decidir reposição**: visão por LINHA, esquadras saldáveis, estoque, ponto futuro, filtro “só alertas”, tabs Mobile / Mix / Portfolio. |

Shell partilhado: `src/components/catalogo-novo/CatalogoNovoShell.jsx` (`mode="catalog"` | `mode="supply"`).

### Duas leituras do mesmo catálogo (não é capricho)

| Vista | Para quê |
|-------|----------|
| **Pathway** | Administrar como a **obra** — bloco → ramo → core → LINHA; tabela de valores por LINHA. |
| **Plano SKU** | **Grade linear** — um SKU por linha (auditoria, cadastro, conversão legado). |

Ambas usam o **mesmo Excel/manifest**. Quem começa do zero numa plataforma “redondinha” entra já com as duas vistas; quem migra mix legado usa **Plano SKU** para conferir SKU a SKU e **Pathway** para validar a distribuição nova.

No **mobile**, alternar entre os dois com **tabs no topo** (sem voltar ao menu). Filtros pesados ficam num **bottom sheet** para não roubar espaço à lista.

## Dados — regra de ouro

- **Fonte canónica:** Excel de estudo `docs/exports/P38-sku-hierarquia-ab.xlsx` — **actualizar o Excel** quando a lógica de distribuição mudar (sem overrides JSON no build).
- Regenerar manifest: `npm run estudo:catalog-manifest` (corre também no `npm run build`).
- Mestre de LINHAs (solo/mix/portfolio): `src/data/hierarquiaPortalLinhas.json` — tipos de comportamento, cruzado com coluna `linha` do Excel.
- Manifest gerado: `src/data/estudoCatalogManifest.generated.json`.
- Hook: `useCatalogoEstudoData` — hierarquia Excel + **estoque real** do cadastro; fallback simulado sem match.

### Hierarquia de negócio (estudo A / B / C)

- **A** — edificações / estrutura (ex.: impermeabilizante pertence aqui, **não** em acabamentos).
- **B** — hidráulica, eléctrica, etc.
- **C** — acabamentos visíveis (pintura, revestimentos, banheiro…).

Árvore UI (alvo): `bloco → sub_bloco → grupo → core → papel pathway → LINHA → produto_compra → SKU`.

**Bloco B — Instalações** (decisão recente, prioridade sobre legado B01–B09 plano):

```
B — Instalações
├─ B1 — Hidráulica
│   ├─ C&C — Canos e Conexões · Soldável
│   ├─ C&C — Canos e Conexões · Esgoto
│   ├─ C&C — Canos e Conexões · Roscável
│   ├─ Captação
│   └─ Componentes
└─ B2 — Elétrica
    ├─ Padrão de entrada
    ├─ Infra (eletroduto e fios)
    ├─ Quadro e proteção
    └─ Caixas de espera
```

Colunas Excel (folhas B): `sub_bloco` = B1/B2; `grupo` + `grupo_ordem` = camada C&C ou etapa eléctrica. Blocos A/C mantêm `grupo` vazio (core directo sob sub-bloco).

### Pathway, core e papéis ·N / ·C / ·R (Excel AB)

Organização da **obra** no Excel (`P38-sku-hierarquia-ab.xlsx`, folha **Legenda A-B**):

| Camada | Coluna / sufixo | Significado | Exemplo mental |
|--------|-----------------|-------------|----------------|
| **Bloco** | `bloco` | Grande fase A/B/C | `A — Edificações` |
| **Sub-bloco** | `sub_bloco` | Ramo dentro do bloco | `A1 Estrutura / alvenaria`, `B1 — Hidráulica` |
| **Grupo** | `grupo` | Agrupamento dentro do ramo (B) | `C&C — Canos e Conexões · Soldável` |
| **Core** | `core` | Núcleo funcional do pathway | `ALVENARIA`, `ARMADURA`, `COBERTURA` |
| **Papel na LINHA** | sufixo `·N` / `·C` / `·R` na coluna `linha` | Papel dentro do core | ver abaixo |
| **LINHA mestre** | nome sem sufixo → `hierarquiaPortalLinhas.json` | Família + tipo solo/mix/portfolio | `CIMENTO`, `ARGAMASSA` |

**Sufixos na coluna `linha` (pathway):**

| Sufixo | Papel | O que João descreveu | Exemplo no Excel |
|--------|-------|----------------------|------------------|
| **·N** | **Núcleo** do pathway | `alvenaria.core` | `CIMENTO·N`, `MATERIAIS BÁSICOS·N` (areia, bloco) |
| **·C** | **Complemento** | `alvenaria.complementos` / consumíveis da etapa | `MATERIAIS BÁSICOS·C` (compensado, cal), `ADESIVO·C` |
| **·R** | **Receita pronta** | argamassa industrializada (assentamento — **bloco C**, não alvenaria A) | `ARGAMASSA·R` (AC-1, AC-2…) |

**Exemplo concreto — core `ALVENARIA` (A1):**

```
A1 Estrutura / alvenaria
└── ALVENARIA (core)
    ├── ·N núcleo     → CIMENTO·N, MATERIAIS BÁSICOS·N
    └── ·C complemento → MATERIAIS BÁSICOS·C, **ADITIVO** (plastificante — fica em Edificações)
```

**Assentamento (bloco C — Acabamentos):** `ARGAMASSA` (mix), `REJUNTE` (portfolio), cerâmicas (portfolio) — sub-bloco `C1 Revestimentos`, core `ASSENTAMENTO_CERAMICA`.

**Pintura (bloco C — Acabamentos):** sub-bloco `C2 Pintura`. **TINTA SPRAY** e **TINTA SPRAY METÁLICO** são LINHAs portfolio no Excel. Aditivos em `ALVENARIA·C` ficam em Edificações (folha A).

### Folhas Excel (estudo AB)

| Folha | Conteúdo |
|-------|----------|
| `A — Edificações` | Estrutura, cobertura, aditivos alvenaria… |
| `B — Hidráulica` / `B — Elétrica` | Instalações |
| `C — Acabamentos (prévia)` | Revestimentos (C1) + pintura (C2) |
| `C prévia — elétrica visível` | Acabamentos eléctricos visíveis |

**Fluxo:** editar Excel → `npm run estudo:catalog-manifest` → preview UI. Até ao corte/migração produção, o Excel é a base viva.

**Consumíveis transversais:** categoria ERP `J — FERRAMENTAS E CONSUMÍVEIS` (etapa 8) é **transversal** — distinto dos complementos **·C** dentro de um core (ex.: aditivo na alvenaria).

**Estado no preview UI:** árvore com níveis **bloco → sub-bloco → grupo (B) → core → pathway (N/C/R) → LINHA → produto compra → SKU**. Estoque real vem do cadastro (`codigo_interno`); SKUs sem match mantêm estoque simulado.


**Solo, mix e portfolio não são etiquetas.** Definem **como a reposição e a grelha funcionam**.

| Tipo | Comportamento | Exemplo |
|------|---------------|---------|
| **solo** | **Não precisa de mix nem de variedade.** Compra-se o item; não monta esquadra. | **CIMENTO PORTLAND** — o saco; sem grelha de peças. |
| **mix** | **Esquadra** no produto compra — várias referências que **completam** a LINHA, mas **não são substituíveis** (cada peça/medida conta). | **JOELHO SOLDÁVEL** · **PREGO** |
| **portfolio** | **Substituíveis** dentro do mesmo produto compra ou da LINHA — troca formato/modelo/cor. | **Cerâmicas**, **rejunte** (cores) |

**Onde está escrito:** `src/data/hierarquiaPortalLinhas.json` (`tipo` + `principios`).  
**No Excel AB:** coluna `linha` → cruza com a mestre; **não** há coluna solo/mix/portfolio na folha (só `status_mix`, que é outra regra).

Filtro `PortalTipoFilter` + chips na lista e no Smart Supply aplicam este comportamento na UI.

## Visual — o que copiar

Inspiração **primária:** lista **Embarques** — linhas finas (1px), vlines por nível, **LEDs 1.5px** à esquerda, hierarquia L0–L3.

Paleta **cítrico (claro) / oliva-caixa (dark):** tokens em `src/lib/catalogoP38Theme.js`.

**Mobile — calma e legibilidade:** alinhar *feeling* com **Planejamento financeiro** dark (carvão + acento parcimonioso), ver `docs/p38-mobile-rollout.md` §0 e `.cursor/rules/p38-mobile-referencia-planejamento.mdc`. Margem = linhas densas; Planejamento = composição + CTA + hierarquia calma.

### Informação crucial (sempre visível ou a 1 toque)

1. **Nome da LINHA** e tipo (solo/mix/portfolio).
2. **LED** semântico (ok / alerta / ruptura / ponto futuro negativo).
3. **Estoque** (label tabular) — no preview, simulado mas consistente.
4. Smart Supply: **esquadras saldáveis**, **ponto futuro**, contagem de SKUs.
5. Mobile: **KPI compacto** no rodapé + contagem total de SKUs no header.

## Relação com produção

| Módulo | Estado |
|--------|--------|
| **SMART SUPPLY produção** | Continua em `SugestoesCompra` (sugestão + cotação real). |
| **Catálogo produção** | `Produtos` / cadastro — **não** substituído por este preview. |
| **Portal hierarquia** | Piloto cerâmica legado — converge para Novo Ecosistema quando estável. |

Labels canónicos: `src/config/smartSupplyFlags.js` (`NOVO_ECOSISTEMA_*`, `SMART_SUPPLY_ECOSYSTEM_LABEL`).

## Comandos

```bash
npm run estudo:catalog-manifest   # Excel → JSON (corre também no build)
# Migração pontual Excel (só se houver script de decisões pendente):
npm run estudo:catalog-excel-apply
npm run build
```

## Preview Vercel (PR #596)

- App: link no comentário `p38-vercel-preview` do PR.
- Rotas: `/CatalogoNovo`, `/SmartSupplyNovo`.

## Ficheiros âncora

| Ficheiro | Papel |
|----------|--------|
| `CatalogoNovoShell.jsx` | Layout, header sticky, tabs mobile, filtros sheet |
| `CatalogoEstudoList.jsx` | Árvore catálogo |
| `CatalogoSmartSupplyPanel.jsx` | Hierarquia supply + KPI strip + tabs visão |
| `useCatalogoEstudoData.js` | Dados só Excel |
| `usePermissoesResolvidas.jsx` | Menu Compras → Novo Ecosistema |
| `menuNavUtils.js` | Submenu aninhado + pesquisa global |

---

**Ao evoluir esta área:** manter entrada única em Compras, mobile first, Excel/estudo até corte explícito para Supabase, e não espalhar botões “preview” pelo resto da app.
