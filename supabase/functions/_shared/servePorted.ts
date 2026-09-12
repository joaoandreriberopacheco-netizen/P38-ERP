import { createP38Client } from './p38Client.ts';
import { CORS_HEADERS, handleCorsPreflight } from './auth.ts';

export type PortedHandler = (req: Request, base44: Awaited<ReturnType<typeof createP38Client>>) => Promise<Response>;

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Envolve handler portado do Base44 com cliente P38, CORS e tratamento de erros. */
export function servePorted(handler: PortedHandler) {
  return async (req: Request): Promise<Response> => {
    const preflight = handleCorsPreflight(req);
    if (preflight) return preflight;

    try {
      const base44 = await createP38Client(req);
      const response = await handler(req, base44);
      return withCors(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[P38][ported]', message);
      return withCors(Response.json({ error: message }, { status: 500 }));
    }
  };
}
