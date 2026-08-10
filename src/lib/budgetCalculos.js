/**
 * Budgets — orçamento de despesas variáveis.
 * Entrada flexível (dia / 7 dias / ciclo / mês); saída sempre mensal.
 * Dias úteis: segunda a sábado (domingo excluído).
 */

export const MODO_ESTIMATIVA = {
  POR_DIA: 'por_dia',
  POR_SEMANA: 'por_semana',
  POR_CICLO: 'por_ciclo',
  POR_MES: 'por_mes',
};

export const MODO_ESTIMATIVA_LABELS = {
  por_dia: 'Por dia',
  por_semana: 'A cada 7 dias',
  por_ciclo: 'A cada N dias',
  por_mes: 'Por mês',
};

export const MODO_ESTIMATIVA_OPCOES = [
  { value: MODO_ESTIMATIVA.POR_DIA, label: MODO_ESTIMATIVA_LABELS.por_dia },
  { value: MODO_ESTIMATIVA.POR_SEMANA, label: MODO_ESTIMATIVA_LABELS.por_semana },
  { value: MODO_ESTIMATIVA.POR_CICLO, label: MODO_ESTIMATIVA_LABELS.por_ciclo },
  { value: MODO_ESTIMATIVA.POR_MES, label: MODO_ESTIMATIVA_LABELS.por_mes },
];

export const STATUS_CONSUMO = {
  DENTRO: 'dentro',
  ATENCAO: 'atencao',
  ACIMA: 'acima',
};

export const STATUS_CONSUMO_LABELS = {
  dentro: 'Dentro',
  atencao: 'Atenção',
  acima: 'Acima',
};

const TAGS_EXCLUIDAS_REALIZADO = new Set(['folha_previsao', 'agefin_previsao']);

