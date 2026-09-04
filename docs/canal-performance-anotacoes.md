# Canal de performance — hub de anotações (branch de trabalho)

**Analogia:** o rio (`main` / produção) continua a correr normalmente. Este trabalho abre um **canal paralelo** (`cursor/canal-performance-anotacoes-2ef5`) para escavar e alargar o leito — cache, snapshots, menos recálculos — sem desviar água da produção até estar pronto.

| | |
|--|--|
| **Branch** | `cursor/canal-performance-anotacoes-2ef5` |
| **Produção** | `main` → [p-38erp.vercel.app](https://p-38erp.vercel.app) — **não alterar** até merge aprovado |
| **Preview** | PR desta branch → workflow **Vercel Preview** (URL temporária) |
| **Objetivo** | Menos carregamentos repetidos; “anotações” para períodos fechados (ontem, meses passados) |

---

## Para agentes e desenvolvedores

### Quando usar esta branch

Trabalho relacionado com:

- performance / lentidão / LCP / carregamentos repetidos;
- cache, buffer, snapshots, “anotações”, hub de KPIs;
- `dashboardIncrementalCache`, `dashboard_kpi_*`, `margem_competencia_snapshot`;
- otimização de **PDVVendedor**, **PedidosCompra**, **Produtos**, **VendasGestao**, **Home**, **Dashboard**.

**Não** commitar estas alterações diretamente na `main`.

## Bifurcação: quem atualiza o quê?

**Não** é “todos os agentes commitam na `main` e na branch do canal”. Isso mistura fluxos e aumenta risco de erro.

| Tipo de trabalho | Onde commitar | Canal fica atualizado como? |
|------------------|---------------|-----------------------------|
| Feature normal, flare, bugfix, negócio | **`main` só** | Workflow **Sync main → canal performance** (automático após cada push na `main`) |
| Performance, cache, anotações | **Branch do canal só** | Agente faz `git merge origin/main` **antes** de começar (por precaução) |
| Publicar otimizações | Merge do **PR canal → `main`** | Aprovação explícita; preview Vercel antes |

### Fluxo (rio + canal)

```
main (rio / produção)
  │
  │  push (qualquer agente, trabalho normal)
  ▼
[GitHub Action: sync-main-to-canal-performance]
  │
  │  merge automático main → canal
  ▼
cursor/canal-performance-anotacoes-2ef5 (canal)
  │
  │  commits de performance (agentes no canal)
  ▼
PR #614 → preview → merge (quando aprovado) → volta ao rio
```

### Para agentes — regra simples

1. **Trabalho normal** → `main`, push, **pronto**. Não tocar no canal; o sync trata do resto.
2. **Trabalho de performance** → checkout do canal → `git merge origin/main` → implementar → push no canal.
3. **Conflito no sync automático** → o workflow falha no GitHub Actions; um agente resolve na branch do canal (`git merge origin/main`, corrigir, push).

### Comandos (trabalho no canal)

```bash
git fetch origin main
git checkout cursor/canal-performance-anotacoes-2ef5
git pull origin cursor/canal-performance-anotacoes-2ef5
git merge origin/main   # extra antes de começar; o sync já traz a main, mas evita surpresas
```

Resolver conflitos, `npm run build`, commit, push na **branch do canal**.

### Outras tarefas (fora de performance)

Correções urgentes, features normais, flares → continuam na **`main`** (regra habitual do repo). O canal recebe essas mudanças sozinho via sync.

### Publicar na produção

1. Abrir ou atualizar PR: `cursor/canal-performance-anotacoes-2ef5` → `main`.
2. Testar no **Vercel Preview** (ver [`PREVIEW_ANTES_PRODUCAO.md`](./PREVIEW_ANTES_PRODUCAO.md)).
3. **Merge só com aprovação explícita** do João André.

---

## Diagnóstico (base da análise — set/2026)

### Páginas mais usadas × mais lentas (Speed Insights, 7 dias)

| Página | Uso (proxy) | LCP p75 |
|--------|-------------|---------|
| `/` | 120 | 7,9 s |
| `/Home` | 40 | 5,8 s |
| `/PedidosCompra` | 33 | 5,7 s |
| `/PDVVendedor` | 20 | 7,8 s |
| `/VendasGestao` | 10 | 9,2 s |
| `/Produtos` | 12 | 6,3 s |

Meta saudável LCP: **&lt; 2,5 s**. INP (~152 ms) está aceitável — o gargalo é **carregar + recalcular**, não cliques.

### Três camadas do problema

1. **JavaScript** — chunk da página + shell (~1–2 s em rede lenta).
2. **Rede / dados** — listas grandes (produtos, pedidos, clientes).
3. **Cálculo no browser** — margem, estoque, KPIs refeitos em cada visita.

### O que já existe (“anotações” parciais)

| Peça | Ficheiros / tabelas |
|------|---------------------|
| Até ontem + hoje | `src/lib/dashboardIncrementalCache.js` |
| Snapshots Postgres | `dashboard_kpi_diario`, `dashboard_kpi_mensal` (migration 064) |
| Job noturno Tabatinga | `supabase/functions/fechar-dashboard-kpi` |
| Margem mês fechado | `margem_competencia_snapshot`, `useLucroBrutoCompetencia` |

**Lacuna principal:** snapshots evitam *fetch* de meses fechados no dashboard, mas **ainda se recalcula no browser** (`computeDashboardVendasMetricsMargem` não usa `sealedMonths.payload`). Páginas operacionais (PDV, Compras, Produtos) **não têm anotações**.

---

## Plano de implementação (nesta branch)

### Fase 1 — Quick wins (sem mudar schema)

- [x] **PDVVendedor** — `useProdutosAtivosPdvQuery` + `useClientesPdvQuery` (cache 2 min partilhado).
- [x] **PedidosCompra** — `usePedidosCompraGestaoInicialQuery` (cache 2 min; invalidate após mutações).
- [x] **VendasGestao** — `staleTime: ∞` quando `dataFim < ontem` (`p38GestaoCache.js`).
- [x] **Home** — refetch menos agressivo (60 s, sem refetch ao focar janela).

### Fase 2 — Completar dashboard + margem

- [x] **Dashboard VendasTab** — `sealedMonths.payload` preenche buckets; só pedidos de hoje são reprocessados; catálogo leve quando há snapshots.
- [x] **fetchDashboardVendas** — janela totalmente selada busca só pedidos de hoje (não a janela inteira).
- [x] **Dashboard EstoqueTab** — cache do tab 5 min (movimentos até ontem já em segmento ∞).
- [x] **Margem / Budgets / Dízimo** — `fetchPedidosVendaParaMargemCompetencia` por mês; snapshot só em mês fechado; cache por competência.

### Fase 3 — Hub de anotações generalizado

- [ ] Tabela/RPC genérica `p38_anotacao` (domain, ref_key, payload, version).
- [ ] Expandir job noturno + flags `dirty` em edições retroativas.
- [ ] Domínios: catálogo, vendas gestão, compras, home KPIs.

### Validação

- `npm run build` em cada entrega.
- Comparar LCP no Vercel Preview vs produção (Speed Insights).
- Pulso opcional: `npm run pulse:corridor` no preview.

---

## Manter o canal atualizado

### Automático (recomendado)

Cada push na **`main`** dispara o workflow [`.github/workflows/sync-main-to-canal-performance.yml`](../.github/workflows/sync-main-to-canal-performance.yml), que faz merge `main` → canal.

Agentes em trabalho **normal** não precisam de atualizar o canal manualmente.

### Manual (se o sync falhar por conflito)

```bash
git checkout cursor/canal-performance-anotacoes-2ef5
git fetch origin
git merge origin/main
# resolver conflitos
npm run build
git push origin cursor/canal-performance-anotacoes-2ef5
```
