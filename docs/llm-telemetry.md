# Telemetria de IA (plano em 3 passos)

Controlo de custo das leituras com Gemini (OCR de pedidos, boletos, cotações).

## Passo 1 — Instrumentar

Cada chamada `InvokeLLM` no `p38-core` regista:

- provedor e modelo (Gemini)
- tokens de entrada, saída e total
- duração, sucesso/erro
- contexto opcional enviado pelo cliente (`source`, `catalog_product_count`, `file_count`)

**Ficheiros:** `supabase/functions/_shared/integrations.ts`, `supabase/functions/p38-core/index.ts`, `supabase/functions/_shared/llmTelemetry.ts`

No frontend, use `buildLlmTelemetryContext()` de `src/lib/p38LlmTelemetry.js` ao chamar `InvokeLLM`.

## Passo 2 — Persistir

Migração `046_llm_telemetry.sql`:

- Tabela `p38_llm_telemetry`
- RPC `p38_llm_telemetry_resumo(p_dias)` para o painel

**Deploy:**

```bash
npm run supabase:deploy
```

(ou só migrações: `npm run db:apply-migrations`)

## Passo 3 — Consultar

- **Painel:** Configurações → Sistema → *Telemetria de IA (OCR)* ou rota `/LlmTelemetria`
- **API:** `fetchLlmTelemetryResumo(dias)` em `src/lib/llmTelemetryApi.js`

### Metas saudáveis

| Indicador | Meta |
|-----------|------|
| Tokens por chamada | &lt; 12 000 |
| Catálogo no prompt | 0 produtos (matching local depois do OCR) |
| Custo por leitura | centavos (Gemini Flash) |

Se `alerta_catalogo_no_prompt` estiver ativo, o próximo passo de otimização é tirar o catálogo do prompt e fazer matching local (como em `ImportadorCotacaoPDF`).

## Origens (`source`) instrumentadas

| source | Onde |
|--------|------|
| `import_pedido_compra` | Importar pedido — catálogo compacto TSV no prompt (match semântico Gemini) |
| `import_cotacao_pdf` | Cotação PDF |
| `import_lista_foto` | Lista por foto |
| `agefin_importador` | Agefin — leitura de boleto |
| `agefin_importador_retry` | Agefin — segunda tentativa |
| `comprovante_bancario` | Comprovante PIX/TED |
