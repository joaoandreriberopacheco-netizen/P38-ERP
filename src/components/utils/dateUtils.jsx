/**
 * Utilitário centralizado de data/hora do sistema VarejoSync.
 *
 * Negócio: **Tabatinga, AM, Brasil** — fuso IANA `America/Rio_Branco` (UTC−5 o ano todo, sem horário de verão).
 * Não confundir o nome IANA “Rio_Branco” com a cidade; é o identificador oficial do fuso do Acre/Amazonas ocidental.
 * Para instantes persistidos use `agora()`; para “dia civil” do negócio use `dataHoje()` e funções deste módulo.
 */

/** Metadados para UI / documentação (o fuso técnico é `TIMEZONE_SISTEMA`). */
export const LOCAL_NEGOCIO = Object.freeze({
  cidade: 'Tabatinga',
  uf: 'AM',
  pais: 'Brasil',
  iana: 'America/Rio_Branco',
  offsetLabel: 'UTC−5',
});

export const TIMEZONE_SISTEMA = 'America/Rio_Branco';

/**
 * Timestamp atual em ISO UTC (instante absoluto). Use para `created_date`,
 * auditoria, etc. Para **chave de dia civil** no negócio (YYYY-MM-DD em Tabatinga),
 * use `dataHoje()` — nunca `toISOString().slice(0, 10)` (isso é o dia em UTC).
 */
export function agora() {
  return new Date().toISOString();
}

/**
 * Retorna a data de hoje no fuso do sistema no formato yyyy-MM-dd.
 * Use para campos de tipo "date" (sem hora).
 * @returns {string} e.g. "2026-03-16"
 */
