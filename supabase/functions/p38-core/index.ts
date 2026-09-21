// Core integrations proxy (LLM, email, storage helpers server-side)
import { requireUser, jsonResponse, badRequest, handleCorsPreflight, serviceClient } from '../_shared/auth.ts';
import { buildCoreIntegrations } from '../_shared/integrations.ts';
import { structurarDocumentoOcrGroq } from '../_shared/groqOcrStruct.ts';
import { logLlmTelemetry } from '../_shared/llmTelemetry.ts';

function readTelemetryContext(body: Record<string, unknown>) {
  const raw = body.telemetry;
  if (!raw || typeof raw !== 'object') {
    return {
      source: 'invoke_llm',
      catalog_product_count: 0,
      file_count: Array.isArray(body.file_urls) ? body.file_urls.length : 0,
    };
  }
  const t = raw as Record<string, unknown>;
  return {
    source: String(t.source || 'invoke_llm'),
    catalog_product_count: Number(t.catalog_product_count) || 0,
    file_count: Number(t.file_count) || (Array.isArray(body.file_urls) ? body.file_urls.length : 0),
  };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const op = String(body.op || '');
  const Core = buildCoreIntegrations();
  const db = serviceClient();

  try {
    switch (op) {
      case 'InvokeLLM': {
        const started = Date.now();
        const telemetryCtx = readTelemetryContext(body);
        const promptChars = String(body.prompt || '').length;
        try {
          const { data, usage } = await Core.InvokeLLM(body);
          await logLlmTelemetry(db, {
            usuario_id: auth.user.id,
            ...telemetryCtx,
            ...usage,
            prompt_chars: promptChars,
            duration_ms: Date.now() - started,
            success: true,
          });
          return jsonResponse(data);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logLlmTelemetry(db, {
            usuario_id: auth.user.id,
            ...telemetryCtx,
            provider: 'gemini',
            model: '',
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            prompt_chars: promptChars,
            duration_ms: Date.now() - started,
            success: false,
            error_message: message,
          });
          throw err;
        }
      }
      case 'GenerateImage':
        return jsonResponse(await Core.GenerateImage(body));
      case 'SendEmail':
        return jsonResponse(await Core.SendEmail(body));
      case 'CreateFileSignedUrl':
        return jsonResponse(await Core.CreateFileSignedUrl(body));
      case 'StructurarDocumentoOcr': {
        const started = Date.now();
        const tipo = String(body.tipo || 'pedido_compra');
        const texto = String(body.texto || '');
        const telemetryCtx = readTelemetryContext(body);
        const promptChars = texto.length;
        try {
          const { dados, usage, model } = await structurarDocumentoOcrGroq({
            texto,
            tipo: tipo as 'pedido_compra' | 'cotacao_pdf' | 'lista_foto' | 'boleto_agefin' | 'comprovante',
          });
          await logLlmTelemetry(db, {
            usuario_id: auth.user.id,
            ...telemetryCtx,
            source: telemetryCtx.source || `ocr_groq_${tipo}`,
            ...usage,
            prompt_chars: promptChars,
            duration_ms: Date.now() - started,
            success: true,
          });
          return jsonResponse({ dados, model, modo: 'ocr_local+groq' });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logLlmTelemetry(db, {
            usuario_id: auth.user.id,
            ...telemetryCtx,
            source: telemetryCtx.source || `ocr_groq_${tipo}`,
            provider: 'groq',
            model: '',
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            prompt_chars: promptChars,
            duration_ms: Date.now() - started,
            success: false,
            error_message: message,
          });
          throw err;
        }
      }
      default:
        return badRequest(`op inválida: ${op}`);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