export function gerarIdInterno(prefix = 'bdg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getCompetenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCompetenciaLabel(competencia) {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return competencia || '';
  const [y, m] = competencia.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[Number(m) - 1]}/${y}`;
}

export function shiftCompetencia(competencia, delta) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return competencia;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCurrency(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDataBr(data) {
  if (!data) return '';
  const s = String(data).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export function dataHojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function competenciaDeData(isoDate) {
  if (!isoDate) return null;
  return String(isoDate).slice(0, 7);
}

/** Dias de calendário do mês (28–31). */
export function diasCalendarioMes(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/** Dias úteis: segunda a sábado — domingo não conta. */
export function diasUteisMes(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return 0;
  const total = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= total; d += 1) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0) count += 1;
  }
  return count;
}

export function diasEfetivosMes(competencia, usaDiasUteis = false) {
  return usaDiasUteis ? diasUteisMes(competencia) : diasCalendarioMes(competencia);
}

export function isDomingo(dataIso) {
  const s = String(dataIso || '').slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 0;
}

export function criarModeloComDefaults(partial = {}) {
  return {
    id: partial.id || gerarIdInterno('bdg-mod'),
    nome: String(partial.nome || '').trim(),
    categoria_id: partial.categoria_id || '',
    categoria_nome: partial.categoria_nome || '',
    centro_custo: String(partial.centro_custo || '').trim(),
    centro_custo_id: partial.centro_custo_id || '',
    modo_estimativa: partial.modo_estimativa || MODO_ESTIMATIVA.POR_MES,
    valor_entrada: Number(partial.valor_entrada) || 0,
    ciclo_dias: Number(partial.ciclo_dias) || 0,
    usa_dias_uteis: partial.usa_dias_uteis === true,
    ativo: partial.ativo !== false,
    observacoes: partial.observacoes || '',
    ordem: Number(partial.ordem) || 0,
    ...partial,
  };
}

export function criarCompetenciaComDefaults(partial = {}) {
  return {
    id: partial.id || gerarIdInterno('bdg-comp'),
    budget_modelo_id: partial.budget_modelo_id || '',
    competencia: partial.competencia || getCompetenciaAtual(),
    valor_ajustado: partial.valor_ajustado != null ? Number(partial.valor_ajustado) : null,
    motivo_ajuste: partial.motivo_ajuste || '',
    ...partial,
  };
}

/** Orçado mensal calculado a partir do modelo de estimativa. */
export function calcularOrcadoMensal(modelo, competencia) {
  if (!modelo || modelo.ativo === false) return 0;
  const valor = Number(modelo.valor_entrada) || 0;
  if (valor <= 0) return 0;

  const modo = modelo.modo_estimativa || MODO_ESTIMATIVA.POR_MES;
  if (modo === MODO_ESTIMATIVA.POR_MES) return valor;

  const dias = diasEfetivosMes(competencia, modelo.usa_dias_uteis);
  if (dias <= 0) return 0;

  switch (modo) {
    case MODO_ESTIMATIVA.POR_DIA:
      return valor * dias;
    case MODO_ESTIMATIVA.POR_SEMANA:
      return valor * (dias / 7);
    case MODO_ESTIMATIVA.POR_CICLO: {
      const n = Number(modelo.ciclo_dias) || 0;
      if (n <= 0) return 0;
      return valor * (dias / n);
    }
    default:
      return valor;
  }
}

export function valorOrcadoEfetivo(modelo, competencia, competenciaRegistro = null) {
  const calculado = calcularOrcadoMensal(modelo, competencia);
  const ajuste = competenciaRegistro?.valor_ajustado;
  if (ajuste != null && !Number.isNaN(Number(ajuste))) return Number(ajuste);
  return calculado;
}

export function formatEstimativaResumo(modelo, competencia = getCompetenciaAtual()) {
  if (!modelo) return '';
  const valor = Number(modelo.valor_entrada) || 0;
  const modo = modelo.modo_estimativa || MODO_ESTIMATIVA.POR_MES;
  const diasLabel = modelo.usa_dias_uteis ? 'dias úteis' : 'dias';
  const dias = diasEfetivosMes(competencia, modelo.usa_dias_uteis);

  switch (modo) {
    case MODO_ESTIMATIVA.POR_DIA:
      return `${formatCurrency(valor)}/dia (${dias} ${diasLabel})`;
    case MODO_ESTIMATIVA.POR_SEMANA:
      return `${formatCurrency(valor)}/7 dias`;
    case MODO_ESTIMATIVA.POR_CICLO: {
      const n = Number(modelo.ciclo_dias) || 0;
      const fator = n > 0 ? (dias / n).toFixed(2) : '—';
      return `${formatCurrency(valor)} a cada ${n || '?'} dias (×${fator})`;
    }
    default:
      return `${formatCurrency(valor)}/mês`;
  }
}

export function mediaOrcadoAnual(modelo) {
  if (!modelo) return 0;
  const ano = Number(String(getCompetenciaAtual()).slice(0, 4)) || new Date().getFullYear();
  let soma = 0;
  for (let m = 1; m <= 12; m += 1) {
    const comp = `${ano}-${String(m).padStart(2, '0')}`;
    soma += calcularOrcadoMensal(modelo, comp);
  }
  return soma / 12;
}

export function percentualConsumo(realizado, orcado) {
  if (!orcado || orcado <= 0) return realizado > 0 ? 100 : 0;
  return (Number(realizado) / Number(orcado)) * 100;
}

export function statusConsumoBudget(percentual) {
  const p = Number(percentual) || 0;
  if (p > 100) return STATUS_CONSUMO.ACIMA;
  if (p >= 80) return STATUS_CONSUMO.ATENCAO;
  return STATUS_CONSUMO.DENTRO;
}

function tagsLancamento(lanc) {
  const t = lanc?.tags;
  if (Array.isArray(t)) return t.map(String);
  return [];
}

export function lancamentoElegivelBudget(lanc) {
  if (!lanc || lanc.tipo !== 'Despesa') return false;
  if (lanc.status === 'Cancelado') return false;
  if (lanc.status !== 'Pago' && !lanc.data_pagamento) return false;
  const tags = tagsLancamento(lanc);
  if (tags.some((tag) => TAGS_EXCLUIDAS_REALIZADO.has(tag))) return false;
  return true;
}

export function lancamentoMatchCategoria(lanc, modelo) {
  if (!modelo?.categoria_id && !modelo?.categoria_nome) return false;
  if (modelo.categoria_id && lanc.categoria_id === modelo.categoria_id) return true;
  const catLanc = String(lanc.categoria || '').trim().toLocaleLowerCase('pt-BR');
  const catMod = String(modelo.categoria_nome || '').trim().toLocaleLowerCase('pt-BR');
  return catMod && catLanc === catMod;
}

export function lancamentoEntraNoBudget(lanc, modelo) {
  if (!lancamentoElegivelBudget(lanc)) return false;
  return lancamentoMatchCategoria(lanc, modelo);
}

export function dataReferenciaLancamento(lanc) {
  return (lanc.data_pagamento || lanc.data_vencimento || lanc.data_lancamento || '').slice(0, 10);
}

export function filtrarLancamentosBudgetMes(lancamentos, competencia) {
  const prefix = String(competencia).slice(0, 7);
  return (lancamentos || []).filter((l) => {
    const ref = dataReferenciaLancamento(l);
    return ref && ref.startsWith(prefix);
  });
}

export function calcularRealizadoBudget(lancamentos, modelo, competencia) {
  const mes = filtrarLancamentosBudgetMes(lancamentos, competencia);
  return mes
    .filter((l) => lancamentoEntraNoBudget(l, modelo))
    .reduce((acc, l) => acc + (Number(l.valor_liquido ?? l.valor) || 0), 0);
}

export function listarLancamentosDoBudget(lancamentos, modelo, competencia) {
  return filtrarLancamentosBudgetMes(lancamentos, competencia)
    .filter((l) => lancamentoEntraNoBudget(l, modelo))
    .sort((a, b) => dataReferenciaLancamento(b).localeCompare(dataReferenciaLancamento(a)));
}

/** Meta diária para modos com conversão por dia (por_dia ou quando usa dias úteis). */
export function metaDiariaBudget(modelo, competencia, dataIso = dataHojeIso()) {
  if (!modelo) return 0;
  const modo = modelo.modo_estimativa || MODO_ESTIMATIVA.POR_MES;
  const valor = Number(modelo.valor_entrada) || 0;
  if (valor <= 0) return 0;

  if (modo === MODO_ESTIMATIVA.POR_DIA) return valor;

  const orcadoMes = calcularOrcadoMensal(modelo, competencia);
  const dias = diasEfetivosMes(competencia, modelo.usa_dias_uteis);
  if (dias <= 0) return 0;
  return orcadoMes / dias;
}

export function calcularRealizadoDia(lancamentos, modelo, dataIso = dataHojeIso()) {
  const dia = String(dataIso).slice(0, 10);
  return (lancamentos || [])
    .filter((l) => lancamentoEntraNoBudget(l, modelo) && dataReferenciaLancamento(l) === dia)
    .reduce((acc, l) => acc + (Number(l.valor_liquido ?? l.valor) || 0), 0);
}

export function montarVisaoBudget(modelo, competencia, competenciaRegistro, lancamentos) {
  const orcadoCalculado = calcularOrcadoMensal(modelo, competencia);
  const orcado = valorOrcadoEfetivo(modelo, competencia, competenciaRegistro);
  const realizado = calcularRealizadoBudget(lancamentos, modelo, competencia);
  const saldo = orcado - realizado;
  const consumo = percentualConsumo(realizado, orcado);
  const status = statusConsumoBudget(consumo);
  const dias = diasEfetivosMes(competencia, modelo.usa_dias_uteis);
  const metaDiaria = metaDiariaBudget(modelo, competencia);
  const realizadoHoje = calcularRealizadoDia(lancamentos, modelo);

  return {
    modelo,
    competencia,
    competenciaRegistro,
    orcadoCalculado,
    orcado,
    realizado,
    saldo,
    consumo,
    status,
    dias,
    metaDiaria,
    realizadoHoje,
    estimativaResumo: formatEstimativaResumo(modelo, competencia),
    lancamentos: listarLancamentosDoBudget(lancamentos, modelo, competencia),
    temAjuste: competenciaRegistro?.valor_ajustado != null,
  };
}

export function montarVisoesBudgets(modelos, competencia, competenciasRegistros, lancamentos) {
  const mapaComp = Object.fromEntries(
    (competenciasRegistros || []).map((c) => [`${c.budget_modelo_id}:${c.competencia}`, c]),
  );
  return (modelos || [])
    .filter((m) => m.ativo !== false)
    .map((modelo) =>
      montarVisaoBudget(
        modelo,
        competencia,
        mapaComp[`${modelo.id}:${competencia}`],
        lancamentos,
      ),
    );
}

export function calcularTotaisBudgets(visoes) {
  const lista = Array.isArray(visoes) ? visoes : [];
  return lista.reduce(
    (acc, v) => {
      acc.orcado += v.orcado || 0;
      acc.realizado += v.realizado || 0;
      acc.saldo += v.saldo || 0;
      if (v.status === STATUS_CONSUMO.ACIMA) acc.acima += 1;
      else if (v.status === STATUS_CONSUMO.ATENCAO) acc.atencao += 1;
      acc.count += 1;
      return acc;
    },
    { orcado: 0, realizado: 0, saldo: 0, acima: 0, atencao: 0, count: 0 },
  );
}

export function filtrarVisoesBudget(visoes, { busca = '', centro = '__todos__', situacao = 'todos' } = {}) {
  const q = String(busca || '').trim().toLocaleLowerCase('pt-BR');
  return (visoes || []).filter((v) => {
    const nome = String(v.modelo?.nome || '').toLocaleLowerCase('pt-BR');
    const cat = String(v.modelo?.categoria_nome || '').toLocaleLowerCase('pt-BR');
    if (q && !nome.includes(q) && !cat.includes(q)) return false;

    const cc = String(v.modelo?.centro_custo || '').trim();
    if (centro === '__sem__' && cc) return false;
    if (centro !== '__todos__' && centro !== '__sem__' && cc !== centro) return false;

    if (situacao === 'dentro' && v.status !== STATUS_CONSUMO.DENTRO) return false;
    if (situacao === 'atencao' && v.status !== STATUS_CONSUMO.ATENCAO) return false;
    if (situacao === 'acima' && v.status !== STATUS_CONSUMO.ACIMA) return false;

    return true;
  });
}

export function ordenarModelosPorCentroENome(modelos) {
  return [...(modelos || [])].sort((a, b) => {
    const ca = String(a.centro_custo || '').toLocaleLowerCase('pt-BR');
    const cb = String(b.centro_custo || '').toLocaleLowerCase('pt-BR');
    if (ca !== cb) return ca.localeCompare(cb, 'pt-BR', { sensitivity: 'base' });
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
}

export function ordenarVisoesPorConsumo(visoes, desc = true) {
  return [...(visoes || [])].sort((a, b) => (desc ? b.consumo - a.consumo : a.consumo - b.consumo));
}

function somaLancamentosMes(lancamentos, competencia, predicate) {
  return filtrarLancamentosBudgetMes(lancamentos, competencia)
    .filter(predicate)
    .reduce((acc, l) => acc + (Number(l.valor_liquido ?? l.valor) || 0), 0);
}

export function calcularRealizadoPorTag(lancamentos, competencia, tag) {
  return somaLancamentosMes(
    lancamentos,
    competencia,
    (l) =>
      l.status === 'Pago' &&
      l.tipo === 'Despesa' &&
      l.status !== 'Cancelado' &&
      tagsLancamento(l).includes(tag),
  );
}

export function calcularReceitasRealizadasMes(lancamentos, competencia) {
  return somaLancamentosMes(
    lancamentos,
    competencia,
    (l) => l.status === 'Pago' && l.tipo === 'Receita' && l.status !== 'Cancelado',
  );
}
