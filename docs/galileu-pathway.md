# Galileu — pathway e posicionamento

**Galileu** é o app B2B de **gestão de entregas fluviais** (multi-tenant, Supabase).  
**Mana** (`a29-erp`) é a **doca seca** onde o Galileu é construído — não um espelho paralelo do P-38.

---

## Três nomes, três papéis

| Nome | Papel |
|------|--------|
| **P-38** | ERP da operação (vendas, compras, stock, financeiro). Continua evoluindo aqui. |
| **Mana** (`a29-erp`) | Repositório canónico **Next.js + Supabase + Vercel** — **doca seca do Galileu**. |
| **Galileu** | Produto: logística fluvial para distribuidoras (Cocil, etc.). Nasce e vive no Mana. |

```
P-38 (ERP)                    Mana (doca seca)
     │                              │
     │  compartilha pedido / API    │  Galileu (app)
     └──────────────────────────────┤  · Vendas (form leve)
                                    │  · Logística (Ricardo)
                                    │  · Porto / motorista
                                    │  · Calendário fluvial
                                    └  · multi-tenant Supabase
```

---

## Mana ≠ branco do P-38

| Antes (visão antiga) | Agora (piloto) |
|----------------------|----------------|
| a29 espelha UI VarejoSync (`mirror:sync`) | Mana é **fábrica do Galileu** |
| Monorepo “futuro P-38” | Monorepo **plataforma fluvial** |
| Copiar `legacy/varejosync/` como foco | Novo código `galileu/` (ou `apps/galileu`) |

O pipeline `npm run mirror:sync` pode continuar **opcional** (referência UI, componentes), mas **não define** o Mana.

---

## O que o Galileu **não** faz

- Não substitui ERP comercial (venda, preço, financeiro).
- Não “ensina o padre a rezar”: separação, volumetria interna, capacidade de caminhão — processo da empresa.
- Não obriga layout único de protocolo (lê Cocil, Tintão, CCG via OCR).

## O que o Galileu **faz**

Entra **depois** da separação, na **tela de volumes / entregas**:

1. **Vendedor** — form leve (pedido, cidade → linha auto, preferências/restrições barcos filtrados).
2. **Logística (Ricardo)** — agenda, **rota caminhão**, planejamento barcos **A/B/C**, calendário + % ocupação, despacho.
3. **Motorista** — roteiro, foto protocolo, fracionamento, fallback papel/Bluetooth.
4. **Triggers** — WhatsApp (status, consulta formal barco alternativo, NPS na chegada).
5. **Chave relacional** — `pedido_erp` liga ERP ↔ Galileu ↔ protocolo/OCR.

---

## Pathway resumido

```
Venda interior (ERP) → Solicitação Galileu (vendedor)
  → Agenda logística → Rota caminhão (Ricardo escolhe pedidos)
  → Planejamento fluvial A/B/C → Script porto
  → OCR / foto protocolo → Embarcado → ETA → Avaliação cliente
```

**Valor principal:** mesa **antes do porto** — otimizar linha/barco, plano B/C, cliente informado; motorista executa script.

---

## Reuso do P-38 no Mana (Galileu)

| No P-38 | Uso no Galileu |
|---------|----------------|
| `src/components/logistica-sandbox/` (Boats, timeline) | Referência UX **calendário** — generalizar linhas/escalas |
| `fluvialDataUtils.jsx` | Datas/viagens — **não** só Tabatinga 7 dias |
| `supabase/054_tenant_empresa_foundation.sql` | Modelo tenant |
| `RotaLogisticaTemplate` (entidade) | Evoluir → linha + escalas |

**Não portar:** ciclo fixo Manaus↔Tabatinga, embarques de compra.

---

## Integração P-38 ↔ Galileu

- **Entrada:** compartilhar pedido (`pedido_erp`, cliente, destino, pref/restrição barcos).
- **Saída:** status, barco, rota caminhão, embarque, protocolo (foto), ocorrência, ETA.

P-38 é **primeiro integrador**; outras distribuidoras usam só Galileu + seu ERP.

---

## Módulos comerciais Galileu

| Módulo | Conteúdo |
|--------|----------|
| **Calendário** | Linhas, barcos (~20 por linha), viagens, ETAs por escala |
| **Logística** | Solicitações, rota caminhão, A/B/C, agenda despacho |
| **Porto** | Motorista, OCR, fracionar, papel auxiliar |

---

## Próximos passos (Mana)

1. Scaffold `apps/galileu` (ou `packages/galileu`) no repo Mana.
2. Migrações Supabase: `tenant`, `linha_fluvial`, `escala`, `embarcacao`, `solicitacao_fluvial`, `plano_embarque`, `rota_caminhao`.
3. Telas piloto: form vendedor · agenda Ricardo · roteiro motorista.
4. API mínima compartilhar pedido + webhook status.

---

*Documento de produto — conversa João André + agente, ago/2026. Piloto: Mana = doca seca Galileu.*
