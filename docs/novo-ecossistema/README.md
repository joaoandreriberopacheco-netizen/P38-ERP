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
| **Novo Catálogo** | `CatalogoNovo` | **Explorar** a árvore de compras: bloco → sub-bloco → LINHA → produto compra → SKU. Ver tipo de LINHA (solo/mix/portfolio) e LEDs de estado (estudo). |
| **Smart Supply** | `SmartSupplyNovo` | **Decidir reposição**: visão por LINHA, esquadras saldáveis, estoque, ponto futuro, filtro “só alertas”, tabs Mobile / Mix / Portfolio. |

Shell partilhado: `src/components/catalogo-novo/CatalogoNovoShell.jsx` (`mode="catalog"` | `mode="supply"`).

No **mobile**, alternar entre os dois com **tabs no topo** (sem voltar ao menu). Filtros pesados ficam num **bottom sheet** para não roubar espaço à lista.

## Dados — regra de ouro

- **Fonte actual:** Excel de estudo → JSON gerado (`npm run estudo:catalog-manifest`).
- Ficheiro Excel: `docs/exports/P38-sku-hierarquia-ab.xlsx` (934 SKUs no estudo AB).
- Manifest: `src/data/estudoCatalogManifest.generated.json`.
- Hook: `useCatalogoEstudoData` — **não chama Supabase nem Base44** no preview (protege produção).
- Estoque / velocidade / LEDs no preview: **simulados ou derivados do manifest**, salvo evolução explícita.

### Hierarquia de negócio (estudo A / B / C)

- **A** — edificações / estrutura (ex.: impermeabilizante pertence aqui, **não** em acabamentos).
- **B** — hidráulica, eléctrica, etc.
- **C** — acabamentos visíveis (pintura, revestimentos, banheiro…).

Árvore UI: `bloco → sub_bloco → LINHA → produto_compra → SKU` (eixos A/B quando existirem).

### Tipos de LINHA

| Tipo | Significado na UI |
|------|-------------------|
| `solo` | LINHA isolada |
| `mix` | mix de referências |
| `portfolio` | portfolio alargado |

Filtro `PortalTipoFilter` + chips na lista e no Smart Supply.

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
npm run build                     # gate toolchain + bundle
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
