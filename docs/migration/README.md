# Migração Base44 → stack própria (canal GitHub)

Este diretório é o **canal versionado** para pedidos, respostas e artefactos da migração: o que estiver aqui em `main` (ou na vossa branch) é a **fonte de verdade** para a equipa e para o Cursor — não depende da memória de um chat.

## Política: peças (vital) vs carga (operacional)

Separar o que **tem de existir** para o motor da app funcionar do que é **volume de negócio** evita migrações frágeis e custosas à toa.

| Tipo | O que é | Como trazer |
|------|---------|-------------|
| **Peças (vital)** | Referências, catálogo de UI, tabelas de apoio, parâmetros mínimos sem os quais ecrãs ou fluxos rebentam (ex.: formas de pagamento, contas financeiras base, categorias, `catalogo_interface`, perfis de acesso, transportadoras se o fluxo exigir, etc.) | **Migrar sim ou sim** (seed versionado em `supabase/seed.sql` + extensões, script `migrate:base44-to-supabase` com `--only=…` para entidades concretas, ou SQL/Studio quando fizer sentido). |
| **Carga (dados)** | Histórico de vendas, movimentos antigos, pedidos fechados — e **catálogo de produtos** se preferirem controlo editorial | **Produtos:** import direto no Supabase (CSV/XLSX no Table Editor ou `COPY`/ferramentas oficiais). **Resto da carga:** opcional, faseada, ou só a partir de cutover. |

**Partida fria só com stock de produtos:** ver `supabase/scripts/cold_start_keep_produto.sql` e `npm run db:cold-start-keep-produto` (com `CONFIRM_COLD_START=1`). Depois encher **peças** via seed ou migração selectiva; **produtos** via XLSX.

Para uma lista técnica de entidades e funções, cruzar com `src/docs/migration/ENTITIES_MANIFEST.json` e `MIGRATION_CHECKLIST.md`.

## Documentos

- **[REQUEST_BASE44_AUTOMATED_MIGRATION_DISCLOSURE.md](./REQUEST_BASE44_AUTOMATED_MIGRATION_DISCLOSURE.md)** — Pedido formal ao Base44 para **revelar todo o âmbito** de integrações, análise e automações em formatos **automatizáveis** (migração o menos manual possível).
- **[REQUEST_BASE44_SIZING_FOR_SUPABASE.md](./REQUEST_BASE44_SIZING_FOR_SUPABASE.md)** — Pedido para o Base44 **verificar e reportar** métricas críticas (BD, storage, egress, MAU, invocações, realtime, integrações) para dimensionar **Supabase Pro**.
- **[SIZING_REPORT_BASE44.md](./SIZING_REPORT_BASE44.md)** — **Estimativas** devolvidas pelo assistente Base44 (tamanho BD, storage, MAU, egress, etc.) + métricas que exigem **ticket oficial**.
- **[GAPS_E_LIGACOES_DETALHADAS_2.0.md](./GAPS_E_LIGACOES_DETALHADAS_2.0.md)** — Versão de referência atualizada (2.0) para lacunas e ligações da transição P38/Base44 → SubPayze.
- **[PARALLEL_REPO_SETUP.md](./PARALLEL_REPO_SETUP.md)** — Setup do repositório paralelo (espelho), governança de branches e política de sincronização com o principal.
- **[P38_CONSOLIDATION.md](./P38_CONSOLIDATION.md)** — Estado da consolidação da camada P38 e contrato operacional do adapter SubPayze em sandbox.
- **[SUPABASE_TEST_SETUP.md](./SUPABASE_TEST_SETUP.md)** — Provisionamento do Supabase de homologação com migrações versionadas e seed de teste.
- **[P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md](./P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md)** — Guia detalhado: onde obter cada chave e onde gravar (GitHub + Cursor).
- **[P38_SECRETS_CANONICOS.md](./P38_SECRETS_CANONICOS.md)** — Referência técnica dos nomes; `npm run secrets:audit` para validar.
- **[P38_CONTINUIDADE_OPERACIONAL.md](./P38_CONTINUIDADE_OPERACIONAL.md)** — O sistema continua sem o fundador? Avião comercial vs. ficheiro txt.
- **[PHASE_1_HOMOLOGACAO.md](./PHASE_1_HOMOLOGACAO.md)** — Fase 1: schema alinhado ao manifesto (18 entidades), homolog local/cloud, **sem cutover** de produção.
- **[CRITICAL_PARITY_VALIDATION.md](./CRITICAL_PARITY_VALIDATION.md)** — Matriz de testes de paridade dos fluxos críticos e query pack de validação.
- **[API_DOC_VS_REALITY_CHECKLIST.md](./API_DOC_VS_REALITY_CHECKLIST.md)** — Checklist para validar documentação de APIs externas contra comportamento real (auth, paginação, erros, webhooks) antes de espelhar na casca 2.0.
- **[CUTOVER_RUNBOOK.md](./CUTOVER_RUNBOOK.md)** — Critérios go/no-go, sequência de virada definitiva e rollback.

## Como usar com o assistente Base44

1. Abre o ficheiro `REQUEST_BASE44_AUTOMATED_MIGRATION_DISCLOSURE.md` no repositório (ou copia o bloco “Colar no assistente Base44”).
2. Cola no canal de IA do Base44 e pede que **devolva os artefactos** (JSON, Markdown, scripts) de forma a poderes **colar de volta** num PR nesta pasta `docs/migration/` ou em `scripts/`.
3. Faz **merge** no GitHub — assim o “canal GitHub” fica com o histórico do que foi acordado e gerado.

### Se o assistente “escreveu” ficheiros só no chat

O conteúdo **não existe no Git** até colares ou fazeres upload. Nomes típicos devolvidos pelo assistente (exemplo real):

- `ENTITIES_MANIFEST.json`
- `AUTOMATIONS_MANIFEST.json`
- `FUNCTIONS_MANIFEST.json`
- `MIGRATION_CHECKLIST.md`

**Ação:** cria estes ficheiros em `docs/migration/` com o conteúdo exacto que ele gerou → **commit + push**. Até lá, a nossa análise no Cursor não os vê.

## Follow-up ao Base44

- **[PROMPT_BASE44_STORAGE_FOLLOWUP.md](./PROMPT_BASE44_STORAGE_FOLLOWUP.md)** — Leitura rápida da primeira resposta + **prompt para copiar/colar** sobre métricas de **armazenamento** (e egress de ficheiros).
- **[PROMPT_BASE44_WHAT_IS_STILL_MISSING.md](./PROMPT_BASE44_WHAT_IS_STILL_MISSING.md)** — Prompt em **português** ao Base44: detalhe de **“mapa elétrico”** (contratos Core, fluxos botão→função→entidade, auth, realtime, conectores) para **paridade de funcionamento** fora da plataforma; sem foco jurídico.

## Manifestos gerados / auditados (código)

Os ficheiros `ENTITIES_MANIFEST.json`, `AUTOMATIONS_MANIFEST.json`, `FUNCTIONS_MANIFEST.json` e `MIGRATION_CHECKLIST.md` estão em **`src/docs/migration/`** (não nesta pasta `docs/migration/`).

- **`FUNCTIONS_MANIFEST.json`** — inclui `audit_notes` após verificação com `grep` no repo (integrações Core + conectores).

## Ligações úteis no código

- Integrações expostas no cliente: `src/api/integrations.js`
- Funções serverless no repo: `base44/functions/` (55 `entry.ts` no momento da criação deste README — o número pode mudar; usa `Get-ChildItem -Recurse -Filter entry.ts` para atualizar).
