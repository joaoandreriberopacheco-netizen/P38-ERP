/**
 * Planejamento financeiro — motor de programação de contas fixas (espelho da Folha de previsão).
 */

import { tagsOrigemBoleto } from '@/lib/agefinLancamentosRecorrencia';
import { lancamentoPago, lancamentoCancelado, lancamentoVencidoOuAtrasado } from '@/lib/agefinConsultaFilters';

export const SITUACAO_SERIE = {
  ATIVA: 'ativa',
  ENCERRADA: 'encerrada',
};

export const SITUACAO_SERIE_LABELS = {
  ativa: 'Ativa',
  encerrada: 'Encerrada',
};

export const FREQUENCIA_SERIE = {
  SEMANAL: 'Semanal',
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  PARCELADA: 'Parcelada',
};

export const MODO_CADASTRO_SERIE = {
  RECORRENTE: 'recorrente',
  PARCELADA: 'parcelada',
};

export const FREQUENCIAS_SERIE_OPCOES = [
  FREQUENCIA_SERIE.MENSAL,
  FREQUENCIA_SERIE.BIMESTRAL,
  FREQUENCIA_SERIE.TRIMESTRAL,
  FREQUENCIA_SERIE.SEMESTRAL,
  FREQUENCIA_SERIE.ANUAL,
];

export function serieEhParcelada(modelo) {
  return String(modelo?.modo_cadastro || '').toLowerCase() === MODO_CADASTRO_SERIE.PARCELADA;
}

export const MESES_VENCIMENTO_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const ORDEM_FREQUENCIAS_CONTAS_FIXAS = [
  FREQUENCIA_SERIE.MENSAL,
  FREQUENCIA_SERIE.BIMESTRAL,
  FREQUENCIA_SERIE.TRIMESTRAL,
  FREQUENCIA_SERIE.SEMESTRAL,
  FREQUENCIA_SERIE.ANUAL,
  FREQUENCIA_SERIE.PARCELADA,
];

export const DESCRICAO_FREQUENCIA_SERIE = {
  [FREQUENCIA_SERIE.MENSAL]: 'Recorrência mensal — aparece em todos os meses.',
  [FREQUENCIA_SERIE.BIMESTRAL]: 'A cada 2 meses, a partir do mês de referência.',
  [FREQUENCIA_SERIE.TRIMESTRAL]: 'A cada 3 meses, a partir do mês de referência.',
  [FREQUENCIA_SERIE.SEMESTRAL]: 'A cada 6 meses, a partir do mês de referência.',
  [FREQUENCIA_SERIE.ANUAL]: 'Uma vez por ano, no mês de vencimento escolhido.',
  [FREQUENCIA_SERIE.PARCELADA]:
    'Valor total dividido em parcelas — cada parcela aparece no mês correspondente.',
};

export function normalizarFrequenciaSerie(frequencia) {
  const f = String(frequencia || FREQUENCIA_SERIE.MENSAL).trim();
  const found = ORDEM_FREQUENCIAS_CONTAS_FIXAS.find(
    (item) => item.toLowerCase() === f.toLowerCase(),
  );
  return found || FREQUENCIA_SERIE.MENSAL;
}

/** Índice na escala Mensal (0) → Anual (4) — maior = menos recorrente. */
export function indiceFrequenciaSerie(frequencia) {
  const idx = ORDEM_FREQUENCIAS_CONTAS_FIXAS.indexOf(normalizarFrequenciaSerie(frequencia));
  return idx >= 0 ? idx : 0;
}

/** Prefere a frequência mais específica (ex.: Anual vence Mensal genérico do LF). */
export function escolherFrequenciaCadastro(overlay, serie) {
  const candidatas = [];
  if (serie?.frequencia != null && serie.frequencia !== '') {
    candidatas.push(normalizarFrequenciaSerie(serie.frequencia));
  }
  if (overlay?.frequencia != null && overlay.frequencia !== '') {
    candidatas.push(normalizarFrequenciaSerie(overlay.frequencia));
  }
  if (!candidatas.length) return FREQUENCIA_SERIE.MENSAL;
  return candidatas.reduce((best, freq) =>
    indiceFrequenciaSerie(freq) > indiceFrequenciaSerie(best) ? freq : best,
  );
}

