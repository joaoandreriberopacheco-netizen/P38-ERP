import { createP38Client } from './p38Client.ts';

export type PortedHandler = (req: Request, base44: Awaited<ReturnType<typeof createP38Client>>) => Promise<Response>;

/** Envolve handler portado do Base44 com cliente P38 e tratamento de erros. */
export function servePorted(handler: PortedHandler) {
  return async (req: Request): Promise<Response> => {
    try {
      const base44 = await createP38Client(req);
      return await handler(req, base44);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[P38][ported]', message);
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
