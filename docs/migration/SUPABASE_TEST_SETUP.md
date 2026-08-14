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

### Portal catálogo cerâmica (tabela auxiliar)

O piloto cerâmica do menu **Compras → Portal catálogo** trabalha em **`public.portal_catalog`** (migração `067_portal_catalog.sql`), **não** altera `public.produto` ao reservar SKUs.

**Popular a tabela auxiliar:**

```bash
npm run supabase:deploy -- --migrations-only   # aplica 067 se pendente
npm run portal:catalog:seed -- --apply         # 174 SKUs do manifest JSON
npm run portal:catalog:import -- --apply       # ou directamente do Excel piloto
```

**Reserva (só `portal_catalog.reserva_portal`):**

```bash
npm run reserva:listar
npm run reserva:reativar -- --apply
```

Se existirem SKUs afectados pela reserva **antiga** (tag `reserva-ceramica` / `ativo=false` no cadastro), use:

```bash
npm run reserva:reativar -- --apply --legacy-cadastro
```

Flags opcionais de UI:

- `VITE_CADASTRO_PRODUTO_V2_ENABLED=true` — aba cadastro no portal
- `VITE_MODELO_CATALOGO_ENABLED=true` — laboratório modelo (opcional)

Leitura de estoque/preço continua a vir de `produto`; hierarquia, reserva e import Excel vivem em `portal_catalog`.

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
