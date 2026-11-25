// Port automático de base44/functions/sincronizarViagensTransportadora/entry.ts
import type { createP38Client } from '../p38Client.ts';

const DELETE_BATCH_SIZE = 25;

async function deleteViagensEmLotes(base44, viagens) {
  for (let index = 0; index < viagens.length; index += DELETE_BATCH_SIZE) {
    const lote = viagens.slice(index, index + DELETE_BATCH_SIZE);
    await Promise.all(
      lote.map((viagem) => base44.asServiceRole.entities.EventoLogisticoSandbox.delete(viagem.id)),
    );
  }
}

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    // base44 injetado por servePorted
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      transportadoraId,
      nome,
      saidaReferencia,
      contato,
      telefone,
      email,
      observacoes,
      ativo = true,
      recalcularViagens = true,
    } = await req.json();

    if (!transportadoraId) {
      return Response.json({ error: 'transportadoraId é obrigatório' }, { status: 400 });
    }

    const saidaReferenciaNormalizada = saidaReferencia ? new Date(`${saidaReferencia}T12:00:00`).toISOString().slice(0, 10) : null;

    await base44.asServiceRole.entities.Transportadora.update(transportadoraId, {
      nome,
      saida_referencia: saidaReferenciaNormalizada,
      contato,
      telefone,
      email,
      observacoes,
      ativo,
    });

    if (!recalcularViagens) {
      return Response.json({ success: true, skipped: true, recalcularViagens: false });
    }

    const [viagensPorTransportadoraId, viagensPorEmbarcacaoId] = await Promise.all([
      base44.asServiceRole.entities.EventoLogisticoSandbox.filter(
        { transportadora_id: transportadoraId },
        '-data_saida_origem',
        500,
      ),
      base44.asServiceRole.entities.EventoLogisticoSandbox.filter(
        { embarcacao_template_id: transportadoraId },
        '-data_saida_origem',
        500,
      ),
    ]);
    const viagensPorId = new Map();
    for (const viagem of [...viagensPorTransportadoraId, ...viagensPorEmbarcacaoId]) {
      const normalizada = viagem.data || viagem;
      if (normalizada?.id) {
        viagensPorId.set(normalizada.id, normalizada);
      }
    }

    await deleteViagensEmLotes(base44, Array.from(viagensPorId.values()));

    const response = await base44.asServiceRole.functions.invoke('gerarViagensTransportadora', {
      transportadoraId,
    });

    return Response.json({ success: true, ...response.data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
