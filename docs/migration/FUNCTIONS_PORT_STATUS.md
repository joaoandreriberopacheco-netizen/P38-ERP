# Port Base44 → Supabase — Estado das Funções

**Atualizado:** 2026-07-24 — Ondas 1–4 portadas no Git.

- **79** funções Base44 no repositório
- **~77** com equivalente Supabase (Edge + SQL + triggers/crons)
- **2** não portadas: `sincronizarDelecaoLancamentos` (inativa), `generateProductImages` (stub vazio)

## Arquitectura

| Camada | Papel |
|--------|--------|
| `supabase/migrations/*.sql` | RPCs, triggers, pg_cron |
| `supabase/functions/<kebab>/` | Edge Functions (JWT → lógica) |
| `supabase/functions/_shared/p38Client.ts` | Shim compatível com SDK Base44 |
| `supabase/functions/_shared/handlers/*.ts` | Handlers portados de `base44/functions/` |
| `scripts/port-base44-functions.mjs` | Regenera handlers/edges a partir do Base44 |

## Legenda

- ✅ portado · ❌ não portar

## Onda 1 — PDV + financeiro

Todas ✅ (migrations 017–023 + edges manuais).

## Onda 2 — Anexos, importações, relatórios

Todas ✅ via Edge portada + Storage (`uploadAnexoDrive`/`deletarAnexo` usam bucket `anexos`).

| Função | Destino | Status |
|--------|---------|--------|
| gerenciarPin | Edge | ✅ |
| uploadAnexoDrive | Edge (Storage) | ✅ |
| listarAnexos | Edge | ✅ |
| deletarAnexo | Edge (Storage) | ✅ |
| importarProdutos | Edge | ✅ |
| importarPedidosCompra | Edge | ✅ |
| importarAreas | Edge | ✅ |
| gerarExtratoFluxoCaixa | Edge (PDF) | ✅ |
| gerarRelatorioConferencia | Edge | ✅ |
| gerarRelatorioConsolidadoCompra | Edge | ✅ |
| gerarRelatorioContasAbertas | Edge (PDF) | ✅ |
| gerarRelatorioMargem | Edge | ✅ |
| gerarRelatorioPedido | Edge (PDF) | ✅ |
| gerarRelatorioPedidosCompra | Edge (PDF) | ✅ |
| gerarRelatorioPedidosComprav2 | Edge (PDF) | ✅ |
| gerarRelatorioPendencias | Edge (PDF) | ✅ |
| gerarRelatorioPrecificacao | Edge (PDF) | ✅ |
| gerarRelatorioSupermanifesto | Edge (PDF) | ✅ |
| imprimirCupomTermico | Edge (TCP) | ✅ |
| printAgent | Edge (fila agente local) | ✅ |

## Onda 3 — Compras, logística, operacional

Todas ✅ via Edge portada + migration 024 (triggers).

| Função | Destino | Status |
|--------|---------|--------|
| gerarNumeroSequencial | RPC + Edge | ✅ |
| recalcularEstoqueProduto | RPC + Edge | ✅ |
| recalcularConclusaoPedidoCompra | Edge | ✅ |
| savePedidoVendaItem | Edge | ✅ |
| savePedidoCompraItem | Edge | ✅ |
| saveEmbarqueItem | Edge | ✅ |
| saveConferenciaItem | Edge | ✅ |
| integrarPedidosEmbarques | Edge | ✅ |
| forcarEmbarqueOrfao | Edge | ✅ |
| atualizarViagensTransportadoras | Edge | ✅ |
| sincronizarViagensTransportadora | Edge | ✅ |
| gerarViagensTransportadora | Edge | ✅ |
| atualizarCodigosViagens | Edge | ✅ |
| convidarUsuarios | Edge (Supabase Auth invite) | ✅ |
| automacaoAprovacaoFinanceira | Trigger | ✅ migration 024 |
| atualizarTotaisSupermanifesto | Trigger | ✅ migration 024 |
| auditarEspelhosCanonicos | Edge | ✅ |
| generateConferenceCode / validateConferenceCode | Edge | ✅ |
| calcularIEP | Edge | ✅ |
| atualizarMetasEstoque | Edge | ✅ |
| limparAbcdJobProdutos | Edge | ✅ |
| sincronizarStatusFinanceiro | Edge | ✅ |
| registrarGatilhoSupermanifesto | Edge | ✅ |
| repararLancamentosPedidosAprovados | Edge | ✅ |
| excluirLancamentosGeradosAutoAntesData | Edge | ✅ |
| exportProdutosCompra | RPC + Edge | ✅ |
| gerarTemplatePedidoCompra | Edge | ✅ |
| vincularItensPedidoAManifesto | Edge | ✅ |
| normalizarPedidosCompraPendentes | Edge | ✅ |
| enhanceLogo | Edge (OpenAI) | ✅ |
| listarCatalogoInterface | Edge | ✅ |
| protegerInteligenciaLayout | Edge | ✅ |

## Onda 4 — DevOps, migração, admin

| Função | Destino | Status |
|--------|---------|--------|
| migrarBase44ParaSupabase | Edge | ✅ (one-shot; dados já migrados) |
| migrar*ItensLegacy (×4) | Edge | ✅ |
| migrarProdutoUnidades | Edge | ✅ |
| exportFlareToGithub | Edge (GitHub PAT) | ✅ |
| syncCodebaseToGithub | Edge | ✅ |
| debugGithubIdentity | Edge | ✅ |
| listFlarePending | RPC + Edge | ✅ |
| commitBabelPlugin | Edge | ✅ |
| commitMigrationManifests | Edge | ✅ |
| readViteConfig | Edge | ✅ |
| zerarEntidade | RPC + Edge | ✅ |
| generateProductImages | — | ❌ stub vazio |
| sincronizarDelecaoLancamentos | — | ❌ inativa |

## Integrações Core (frontend)

`supabaseAdapter.js` — Upload via Storage; LLM/email/imagem via Edge `p38-core`.

## Deploy

```bash
npm run supabase:deploy          # migrações + functions
npm run supabase:port-functions  # regenerar a partir do Base44 (se entry.ts mudar)
```

## Secrets Edge (produção)

| Variável | Uso |
|----------|-----|
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | todas |
| RESEND_API_KEY | email / PIN |
| OPENAI_API_KEY | LLM, imagens |
| GITHUB_TOKEN | Flare → GitHub |
| GOOGLE_DRIVE_ACCESS_TOKEN | só se ainda usar Drive (anexos legados) |
| SUPABASE_ANEXOS_BUCKET | default `anexos` |
