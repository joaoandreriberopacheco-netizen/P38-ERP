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
| **Novo Catálogo** | `CatalogoNovo` | **Igual Produtos** (TreeGrid, mobile, colunas, filtros) — árvore **pathway** (Edificações → … → LINHA → produto compra). Cadastro estrutural: **produto compra + eixo A + eixo B**. |
| **Smart Supply** | `SmartSupplyNovo` | **Decidir reposição**: visão por LINHA, esquadras saldáveis, estoque, ponto futuro, filtro “só alertas”, tabs Mobile / Mix / Portfolio. |

**Âmbito:** estas regras aplicam-se **só ao Novo Ecosistema** (`/CatalogoNovo`, `/SmartSupplyNovo`). O módulo **Produtos** (`/Produtos`) mantém-se inalterado (h1–h5, fluxo actual).

Shell partilhado: `src/components/catalogo-novo/CatalogoNovoShell.jsx` (`mode="catalog"` | `mode="supply"`).

### Três modos no Novo Catálogo

| Modo | UI | Para quê |
|------|-----|----------|
| **Catálogo** | `TreeGrid` + `MobileHierarquica` (mesmos componentes de Produtos) | Explorar SKUs com colunas comerciais; árvore pathway |
| **Compra** | Pathway + abas Solo / Mix / Portfolio | Administrar distribuição da obra |
| **Cadastrar** | `CadastroProdutoV2Form` (só Novo Ecosistema) | LINHA → produto compra → eixo A/B — **não** h1–h5 |

### Duas visões de negócio (Compra vs Catálogo)

| Visão | UI | Para quê |
|-------|-----|----------|
| **Catálogo** | TreeGrid / mobile como Produtos | Auditar, preços, estoque, ABCD — árvore pathway |
| **Compra** | **Pathway** da obra; abas **Solo / Mix / Portfolio** | Administrar distribuição — bloco → ramo → LINHA → produto compra / eixos |

Mesmo Excel/manifest. Quem começa do zero usa as duas desde o dia 1; quem migra mix legado usa **Catálogo** plano para conferir SKU a SKU e **Compra** para validar a árvore nova.

No **mobile**, alternar entre os dois com **tabs no topo** (sem voltar ao menu). Filtros pesados ficam num **bottom sheet** para não roubar espaço à lista.

## Dados — regra de ouro

- **Fonte canónica:** Excel de estudo `docs/exports/P38-sku-hierarquia-ab.xlsx` — **actualizar o Excel** quando a lógica de distribuição mudar (sem overrides JSON no build).
- Regenerar manifest: `npm run estudo:catalog-manifest` (corre também no `npm run build`).
- Mestre de LINHAs (solo/mix/portfolio): `src/data/hierarquiaPortalLinhas.json` — tipos de comportamento, cruzado com coluna `linha` do Excel.
- Manifest gerado: `src/data/estudoCatalogManifest.generated.json`.
- Hook: `useCatalogoEstudoData` — manifest Excel + **enrich comercial** opcional do cadastro (`codigo_interno`); hierarquia **nunca** do Supabase.
- Adapter TreeGrid: `src/lib/estudoCatalog/mapEstudoToProdutoCatalogRow.js` (pathway → pseudo h1–h4 **só visualização**).
- Painel catálogo: `src/components/catalogo-novo/CatalogoNovoCatalogPanel.jsx` (reutiliza `TreeGrid`, `MobileHierarquica`).
- Cadastro estrutural: `src/components/catalogo-novo/CatalogoNovoCadastroPanel.jsx` → `CadastroProdutoV2Form`.

Colunas de estoque no Excel AB: `estoque_atual`, `estoque_sigla`, `estoque_minimo`, `estoque_atualizado_em` (chave `codigo_interno`).

Job nocturno (00:00 Tabatinga): `npm run estudo:catalog-sync-estoque` → regenera manifest. Workflow GitHub: **Estudo Excel estoque nocturno**.

### Hierarquia de negócio (estudo A / B / C)

- **A** — edificações / estrutura (ex.: impermeabilizante pertence aqui, **não** em acabamentos).
- **B** — hidráulica, eléctrica, etc.
- **C** — acabamentos visíveis (pintura, revestimentos, banheiro…).

Árvore **Excel / vista Compra** (detalhe técnico): `bloco → sub_bloco → grupo → core → pathway (N/C/R) → LINHA → produto_compra → SKU`.

Árvore **Catálogo** (leitura João André — 5 níveis):

```
Edificações → Alvenaria (core) → LINHA → Produto compra → SKU
```

| Nível UI | Coluna Excel | Exemplo |
|----------|--------------|---------|
| Edificações | `bloco` | `A — Edificações` → mostra **Edificações** |
| Alvenaria | `core` | `ALVENARIA` → **Alvenaria** |
| LINHA | `linha` / mestre | `CIMENTO`, `MATERIAIS BÁSICOS` |
| Produto compra | `produto_compra_nome` | `CAL SUPERCAL` |
| SKU | `novo_sku` | folha (lista) |

SKUs **solo** (sem produto compra) ficam directamente sob a LINHA. Sub-bloco, grupo e sufixos ·N/·C/·R continuam no Excel e na vista **Compra**; o adapter `mapEstudoToProdutoCatalogRow.js` colapsa para os 5 níveis no TreeGrid/mobile.

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

**Fluxo canónico (Excel = única fonte na UI):**

1. **Editar / sincronizar** `docs/exports/P38-sku-hierarquia-ab.xlsx` — nomenclatura (`novo_sku`, LINHA, produto compra, eixos, bloco…) e colunas de estoque.
2. **Opcional — nomenclatura a partir do cadastro:** `npm run estudo:catalog-sync-nomenclatura` (actualiza `sku_atual`; propõe `novo_sku` onde ainda há legado).
3. **Opcional — estoque a partir do cadastro (job nocturno ou manual):** `npm run estudo:catalog-sync-estoque` — grava `estoque_atual` etc. no Excel por `codigo_interno`. Requer `DATABASE_URL` ou fallback `P38-catalogo-skus-completo.xlsx`.
4. **Regenerar manifest:** `npm run estudo:catalog-manifest` (corre também no `npm run build`).
5. **UI:** `useCatalogoEstudoData` lê **apenas** o manifest — nada do Supabase em runtime.

Até ao corte/migração produção, o **Excel é a base viva** para Novo Catálogo e Smart Supply; a BD legada só entra via jobs de sync, nunca na leitura directa das telas.

**Consumíveis transversais:** categoria ERP `J — FERRAMENTAS E CONSUMÍVEIS` (etapa 8) é **transversal** — distinto dos complementos **·C** dentro de um core (ex.: aditivo na alvenaria).

**Estado no preview UI:** catálogo com **5 níveis** (Edificações → core → LINHA → produto compra → SKU); vista Compra mantém árvore pathway completa. Estoque vem das colunas Excel (job nocturno); SKUs sem estoque no Excel mostram **—**.


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
3. **Estoque** (label tabular) — do Excel (pode estar desactualizado até ao job nocturno).
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
npm run estudo:catalog-sync-nomenclatura   # cadastro → Excel (sku_atual + nomenclatura proposta)
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