/** Competência YYYY-MM do mês âncora (ex.: IPTU em março). */
export function competenciaAncoraSerie(modelo, ref = getCompetenciaAtual()) {
  const mesRef = Math.min(12, Math.max(1, Number(modelo?.mes_vencimento) || 1));
  const anoRef = parseInt(String(ref || '').slice(0, 4), 10) || new Date().getFullYear();
  const mesAtual = parseInt(String(ref || '').slice(5, 7), 10) || new Date().getMonth() + 1;
  let ano = anoRef;
  const f = normalizarFrequenciaSerie(modelo?.frequencia);
  if (f === FREQUENCIA_SERIE.ANUAL && mesRef < mesAtual) {
    ano += 1;
  }
  return `${ano}-${String(mesRef).padStart(2, '0')}`;
}

/** Mapa grupo_lancamento_id → frequência inferida dos lançamentos recorrentes. */
export function mapaFrequenciaPorGrupoLancamento(lancamentos = []) {
  const map = {};
  for (const lf of lancamentos || []) {
    const gid = lf?.grupo_lancamento_id;
    const raw = lf?.frequencia_recorrencia;
    if (!gid || !raw || raw === 'Único') continue;
    const freq = normalizarFrequenciaSerie(raw);
    if (!map[gid] || indiceFrequenciaSerie(freq) > indiceFrequenciaSerie(map[gid])) {
      map[gid] = freq;
    }
  }
  return map;
}

/** Frequência efetiva da série (cadastro + espelho do financeiro). */
export function frequenciaEfetivaSerie(modelo, frequenciasPorGrupo = {}) {
  const fromModelo = normalizarFrequenciaSerie(
    modelo?.frequencia || modelo?.frequencia_recorrencia,
  );
  if (fromModelo !== FREQUENCIA_SERIE.MENSAL) return fromModelo;
  const gid = modelo?.grupo_lancamento_id;
  if (gid && frequenciasPorGrupo[gid]) {
    return normalizarFrequenciaSerie(frequenciasPorGrupo[gid]);
  }
  return fromModelo;
}

export function serieEhNaoMensal(modelo, frequenciasPorGrupo = {}) {
  return frequenciaEfetivaSerie(modelo, frequenciasPorGrupo) !== FREQUENCIA_SERIE.MENSAL;
}

export function provisaoMensalPorFrequencia(valor, frequencia) {
  const f = normalizarFrequenciaSerie(frequencia);
  const v = Number(valor) || 0;
  switch (f) {
    case FREQUENCIA_SERIE.ANUAL:
      return v / 12;
    case FREQUENCIA_SERIE.SEMESTRAL:
      return v / 6;
    case FREQUENCIA_SERIE.TRIMESTRAL:
      return v / 3;
    case FREQUENCIA_SERIE.BIMESTRAL:
      return v / 2;
    default:
      return v;
  }
}

export function valorAnualEquivalente(valorParcela, frequencia) {
  const f = normalizarFrequenciaSerie(frequencia);
  const v = Number(valorParcela) || 0;
  switch (f) {
    case FREQUENCIA_SERIE.ANUAL:
      return v;
    case FREQUENCIA_SERIE.SEMESTRAL:
      return v * 2;
    case FREQUENCIA_SERIE.TRIMESTRAL:
      return v * 4;
    case FREQUENCIA_SERIE.BIMESTRAL:
      return v * 6;
    default:
      return v * 12;
  }
}

export function dataVencimentoReferenciaSerie(modelo, competencia) {
  const dia = Number(modelo?.dia_vencimento) || 10;
  const mesRef = Math.min(12, Math.max(1, Number(modelo?.mes_vencimento) || 1));
  const ano = parseInt(String(competencia || '').slice(0, 4), 10) || new Date().getFullYear();
  const mesVenc = `${ano}-${String(mesRef).padStart(2, '0')}`;
  return dataVencimentoNaCompetencia(mesVenc, dia) || dataVencimentoNaCompetencia(competencia, dia);
}

export function labelFrequenciaSerie(modelo) {
  if (serieEhParcelada(modelo)) {
    const total = Number(modelo?.total_parcelas) || 0;
    return total > 0 ? `Parcelada (${total}x)` : FREQUENCIA_SERIE.PARCELADA;
  }
  return normalizarFrequenciaSerie(modelo?.frequencia);
}

export function tagFrequenciaSerie(modelo) {
  const f = labelFrequenciaSerie(modelo);
  if (f === FREQUENCIA_SERIE.MENSAL) return '';
  return f.toUpperCase();
}

export function labelValorSerie(modelo) {
  const v = formatCurrency(modelo?.valor_previsto);
  if (serieEhParcelada(modelo)) {
    const total = Number(modelo?.total_parcelas) || 0;
    return total > 0 ? `${v} em ${total} parcelas` : `${v} parcelado`;
  }
  const f = modelo?.frequencia || FREQUENCIA_SERIE.MENSAL;
  if (f === FREQUENCIA_SERIE.ANUAL) return `${v}/ano`;
  if (f === FREQUENCIA_SERIE.MENSAL) return `${v}/mês`;
  return `${v} · ${f}`;
}

