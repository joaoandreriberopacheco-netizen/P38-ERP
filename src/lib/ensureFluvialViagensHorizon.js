import { format, addMonths } from 'date-fns';
import { gerarViagensTransportadora } from '@/functions/gerarViagensTransportadora';

const SESSION_KEY = 'p38:fluvial-viagens-ensure-date';

/** Re-extende quando a última saída planejada fica a menos de ~2 meses à frente. */
const MESES_BUFFER_MINIMO = 2;

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}

function maxDataSaidaOrigem(eventos = []) {
  let max = null;
  for (const evento of eventos) {
    const saida = evento?.data_saida_origem;
    if (!saida) continue;
    if (!max || saida > max) max = saida;
  }
  return max;
}

/**
 * True quando faltam viagens prospectivas (horizonte deslizante de ~3 meses no backend).
 */
export function fluvialViagensNeedHorizonExtension(eventos = []) {
  const limiteMinimo = format(addMonths(new Date(), MESES_BUFFER_MINIMO), 'yyyy-MM-dd');
  const ultimaSaida = maxDataSaidaOrigem(eventos);
  if (!ultimaSaida) return true;
  return ultimaSaida < limiteMinimo;
}

/**
 * Garante viagens prospectivas (até ~3 meses) sem apagar as existentes.
 * Idempotente: só cria saídas que ainda não existem na transportadora.
 * Corre no máximo uma vez por dia por sessão, exceto se o horizonte estiver curto.
 */
export async function ensureFluvialViagensHorizon(transportadoras = [], eventos = []) {
  const day = todayKey();
  const needsExtension = fluvialViagensNeedHorizonExtension(eventos);

  if (
    !needsExtension
    && typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem(SESSION_KEY) === day
  ) {
    return { skipped: true, reason: 'already_ran_today', created: 0, needsExtension };
  }

  const ativas = (transportadoras || []).filter(
    (item) => item?.id && item.ativo !== false && item.saida_referencia,
  );

  if (!ativas.length) {
    return { skipped: true, reason: 'no_active_carriers', created: 0, needsExtension };
  }

  let created = 0;
  const errors = [];

  for (const transportadora of ativas) {
    try {
      const { data } = await gerarViagensTransportadora({ transportadoraId: transportadora.id });
      created += Number(data?.created) || 0;
    } catch (error) {
      errors.push({ transportadoraId: transportadora.id, message: error?.message || String(error) });
    }
  }

  if (typeof sessionStorage !== 'undefined' && (created > 0 || errors.length === 0)) {
    sessionStorage.setItem(SESSION_KEY, day);
  }

  return {
    skipped: false,
    created,
    transportadoras: ativas.length,
    needsExtension,
    horizonHint: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
    errors,
  };
}
