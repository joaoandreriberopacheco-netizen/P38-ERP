# P38 — Módulos e perfis

Mapa comercial e operacional dos “quatro chapéus” do sistema.  
Código de permissões: `src/components/config/usePermissoesResolvidas.jsx`.

---

## Módulos (portas do produto)

| Módulo | Nome comercial | Foco | Exemplos de ecrãs |
|--------|----------------|------|-------------------|
| **A** | **P38 Caixa** | Vender e receber | `PDVVendedor`, `PDVCaixa`, `PDV`, `AutoAtendimento`, `TurnosFechados` |
| **B** | **P38 Supply** | Comprar, receber, mover stock | `SugestoesCompra`, `PedidosCompra`, `ConferenciaEntrada`, `Armazenagem`, `ItinerarioFluvial` |
| **C** | **P38 Financeiro** | Lançar, pagar, fluxo do dia | `FluxoCaixa`, `ContasFinanceiras`, `AprovacoesFinanceiras`, `PlanejamentoFinanceiro` |
| **D** | **P38 Gestão** | Visão 360°, margem, configuração | `Dashboard`, `PainelGerente`, `RelatorioMargem`, `Relatorios`, `Configuracoes` |

Todos partilham a **mesma base Supabase** — não há silos de dados.

---

## Perfis típicos

| Perfil | Módulos | O que faz no dia |
|--------|---------|------------------|
| **Vendedor / Caixa** | A | Vende, recebe, fecha turno |
| **Conferente / Depósito** | B (+ A parcial) | Confere entrada, separa, audita stock |
| **Comprador** | B | Cotações, pedidos, sugestão de compra |
| **Financeiro operacional** | C | Lançamentos, aprovações, fluxo de caixa |
| **Dono / Gerente** | A+B+C+D (filtrado) | Margem, planejamento, cotas de reabastecimento, aprovações remotas |
| **Administrador** | D completo | Utilizadores, perfis, parametrização |

---

## O dono multitarefa

Perfil especial (muito comum em varejo médio): **uma pessoa acumula 3–5 funções**.

O P38 responde a perguntas de gestão sem relatório mensal do contador:

| Pergunta | Onde olhar |
|----------|------------|
| Lucro ou prejuízo operacional? | `RelatorioMargem`, `PlanejamentoFinanceiro` |
| Caixa e margem fazem sentido? | `FluxoCaixa`, `PainelGerente` |
| Stock dentro das cotas? | `Produtos` (mín/ideal/máx), `SugestoesCompra` |
| O que está crítico? | Status no catálogo, IEP/ABC, notificações |

---

## Mobile por perfil

| Perfil | Padrão mobile |
|--------|---------------|
| Operador (caixa, conferente) | **M-F** fullscreen — toque grande, fluxo rápido |
| Dono remoto | **M-B / M-E** — listas, KPIs, aprovações |
| Relatórios densos | **M-A / M-D** — grelha Margem, scroll horizontal |

Referência visual: [`p38-mobile-rollout.md`](./p38-mobile-rollout.md).

---

## Evolução (Essie / A-29)

Visão de ecossistema: [`essie-ecossistema-a29-visao.md`](./essie-ecossistema-a29-visao.md) — Essie (rotina/IA) como app separada sobre a mesma base.

---

*Usar esta página em conversas com parceiros — não é documentação técnica de API.*