export function mesCompetenciaNum(competencia) {
  return parseInt(String(competencia).slice(5, 7), 10);
}

/**
 * Define em quais meses a conta fixa entra na previsão / projeção.
 * mes_vencimento (1–12) é o mês âncora (ex.: IPTU em março; bimestral a partir de jan).
 */
export function serieDeveAparecerNaCompetencia(modelo, competencia, frequenciasPorGrupo = {}) {
  if (!serieEstaAtivaNaCompetencia(modelo, competencia)) return false;
  if (serieEhParcelada(modelo)) return false;
  const f = frequenciaEfetivaSerie(modelo, frequenciasPorGrupo);
  const mesRef = Math.min(12, Math.max(1, Number(modelo.mes_vencimento) || 1));
  const mes = mesCompetenciaNum(competencia);
  const offset = (mes - mesRef + 12) % 12;

  switch (f) {
    case FREQUENCIA_SERIE.ANUAL:
      return mes === mesRef;
    case FREQUENCIA_SERIE.SEMESTRAL:
      return offset % 6 === 0;
    case FREQUENCIA_SERIE.TRIMESTRAL:
      return offset % 3 === 0;
    case FREQUENCIA_SERIE.BIMESTRAL:
      return offset % 2 === 0;
    case FREQUENCIA_SERIE.SEMANAL:
    case FREQUENCIA_SERIE.MENSAL:
    default:
      return true;
  }
}

/** Agrupa séries por recorrência (mensal → anual) e, dentro de cada uma, por centro de custo. */
export function agruparSeriesPorFrequenciaECentro(series, centrosRegistrados = []) {
  const centrosSet = new Set(
    (centrosRegistrados || []).map((c) => String(c).toLocaleLowerCase('pt-BR')),
  );
  const out = {};
  for (const f of ORDEM_FREQUENCIAS_CONTAS_FIXAS) {
    out[f] = {};
  }

  for (const serie of series || []) {
    const freq = frequenciaEfetivaSerie(serie);
    if (!out[freq]) out[freq] = {};
    const centro = String(serie.centro_custo || '').trim();
    const chave =
      centro && centrosSet.has(centro.toLocaleLowerCase('pt-BR')) ? centro : '__sem__';
    if (!out[freq][chave]) out[freq][chave] = [];
    out[freq][chave].push(serie);
  }

  return out;
}

function metaGrupoSerieContasFixas(serie, groupBy, centrosSet) {
  if (groupBy === 'dia_vencimento') {
    const dia = Number(serie.dia_vencimento) || 10;
    return {
      key: `dia:${dia}`,
      label: `Vence dia ${dia}`,
      orderValue: String(dia).padStart(2, '0'),
    };
  }
  if (groupBy === 'favorecido') {
    const nome = (serie.terceiro_nome || '').trim() || 'Sem favorecido';
    return { key: `fav:${nome}`, label: nome, orderValue: nome.toLowerCase() };
  }
  if (groupBy === 'categoria') {
    const cat = (serie.categoria_nome || '').trim() || 'Sem categoria';
    return { key: `cat:${cat}`, label: cat, orderValue: cat.toLowerCase() };
  }
  const centro = String(serie.centro_custo || '').trim();
  const chave =
    centro && centrosSet.has(centro.toLocaleLowerCase('pt-BR')) ? centro : '__sem__';
  return {
    key: `cc:${chave}`,
    label: chave === '__sem__' ? 'Sem centro de custo' : centro,
    orderValue: chave === '__sem__' ? 'zzz' : centro.toLowerCase(),
    centroKey: chave,
  };
}

