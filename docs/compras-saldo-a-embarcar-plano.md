# Compras — Saldo a embarcar (plano central BD + interface)

Documento de referência para alinhar **base de dados** e **interface** à lógica real de compras (Tintão e demais fornecedores).

**Estado:** view 094 **aplicada no Supabase** (consultas SQL directas). View **095** `pedido_compra_orfaos_v` — conta simples órfãos (pedido − embarcado).  
**Referência de auditoria SQL:** [`scripts/sql/auditoria-pedido-compra-tintao-e62.sql`](../scripts/sql/auditoria-pedido-compra-tintao-e62.sql)  
**View canónica (migration 094):** `pedido_compra_saldo_a_embarcar_v`

---

## 1. Resumo do problema

Hoje o sistema mistura três conceitos diferentes na mesma lista de “Embarques”:

| Conceito de negócio | O que é | Como aparece hoje | Problema |
|---------------------|---------|-------------------|----------|
| **Pedido** | Contrato total com o fornecedor | `pedido_compra` + `pedido_compra_item` | OK como fonte |
| **Embarque real** | Viagem despachada (parte do pedido que saiu) | `embarque.tipo = 'Embarque'` | OK; trânsito **não** é pendência |
| **Saldo a embarcar** | Parte do pedido **ainda não colocada** num embarque real, ou a **repor** após recepção com falha | Card virtual “Necessidade” + registos `embarque.tipo = 'Necessidade'` | Números inflados (~592 cx vs ~42 cx reais Tintão) |

### Sintomas observados (Tintão, set/2026)

- PDF operacional (18/09): **6 cards**, ~**45 cx**, ~R$ 2.879 — filtro Necessidade + Aguardando, busca “tint”.
- App (motor virtual + cascata ETA): centenas de cx e dezenas de mil reais a mais.
- Dupla contagem: `(pedido − embarcado virtual)` **+** linhas já gravadas em `Necessidade` (ex.: AB6-PPQ-C, 10 cx).
- Duas fontes de quantidade na UI: `_display_itens` vs `buildConsultaItensEmbarque` (cx vs m²).

### Lista manual de controlo (22/09/2026)

Após embarque PW8-WLV-B e nova linha 7MW-ZZQ-A (Roble avariada):

| Código card | Produto (resumo) | Qtd |
|-------------|------------------|-----|
| EXC-FQZ | — | 1 cx |
| HHW-5NP | — | 9 cx |
| KQL-J94 | — | 4 cx |
| SQF-7ZH | — | 17 cx |
| AB6-PPQ-C | Travertino CZ | 10 cx |
| 7MW-ZZQ-A | Roble (avaria) | 1 cx |
| **Total** | | **~42 cx** |

PW8-WLV **fora** da lista (embarcou 22/09).

---

## 2. Vocabulário canónico (usar na UI e docs)

| Termo | Definição | Conta em “falta embarcar”? |
|-------|-----------|----------------------------|
| **Pedido** | Quantidade contratada (`quantidade_comercial` por linha) | Base |
| **Embarque real** | Split executado com transporte/datas; `tipo ≠ 'Necessidade'` | Não — é viagem |
| **Em trânsito** | Embarcado no embarque real, ainda não recebido (`embarcada − recebida`) | **Não** |
| **Saldo nunca embarcado** | `pedido − Σ embarcada (embarques reais)` | **Sim** |
| **Saldo pós-recepção** | Divergência registada em `embarque.tipo = 'Necessidade'` | **Sim** (já na BD) |
| **Falta operacional** | `pedido − recebida − em_trânsito` (exclui o que já vai chegar) | **Sim** — KPI principal |

**Regra de ouro:** embarque real **não tem pendência de embarque** — só tramite (despachado → recepção).  
Pendência de **colocar num embarque** é atributo do **pedido**, não do card de viagem.

---

## 3. View global (base de dados)

Migration [`094_pedido_compra_saldo_a_embarcar_view.sql`](../supabase/migrations/094_pedido_compra_saldo_a_embarcar_view.sql) cria:

### `pedido_compra_saldo_a_embarcar_v`

Uma linha por **`pedido_compra_item`** (produto × pedido), com colunas:

| Coluna | Significado |
|--------|-------------|
| `quantidade_pedida_comercial` | Contratado |
| `quantidade_embarcada_real` | Soma em embarques reais |
| `quantidade_recebida_real` | Soma recebida em embarques reais |
| `quantidade_em_transito` | Embarcado − recebido (só embarques reais) |
| `saldo_nunca_embarcado` | `max(pedido − embarcada_real, 0)` |
| `saldo_pos_recepcao` | Soma em embarques `Necessidade` |
| **`falta_operacional`** | `max(pedido − recebida − em_transito, 0)` — **número do PDF** |
| `diagnostico` | `FALTA_EMBARCAR` / `EM_TRANSITO` / `OK` / `REVISAR` |

### Consultas típicas