export function dataHoje() {
  const d = new Date();
  const local = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Data civil de hoje menos N dias (UTC−5 Tabatinga; mesmo critério de `dataHoje`).
 * @param {number} diasAtras inteiro ≥ 0
 */
export function dataMenosDiasSistema(diasAtras) {
  const t = Date.now() - Number(diasAtras) * 86400000;
  const local = new Date(t - 5 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Primeiro e último dia do mês civil em `YYYY-MM-DD` (calendário universal; seguro para vencimentos só-data).
 * @param {number} year ex. 2026
 * @param {number} monthIndexZeroBased 0 = janeiro
 */
export function boundsMesCivil(year, monthIndexZeroBased) {
  const pad = (n) => String(n).padStart(2, '0');
  const m = monthIndexZeroBased + 1;
  const start = `${year}-${pad(m)}-01`;
  const ultimoDia = new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).getUTCDate();
  return { start, end: `${year}-${pad(m)}-${pad(ultimoDia)}` };
}

/**
 * Mantém o mês/ano de `alvoYmd` e aplica o dia civil de `referenciaYmd`,
 * limitando ao último dia do mês de destino (ex.: 31 → fevereiro vira 28/29).
 * @param {string} referenciaYmd YYYY-MM-DD (fonte do dia)
 * @param {string} alvoYmd YYYY-MM-DD (competência de destino)
 */
export function vencimentoComMesmoDiaNoMes(referenciaYmd, alvoYmd) {
  const ref = String(referenciaYmd || '').slice(0, 10);
  const alvo = String(alvoYmd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ref) || !/^\d{4}-\d{2}-\d{2}$/.test(alvo)) return alvo || ref;
  const diaRef = parseInt(ref.slice(8, 10), 10);
  const y = parseInt(alvo.slice(0, 4), 10);
  const m = parseInt(alvo.slice(5, 7), 10);
  const mi = m - 1;
  const ultimo = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate();
  const dia = Math.min(diaRef, ultimo);
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(dia)}`;
}

/** Offset fixo do negócio (Tabatinga / America/Rio_Branco). */
const OFFSET_SISTEMA = '-05:00';

/**
 * Início do dia civil no fuso do negócio como ISO UTC (filtros `$gte` na API).
 */
export function inicioDiaSistemaISO(dateStrYyyyMmDd) {
  return new Date(`${dateStrYyyyMmDd}T00:00:00${OFFSET_SISTEMA}`).toISOString();
}

/**
 * Fim do dia civil no fuso do negócio como ISO UTC (filtros `$lte` na API).
 */
export function fimDiaSistemaISO(dateStrYyyyMmDd) {
  return new Date(`${dateStrYyyyMmDd}T23:59:59.999${OFFSET_SISTEMA}`).toISOString();
}

/**
 * Converte `YYYY-MM-DD` (dia civil em Tabatinga) em ISO UTC do **meio-dia** local (−5).
 * Use ao gravar campos “só data” quando a API espera um instante — evita deslocar o dia vs. `...Z` em UTC.
 */
export function meioDiaSistemaISO(dateStrYyyyMmDd) {
  if (!dateStrYyyyMmDd) return null;
  const d = String(dateStrYyyyMmDd).slice(0, 10);
  return new Date(`${d}T12:00:00${OFFSET_SISTEMA}`).toISOString();
}

/**
 * Segunda-feira da mesma semana civil que o dia `YYYY-MM-DD` (semana começa na segunda).
 * Usa apenas calendário gregoriano (sem depender do fuso do navegador).
 */
export function inicioSemanaCivilDesdeYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const dow = day.getUTCDay();
  const diffToMon = (dow + 6) % 7;
  const mon = new Date(Date.UTC(y, m - 1, d - diffToMon));
  const yy = mon.getUTCFullYear();
  const mm = String(mon.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(mon.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Converte uma data/timestamp para o fuso do negócio (UTC−5 fixo, Tabatinga).
 * Usa offset manual como fallback garantido para Android/WebView.
 * @param {string|Date} valor
 * @returns {Date} objeto Date ajustado para UTC-5
 */
function parseDateValue(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  if (typeof valor !== 'string') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return new Date(`${valor}T00:00:00${OFFSET_SISTEMA}`);
  }

  const normalized = /([zZ]|[+-]\d{2}:\d{2})$/.test(valor) ? valor : `${valor}Z`;
  const parsed = new Date(normalized);
  if (!isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(valor);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function toRioBranco(valor) {
  const d = parseDateValue(valor);
  if (!d) return null;
  // Aplica offset UTC-5 manualmente (5 * 60 * 60 * 1000 ms)
  return new Date(d.getTime() - 5 * 60 * 60 * 1000);
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Formata um timestamp para exibição no fuso do sistema (com hora).
 * Usa offset UTC-5 fixo — funciona em qualquer navegador/Android.
 * @param {string|Date} valor
 * @returns {string} e.g. "16/03/2026 10:32"
 */
export function formatarDataHora(valor) {
  const local = toRioBranco(valor);
  if (!local) return '—';
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/**
 * Formata apenas a data (sem hora) no fuso do sistema (UTC-5 fixo).
 * @param {string|Date} valor
 * @returns {string} e.g. "16/03/2026"
 */
export function formatarSoData(valor) {
  if (!valor) return '—';
  // Campos só-data (YYYY-MM-DD) não precisam de conversão de fuso
  if (typeof valor === 'string' && valor.length === 10) {
    const [y, m, dd] = valor.split('-');
    return `${dd}/${m}/${y}`;
  }
  const local = toRioBranco(valor);
  if (!local) return '—';
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
}

// Meses em pt-BR — evita Intl.DateTimeFormat em Android WebView
const MESES_CURTOS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESES_LONGOS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/**
 * Dia civil YYYY-MM-DD para campos financeiros (date, timestamptz meia-noite UTC, etc.).
 * Evita deslocar o dia ao interpretar `...T00:00:00.000Z` como instante UTC.
 */
export function chaveDiaCampoData(valor) {
  if (valor == null || valor === '') return '';
  const s = String(valor).trim();
  const d10 = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d10)) {
    if (s.length === 10) return d10;
    if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/i.test(s)) return d10;
  }
  const local = toRioBranco(valor);
  if (!local) return '';
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

/**
 * Retorna chave YYYY-MM-DD no fuso UTC-5 — para agrupamentos de listas.
 * @param {string|Date} valor
 * @returns {string} e.g. "2026-03-16"
 */
export function toLocalDateKey(valor) {
  return chaveDiaCampoData(valor);
}

/**
 * Formata data curta estilo "16 mar" — para uso em listas/rows.
 * Campos só-data (YYYY-MM-DD) são tratados sem conversão de fuso.
 * @param {string|Date} valor
 * @returns {string} e.g. "16 mar"
 */
export function formatarDataCurta(valor) {
  if (!valor) return '—';
  if (typeof valor === 'string' && valor.length === 10) {
    const [, m, dd] = valor.split('-');
    return `${parseInt(dd, 10)} ${MESES_CURTOS[parseInt(m, 10) - 1]}`;
  }
  const local = toRioBranco(valor);
  if (!local) return '—';
  return `${local.getUTCDate()} ${MESES_CURTOS[local.getUTCMonth()]}`;
}

/**
 * Formata data longa estilo "16 de março de 2026".
 * @param {string|Date} valor
 * @returns {string}
 */
export function formatarDataLonga(valor) {
  if (!valor) return '—';
  if (typeof valor === 'string' && valor.length === 10) {
    const [y, m, dd] = valor.split('-');
    return `${parseInt(dd, 10)} de ${MESES_LONGOS[parseInt(m, 10) - 1]} de ${y}`;
  }
  const local = toRioBranco(valor);
  if (!local) return '—';
  return `${local.getUTCDate()} de ${MESES_LONGOS[local.getUTCMonth()]} de ${local.getUTCFullYear()}`;
}

/** @deprecated Use formatarSoData */
export function formatarData(valor) { return formatarSoData(valor); }

/**
 * Retorna a data de hoje (início do dia UTC-5) como objeto Date.
 * @returns {Date}
 */
export function inicioDiaHoje() {
  const hoje = dataHoje();
  return new Date(`${hoje}T00:00:00${OFFSET_SISTEMA}`);
}

/**
 * Retorna uma string "dd/MM HH:mm" no fuso UTC-5 — útil para logs.
 * @param {string|Date} [valor]
 * @returns {string} e.g. "16/03 10:32"
 */
export function formatarLogTime(valor) {
  const ts = valor || new Date();
  const local = toRioBranco(ts);
  if (!local) return '—';
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/**
 * Código de ordenação AAAAMMDDHHMMSS no fuso do negócio (Tabatinga).
 * @param {string|Date} valor
 * @returns {string|null}
 */
export function codigoOrdenacaoDesdeInstante(valor) {
  const local = toRioBranco(valor);
  if (!local) return null;
  return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}${pad(local.getUTCSeconds())}`;
}