function ordenarSeriesContasFixas(series, groupBy, sortOrder) {
  const asc = sortOrder === 'asc';
  return [...(series || [])].sort((a, b) => {
    let cmp = 0;
    if (groupBy === 'dia_vencimento') {
      cmp = (Number(a.dia_vencimento) || 10) - (Number(b.dia_vencimento) || 10);
      if (cmp === 0) cmp = (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    } else if (groupBy === 'favorecido') {
      cmp = (a.terceiro_nome || '').localeCompare(b.terceiro_nome || '', 'pt-BR', {
        sensitivity: 'base',
      });
    } else if (groupBy === 'categoria') {
      cmp = (a.categoria_nome || '').localeCompare(b.categoria_nome || '', 'pt-BR', {
        sensitivity: 'base',
      });
    } else {
      const ca = String(a.centro_custo || '').toLocaleLowerCase('pt-BR');
      const cb = String(b.centro_custo || '').toLocaleLowerCase('pt-BR');
      if (ca !== cb) {
        if (!ca) cmp = 1;
        else if (!cb) cmp = -1;
        else cmp = ca.localeCompare(cb, 'pt-BR');
      } else {
        cmp = (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      }
    }
    return asc ? cmp : -cmp;
  });
}

/**
 * Agrupa séries por recorrência e, dentro de cada bloco, por centro / dia / favorecido / categoria.
 */
export function agruparSeriesPorFrequenciaEGrupo(
  series,
  { centrosRegistrados = [], groupBy = 'centro_custo', sortOrder = 'asc', frequenciasPorGrupo = {} } = {},
) {
  const centrosSet = new Set(
    (centrosRegistrados || []).map((c) => String(c).toLocaleLowerCase('pt-BR')),
  );
  const porFreq = {};
  for (const f of ORDEM_FREQUENCIAS_CONTAS_FIXAS) porFreq[f] = [];

  for (const serie of series || []) {
    const freq = serieEhParcelada(serie)
      ? FREQUENCIA_SERIE.PARCELADA
      : frequenciaEfetivaSerie(serie, frequenciasPorGrupo);
    if (!porFreq[freq]) porFreq[freq] = [];
    porFreq[freq].push(serie);
  }

  const out = {};
  for (const freq of ORDEM_FREQUENCIAS_CONTAS_FIXAS) {
    const ordenadas = ordenarSeriesContasFixas(porFreq[freq], groupBy, sortOrder);
    const map = new Map();
    for (const serie of ordenadas) {
      const meta = metaGrupoSerieContasFixas(serie, groupBy, centrosSet);
      if (!map.has(meta.key)) {
        map.set(meta.key, {
          key: meta.key,
          label: meta.label,
          orderValue: meta.orderValue,
          centroKey: meta.centroKey,
          items: [],
        });
      }
      map.get(meta.key).items.push(serie);
    }
    const grupos = [...map.values()].sort((a, b) => {
      const cmp = String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR', {
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    out[freq] = grupos;
  }

  return out;
}

export function gerarGrupoLancamentoId() {
  return `grp-agefin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function gerarSerieId() {
  return `serie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const MESES_COMPETENCIA_LABEL = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

export function formatCompetenciaLabel(competencia) {
  if (!competencia) return '';
  const raw = String(competencia).trim();
  const isoMes = /^\d{4}-\d{2}$/.test(raw)
    ? raw
    : /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? raw.slice(0, 7)
      : '';
  if (!isoMes) return raw;
  const [y, m] = isoMes.split('-');
  const mesIdx = Number(m) - 1;
  const nomeMes = MESES_COMPETENCIA_LABEL[mesIdx];
  if (!nomeMes) return raw;
  return `${nomeMes}/${y}`;
}

export function formatDataBr(data) {
  if (!data) return '';
  const s = String(data).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export function getCompetenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dataHojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shiftCompetencia(competencia, delta) {
  const [y, m] = competencia.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ultimoDiaCompetencia(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return null;
  const ultimo = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

export function competenciaDeveEstarFechada(competencia, hojeIso = dataHojeIso()) {
  const fim = ultimoDiaCompetencia(competencia);
  return fim ? hojeIso > fim : false;
}

export function dataVencimentoNaCompetencia(competencia, diaVencimento = 10) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return null;
  const dim = new Date(y, m, 0).getDate();
  const dia = Math.min(Math.max(1, Number(diaVencimento) || 10), dim);
  return `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function formatCicloAgefinCompetencia(competencia, diaVencimento = 10) {
  const venc = dataVencimentoNaCompetencia(competencia, diaVencimento);
  const periodo = formatCompetenciaLabel(competencia);
  if (!periodo) return '';
  if (!venc) return periodo;
  return `${periodo} · Vence ${formatDataBr(venc)}`;
}

export function formatCurrency(value) {
  return `R$ ${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isCompetenciaPlanejamento(comp) {
  return Boolean(comp?._modoPlanejamento);
}

export function isCompetenciaFutura(competencia, ref = getCompetenciaAtual()) {
  return String(competencia).slice(0, 7) > ref;
}

export function serieEstaAtivaNaCompetencia(modelo, competencia) {
  if (!modelo || modelo.ativo === false) return false;
  if ((modelo.situacao || SITUACAO_SERIE.ATIVA) === SITUACAO_SERIE.ENCERRADA) {
    const enc = String(modelo.data_encerramento || '').slice(0, 7);
    if (enc && competencia > enc) return false;
  }
  return true;
}

export function valorEfetivoCompetencia(comp, modelo) {
  if (comp?.valor_real != null && Number(comp.valor_real) > 0) return Number(comp.valor_real);
  if (comp?.valor_previsto != null) return Number(comp.valor_previsto);
  return Number(modelo?.valor_previsto) || 0;
}

export function statusCompetenciaEfetivo(comp, hojeIso = dataHojeIso()) {
  if (!comp) return 'rascunho';
  if (comp._modoPlanejamento) return 'planejamento';
  if (comp.status === 'fechado') return 'fechado';
  if (lancamentoPago(comp._lancamento)) return 'fechado';
  if (lancamentoCancelado(comp._lancamento)) return 'cancelado';
  return 'rascunho';
}

/** Só bloqueia edição quando o financeiro já marcou pago ou cancelado. */
export function competenciaBloqueadaEdicao(comp) {
  if (!comp || comp._fantasmaParcelamento) return true;
  if (comp._modoPlanejamento) return false;
  if (lancamentoPago(comp._lancamento)) return true;
  if (lancamentoCancelado(comp._lancamento)) return true;
  return false;
}

export function competenciaEstaFechada(comp, hojeIso = dataHojeIso()) {
  if (comp?._modoPlanejamento) return false;
  return statusCompetenciaEfetivo(comp, hojeIso) === 'fechado';
}

export function criarCompetenciaPlanejada(modelo, competencia) {
  const dia = Number(modelo.dia_vencimento) || 10;
  return {
    id: `planej-${modelo.id}-${competencia}`,
    serie_id: modelo.id,
    serie_nome: modelo.nome,
    terceiro_nome: modelo.terceiro_nome,
    categoria_nome: modelo.categoria_nome,
    centro_custo: modelo.centro_custo,
    competencia,
    frequencia: normalizarFrequenciaSerie(modelo.frequencia),
    mes_vencimento: Math.min(12, Math.max(1, Number(modelo.mes_vencimento) || 1)),
    dia_vencimento: dia,
    valor_previsto: Number(modelo.valor_previsto) || 0,
    valor_real: null,
    status: 'rascunho',
    grupo_lancamento_id: modelo.grupo_lancamento_id,
    lancamento_id: null,
    origem_boleto: null,
    _modoPlanejamento: true,
    _lancamento: null,
  };
}

export function competenciaFromLancamento(lf, modelo, competencia) {
  const dia = Number(modelo?.dia_vencimento) || Number((lf.data_vencimento || '').slice(8, 10)) || 10;
  return {
    id: lf.id,
    serie_id: modelo?.id,
    serie_nome: modelo?.nome || lf.descricao,
    terceiro_nome: lf.terceiro_nome || modelo?.terceiro_nome,
    categoria_nome: lf.categoria || modelo?.categoria_nome,
    centro_custo: modelo?.centro_custo,
    competencia,
    frequencia: normalizarFrequenciaSerie(modelo?.frequencia || lf.frequencia_recorrencia),
    mes_vencimento: Math.min(12, Math.max(1, Number(modelo?.mes_vencimento) || 1)),
    dia_vencimento: dia,
    valor_previsto: Number(modelo?.valor_previsto) || Number(lf.valor) || 0,
    valor_real: Number(lf.valor) || 0,
    status: lancamentoPago(lf) ? 'fechado' : 'rascunho',
    grupo_lancamento_id: lf.grupo_lancamento_id,
    lancamento_id: lf.id,
    origem_boleto: tagsOrigemBoleto(lf.tags),
    _modoPlanejamento: false,
    _lancamento: lf,
  };
}

/**
 * Mescla lançamentos do mês (fonte AGEFIN / LancamentoFinanceiro) com linhas de planejamento.
 */
export function montarCompetenciasVisao(competenciaMes, modelos, lancamentosMes = [], lancamentosRecorrentes = []) {
  const frequenciasPorGrupo = mapaFrequenciaPorGrupoLancamento(lancamentosRecorrentes);
  const byKey = new Map();
  const lfByGrupo = {};
  const modelosByGrupo = {};
  const modelosById = mapaModelosPorId(modelos);

  for (const lf of lancamentosMes || []) {
    const gid = lf.grupo_lancamento_id;
    if (gid) lfByGrupo[gid] = lf;
  }
  for (const modelo of modelos || []) {
    if (modelo?.grupo_lancamento_id) modelosByGrupo[modelo.grupo_lancamento_id] = modelo;
  }

  // 1) Lançamentos reais do mês — mesma base que a AGEFIN Consulta
  for (const lf of lancamentosMes || []) {
    const modelo =
      (lf.grupo_lancamento_id ? modelosByGrupo[lf.grupo_lancamento_id] : null) ||
      modelosById[lf.referencia_id] ||
      null;
    const comp = competenciaFromLancamento(lf, modelo, competenciaMes);
    const key = modelo?.id || `lf-${lf.id}`;
    comp.serie_id = comp.serie_id || key;
    byKey.set(key, comp);
  }

  // 2) Séries cadastradas sem LF no mês (modo planejamento)
  for (const modelo of (modelos || []).filter((m) => m?.ativo !== false)) {
    if (!serieDeveAparecerNaCompetencia(modelo, competenciaMes, frequenciasPorGrupo)) continue;
    if (byKey.has(modelo.id)) continue;
    const lf = modelo.grupo_lancamento_id ? lfByGrupo[modelo.grupo_lancamento_id] : null;
    if (lf) {
      byKey.set(modelo.id, competenciaFromLancamento(lf, modelo, competenciaMes));
    } else {
      byKey.set(modelo.id, criarCompetenciaPlanejada(modelo, competenciaMes));
    }
  }

  return [...byKey.values()].sort((a, b) =>
    (a.serie_nome || '').localeCompare(b.serie_nome || '', 'pt-BR'),
  );
}

export function mapaModelosPorId(modelos) {
  const map = {};
  for (const m of modelos || []) {
    if (m?.id) map[m.id] = m;
  }
  return map;
}

export function filtrarCompetenciasPrevisao(competencias, { busca = '', centro = '__todos__' } = {}) {
  const q = busca.trim().toLowerCase();
  return (competencias || []).filter((c) => {
    if (q) {
      const text = `${c.serie_nome || ''} ${c.terceiro_nome || ''} ${c.categoria_nome || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    if (centro === '__todos__') return true;
    const cc = String(c.centro_custo || '').trim();
    if (centro === '__sem__') return !cc;
    return cc.toLocaleLowerCase('pt-BR') === centro.toLocaleLowerCase('pt-BR');
  });
}

export function dataVencimentoCompetencia(comp, modelo) {
  const lf = comp?._lancamento;
  if (lf?.data_vencimento) return String(lf.data_vencimento).slice(0, 10);
  const dia = Number(modelo?.dia_vencimento ?? comp?.dia_vencimento) || 10;
  return dataVencimentoNaCompetencia(comp?.competencia, dia);
}

function compararCompetenciasPorVencimento(a, b, modelosMap, sortOrder = 'asc') {
  const da = dataVencimentoCompetencia(a, modelosMap[a.serie_id]) || '9999-12-31';
  const db = dataVencimentoCompetencia(b, modelosMap[b.serie_id]) || '9999-12-31';
  const cmp = da.localeCompare(db);
  if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
  const nomeCmp = (a.serie_nome || '').localeCompare(b.serie_nome || '', 'pt-BR', { sensitivity: 'base' });
  return sortOrder === 'asc' ? nomeCmp : -nomeCmp;
}

/** Ordena por vencimento (padrão: asc = mais antigo primeiro). */
export function ordenarCompetenciasPrevisao(competencias, sortOrder = 'asc', modelosMap = {}) {
  return [...(competencias || [])].sort((a, b) => compararCompetenciasPorVencimento(a, b, modelosMap, sortOrder));
}

function bucketStatusCompetencia(comp, hojeIso = dataHojeIso()) {
  const lf = comp?._lancamento;
  const status = statusCompetenciaEfetivo(comp, hojeIso);
  if (status === 'planejamento') return { key: 'planejamento', label: 'Planejamento', order: 0 };
  if (status === 'fechado' || lancamentoPago(lf)) return { key: 'pago', label: 'Pagos / fechados', order: 1 };
  if (status === 'cancelado' || lancamentoCancelado(lf)) return { key: 'cancelado', label: 'Cancelados', order: 2 };
  const venc = dataVencimentoCompetencia(comp);
  if (venc && venc < hojeIso && !lancamentoPago(lf)) {
    return { key: 'vencido', label: 'Vencidos', order: 3 };
  }
  return { key: 'aberto', label: 'Em aberto', order: 4 };
}

/**
 * Agrupa competências para exibição (consulta AGEFIN).
 * groupBy: vencimento | favorecido | categoria | status | centro_custo
 */
export function agruparCompetenciasPrevisao(competencias, groupBy = 'vencimento', sortOrder = 'asc', modelosMap = {}) {
  const ordenadas = ordenarCompetenciasPrevisao(competencias, sortOrder, modelosMap);
  const hoje = dataHojeIso();

  const metaFor = (comp) => {
    const modelo = modelosMap[comp.serie_id];
    if (groupBy === 'vencimento') {
      const d = dataVencimentoCompetencia(comp, modelo) || 'sem-data';
      const label =
        d === 'sem-data' ? 'Sem data' : d === hoje ? 'Hoje' : formatDataBr(d);
      return { key: `v:${d}`, label, orderValue: d === 'sem-data' ? '9999-12-31' : d };
    }
    if (groupBy === 'favorecido') {
      const nome = (comp.terceiro_nome || modelo?.terceiro_nome || '').trim() || 'Sem favorecido';
      return { key: `f:${nome}`, label: nome, orderValue: nome.toLowerCase() };
    }
    if (groupBy === 'categoria') {
      const cat = (comp.categoria_nome || modelo?.categoria_nome || '').trim() || 'Sem categoria';
      return { key: `c:${cat}`, label: cat, orderValue: cat.toLowerCase() };
    }
    if (groupBy === 'centro_custo') {
      const cc = (comp.centro_custo || modelo?.centro_custo || '').trim() || 'Sem centro de custo';
      return { key: `cc:${cc}`, label: cc, orderValue: cc.toLowerCase() };
    }
    const b = bucketStatusCompetencia(comp, hoje);
    return { key: `s:${b.key}`, label: b.label, orderValue: String(b.order).padStart(2, '0') };
  };

  const map = {};
  for (const comp of ordenadas) {
    const m = metaFor(comp);
    if (!map[m.key]) map[m.key] = { key: m.key, label: m.label, orderValue: m.orderValue, items: [] };
    map[m.key].items.push(comp);
  }

  const compareGroups = (a, b) => {
    if (groupBy === 'status') {
      const ia = Number(a.orderValue);
      const ib = Number(b.orderValue);
      return sortOrder === 'asc' ? ia - ib : ib - ia;
    }
    const cmp = String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR', { sensitivity: 'base' });
    return sortOrder === 'asc' ? cmp : -cmp;
  };

  return Object.values(map)
    .sort(compareGroups)
    .map((g) => ({
      ...g,
      items: ordenarCompetenciasPrevisao(g.items, sortOrder, modelosMap),
    }));
}

export function agruparCompetenciasPorCentroCusto(competencias, centrosRegistrados = []) {
  const centrosSet = new Set((centrosRegistrados || []).map((c) => c.toLocaleLowerCase('pt-BR')));
  const grupos = {};
  for (const c of competencias || []) {
    const cc = String(c.centro_custo || '').trim();
    const chave =
      cc && centrosSet.has(cc.toLocaleLowerCase('pt-BR')) ? cc : '__sem__';
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(c);
  }
  const ordem = [...centrosRegistrados, '__sem__'];
  return ordem
    .filter((k) => grupos[k]?.length)
    .map((chave) => ({
      chave,
      label: chave === '__sem__' ? 'Sem centro de custo' : chave,
      items: grupos[chave],
    }));
}

export function calcularTotaisGrupo(competencias, modelosMap = {}) {
  let total = 0;
  let comBoleto = 0;
  let semBoleto = 0;
  let planejamento = 0;
  let vencidas = 0;
  const hoje = dataHojeIso();

  for (const c of competencias || []) {
    if (c._fantasmaParcelamento || c._excluirDoTotal) continue;
    const modelo = modelosMap[c.serie_id];
    const valor =
      c._modoParcela && c.valor_previsto != null
        ? Number(c.valor_previsto) || 0
        : valorEfetivoCompetencia(c, modelo);
    total += valor;
    if (isCompetenciaPlanejamento(c)) {
      planejamento += 1;
      continue;
    }
    if (c.origem_boleto === 'pdf') comBoleto += 1;
    else semBoleto += 1;
    const venc = c._lancamento?.data_vencimento?.slice(0, 10);
    if (venc && venc < hoje && !lancamentoPago(c._lancamento)) vencidas += 1;
  }

  return {
    total,
    count: competencias?.length || 0,
    comBoleto,
    semBoleto,
    planejamento,
    vencidas,
  };
}

export function ordenarSeriesPorCentroENome(series) {
  return [...(series || [])].sort((a, b) => {
    const ca = String(a.centro_custo || '').toLocaleLowerCase('pt-BR');
    const cb = String(b.centro_custo || '').toLocaleLowerCase('pt-BR');
    if (ca !== cb) {
      if (!ca) return 1;
      if (!cb) return -1;
      return ca.localeCompare(cb, 'pt-BR');
    }
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });
}

/** Mapa grupo_lancamento_id:YYYY-MM → valor real do lançamento. */
export function mapaValoresReaisPorGrupoMes(lancamentos) {
  const map = {};
  for (const lf of lancamentos || []) {
    const gid = lf.grupo_lancamento_id;
    const mes = (lf.data_vencimento || '').slice(0, 7);
    if (!gid || !mes) continue;
    const v = Number(lf.valor);
    if (Number.isFinite(v) && v > 0) map[`${gid}:${mes}`] = v;
  }
  return map;
}

/**
 * Projeção de 12 meses: o mês inicial (ex.: julho, mês em que você trabalha) define o valor;
 * todos os meses seguintes na projeção espelham esse valor por conta.
 * — Valor do mês inicial: lançamento real (editado) ou cadastro da conta fixa.
 */
export function calcularProjecaoAgefin(modelos, competenciaInicio, lancamentos = []) {
  const reais = mapaValoresReaisPorGrupoMes(lancamentos);
  const frequenciasPorGrupo = mapaFrequenciaPorGrupoLancamento(lancamentos);

  /** Valor âncora por série = mês inicial da projeção (competenciaInicio). */
  const anchorPorGrupo = {};
  for (const m of modelos || []) {
    const gid = m.grupo_lancamento_id;
    if (!gid) continue;
    if (!serieDeveAparecerNaCompetencia(m, competenciaInicio, frequenciasPorGrupo)) continue;
    const real = reais[`${gid}:${competenciaInicio}`];
    anchorPorGrupo[gid] = real ?? (Number(m.valor_previsto) || 0);
  }

  const meses = [];
  let comp = competenciaInicio;
  for (let i = 0; i < 12; i += 1) {
    let total = 0;
    let count = 0;
    for (const m of modelos || []) {
      if (!serieDeveAparecerNaCompetencia(m, comp, frequenciasPorGrupo)) continue;
      const gid = m.grupo_lancamento_id;
      const valor = gid
        ? (anchorPorGrupo[gid] ?? (Number(m.valor_previsto) || 0))
        : (Number(m.valor_previsto) || 0);
      total += valor;
      count += 1;
    }
    meses.push({ competencia: comp, total, count });
    comp = shiftCompetencia(comp, 1);
  }
  const totalAno = meses.reduce((s, x) => s + x.total, 0);
  return { meses, totalAno };
}

export function criarSerieComDefaults(partial = {}) {
  const modoCadastro =
    String(partial.modo_cadastro || '').toLowerCase() === MODO_CADASTRO_SERIE.PARCELADA
      ? MODO_CADASTRO_SERIE.PARCELADA
      : MODO_CADASTRO_SERIE.RECORRENTE;
  const frequencia = normalizarFrequenciaSerie(partial.frequencia || FREQUENCIA_SERIE.MENSAL);
  return {
    id: partial.id || gerarSerieId(),
    nome: partial.nome || '',
    terceiro_nome: partial.terceiro_nome || '',
    terceiro_id: partial.terceiro_id || '',
    categoria_id: partial.categoria_id || '',
    categoria_nome: partial.categoria_nome || '',
    centro_custo: partial.centro_custo || '',
    centro_custo_id: partial.centro_custo_id || '',
    valor_previsto: Number(partial.valor_previsto) || 0,
    dia_vencimento: Number(partial.dia_vencimento) || 10,
    frequencia,
    modo_cadastro: modoCadastro,
    total_parcelas:
      modoCadastro === MODO_CADASTRO_SERIE.PARCELADA
        ? Math.max(2, Number(partial.total_parcelas) || 2)
        : null,
    competencia_inicio_parcelas:
      modoCadastro === MODO_CADASTRO_SERIE.PARCELADA
        ? String(partial.competencia_inicio_parcelas || '').slice(0, 7) || null
        : null,
    mes_vencimento: Math.min(12, Math.max(1, Number(partial.mes_vencimento) || new Date().getMonth() + 1)),
    grupo_lancamento_id: partial.grupo_lancamento_id || gerarGrupoLancamentoId(),
    ativo: partial.ativo !== false,
    situacao: partial.situacao || SITUACAO_SERIE.ATIVA,
    data_encerramento: partial.data_encerramento || null,
    observacoes: partial.observacoes || '',
  };
}
