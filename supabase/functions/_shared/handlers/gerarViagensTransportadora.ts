// Port automático de base44/functions/gerarViagensTransportadora/entry.ts
import type { createP38Client } from '../p38Client.ts';
import { fluvialLimiteProspectivoKey } from '../fluvialForecastHorizon.ts';

function createUtcDate(dateString, hour = 12) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days, hour = 12) {
  const date = createUtcDate(dateString, hour);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function buildCodigoAleatorio() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let output = '';

  for (let index = 0; index < 6; index += 1) {
    output += chars[bytes[index] % chars.length];
  }

  return `${output.slice(0, 3)}-${output.slice(3)}`;
}

async function codigoJaExiste(base44, codigo) {
  const resultados = await base44.asServiceRole.entities.EventoLogisticoSandbox.filter({ codigo }, null, 1);
  return resultados.length > 0;
}

async function gerarCodigoUnico(base44, codigosLocais) {
  let tentativas = 0;

  while (tentativas < 200) {
    const codigo = buildCodigoAleatorio();
    if (codigosLocais.has(codigo)) {
      tentativas += 1;
      continue;
    }

    if (await codigoJaExiste(base44, codigo)) {
      codigosLocais.add(codigo);
      tentativas += 1;
      continue;
    }

    codigosLocais.add(codigo);
    return codigo;
  }

  throw new Error('Não foi possível gerar um código único para a viagem');
}

function isSameOrBefore(dateA, dateB) {
  return createUtcDate(dateA).getTime() <= createUtcDate(dateB).getTime();
}

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    // base44 injetado por servePorted
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transportadoraId } = await req.json();

    if (!transportadoraId) {
      return Response.json({ error: 'transportadoraId é obrigatório' }, { status: 400 });
    }

    const transportadoras = await base44.asServiceRole.entities.Transportadora.filter({ id: transportadoraId });
    const transportadora = transportadoras?.[0]?.data || transportadoras?.[0];

    if (!transportadora) {
      return Response.json({ error: 'Transportadora não encontrada' }, { status: 404 });
    }

    if (!transportadora.saida_referencia) {
      return Response.json({ error: 'Transportadora sem saída de referência' }, { status: 400 });
    }

    const limiteProspectivo = fluvialLimiteProspectivoKey();
    const sequenciaMaxima = 999;

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
    const viagensNormalizadas = Array.from(viagensPorId.values());
    const codigosLocais = new Set(viagensNormalizadas.map((viagem) => viagem.codigo).filter(Boolean));
    const saidasExistentes = new Set(viagensNormalizadas.map((viagem) => viagem.data_saida_origem).filter(Boolean));

    let sequencia = 1;
    const novasViagens = [];

    while (sequencia <= sequenciaMaxima) {
      const saidaManaus = addDays(transportadora.saida_referencia, (sequencia - 1) * 21, 12);

      if (!isSameOrBefore(saidaManaus, limiteProspectivo)) {
        break;
      }

      if (!saidasExistentes.has(saidaManaus)) {
        const codigo = await gerarCodigoUnico(base44, codigosLocais);
        const chegadaManaus = addDays(saidaManaus, -7, 12);
        const etaTabatinga = addDays(saidaManaus, 7, 12);
        const proximaChegadaManaus = addDays(saidaManaus, 21, 12);

        novasViagens.push({
          nome: `${transportadora.nome} · ${codigo}`,
          codigo,
          embarcacao_template_id: transportadoraId,
          embarcacao_nome: transportadora.nome,
          rota_nome: 'Manaus → Tabatinga',
          status_operacao: 'Atracado na Origem',
          data_referencia: chegadaManaus,
          data_chegada_manaus: chegadaManaus,
          data_saida_origem: saidaManaus,
          previsao_chegada: etaTabatinga,
          data_chegada_destino: etaTabatinga,
          previsao_retorno: proximaChegadaManaus,
          data_retorno_origem: proximaChegadaManaus,
          proxima_chegada_manaus: proximaChegadaManaus,
          ocupacao_percentual: 0,
          dias_atraso: 0,
          transportadora_id: transportadora.id,
          transportadora_nome: transportadora.nome,
          tipo_registro: 'Viagem',
          observacoes: transportadora.observacoes || '',
          chave_relacional_futura: 'viagem_id',
        });
      }

      sequencia += 1;
    }

    if (novasViagens.length > 0) {
      await base44.asServiceRole.entities.EventoLogisticoSandbox.bulkCreate(novasViagens);
    }

    return Response.json({
      created: novasViagens.length,
      viagens: novasViagens,
      limite_global: limiteProspectivo,
      skipped: false,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
