import { toLocalDateKey } from '@/components/utils/dateUtils';
import { getDataChaveLancamento, roundToTwoDecimals, sortLancamentosPorCodigo } from '@/lib/financialUtils';
import {
  buildMapaContrapartesTransferencia,
  buildMapaParIdsTransferencia,
  chaveParTransferenciaLancamentoFluxo,
  contaUsaRegraCaixaPDV,
  getDataMovimentoCaixa,
  idsMovimentosComLancamentoFinanceiro,
  isMovimentoTransferenciaCaixaPDV,
  isTransferenciaEntreContas,
  lancamentoPertenceContasSelecionadas,
  movimentoParticipaExtrato,
  projetarLinhaFluxoCaixa,
  totaisGrupoFluxoCaixa,
} from '@/lib/saldoContaFinanceira';
import {
  getDataAncoraFluxoKey,
  isLancamentoCancelado,
  isLancamentoRealizadoFluxo,
} from '@/lib/lancamentoFinanceiroStatus';
import {
  mapReforcosTransferenciaPorLancamentoId,
  statusReforcoTransferenciaPdv,
} from '@/lib/reforcoPendenteCaixaPDV';

function totaisDiaFromGrupo(totaisGrupo) {
  return {
    r: totaisGrupo.r,
    d: totaisGrupo.d,
    entrou: totaisGrupo.r,
    saiu: totaisGrupo.d,
    liquido: totaisGrupo.liquido,
    liquidoOperacional: roundToTwoDecimals(totaisGrupo.r - totaisGrupo.d),
  };
}

/** Variação líquida do fluxo em dias posteriores ao cabeçalho mais recente visível. */
export function liquidoFluxoCaixaAposDia({
  lancamentos = [],
  movimentos = [],
  todosLancamentos = [],
  contas = [],
  contasSel = [],
  contasById = {},
  diaLimite,
}) {
  if (!diaLimite || diaLimite === 'sem-data') return 0;

  const aposDia = (dataKey) => dataKey && dataKey > diaLimite;

  const lancsDepois = lancamentos.filter((l) => {
    if (isLancamentoCancelado(l)) return false;
    if (!isLancamentoRealizadoFluxo(l)) return false;
    const dataKey = getDataAncoraFluxoKey(l);
    if (!aposDia(dataKey)) return false;
    if (contasSel.length && !lancamentoPertenceContasSelecionadas(l, contasSel, contasById)) return false;
    return true;
  });

  const movsDepois = movimentos.filter((m) => {
    if (contasSel.length && !contasSel.includes(m.conta_id)) return false;
    const dataKey = m.created_date ? toLocalDateKey(m.created_date) : null;
    return aposDia(dataKey);
  });

  if (!lancsDepois.length && !movsDepois.length) return 0;

  const grupos = montarGruposFluxoCaixa({
    lancamentos: lancsDepois,
    movimentos: movsDepois,
    todosLancamentos,
    contas,
    contasSel,
    contasById,
    formatGrupoLabel: (k) => k,
    hStr: diaLimite,
    oStr: diaLimite,
  });

  return roundToTwoDecimals(grupos.reduce((acc, g) => acc + (g.totais?.liquido || 0), 0));
}

/** Anexa saldo acumulado ao fim de cada dia (grupos do mais recente ao mais antigo). */
export function anexarSaldoAcumuladoAosGrupos(grupos = [], saldoNoFimDoPeriodoVisivel = 0) {
  if (!grupos.length) return grupos;
  let saldo = roundToTwoDecimals(saldoNoFimDoPeriodoVisivel);
  return grupos.map((grupo) => {
    const saldoAcumulado = saldo;
    saldo = roundToTwoDecimals(saldo - (grupo.totais?.liquido ?? 0));
    return {
      ...grupo,
      totais: {
        ...grupo.totais,
        saldoAcumulado,
      },
    };
  });
}

/** Fluxo de caixa: variação do dia + saldo acumulado no cabeçalho de cada dia. */
export function prepararGruposFluxoComSaldoAcumulado({
  grupos = [],
  saldoContasAtual = 0,
  lancamentos = [],
  movimentos = [],
  todosLancamentos = [],
  contas = [],
  contasSel = [],
  contasById = {},
}) {
  if (!grupos.length) return grupos;
  const diaRef = grupos[0].k;
  const liquidoApos = liquidoFluxoCaixaAposDia({
    lancamentos,
    movimentos,
    todosLancamentos,
    contas,
    contasSel,
    contasById,
    diaLimite: diaRef,
  });
  const saldoNoFim = roundToTwoDecimals(saldoContasAtual - liquidoApos);
  return anexarSaldoAcumuladoAosGrupos(grupos, saldoNoFim);
}