```sql
-- Tintão: linhas com falta real (exclui trânsito)
select pedido_compra_numero, produto_nome, unidade_sigla,
       falta_operacional, saldo_pos_recepcao, diagnostico
from pedido_compra_saldo_a_embarcar_v
where fornecedor_nome ilike '%tint%'
  and falta_operacional > 0.009
order by pedido_compra_numero, produto_nome;

-- KPI global Tintão
select count(*) as linhas,
       sum(falta_operacional) as unidades_falta
from pedido_compra_saldo_a_embarcar_v
where fornecedor_nome ilike '%tint%'
  and falta_operacional > 0.009;
```

**Validação:** [`scripts/tintao-saldo-view-auditoria.mjs`](../scripts/tintao-saldo-view-auditoria.mjs) compara a view com a lista manual de 22/09.

---

## 4. Plano de execução (fases)

Execução **incremental** — produção não quebra; filtros antigos ficam em paralelo até corte.

### Fase 0 — Documentação ✅ (este ficheiro)

- Vocabulário, métricas, critérios de aceitação, referências.

### Fase BD-1 — View SQL (zero risco) ✅

- [x] Migration `094_pedido_compra_saldo_a_embarcar_view.sql`
- [x] Script auditoria Tintão
- **Critério:** soma `falta_operacional` Tintão ≈ lista manual (~42 cx); PW8 = 0

### Fase BD-2 — Persistência (médio prazo)

Escolher **uma** opção (decidir na implementação):

| Opção | Prós | Contras |
|-------|------|---------|
| A. Triggers em `embarque_item` | Sempre actualizado | Mais complexo |
| B. Reactivar `quantidade_vinculada` ao criar embarque | Coluna já existe | Só cobre “embarcado”, não recepção |
| C. Tabela `pedido_compra_saldo` materializada | Consultas rápidas | Sync extra |

**Recomendação:** manter view como fonte de verdade até BD-2; triggers espelham a mesma fórmula da view.

### Fase BD-3 — Modelo limpo (longo prazo)

- Separar saldo do pedido de `embarque`.
- Migrar `Necessidade` → entidade própria (ex. `pedido_compra_saldo_pendente`).
- `embarque` fica **só** viagens reais.

### Fase UI-1 — Motor paralelo ✅

- [`src/lib/pedidoCompraSaldoEmbarque.js`](../src/lib/pedidoCompraSaldoEmbarque.js) — mesma fórmula que a view.

### Fase UI-2 — Interface Embarques ✅

- Aba **Saldo a embarcar** em `PedidosCompra.jsx` (terceira tab).
- KPI: pedidos com falta · unidades · valor (exclui trânsito).
- Filtro de status **Saldo a embarcar** em `comprasEmbarquesPalette.js`.
- `_consulta_papel: 'saldo_a_embarcar'`.

### Fase UI-3 — Relatório ✅

- PDF **Saldo a embarcar** no `ComprasRelatoriosMenu` (`comprasRelatorioSaldoEmbarque.js`).

### Fase UI-4 — Pós-recepção ✅

- Card virtual substituído por `buildEmbarqueVirtualSaldoEmbarque` (`falta_operacional`, sem cascata).
- Produtos já em `Necessidade` BD excluídos do virtual (sem dupla contagem AB6).

---

## 5. Critérios de aceitação (Tintão)

| # | Critério |
|---|----------|
| 1 | KPI “Falta embarcar” ≈ **42 cx** (22/09), não centenas |
| 2 | PW8-WLV **não** aparece com saldo > 0 |
| 3 | AB6-PPQ-C **10 cx** Travertino |
| 4 | 7MW-ZZQ **1 cx** Roble |
| 5 | Embarques em trânsito **não** entram no KPI falta |
| 6 | View SQL e motor JS (`pedidoCompraSaldoEmbarque`) **mesmos números** |

---

## 6. Mapa de ficheiros

| Área | Ficheiro |
|------|----------|
| Plano | `docs/compras-saldo-a-embarcar-plano.md` |
| View SQL | `supabase/migrations/094_pedido_compra_saldo_a_embarcar_view.sql` |
| Auditoria | `scripts/tintao-saldo-view-auditoria.mjs` |
| Motor JS | `src/lib/pedidoCompraSaldoEmbarque.js` |
| Virtual (legado) | `src/lib/pedidoCompraNecessidade.js` |
| Cards | `src/lib/comprasEmbarqueCards.js` |
| Órfãos | `src/lib/embarqueLogisticaHelpers.js` |
| Consulta / relatório | `src/lib/consultaComprasEmbarques.js` |
| Recepção → Necessidade | `src/components/compras/RecepcionarEmbarque.jsx` |
| Schema linhas | `supabase/migrations/030_normalize_line_items.sql` |

---

## 7. Ordem de trabalho recomendada

1. Deploy migration 094 (Supabase) + correr auditoria Tintão.
2. Validar script `tintao-saldo-view-auditoria.mjs` verde.
3. UI-2: filtro “Saldo a embarcar” lendo view ou motor JS.
4. UI-3: PDF alinhado ao PDF operacional 18/09 (actualizado 22/09).
5. BD-2 / BD-3 conforme prioridade de performance e limpeza de modelo.

**Canal performance:** alterações de cache/snapshot **não** nesta branch — ver [`docs/canal-performance-anotacoes.md`](canal-performance-anotacoes.md).
