import { roundToTwoDecimals, getDataChaveLancamento } from '@/lib/financialUtils';
import { toLocalDateKey } from '@/components/utils/dateUtils';
import { getValorFluxoCaixa } from '@/lib/lancamentoFinanceiroStatus';

/** Lançamento pago/cancelado entra no saldo (receita +, despesa −). Transferências ficam de fora. */
export function lancamentoParticipaSaldo(l) {
  if (!l || l.status === 'Cancelado') return false;
  if (l.tipo !== 'Receita' && l.tipo !== 'Despesa') return false;
  return l.status === 'Pago' || !!l.data_pagamento;
}

const FORMAS_NAO_DINHEIRO_FISICO = new Set([
  'PIX',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Conta a Pagar',
  'Vale Troca',
]);

/**
 * Receitas que não representam dinheiro físico na gaveta do PDV (PIX, cartão, fiado, etc.).
 * Despesas pagas na conta PDV sempre saem da gaveta e entram no saldo.
 */
export function formaPagamentoNaoDinheiroFisico(l) {
  if (!l || l.tipo !== 'Receita') return false;

  const fp = String(l.forma_pagamento || '').trim();
  const fpt = String(l.forma_pagamento_tipo || '').trim();

  if (fp === 'Dinheiro') return false;
  if (FORMAS_NAO_DINHEIRO_FISICO.has(fp)) return true;
  if (fpt === 'Cartão Débito' || fpt === 'Cartão Crédito' || fpt === 'Boleto') return true;

  const tags = Array.isArray(l.tags) ? l.tags : [];
  if (tags.includes('CARTAO') || tags.includes('FIADO')) return true;

  // Receita com forma definida que não é Dinheiro (ex.: PIX legado na conta errada).
  if (fp) return true;

  return false;
}

/** Saldo da conta Caixa PDV no módulo financeiro: só dinheiro na gaveta. */
export function lancamentoParticipaSaldoCaixaPDV(l) {
  if (!lancamentoParticipaSaldo(l)) return false;
  if (l.tipo === 'Despesa') return true;
  if (l.tipo === 'Receita') {
    // Transferência para o PDV só entra na gaveta após reforço confirmado pelo operador.
    if (isTransferenciaEntreContas(l)) return false;
    return !formaPagamentoNaoDinheiroFisico(l);
  }
  return false;
}

export function contaUsaRegraCaixaPDV(conta) {
  return conta?.is_caixa_pdv === true || conta?.tipo === 'Caixa PDV';
}

export function lancamentoParticipaSaldoConta(conta, l) {
  if (contaUsaRegraCaixaPDV(conta)) return lancamentoParticipaSaldoCaixaPDV(l);
  return lancamentoParticipaSaldo(l);
}

export function deltaLancamentoSaldo(l) {
  if (!lancamentoParticipaSaldo(l)) return 0;
  const valor = Number(l.valor || 0);
  return l.tipo === 'Receita' ? valor : -valor;
}

export function deltaLancamentoSaldoConta(conta, l) {
  if (!lancamentoParticipaSaldoConta(conta, l)) return 0;
  const valor = Number(l.valor || 0);
  return l.tipo === 'Receita' ? valor : -valor;
}

/** Lançamento visível nas contas selecionadas (inclui legado sem conta_financeira_id na Caixa Geral). */
export function lancamentoPertenceContasSelecionadas(l, contasSel = [], contasById = {}) {
  if (!contasSel.length) return true;
  if (l.conta_financeira_id && contasSel.includes(l.conta_financeira_id)) return true;
  if (!l.conta_financeira_id) {
    return contasSel.some((id) => contasById[id]?.is_caixa_geral === true);
  }
  return false;
}

/** Recolhimento/fechamento PDV e transferências manuais entre contas financeiras. */
export function isTransferenciaEntreContas(l) {
  if (!l) return false;
  if (l.tipo === 'Transferência') return true;
  if (l.categoria === 'Transferência entre Contas') return true;
  if (l.referencia_tipo === 'MovimentosCaixa') return true;
  return false;
}

