// Port automático de base44/functions/atualizarViagensTransportadoras/entry.ts
import type { createP38Client } from '../p38Client.ts';

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    // base44 injetado por servePorted
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transportadoras = await base44.asServiceRole.entities.Transportadora.filter({ ativo: true }, '-updated_date', 500);
    const resultados = [];

    for (const transportadora of transportadoras) {
      if (!transportadora.saida_referencia) continue;
      const response = await base44.asServiceRole.functions.invoke('gerarViagensTransportadora', {
        transportadoraId: transportadora.id,
      });
      resultados.push({ transportadoraId: transportadora.id, ...response.data });
    }

    return Response.json({ success: true, resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
