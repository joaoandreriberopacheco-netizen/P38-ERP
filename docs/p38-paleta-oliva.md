# Paleta oliva P38 — referência para agentes e equipa

Guia canónico do **verde oliva mediterrâneo** usado em módulos operacionais (Caixa, Embarques/Compras) no modo escuro. Validado por João André em **2026-08-29** (Embarques mobile alinhado ao Caixa).

Documento irmão: [`p38-mobile-rollout.md`](./p38-mobile-rollout.md) · Regra Cursor: [`.cursor/rules/p38-paleta-oliva-operacional.mdc`](../.cursor/rules/p38-paleta-oliva-operacional.mdc)

---

## Porquê existe

O limão `#a4ce33` continua válido em **Planejamento financeiro** (CTA forte, FAB, contraste limão × carvão). Em ecrãs **operacionais densas** (listas + filtros + ícones lado a lado), o oliva reduz “ruído visual” e evita sensação de interface espremida ou neon.

**Regra prática:** operacional (caixa, embarques, PDV recebimentos) → **oliva**; planeamento / CTAs hero → **limão** (salvo pedido explícito do utilizador).

---

## Tokens de cor (fonte única)

Definição partilhada em `src/lib/caixaP38Theme.js`:

| Token JS | Hex / valor | Uso |
|----------|-------------|-----|
| `CAIXA_OLIVE.solid` | `#636B2F` | Fundo sólido dark (FAB, tab activa, badge, botão primário) |
| `CAIXA_OLIVE.solidLight` | `#4a5240` | Oliva escuro no **modo claro** |
| `CAIXA_OLIVE.textDark` | `#A8B56E` | Texto acento no dark (KPI, ícones, chip activo) |
| `CAIXA_OLIVE.textDarkSoft` | `#8F9A5C` | Texto acento mais suave |
| `CAIXA_OLIVE.wash` | `rgba(99,107,47,0.14)` | Fundo chip / highlight suave |
| `CAIXA_OLIVE.washStrong` | `rgba(99,107,47,0.22)` | Badges, pills com mais presença |
| `CAIXA_OLIVE.border` | `rgba(99,107,47,0.35)` | Anéis focus, bordas de ênfase |

**Compras/Embarques** re-exporta o mesmo objecto:

```js
import { COMPRAS_OLIVE } from '@/lib/comprasP38Theme';
// COMPRAS_OLIVE === CAIXA_OLIVE
```

---

## Onde está no código (mapa para agentes)

| Módulo | Ficheiro tokens | Paleta status (chips/lista) |
|--------|-----------------|------------------------------|
| **Caixa** | `src/lib/caixaP38Theme.js` | `caixaStatusPills`, `caixaMobileAccents`, `caixaAccentDot` |
| **Embarques / Compras** | `src/lib/comprasP38Theme.js` | Layout, FAB, busca, abas inline |
| **Lista Embarques** | `src/lib/comprasEmbarquesPalette.js` | `COMPRAS_PILL`, `COMPRAS_STATUS_BORDER`, status Aprovado |

### Ecrãs de referência (produção)

| Ecrã | URL |
|------|-----|
| Embarques mobile | https://p-38erp.vercel.app/PedidosCompra |
| Caixa PDV | https://p-38erp.vercel.app/PDVCaixa |

---

## Classes Tailwind preferidas (não inventar hex novos)

Importar de `comprasP38Theme.js` ou `caixaP38Theme.js`:

| Situação | Token / classe |
|----------|----------------|
| FAB novo pedido | `COMPRAS_FAB` |
| Tab activa Embarques/Consulta (inline) | `COMPRAS_VIEW_TAB_ACTIVE` + `COMPRAS_VIEW_TAB_GROUP` |
| Chip filtro activo (“Últimos 30 dias”) | `COMPRAS_CHIP_ACTIVE_OLIVE` |
| KPI header (“Aprovados financeiramente…”) | `COMPRAS_KPI_ACCENT` |
| Botão primário / Aplicar filtros | `COMPRAS_MOBILE_CTA` ou `COMPRAS_BTN_PRIMARY` |
| Ícone acento em secções | `COMPRAS_ICON_ACCENT` |
| Badge contador filtros | `COMPRAS_FILTER_BADGE` |
| Busca compacta (com abas ao lado) | `COMPRAS_SEARCH_INPUT_COMPACT` |
| Status **Aprovado** na lista | `COMPRAS_PILL.aprovado` em `comprasEmbarquesPalette.js` |

### Layout mobile Embarques (compacto)

| Elemento | Tamanho |
|----------|---------|
| Grupo abas inline | pill `h-8`, ícones Lucide `h-4 w-4` |
| Campo busca (com abas) | `h-10` via `COMPRAS_SEARCH_INPUT_COMPACT` |
| Botão filtro | `h-9 w-9`, ícone `h-4` via `COMPRAS_MOBILE_ICON_BTN` |
| Gap da linha | `gap-2` |

Implementação: `ComprasViewTabsInline` em `src/pages/PedidosCompra.jsx` + `mobileLeading` em `FiltrosCompras.jsx`.

---

## O que usar oliva vs limão vs semântico

| Cor | Quando |
|-----|--------|
| **Oliva** | CTAs operacionais, tabs activas, chips de filtro, FAB, KPI positivo financeiro, status **Aprovado** |
| **Limão `#a4ce33`** | Planejamento financeiro, CTAs hero “Abrir mês”, alguns tokens globais `P38_CHIP_ACTIVE` / `financeiroP38.js` |
| **Ciano `#4ECDC4`** | Status **Despachado** (embarques) — não trocar por oliva |
| **Coral `#D96F55`** | Aguardando / pendências |
| **Carvão `#1f1d22`** | Fundo dark base — inalterado |

---

## O que NÃO fazer

1. **Não** espalhar `#a4ce33` em novos ecrãs operacionais mobile — usar tokens oliva.
2. **Não** duplicar hex soltos se já existe token (`COMPRAS_*`, `caixa*`).
3. **Não** aumentar ícones Lucide na linha busca+filtro acima de `h-4` sem testar no telemóvel (fica espremido).
4. **Não** misturar oliva e limão no mesmo controlo activo (ex.: tab oliva + chip limão).

---

## Checklist para agente (nova ecrã operacional mobile)

- [ ] Importar `CAIXA_OLIVE` ou tokens `COMPRAS_*` / `caixa*`
- [ ] Dark: sólidos `#636B2F`, texto acento `#A8B56E`
- [ ] Claro: sólidos `#4a5240`, texto `#3a4232`
- [ ] Abrir ecrã de referência (Embarques ou Caixa) antes de inventar classes
- [ ] Validar com `npm run build`
- [ ] Entregar em **branch + preview Vercel** (ver [`PREVIEW_ANTES_PRODUCAO.md`](./PREVIEW_ANTES_PRODUCAO.md))

---

## Histórico

| Data | Decisão |
|------|---------|
| 2026-07-29 | Planejamento financeiro — limão × carvão aprovado (referência composição) |
| 2026-08-29 | Embarques mobile — oliva alinhada ao Caixa; layout compacto busca+abas |
