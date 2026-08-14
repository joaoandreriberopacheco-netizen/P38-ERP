# Supabase de homologação (P38)

## Objetivo

Subir um ambiente de teste para validar paridade dos fluxos críticos antes do cutover.

## Estrutura criada

- `supabase/config.toml`
- `supabase/migrations/001_p38_core_homologation.sql` — núcleo PDV/financeiro
- `supabase/migrations/002_phase1_manifest_entities.sql` — restantes entidades do manifesto + `target_flare`
- `supabase/migrations/003_phase1_extras_manifest_overflow.sql` — coluna `extras` (JSONB) no núcleo para overflow do manifesto
- `supabase/seed.sql`

Ver também **[PHASE_1_HOMOLOGACAO.md](./PHASE_1_HOMOLOGACAO.md)** (Fase 1 completa: homolog sem cutover).

## Passos locais (CLI)

1. Instalar Supabase CLI.
2. No root do repo:
   - `supabase start`
   - `supabase db reset`
3. Conferir tabelas core no Studio:
   - `terceiro`
   - `produto`
   - `pedido_venda`
   - `movimentacao_estoque`
   - `lancamento_financeiro`
   - `contas_financeiras`
   - `formas_de_pagamento`
   - `turno_caixa`

## Variáveis de ambiente (frontend)

- `VITE_P38_PROVIDER=subpayze` (apenas em homologação)
- `VITE_P38_ENABLE_SUBPAYZE=true`
- `VITE_P38_SUBPAYZE_READY=true`
- `VITE_SUBPAYZE_API_URL`
- `VITE_SUBPAYZE_API_KEY`
- `VITE_SUBPAYZE_WEBHOOK_SECRET`

### Portal cerâmica / cadastro v2 (só homologação)

Em **produção** estes flags vêm `false` (deploy Vercel). Para testar o piloto no Cloud Agent ou `.env.local`:

- `VITE_HIERARQUIA_PORTAL_ENABLED=true`
- `VITE_CADASTRO_PRODUTO_V2_ENABLED=true`
- `VITE_MODELO_CATALOGO_ENABLED=true` (opcional — laboratório modelo)

**Atenção — cadastro partilhado:** o portal de homologação usa o **mesmo Base44 / cadastro de produtos** que a operação real. Ações como **“Enviar para reserva”** (`ativo: false` + tag `reserva-ceramica`) **alteram o cadastro de produção** se as credenciais apontarem para o app P38. O flag só esconde o botão no site de produção; **não isola dados**. Para recuperar SKUs: `npm run reserva:listar` e `npm run reserva:reativar -- --apply` (com `VITE_BASE44_APP_ID` + token no ambiente).

### Datalink híbrido (entidades → Postgres Supabase)

Com o stack local a correr (`supabase start`), no `.env.local` na raiz do app:

- `VITE_SUPABASE_URL=http://127.0.0.1:54321`
- `VITE_SUPABASE_ANON_KEY=` (key **Publishable** do output do CLI)
- `VITE_USE_SUPABASE_ENTITIES=true`

O export `base44` passa a ler/escrever nas tabelas mapeadas em `src/integrations/p38/entityTableMap.js`; auth e funções serverless continuam no Base44 até serem portados. Em homolog local os avisos de RLS no Studio são esperados; em cloud ativa RLS antes de expor a anon key.

## Critério mínimo de pronto

- Migração e seed aplicam sem erro.
- Fluxo de leitura/escrita do piloto (PDV ou financeiro) executa no ambiente de homologação.
- Logs com `request-id` disponíveis para rastreabilidade.
