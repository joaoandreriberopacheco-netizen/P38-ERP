import { randomBytes } from 'node:crypto';
import { fluvialLimiteProspectivoKey } from '../../src/lib/fluvialForecastHorizon.js';

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

function isSameOrBefore(dateA, dateB) {
  return createUtcDate(dateA).getTime() <= createUtcDate(dateB).getTime();
}

function buildCodigoAleatorio() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let output = '';
  for (let index = 0; index < 6; index += 1) {
    output += chars[bytes[index] % chars.length];
  }
  return `${output.slice(0, 3)}-${output.slice(3)}`;
}

async function codigoJaExiste(entities, codigo) {
  const resultados = await entities.EventoLogisticoSandbox.filter({ codigo }, null, 1);
  return (resultados || []).length > 0;
}

async function gerarCodigoUnico(entities, codigosLocais) {
  for (let tentativas = 0; tentativas < 200; tentativas += 1) {
    const codigo = buildCodigoAleatorio();
    if (codigosLocais.has(codigo)) continue;
    if (await codigoJaExiste(entities, codigo)) {
      codigosLocais.add(codigo);
      continue;
    }
    codigosLocais.add(codigo);
    return codigo;
  }
  throw new Error('Não foi possível gerar um código único para a viagem');
}

/**
 * Mesma lógica da Edge Function, via service role no Postgres (scripts admin).
 */
export async function gerarViagensTransportadoraLocal(entities, transportadora) {
  const transportadoraId = transportadora.id;
  if (!transportadora.saida_referencia) {
    throw new Error('Transportadora sem saída de referência');
  }

  const limiteProspectivo = fluvialLimiteProspectivoKey();
  const sequenciaMaxima = 999;

  const [viagensPorTransportadoraId, viagensPorEmbarcacaoId] = await Promise.all([
    entities.EventoLogisticoSandbox.filter({ transportadora_id: transportadoraId }, '-data_saida_origem', 500),
    entities.EventoLogisticoSandbox.filter({ embarcacao_template_id: transportadoraId }, '-data_saida_origem', 500),
  ]);
  const viagensPorId = new Map();
  for (const viagem of [...(viagensPorTransportadoraId || []), ...(viagensPorEmbarcacaoId || [])]) {
    const normalizada = viagem.data || viagem;
    if (normalizada?.id) viagensPorId.set(normalizada.id, normalizada);
  }
  const viagensNormalizadas = [...viagensPorId.values()];
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
      const codigo = await gerarCodigoUnico(entities, codigosLocais);
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
    await entities.EventoLogisticoSandbox.bulkCreate(novasViagens);
  }

  return { created: novasViagens.length, limite_global: limiteProspectivo };
}