/**
 * Código de ordenação a partir de campo só-data (hora 00:00:00).
 * @param {string} ymd YYYY-MM-DD
 * @returns {string|null}
 */
export function codigoOrdenacaoDesdeDataSomente(ymd) {
  const d = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return `${d.replace(/-/g, '')}000000`;
}

/**
 * Converte valor de `<input type="datetime-local">` para ISO UTC.
 * @param {string} datetimeLocal e.g. "2026-06-18T14:30"
 * @returns {string|null}
 */
export function datetimeLocalParaISO(datetimeLocal) {
  if (!datetimeLocal) return null;
  const s = String(datetimeLocal).trim();
  if (!s) return null;
  const normalized = s.length === 16 ? `${s}:00` : s;
  return new Date(`${normalized}${OFFSET_SISTEMA}`).toISOString();
}

/**
 * Converte ISO UTC para valor de `<input type="datetime-local">` no fuso do negócio.
 * @param {string|Date} iso
 * @returns {string} e.g. "2026-06-18T14:30" ou "" se inválido
 */
export function isoParaInputDatetimeLocal(iso) {
  if (!iso) return '';
  const local = toRioBranco(iso);
  if (!local) return '';
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/**
 * Valor atual formatado para `<input type="datetime-local">` no fuso do negócio.
 * @returns {string}
 */
export function agoraParaInputDatetimeLocal() {
  const local = toRioBranco(new Date());
  if (!local) return '';
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}