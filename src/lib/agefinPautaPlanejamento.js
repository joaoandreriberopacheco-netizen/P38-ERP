/**
 * Regras partilhadas: parcelas do planejamento e avulsos do fluxo de caixa na pauta
 * (Dízimo, Visão Financeira, AGEFIN Consulta).
 */

import { boundsMesCivil } from '@/components/utils/dateUtils';
import { dataVencimentoNaCompetencia, serieEhParcelada } from '@/lib/agefinPrevisaoCalculos';
import { competenciaDoMes, listaJaTemFolhaPagamento } from '@/lib/superAgefinCompromissos';

function tagsLancamento(lancamento) {
  return (Array.isArray(lancamento?.tags) ? lancamento.tags : []).map((tag) =>
    String(tag).trim().toLocaleLowerCase('pt-BR'),
  );
}

export function lancamentoEhParcelaPlanejamento(lancamento) {
  if (!lancamento) return false;
  if (lancamento.frequencia_recorrencia === 'Parcelado') return true;
  const tags = tagsLancamento(lancamento);
  if (tags.includes('parcelado')) return true;
  if (lancamento.numero_parcelas_total && lancamento.parcela_atual) return true;
  return false;
}

/** Contas do planejamento / fluxo de caixa que entram na pauta (parcelas e avulsos). */
export function lancamentoEntraPautaAgefinPrevisao(lancamento, modelosAgefin = []) {
  const tags = tagsLancamento(lancamento);
  if (!tags.includes('agefin_previsao') || tags.includes('folha_previsao')) return false;
  if (lancamentoEhParcelaPlanejamento(lancamento)) return true;

  const recorrente = Boolean(lancamento.is_recorrente) || tags.includes('recorrente');
  if (!recorrente) return true;

  const modelo = (modelosAgefin || []).find(
    (m) => m?.grupo_lancamento_id && m.grupo_lancamento_id === lancamento.grupo_lancamento_id,
  );
  return serieEhParcelada(modelo);
}

export function grupoSerieEhParcelado(modelo, lancamentosRecorrentes = []) {
  if (serieEhParcelada(modelo)) return true;
  const gid = modelo?.grupo_lancamento_id;
  if (!gid) return false;
  return (lancamentosRecorrentes || []).some(
    (lf) =>
      lf?.grupo_lancamento_id === gid &&
      (lf.frequencia_recorrencia === 'Parcelado' || lancamentoEhParcelaPlanejamento(lf)),
  );
}

export function lancamentoCobreParcelaVirtual(lancamentos = [], modelo, parcela) {
  if (!modelo?.grupo_lancamento_id || !parcela) return false;
  const mes = String(parcela.competencia || '').slice(0, 7);
  return (lancamentos || []).some((lf) => {
    if (lf.grupo_lancamento_id !== modelo.grupo_lancamento_id) return false;
    if (String(lf.data_vencimento || '').slice(0, 7) !== mes) return false;
    if (!lancamentoEhParcelaPlanejamento(lf)) return false;
    if (lf.parcela_atual != null) {
      return Number(lf.parcela_atual) === Number(parcela.numero);
    }
    return true;
  });
}

const SUFIXO_PARCELA_RE = /\s*\(\d+\s*\/\s*\d+\)\s*$/;

export function descricaoComSufixoParcela(nomeBase, numero, total) {
  const base = String(nomeBase || '')
    .trim()
    .replace(SUFIXO_PARCELA_RE, '');
  if (!base || !numero || !total) return String(nomeBase || '').trim();
  const suf = `(${numero}/${total})`;
  if (SUFIXO_PARCELA_RE.test(String(nomeBase || ''))) return String(nomeBase).trim();
  return `${base} ${suf}`;
}

function acharParcelaPlanejamentoParaConta(conta, modelosAgefin = [], parcelamentos = []) {
  const gid = conta?.grupo_lancamento_id;
  if (!gid) return null;
  const modelo = (modelosAgefin || []).find((m) => m?.grupo_lancamento_id === gid);
  if (!modelo) return null;

  const venc = String(conta.data_vencimento || '').slice(0, 10);
  const mes = venc.slice(0, 7);
  if (!mes) return null;

  for (const parc of parcelamentos || []) {
    if (parc?.ativo === false || parc.serie_id !== modelo.id) continue;
    const total = parc.total_parcelas || parc.parcelas?.length || 1;
    for (const parcela of parc.parcelas || []) {
      if (String(parcela.competencia || '').slice(0, 7) !== mes) continue;
      const dia = Number(parcela.dia_vencimento) || Number(modelo.dia_vencimento) || 10;
      const dataParcela =
        parcela.data_vencimento || dataVencimentoNaCompetencia(parcela.competencia, dia);
      if (String(dataParcela).slice(0, 10) !== venc) continue;
      return {
        numero: parcela.numero || 1,
        total,
        nome: String(modelo.nome || conta.descricao || 'Conta parcelada').trim(),
      };
    }
  }
  return null;
}

/** Garante «Nome (1/2)» em lançamentos reais do planejamento (consulta + PDF). */
export function enriquecerContaParcelaPlanejamentoAgefin(
  conta,
  modelosAgefin = [],
  parcelamentos = [],
) {
  if (!conta || conta._superagefin_parcela_planejamento) return conta;

  let numero = conta.parcela_atual;
  let total = conta.numero_parcelas_total;
  let nomeBase = conta.descricao;

  if (lancamentoEhParcelaPlanejamento(conta) && numero && total) {
    const modelo = (modelosAgefin || []).find(
      (m) => m?.grupo_lancamento_id && m.grupo_lancamento_id === conta.grupo_lancamento_id,
    );
    if (modelo?.nome) nomeBase = modelo.nome;
    return {
      ...conta,
      descricao: descricaoComSufixoParcela(nomeBase, numero, total),
    };
  }

  const achado = acharParcelaPlanejamentoParaConta(conta, modelosAgefin, parcelamentos);
  if (!achado) return conta;

  return {
    ...conta,
    descricao: descricaoComSufixoParcela(achado.nome, achado.numero, achado.total),
    parcela_atual: achado.numero,
    numero_parcelas_total: achado.total,
  };
}

