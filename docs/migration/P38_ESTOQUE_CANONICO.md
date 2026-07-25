# Estoque canónico — regra de negócio (P38)

## Hierarquia da verdade

1. **Migração Base44 (corte)** — O que foi importado como saldo inicial + movimentos até ao momento do corte é a linha de base documentada. Cada movimento deve ter referência (venda, compra, ajuste, contagem).

2. **Movimentos documentados após o corte** — Vendas (`Saída` / motivo Venda), recepções de compra (`Entrada` / motivo Compra), consumo interno, etc. O extrato (`movimentacao_estoque`) é a fonte técnica de `estoque_atual`.

3. **Contagem física (Contagem Express / auditoria)** — Quando há inventário real no armazém, **a quantidade contada prevalece** sobre o saldo do extrato. O sistema gera um movimento `Ajuste de Inventário` com delta = físico − saldo extrato **completo**, nunca um valor arbitrário.

4. **Estoque virtual (catálogo)** — Soma ao físico apenas pedidos aprovados e **não recebidos** (trânsito). Não substitui nem corrige o físico.

## O que NÃO é permitido

- Arbitrar `estoque_atual` porque “o extrato parece bonito” sem contagem física ou documento.
- Ajustes automáticos baseados em **extrato parcial** (ex.: só os últimos N movimentos).
- Ignorar contagem física recente em favor de soma de movimentos errados na migração.

## Implementação técnica

| Operação | Regra |
|----------|--------|
| Saldo do extrato | `fetchMovimentacoesEstoqueProduto` — **todas** as linhas, paginado |
| Contagem Express | `físico contado − saldoExtratoCompleto` → movimento de ajuste |
| Recalcular produto | `recalcularEstoqueProduto` (RPC Supabase) ou fallback com extrato completo |
| Embarque recebido | Mesma regra da página de embarques: `Recebido OK` conta como recebido mesmo se `quantidade_recebida` estiver 0 |

## Caso documentado: CIMENTO #510-4Z4 (jul/2026)

- Contagem Express **75M8P6** (18/jul): físico **660 SC**.
- Extrato real antes do ajuste: **726,4 SC** (não −458,6).
- Ajuste correcto seria **≈ −66 SC**; foi aplicado **+1.118,6 SC** por bug do limite de 1.000 movimentos (produto com 1.074 movimentos).
- Resultado: cadastro inflado (~1.962 SC) vs inventário físico recente (~1.060 SC).
- **Correcção de dados:** nova Contagem Express com quantidade física actual; o código já não trunca o extrato.

## Referências no código

- `src/lib/movimentacaoEstoqueSaldo.js` — saldo e fetch paginado
- `src/lib/contagemExpressApply.js` — aplicar contagem
- `src/lib/sugestaoCompraEstoquePendente.js` — estoque virtual / trânsito
- `src/docs/migration/ENTITIES_MANIFEST.json` — `MovimentacaoEstoque` como fonte da verdade
