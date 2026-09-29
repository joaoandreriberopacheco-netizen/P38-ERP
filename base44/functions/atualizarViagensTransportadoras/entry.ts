import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
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
});