function chaveParTransferenciaLancamento(l) {
  if (!isTransferenciaEntreContas(l) || l.origem === 'movimento') return null;
  if (l.referencia_tipo === 'MovimentosCaixa' && l.referencia_id != null) {
    const data = getDataChaveLancamento(l) || '';
    const valor = Number(l.valor || 0).toFixed(2);
    return `tr:${data}:${valor}`;
  }
  const data = getDataChaveLancamento(l) || '';
  const valor = Number(l.valor || 0).toFixed(2);
  if (l.categoria === 'Transferência entre Contas' || l.referencia_tipo === 'Manual') {
    return `tr:${data}:${valor}`;
  }
  return null;
}

function pareceParRepasseImplicito(despesa, receita) {
  const texto = `${despesa?.descricao || ''} ${despesa?.observacoes || ''} ${receita?.descricao || ''} ${receita?.observacoes || ''}`.toLowerCase();
  return /repasse|transfer[eê]ncia|dep[oó]sito/i.test(texto);
}

function adicionarParesTransferenciaImplicitos(lancamentos = [], mapa = new Map()) {
  const buckets = new Map();
  lancamentos.forEach((l) => {
    if (mapa.has(l.id) || l.origem === 'movimento') return;
    if (!lancamentoParticipaSaldo(l)) return;
    if (l.tipo !== 'Despesa' && l.tipo !== 'Receita') return;
    const data = getDataChaveLancamento(l);
    if (!data) return;
    const key = `${data}:${Number(l.valor || 0).toFixed(2)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(l);
  });

  buckets.forEach((grupo) => {
    const despesas = grupo.filter((l) => l.tipo === 'Despesa');
    const receitas = grupo.filter((l) => l.tipo === 'Receita');
    if (despesas.length !== 1 || receitas.length !== 1) return;
    const despesa = despesas[0];
    const receita = receitas[0];
    if (despesa.conta_financeira_id === receita.conta_financeira_id) return;
    const explicito = isTransferenciaEntreContas(despesa) || isTransferenciaEntreContas(receita);
    if (!explicito && !pareceParRepasseImplicito(despesa, receita)) return;
    mapa.set(despesa.id, receita.conta_financeira_id);
    mapa.set(receita.id, despesa.conta_financeira_id);
  });
}

/** Usado na consolidação visual do fluxo — mesma chave do mapa de contrapartes. */
export function chaveParTransferenciaLancamentoFluxo(l) {
  return chaveParTransferenciaLancamento(l);
}

/** Mapa lancamentoId → conta_financeira_id da contraparte na transferência. */
export function buildMapaContrapartesTransferencia(lancamentos = []) {
  const porChave = new Map();
  lancamentos.forEach((l) => {
    const key = chaveParTransferenciaLancamento(l);
    if (!key) return;
    if (!porChave.has(key)) porChave.set(key, []);
    porChave.get(key).push(l);
  });

  const mapa = new Map();
  porChave.forEach((grupo) => {
    const despesa = grupo.find((i) => i.tipo === 'Despesa');
    const receita = grupo.find((i) => i.tipo === 'Receita');
    if (!despesa || !receita) return;
    if (Math.abs(Number(despesa.valor || 0) - Number(receita.valor || 0)) > 0.009) return;
    mapa.set(despesa.id, receita.conta_financeira_id);
    mapa.set(receita.id, despesa.conta_financeira_id);
  });

  adicionarParesTransferenciaImplicitos(lancamentos, mapa);
  return mapa;
}

/** Mapa lancamentoId → id do par (despesa ↔ receita) na mesma transferência. */
export function buildMapaParIdsTransferencia(lancamentos = []) {
  const porChave = new Map();
  lancamentos.forEach((l) => {
    const key = chaveParTransferenciaLancamento(l);
    if (!key) return;
    if (!porChave.has(key)) porChave.set(key, []);
    porChave.get(key).push(l);
  });

  const mapa = new Map();
  porChave.forEach((grupo) => {
    const despesa = grupo.find((i) => i.tipo === 'Despesa');
    const receita = grupo.find((i) => i.tipo === 'Receita');
    if (!despesa || !receita) return;
    if (Math.abs(Number(despesa.valor || 0) - Number(receita.valor || 0)) > 0.009) return;
    mapa.set(despesa.id, receita.id);
    mapa.set(receita.id, despesa.id);
  });

  return mapa;
}

/** Conta entra no conjunto visível do filtro de contas. */
export function contaEstaNoFiltroFluxo(contaId, contasSel = [], contasById = {}) {
  if (!contasSel.length) return true;
  if (contaId && contasSel.includes(contaId)) return true;
  if (!contaId) {
    return contasSel.some((id) => contasById[id]?.is_caixa_geral === true);
  }
  return false;
}

/**
 * Transferência interna ao filtro = contraparte também está nas contas selecionadas.
 * Só nesse caso excluímos de entrou/saída (permutação entre contas visíveis).
 */
export function transferenciaInternaAoFiltro(
  l,
  contasSel = [],
  contasById = {},
  mapaContrapartes = null,
) {
  const contraparteId = mapaContrapartes?.get(l?.id);
  if (contraparteId === undefined) return false;
  if (!isTransferenciaEntreContas(l) && contraparteId == null) return false;
  return contaEstaNoFiltroFluxo(contraparteId, contasSel, contasById);
}

/** Transferência explícita ou par implícito (repasse entre contas) para KPIs. */
export function lancamentoContaComoTransferenciaKpi(l, mapaContrapartes = null) {
  return isTransferenciaEntreContas(l) || mapaContrapartes?.has(l?.id);
}

function contaContraparteMovimentoPDV(mov, todosLancamentos = [], mapaContrapartes = null) {
  const despesa = todosLancamentos.find(
    (l) =>
      l.referencia_tipo === 'MovimentosCaixa' &&
      String(l.referencia_id) === String(mov.id) &&
      l.tipo === 'Despesa',
  );
  if (!despesa) return null;
  return mapaContrapartes?.get(despesa.id) ?? null;
}

function movimentoPDVTransferenciaInternaAoFiltro(
  mov,
  contasSel = [],
  contasById = {},
  todosLancamentos = [],
  mapaContrapartes = null,
) {
  const destinoId = contaContraparteMovimentoPDV(mov, todosLancamentos, mapaContrapartes);
  if (!destinoId) return false;
  return (
    contaEstaNoFiltroFluxo(mov.conta_id, contasSel, contasById) &&
    contaEstaNoFiltroFluxo(destinoId, contasSel, contasById)
  );
}

export function isMovimentoTransferenciaCaixaPDV(m) {
  return m?.tipo === 'Sangria' || m?.tipo === 'Recolhimento de Caixa';
}

/** Linha do Fluxo: recolhimentos aparecem como transferência (sem mudar o PDV). */
export function projetarLinhaFluxoCaixa(l) {
  if (!isTransferenciaEntreContas(l)) return l;
  return {
    ...l,
    tipoExibicao: 'Transferência',
  };
}

/** IDs de MovimentosCaixa já refletidos em LancamentoFinanceiro (evita contar duas vezes). */
export function idsMovimentosComLancamentoFinanceiro(lancamentos = [], movimentos = []) {
  const ids = new Set();
  lancamentos.forEach((l) => {
    if (l?.referencia_tipo === 'MovimentosCaixa' && l?.referencia_id) {
      ids.add(String(l.referencia_id));
    }
  });
  (movimentos || []).forEach((m) => {
    if (m?.tipo === 'Reforço' && m?.status_registro === 'Pendente' && m?.lancamento_financeiro_id) {
      ids.add(String(m.id));
    }
  });
  return ids;
}

/**
 * Lançamentos do PDV já contabilizados via MovimentosCaixa (reforço/recolhimento vinculado).
 * Evita somar Receita de transferência + Movimento Reforço em duplicado.
 */
export function idsLancamentosEspelhadosEmMovimentosCaixa(lancamentos = [], movimentos = []) {
  const ids = new Set();
  lancamentos.forEach((l) => {
    if (l?.referencia_tipo === 'MovimentosCaixa' && l?.referencia_id) {
      ids.add(String(l.id));
    }
  });
  movimentos.forEach((m) => {
    if (m?.lancamento_financeiro_id) {
      ids.add(String(m.lancamento_financeiro_id));
    }
  });
  return ids;
}

/** Data efetiva do movimento de caixa (permite retroativo via data_movimento). */
export function getDataMovimentoCaixa(mov) {
  return mov?.data_movimento || mov?.created_date || null;
}

/** Reforço soma; sangria e recolhimento subtraem. Reforços pendentes não alteram saldo. */
export function deltaMovimentoCaixaSaldo(m) {
  if (!m) return 0;
  const valor = Number(m.valor || 0);
  if (m.tipo === 'Reforço') {
    if (m.status_registro === 'Pendente' || m.status_registro === 'Cancelado') return 0;
    return valor;
  }
  if (m.tipo === 'Sangria' || m.tipo === 'Recolhimento de Caixa') return -valor;
  return 0;
}

export function filtrarLancamentosDaConta(conta, todosLancamentos = []) {
  if (!conta) return [];
  if (conta.is_caixa_geral === true) {
    // Legado sem conta_financeira_id + lançamentos já vinculados à Caixa Geral (mesma regra do Extrato).
    return todosLancamentos.filter(
      (l) => !l.conta_financeira_id || l.conta_financeira_id === conta.id,
    );
  }
  return todosLancamentos.filter((l) => l.conta_financeira_id === conta.id);
}

export function filtrarMovimentosDaConta(contaId, todosMovimentos = []) {
  if (!contaId) return [];
  return todosMovimentos.filter((m) => m.conta_id === contaId);
}

/**
 * Saldo canónico = saldo_inicial + lançamentos pagos (receita/despesa) + reforços/sangrias.
 * Contas is_caixa_pdv: apenas dinheiro físico na gaveta (vendas em dinheiro, despesas, recolhimentos).
 * Fonte única para lista de contas, extrato e KPIs.
 */
export function calcularSaldoContaFinanceira(conta, todosLancamentos = [], todosMovimentos = []) {
  if (!conta) return 0;
  const saldoInicial = Number(conta.saldo_inicial || 0);
  const lancamentos = filtrarLancamentosDaConta(conta, todosLancamentos);
  const movimentos = filtrarMovimentosDaConta(conta.id, todosMovimentos);

  const movimentosJaNoFinanceiro = idsMovimentosComLancamentoFinanceiro(lancamentos);
  const lancamentosEspelhadosEmMov = contaUsaRegraCaixaPDV(conta)
    ? idsLancamentosEspelhadosEmMovimentosCaixa(lancamentos, movimentos)
    : new Set();

  let delta = 0;
  lancamentos.forEach((l) => {
    if (lancamentosEspelhadosEmMov.has(String(l.id))) return;
    delta += deltaLancamentoSaldoConta(conta, l);
  });
  if (contaUsaRegraCaixaPDV(conta)) {
    movimentos.forEach((m) => {
      if (movimentosJaNoFinanceiro.has(String(m.id))) return;
      delta += deltaMovimentoCaixaSaldo(m);
    });
  }

  return roundToTwoDecimals(saldoInicial + delta);
}

export function calcularSaldosTodasContas(contas = [], todosLancamentos = [], todosMovimentos = []) {
  const map = {};
  contas.forEach((conta) => {
    map[conta.id] = calcularSaldoContaFinanceira(conta, todosLancamentos, todosMovimentos);
  });
  return map;
}

function dataChaveLancamentoSaldo(l) {
  const dr = l?.data_pagamento || l?.data_vencimento;
  return dr ? toLocalDateKey(dr) : null;
}

/** Líquido de lançamentos + movimentos de caixa a partir da data de corte (inclusive). */
export function liquidoContaDesdeDataCorte(conta, todosLancamentos = [], todosMovimentos = [], dataCorte) {
  if (!conta || !dataCorte) return 0;

  const lancamentos = filtrarLancamentosDaConta(conta, todosLancamentos);
  const movimentosJaNoFinanceiro = idsMovimentosComLancamentoFinanceiro(lancamentos);
  const lancamentosEspelhadosEmMov = contaUsaRegraCaixaPDV(conta)
    ? idsLancamentosEspelhadosEmMovimentosCaixa(lancamentos, todosMovimentos)
    : new Set();
  let liquido = 0;

  lancamentos.forEach((l) => {
    if (lancamentosEspelhadosEmMov.has(String(l.id))) return;
    const dataKey = dataChaveLancamentoSaldo(l);
    if (dataKey && dataKey >= dataCorte) {
      liquido += deltaLancamentoSaldoConta(conta, l);
    }
  });

  filtrarMovimentosDaConta(conta.id, todosMovimentos).forEach((m) => {
    if (!contaUsaRegraCaixaPDV(conta)) return;
    if (movimentosJaNoFinanceiro.has(String(m.id))) return;
    const dataKey = m.created_date ? toLocalDateKey(m.created_date) : null;
    if (dataKey && dataKey >= dataCorte) {
      liquido += deltaMovimentoCaixaSaldo(m);
    }
  });

  return roundToTwoDecimals(liquido);
}

/**
 * Saldo pós-corte = saldo_inicial (abertura configurada) + movimentos desde a data de corte.
 * Histórico anterior à data de corte fica fora — não entra no cálculo.
 */
export function calcularSaldoContaAposDataCorte(conta, todosLancamentos = [], todosMovimentos = [], dataCorte) {
  if (!conta || !dataCorte) {
    return calcularSaldoContaFinanceira(conta, todosLancamentos, todosMovimentos);
  }

  const saldoInicial = Number(conta.saldo_inicial || 0);
  const liquidoDesdeCorte = liquidoContaDesdeDataCorte(conta, todosLancamentos, todosMovimentos, dataCorte);
  return roundToTwoDecimals(saldoInicial + liquidoDesdeCorte);
}

export function calcularSaldosAposDataCorte(contas = [], todosLancamentos = [], todosMovimentos = [], dataCorte) {
  const map = {};
  contas.forEach((conta) => {
    map[conta.id] = calcularSaldoContaAposDataCorte(conta, todosLancamentos, todosMovimentos, dataCorte);
  });
  return map;
}

/** Saldo para exibir na UI (prioriza mapa calculado). */
export function getSaldoExibicaoConta(conta, saldosCalculados) {
  if (!conta) return 0;
  if (saldosCalculados && Object.prototype.hasOwnProperty.call(saldosCalculados, conta.id)) {
    return saldosCalculados[conta.id];
  }
  if (conta.saldo_calculado != null) return roundToTwoDecimals(conta.saldo_calculado);
  return roundToTwoDecimals(Number(conta.saldo_atual ?? conta.saldo_inicial ?? 0));
}

export function contaTemDivergenciaSaldo(conta, saldoCalculado) {
  const gravado = roundToTwoDecimals(Number(conta?.saldo_atual ?? 0));
  return Math.abs(gravado - saldoCalculado) > 0.009;
}

function movimentoCaixaParticipaExtrato(mov) {
  if (!mov) return false;
  if (mov.tipo === 'Reforço') {
    if (mov.status_registro === 'Pendente' || mov.status_registro === 'Cancelado') return false;
    return true;
  }
  return mov.tipo === 'Sangria' || mov.tipo === 'Recolhimento de Caixa';
}

/** Indica se o movimento compõe o saldo/extrato da conta (PDV usa regra de dinheiro físico). */
export function movimentoParticipaExtrato(mov, conta = null) {
  if (mov?.origem === 'movimento' || mov?.conta_id) {
    if (!contaUsaRegraCaixaPDV(conta)) return false;
    return movimentoCaixaParticipaExtrato(mov);
  }
  return lancamentoParticipaSaldoConta(conta, mov);
}

/** Entradas e saídas de um conjunto de movimentos (extrato / período). */
export function totaisEntradaSaidaMovimentos(
  movimentos = [],
  conta = null,
  {
    contasSel = null,
    contasById = {},
    mapaContrapartes = null,
    todosLancamentos = [],
  } = {},
) {
  const filtrarTransfInternas = contasSel !== null;
  let entradas = 0;
  let saidas = 0;

  movimentos.forEach((mov) => {
    if (mov.origem === 'movimento' || mov.conta_id) {
      if (mov.tipo === 'Reforço') {
        if (mov.status_registro !== 'Pendente' && mov.status_registro !== 'Cancelado') {
          entradas += Number(mov.valor || 0);
        }
      } else if (mov.tipo === 'Sangria' || mov.tipo === 'Recolhimento de Caixa') {
        const interna = filtrarTransfInternas && movimentoPDVTransferenciaInternaAoFiltro(
          mov,
          contasSel,
          contasById,
          todosLancamentos,
          mapaContrapartes,
        );
        if (!interna) saidas += Number(mov.valor || 0);
      }
      return;
    }
    if (
      filtrarTransfInternas &&
      lancamentoContaComoTransferenciaKpi(mov, mapaContrapartes) &&
      transferenciaInternaAoFiltro(mov, contasSel, contasById, mapaContrapartes)
    ) {
      return;
    }
    if (!lancamentoParticipaSaldoConta(conta, mov)) return;
    if (mov.tipo === 'Receita') entradas += Number(mov.valor || 0);
    else if (mov.tipo === 'Despesa') saidas += Number(mov.valor || 0);
  });

  return {
    entradas: roundToTwoDecimals(entradas),
    saidas: roundToTwoDecimals(saidas),
  };
}

/**
 * KPIs do Fluxo de Caixa alinhados ao extrato.
 * Caixa PDV: só dinheiro físico nos lançamentos + reforços/sangrias/recolhimentos.
 */
export function calcularKpisFluxoPeriodo(
  lancamentosPeriodo = [],
  movimentosPeriodo = [],
  todosLancamentos = [],
  contasById = {},
  contasSel = [],
) {
  const movimentosJaNoFinanceiro = idsMovimentosComLancamentoFinanceiro(todosLancamentos);
  const mapaContrapartes = buildMapaContrapartesTransferencia(todosLancamentos);
  const contaNoFiltro = (contaId) => !contasSel.length || contasSel.includes(contaId);
  let entrou = 0;
  let saiu = 0;
  let pEntrou = 0;
  let pSaiu = 0;
  let totalTransferencias = 0;
  let transfIn = 0;
  let transfOut = 0;
  let vencidos = 0;
  let qtdVencidos = 0;

  const acumularOperacional = (l, valor, isPago) => {
    const conta = contasById[l.conta_financeira_id];
    if (l.status === 'Vencido') {
      vencidos += valor;
      qtdVencidos++;
    }
    const participaSaldo = lancamentoParticipaSaldoConta(conta, l);
    if (!participaSaldo) return;
    if (isPago) {
      if (l.tipo === 'Receita') entrou += valor;
      else if (l.tipo === 'Despesa') saiu += valor;
    } else {
      if (l.tipo === 'Receita') pEntrou += valor;
      else if (l.tipo === 'Despesa') pSaiu += valor;
    }
  };

  lancamentosPeriodo.forEach((l) => {
    const valor = getValorFluxoCaixa(l);
    const isPago = l.status === 'Pago' || !!l.data_pagamento;

    if (lancamentoContaComoTransferenciaKpi(l, mapaContrapartes)) {
      totalTransferencias += Number(l.valor || 0);
      if (transferenciaInternaAoFiltro(l, contasSel, contasById, mapaContrapartes)) {
        if (contaNoFiltro(l.conta_financeira_id)) {
          if (l.tipo === 'Receita') transfIn += Number(l.valor || 0);
          else if (l.tipo === 'Despesa') transfOut += Number(l.valor || 0);
        }
        return;
      }
      acumularOperacional(l, valor, isPago);
      return;
    }

    acumularOperacional(l, valor, isPago);
  });

  movimentosPeriodo.forEach((m) => {
    if (movimentosJaNoFinanceiro.has(String(m.id))) return;
    const conta = contasById[m.conta_id];
    if (!contaUsaRegraCaixaPDV(conta)) return;
    const valor = Number(m.valor || 0);
    if (m.tipo === 'Reforço') {
      if (m.status_registro !== 'Pendente' && m.status_registro !== 'Cancelado') {
        entrou += valor;
      }
      return;
    }
    if (!isMovimentoTransferenciaCaixaPDV(m)) return;
    totalTransferencias += valor;
    if (movimentoPDVTransferenciaInternaAoFiltro(m, contasSel, contasById, todosLancamentos, mapaContrapartes)) {
      if (contaNoFiltro(m.conta_id)) transfOut += valor;
      return;
    }
    saiu += valor;
  });

  return {
    entrou: roundToTwoDecimals(entrou),
    saiu: roundToTwoDecimals(saiu),
    saldo: roundToTwoDecimals(entrou - saiu),
    pEntrou: roundToTwoDecimals(pEntrou),
    pSaiu: roundToTwoDecimals(pSaiu),
    saldoPrev: roundToTwoDecimals(entrou + pEntrou - saiu - pSaiu),
    totalTransferencias: roundToTwoDecimals(totalTransferencias),
    transfIn: roundToTwoDecimals(transfIn),
    transfOut: roundToTwoDecimals(transfOut),
    vencidos: roundToTwoDecimals(vencidos),
    qtdVencidos,
  };
}

/**
 * Totais do grupo no Fluxo.
 * Transferências (recolhimento/fechamento) entram no líquido do dia mas fora de receita/despesa operacional.
 */
export function totaisGrupoFluxoCaixa(
  items = [],
  contasById = {},
  {
    contasSel = [],
    mapaContrapartes = null,
    todosLancamentos = [],
  } = {},
) {
  let r = 0;
  let d = 0;
  let transfIn = 0;
  let transfOut = 0;

  items.forEach((l) => {
    const conta = contasById[l.conta_financeira_id];
    const isPago = l.status === 'Pago' || !!l.data_pagamento;
    const valor = getValorFluxoCaixa(l);

    if (l.origem === 'movimento' || (l.conta_id && !l.conta_financeira_id)) {
      if (l.tipo === 'Reforço') {
        if (l.status_registro !== 'Pendente' && l.status_registro !== 'Cancelado') r += valor;
      } else if (isMovimentoTransferenciaCaixaPDV(l)) {
        if (movimentoPDVTransferenciaInternaAoFiltro(l, contasSel, contasById, todosLancamentos, mapaContrapartes)) {
          transfOut += valor;
        } else {
          d += valor;
        }
      }
      return;
    }

    if (lancamentoContaComoTransferenciaKpi(l, mapaContrapartes)) {
      if (transferenciaInternaAoFiltro(l, contasSel, contasById, mapaContrapartes)) {
        if (l.tipo === 'Receita') transfIn += valor;
        else if (l.tipo === 'Despesa') transfOut += valor;
      } else {
        const participaSaldo = lancamentoParticipaSaldoConta(conta, l);
        if (!participaSaldo) return;
        if (l.tipo === 'Receita' && isPago) r += valor;
        if (l.tipo === 'Despesa' && isPago) d += valor;
      }
      return;
    }

    const participaSaldo = lancamentoParticipaSaldoConta(conta, l);
    if (!participaSaldo) return;
    if (l.tipo === 'Receita' && isPago) r += valor;
    if (l.tipo === 'Despesa' && isPago) d += valor;
  });

  const liquido = r - d + transfIn - transfOut;
  return {
    r: roundToTwoDecimals(r),
    d: roundToTwoDecimals(d),
    transfIn: roundToTwoDecimals(transfIn),
    transfOut: roundToTwoDecimals(transfOut),
    liquido: roundToTwoDecimals(liquido),
  };
}