function chaveParTransferenciaLancamento(l) {
  return chaveParTransferenciaLancamentoFluxo(l);
}

function extrairNotaTransferencia(despesa, receita) {
  const origem = despesa?.conta_financeira_nome || '';
  const destino = receita?.conta_financeira_nome || '';

  const limpar = (text) => {
    if (!text) return '';
    let s = String(text).trim();
    if (origem) {
      s = s.replace(new RegExp(`^entrada de\\s+${origem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i'), '');
      s = s.replace(new RegExp(`^transferência de\\s+${origem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?\\s*`, 'i'), '');
    }
    if (destino) {
      s = s.replace(new RegExp(`^transferência para\\s+${destino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?\\s*`, 'i'), '');
    }
    return s.trim();
  };

  for (const raw of [despesa?.observacoes, despesa?.descricao, receita?.observacoes, receita?.descricao]) {
    const note = limpar(raw);
    if (note.length > 2) return note;
  }
  return null;
}

function extrairNomesTransferenciaLadoUnico(item, contasById = {}, mapaContrapartes = null) {
  const desc = (item.descricao || '').trim();
  const contaNome = item.conta_financeira_nome || contasById[item.conta_financeira_id]?.nome;

  const paraMatch = desc.match(/^Transferência para\s+(.+)$/i);
  const deMatch = desc.match(/^Transferência de\s+(.+)$/i);

  if (item.tipo === 'Despesa' && paraMatch) {
    return { contaOrigemNome: contaNome || 'Origem', contaDestinoNome: paraMatch[1].trim() };
  }
  if (item.tipo === 'Receita' && deMatch) {
    return { contaOrigemNome: deMatch[1].trim(), contaDestinoNome: contaNome || 'Destino' };
  }

  const contraparteId = mapaContrapartes?.get(item.id);
  const contraparteNome = contraparteId ? contasById[contraparteId]?.nome : null;
  if (item.tipo === 'Despesa') {
    return { contaOrigemNome: contaNome || 'Origem', contaDestinoNome: contraparteNome || 'Destino' };
  }
  if (item.tipo === 'Receita') {
    return { contaOrigemNome: contraparteNome || 'Origem', contaDestinoNome: contaNome || 'Destino' };
  }
  return null;
}

function projetarTransferenciaLadoUnico(
  item,
  { reforcosPorLancamento, mapaParIds, contasById, mapaContrapartes },
) {
  if (!isTransferenciaEntreContas(item) || item.origem === 'movimento') return null;

  const nomes = extrairNomesTransferenciaLadoUnico(item, contasById, mapaContrapartes);
  if (!nomes) return null;

  const receitaId = item.tipo === 'Receita' ? item.id : mapaParIds?.get(item.id);
  const reforcoStatus = receitaId
    ? statusReforcoTransferenciaPdv(reforcosPorLancamento.get(String(receitaId)))
    : null;

  return {
    id: `transfer-single-${item.id}`,
    isTransferenciaConsolidada: true,
    tipoExibicao: 'Transferência',
    tipo: 'Transferência',
    valor: item.valor,
    data_pagamento: item.data_pagamento,
    data_vencimento: item.data_vencimento,
    contaOrigemNome: nomes.contaOrigemNome,
    contaDestinoNome: nomes.contaDestinoNome,
    conta_origem_id: item.tipo === 'Despesa' ? item.conta_financeira_id : mapaContrapartes?.get(item.id),
    conta_destino_id: item.tipo === 'Receita' ? item.conta_financeira_id : mapaContrapartes?.get(item.id),
    notaTransferencia: item.observacoes || null,
    reforcoCaixaStatus: reforcoStatus,
    status: item.status,
    status_conciliacao: item.status_conciliacao,
    categoria: 'Transferência entre Contas',
    tags: item.tags,
    _lancamentoDespesa: item.tipo === 'Despesa' ? item : undefined,
    _lancamentoReceita: item.tipo === 'Receita' ? item : undefined,
  };
}

/** Une par Despesa+Receita da mesma transferência numa linha só no Fluxo de Caixa. */
export function consolidarTransferenciasListaFluxo(
  items = [],
  { movimentos = [], mapaContrapartes = null, contasById = {}, mapaParIds = null } = {},
) {
  const reforcosPorLancamento = mapReforcosTransferenciaPorLancamentoId(movimentos);
  const grupos = new Map();
  items.forEach((item) => {
    const key = chaveParTransferenciaLancamento(item);
    if (!key) return;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(item);
  });

  const consolidados = new Map();
  const receitaOculta = new Set();

  grupos.forEach((grupo) => {
    const despesa = grupo.find((i) => i.tipo === 'Despesa');
    const receita = grupo.find((i) => i.tipo === 'Receita');
    if (!despesa || !receita) return;
    if (Math.abs(Number(despesa.valor || 0) - Number(receita.valor || 0)) > 0.009) return;

    consolidados.set(despesa.id, {
      id: `transfer-par-${despesa.id}-${receita.id}`,
      isTransferenciaConsolidada: true,
      tipoExibicao: 'Transferência',
      tipo: 'Transferência',
      valor: despesa.valor,
      data_pagamento: despesa.data_pagamento || receita.data_pagamento,
      data_vencimento: despesa.data_vencimento || receita.data_vencimento,
      contaOrigemNome: despesa.conta_financeira_nome || 'Origem',
      contaDestinoNome: receita.conta_financeira_nome || 'Destino',
      conta_origem_id: despesa.conta_financeira_id,
      conta_destino_id: receita.conta_financeira_id,
      notaTransferencia: extrairNotaTransferencia(despesa, receita),
      reforcoCaixaStatus: statusReforcoTransferenciaPdv(reforcosPorLancamento.get(String(receita.id))),
      status: despesa.status || receita.status || 'Pago',
      status_conciliacao: despesa.status_conciliacao || receita.status_conciliacao,
      categoria: 'Transferência entre Contas',
      tags: despesa.tags || receita.tags,
      _lancamentoDespesa: despesa,
      _lancamentoReceita: receita,
    });
    receitaOculta.add(receita.id);
  });

  const parIds = mapaParIds || buildMapaParIdsTransferencia(items);

  return items
    .filter((item) => !receitaOculta.has(item.id))
    .map((item) => {
      if (consolidados.has(item.id)) return consolidados.get(item.id);
      const projetado = projetarTransferenciaLadoUnico(item, {
        reforcosPorLancamento,
        mapaParIds: parIds,
        contasById,
        mapaContrapartes,
      });
      if (projetado) return projetado;
      return isTransferenciaEntreContas(item) ? projetarLinhaFluxoCaixa(item) : item;
    });
}

export function normalizarMovimentoCaixaParaLinha(mov) {
  const data = mov.data_pagamento || mov.data_vencimento || getDataMovimentoCaixa(mov);
  let tipo = mov.tipo;
  if (tipo === 'Reforço') tipo = 'Receita';
  if (tipo === 'Sangria' || tipo === 'Recolhimento de Caixa') tipo = 'Despesa';

  return {
    ...mov,
    origem: 'movimento',
    tipo,
    descricao: mov.descricao || mov.observacao || mov.tipo,
    data_pagamento: data,
    data_vencimento: data,
    status: mov.status || 'Pago',
    categoria: mov.categoria || 'Transferência entre Contas',
    tipoExibicao: tipo === 'Despesa' ? 'Transferência' : undefined,
  };
}

function dataChaveMovimento(mov) {
  if (mov?.origem !== 'movimento' && !mov?.conta_id) {
    const chaveLanc = getDataChaveLancamento(mov);
    if (chaveLanc) return chaveLanc;
  }
  const data = mov.data_lancamento || mov.data_pagamento || mov.data_vencimento || getDataMovimentoCaixa(mov) || mov.created_date;
  return data ? toLocalDateKey(data) : null;
}

/**
 * Grupos do Fluxo de Caixa: lista todos os lançamentos filtrados + movimentos PDV órfãos.
 * Totais do dia separam operacional vs transferência (recolhimento/fechamento).
 */
export function montarGruposFluxoCaixa({
  lancamentos = [],
  movimentos = [],
  todosLancamentos = [],
  contas = [],
  contasSel = [],
  contasById = {},
  formatGrupoLabel,
  hStr,
  oStr,
  ordemLancamentos = 'desc',
}) {
  const movimentosJaNoFinanceiro = idsMovimentosComLancamentoFinanceiro(todosLancamentos, movimentos);
  const mapaContrapartes = buildMapaContrapartesTransferencia(todosLancamentos);
  const pdvIds = new Set(
    contas
      .filter(
        (c) => contaUsaRegraCaixaPDV(c) && (!contasSel.length || contasSel.includes(c.id)),
      )
      .map((c) => c.id),
  );

  const map = {};
  lancamentos.forEach((l) => {
    const k = getDataChaveLancamento(l) || 'sem-data';
    (map[k] = map[k] || []).push(l);
  });

  movimentos.forEach((m) => {
    if (!pdvIds.has(m.conta_id)) return;
    if (movimentosJaNoFinanceiro.has(String(m.id))) return;
    if (m.tipo !== 'Reforço' && !isMovimentoTransferenciaCaixaPDV(m)) return;
    const k = getDataMovimentoCaixa(m) ? toLocalDateKey(getDataMovimentoCaixa(m)) : 'sem-data';
    (map[k] = map[k] || []).push({ ...m, origem: 'movimento' });
  });

  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((dia) => {
      const brutos = map[dia];
      const itemsOrdenados = sortLancamentosPorCodigo(brutos, ordemLancamentos);
      const itemsConsolidados = consolidarTransferenciasListaFluxo(itemsOrdenados, { movimentos });
      const items = itemsConsolidados.map((m) => {
        if (m.origem === 'movimento') {
          return projetarLinhaFluxoCaixa(normalizarMovimentoCaixaParaLinha(m));
        }
        return projetarLinhaFluxoCaixa(m);
      });
      const totaisGrupo = totaisGrupoFluxoCaixa(itemsOrdenados, contasById, {
        contasSel,
        mapaContrapartes,
        todosLancamentos,
      });
      const label = dia === 'sem-data' ? 'Sem data' : formatGrupoLabel(dia, hStr, oStr);

      return {
        k: dia,
        label,
        items,
        totais: totaisDiaFromGrupo(totaisGrupo),
      };
    });
}

/**
 * Grupos por dia alinhados ao extrato (Caixa PDV: só dinheiro físico na gaveta).
 * Usado no extrato da conta — não no Fluxo de Caixa geral.
 */
export function montarGruposPorDiaConta({
  conta,
  lancamentos = [],
  movimentos = [],
  todosLancamentos = [],
  filtrarDataKey = null,
  filtrarBusca = null,
  formatGrupoLabel,
  hStr,
  oStr,
}) {
  if (!conta) return [];

  const movimentosJaNoFinanceiro = idsMovimentosComLancamentoFinanceiro(todosLancamentos, movimentos);
  const participa = (mov) => movimentoParticipaExtrato(mov, conta);

  const todasMovimentacoes = [
    ...lancamentos.map((l) => ({ ...l, origem: 'lancamento' })),
    ...movimentos
      .filter((m) => !movimentosJaNoFinanceiro.has(String(m.id)))
      .filter((m) => !(m.tipo === 'Reforço' && m.lancamento_financeiro_id))
      .map((m) => ({ ...m, origem: 'movimento' })),
  ].filter(participa);

  const noPeriodo = todasMovimentacoes.filter((mov) => {
    const dataKey = dataChaveMovimento(mov);
    if (filtrarDataKey && dataKey && !filtrarDataKey(dataKey)) return false;
    if (filtrarDataKey && !dataKey) return false;
    if (filtrarBusca && !filtrarBusca(mov)) return false;
    return true;
  });

  const porDia = {};
  noPeriodo.forEach((mov) => {
    const dia = dataChaveMovimento(mov) || 'sem-data';
    (porDia[dia] = porDia[dia] || []).push(mov);
  });

  return Object.keys(porDia)
    .sort((a, b) => b.localeCompare(a))
    .map((dia) => {
      const brutos = porDia[dia];
      const contasById = { [conta.id]: conta };
      const itemsBrutos = sortLancamentosPorCodigo(brutos);
      const itemsConsolidados = consolidarTransferenciasListaFluxo(itemsBrutos, { movimentos });
      const items = itemsConsolidados.map((m) => {
        const linha = m.origem === 'movimento' ? normalizarMovimentoCaixaParaLinha(m) : m;
        return projetarLinhaFluxoCaixa(linha);
      });
      const totaisGrupo = totaisGrupoFluxoCaixa(brutos, contasById, {
        contasSel: [conta.id],
        mapaContrapartes: buildMapaContrapartesTransferencia(todosLancamentos),
        todosLancamentos,
      });
      const label =
        dia === 'sem-data' ? 'Sem data' : formatGrupoLabel(dia, hStr, oStr);

      return {
        k: dia,
        label,
        items,
        totais: totaisDiaFromGrupo(totaisGrupo),
      };
    });
}
