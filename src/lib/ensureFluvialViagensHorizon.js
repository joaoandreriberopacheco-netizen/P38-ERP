import { addDays, format, parseISO } from 'date-fns';
import { gerarViagensTransportadora } from '@/functions/gerarViagensTransportadora';
import {
  FLUVIAL_FORECAST_MONTHS,
  fluvialForecastMonthKey,
  fluvialLimiteProspectivoKey,
} from '@/lib/fluvialForecastHorizon';

const SESSION_DAY_KEY = 'p38:fluvial-viagens-ensure-date';
const SESSION_MONTH_KEY = 'p38:fluvial-viagens-ensure-month';

/** Intervalo entre saídas de Manaus na grade de viagens. */
const DIAS_CICLO_VIAGEM = 21;

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Última saída aceitável: até um ciclo antes do limite (a grade salta de 21 em 21 dias).
 */
export function fluvialMinUltimaSaidaAceitavelKey() {
  const limite = fluvialLimiteProspectivoKey();
  return format(addDays(parseISO(limite), -DIAS_CICLO_VIAGEM), 'yyyy-MM-dd');
}

function transportadoraIdFromEvento(evento) {
  return evento?.transportadora_id || evento?.embarcacao_template_id || null;
}

export function maxDataSaidaOrigemPorTransportadora(eventos = [], transportadoraId) {
  let max = null;
  for (const evento of eventos) {
    if (transportadoraIdFromEvento(evento) !== transportadoraId) continue;
    const saida = evento?.data_saida_origem;
    if (!saida) continue;
    if (!max || saida > max) max = saida;
  }
  return max;
}

/**
 * Alguma transportadora ativa ficou curta no forecast de 3 meses.
 */
export function fluvialViagensNeedHorizonExtension(transportadoras = [], eventos = []) {
  const minAceitavel = fluvialMinUltimaSaidaAceitavelKey();
  const ativas = (transportadoras || []).filter(
    (item) => item?.id && item.ativo !== false && item.saida_referencia,
  );

  if (!ativas.length) return false;

  return ativas.some((transportadora) => {
    const ultimaSaida = maxDataSaidaOrigemPorTransportadora(eventos, transportadora.id);
    if (!ultimaSaida) return true;
    return ultimaSaida < minAceitavel;
  });
}

function isNewForecastMonth() {
  if (typeof sessionStorage === 'undefined') return true;
  const month = fluvialForecastMonthKey();
  return sessionStorage.getItem(SESSION_MONTH_KEY) !== month;
}

/**
 * Mantém forecast de 3 meses (fim de mês civil) sem apagar viagens existentes.
 *
 * - Virada de mês: corre sempre (equivalente a “acabou o mês → cria +1 mês à frente”).
 * - Horizonte curto: corre sempre (ex.: Embaixador parou na 27H-PZB).
 * - Caso contrário: no máximo uma vez por dia por sessão.
 */
export async function ensureFluvialViagensHorizon(transportadoras = [], eventos = []) {
  const day = todayKey();
  const needsExtension = fluvialViagensNeedHorizonExtension(transportadoras, eventos);
  const monthRollover = isNewForecastMonth();

  if (
    !needsExtension
    && !monthRollover
    && typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem(SESSION_DAY_KEY) === day
  ) {
    return {
      skipped: true,
      reason: 'already_ran_today',
      created: 0,
      needsExtension,
      monthRollover,
      limiteProspectivo: fluvialLimiteProspectivoKey(),
      forecastMonths: FLUVIAL_FORECAST_MONTHS,
    };
  }

  const ativas = (transportadoras || []).filter(
    (item) => item?.id && item.ativo !== false && item.saida_referencia,
  );

  if (!ativas.length) {
    return {
      skipped: true,
      reason: 'no_active_carriers',
      created: 0,
      needsExtension,
      monthRollover,
      limiteProspectivo: fluvialLimiteProspectivoKey(),
      forecastMonths: FLUVIAL_FORECAST_MONTHS,
    };
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
    sessionStorage.setItem(SESSION_DAY_KEY, day);
    sessionStorage.setItem(SESSION_MONTH_KEY, fluvialForecastMonthKey());
  }

  return {
    skipped: false,
    created,
    transportadoras: ativas.length,
    needsExtension,
    monthRollover,
    limiteProspectivo: fluvialLimiteProspectivoKey(),
    forecastMonths: FLUVIAL_FORECAST_MONTHS,
    errors,
  };
}

// Compat: export usado em testes / imports antigos
export { FLUVIAL_FORECAST_MONTHS as FLUVIAL_VIAGENS_HORIZON_MONTHS, fluvialLimiteProspectivoKey };
