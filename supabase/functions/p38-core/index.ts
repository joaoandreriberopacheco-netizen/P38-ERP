// Core integrations proxy (LLM, email, storage helpers server-side)
import { requireUser, jsonResponse, badRequest, serviceClient } from '../_shared/auth.ts';
import { buildCoreIntegrations } from '../_shared/integrations.ts';

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const op = String(body.op || '');
  const Core = buildCoreIntegrations();

  try {
    switch (op) {
      case 'InvokeLLM':
        return jsonResponse(await Core.InvokeLLM(body));
      case 'GenerateImage':
        return jsonResponse(await Core.GenerateImage(body));
      case 'SendEmail':
        return jsonResponse(await Core.SendEmail(body));
      case 'CreateFileSignedUrl':
        return jsonResponse(await Core.CreateFileSignedUrl(body));
      default:
        return badRequest(`op inválida: ${op}`);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