export function enriquecerContasParcelaPlanejamentoAgefin(
  contas = [],
  modelosAgefin = [],
  parcelamentos = [],
) {
  return (contas || []).map((conta) =>
    enriquecerContaParcelaPlanejamentoAgefin(conta, modelosAgefin, parcelamentos),
  );
}

/**
 * Contas do mês na consulta AGEFIN: reais + parcelas virtuais + sócios + folha.
 */
export function mesclarContasConsultaAgefinMes({
  currentMonth,
  contas = [],
  modelosAgefin = [],
  parcelamentos = [],
  contasSociosSabado = [],
  contaFolhaDia5 = null,
}) {
  const monthDate = currentMonth instanceof Date ? currentMonth : new Date(currentMonth);
  const { start, end } = boundsMesCivil(monthDate.getFullYear(), monthDate.getMonth());
  const reais = (contas || []).filter((conta) => {
    if (!conta?.data_vencimento) return false;
    const vencimento = `${conta.data_vencimento}`.slice(0, 10);
    return vencimento >= start && vencimento <= end;
  });
  const reaisEnriquecidos = enriquecerContasParcelaPlanejamentoAgefin(
    reais,
    modelosAgefin,
    parcelamentos,
  );
  const parcelas = montarContasSinteticasParcelasAgefin({
    competencia: monthDate,
    modelosAgefin,
    parcelamentos,
    lancamentosMes: contas,
  });
  const folha =
    contaFolhaDia5 && !listaJaTemFolhaPagamento(reais) ? [contaFolhaDia5] : [];

  return [...reaisEnriquecidos, ...parcelas, ...contasSociosSabado, ...folha].sort(
    (a, b) =>
      new Date(`${a.data_vencimento}T12:00:00-05:00`) -
      new Date(`${b.data_vencimento}T12:00:00-05:00`),
  );
}

/** Agrupa contas por vencimento para o PDF «Despesa mensal». */
export function montarGruposContasPorVencimento(contas = [], { sortOrder = 'asc', formatarData } = {}) {
  const formatar = formatarData || ((d) => d);
  const map = {};
  (contas || []).forEach((conta) => {
    const data = (conta.data_vencimento || '').slice(0, 10) || 'sem-data';
    if (!map[data]) {
      map[data] = {
        key: data,
        label: data === 'sem-data' ? 'Sem vencimento' : formatar(data),
        orderValue: data === 'sem-data' ? '9999-12-31' : data,
        contas: [],
      };
    }
    map[data].contas.push(conta);
  });

  return Object.values(map).sort((a, b) => {
    const cmp = String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR', {
      sensitivity: 'base',
    });
    return sortOrder === 'asc' ? cmp : -cmp;
  });
}

/**
 * Parcelas do planejamento ainda sem LancamentoFinanceiro — formato compatível com SuperAgefin.
 */
export function montarContasSinteticasParcelasAgefin({
  competencia,
  modelosAgefin = [],
  parcelamentos = [],
  lancamentosMes = [],
}) {
  const mes = competenciaDoMes(competencia);
  const modelosMap = Object.fromEntries(
    (modelosAgefin || []).filter((m) => m?.id).map((m) => [m.id, m]),
  );
  const contas = [];

  for (const parc of parcelamentos || []) {
    if (parc?.ativo === false) continue;
    const modelo = modelosMap[parc.serie_id];
    if (!modelo) continue;

    for (const parcela of parc.parcelas || []) {
      if (String(parcela.competencia || '').slice(0, 7) !== mes) continue;
      if (lancamentoCobreParcelaVirtual(lancamentosMes, modelo, parcela)) continue;

      const valor = Number(parcela.valor) || 0;
      if (valor <= 0) continue;

      const total = parc.total_parcelas || parc.parcelas?.length || 1;
      const numero = parcela.numero || 1;
      const dia = Number(parcela.dia_vencimento) || Number(modelo.dia_vencimento) || 10;
      const dataVencimento =
        parcela.data_vencimento || dataVencimentoNaCompetencia(parcela.competencia, dia);
      const nome = String(modelo.nome || 'Conta parcelada').trim();

      contas.push({
        id: `superagefin-parc-${parc.id}-${numero}`,
        descricao: `${nome} (${numero}/${total})`,
        valor,
        data_vencimento: dataVencimento,
        status: 'Em Aberto',
        tipo: 'Despesa',
        tags: ['conta_pagar', 'agefin_previsao', 'parcelado'],
        terceiro_nome: modelo.terceiro_nome || '',
        categoria: modelo.categoria_nome || '',
        centro_custo: modelo.centro_custo || '',
        natureza: 'Parcelado',
        frequencia_recorrencia: 'Parcelado',
        parcela_atual: numero,
        numero_parcelas_total: total,
        grupo_lancamento_id: modelo.grupo_lancamento_id || '',
        _superagefin_parcela_planejamento: true,
        _superagefin_sintetico: true,
      });
    }
  }

  return contas.sort((a, b) => {
    const c = String(a.data_vencimento).localeCompare(String(b.data_vencimento));
    if (c !== 0) return c;
    return String(a.descricao).localeCompare(String(b.descricao), 'pt-BR', { sensitivity: 'base' });
  });
}
