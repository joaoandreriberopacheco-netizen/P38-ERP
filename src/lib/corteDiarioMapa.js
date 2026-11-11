import { toLocalDateKey } from '@/components/utils/dateUtils';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { corteHistoricoAtivo, passaFiltroCorteHistorico } from '@/lib/filtroDataFinanceiro';
import {
  calcularSaldoContaAposDataCorte,
  calcularSaldoContaFinanceira,
  contaUsaRegraCaixaPDV,
  filtrarLancamentosDaConta,
  filtrarMovimentosDaConta,
  formaPagamentoNaoDinheiroFisico,
  getDataMovimentoCaixa,
  idsMovimentosComLancamentoFinanceiro,
  isMovimentoTransferenciaCaixaPDV,
  isTransferenciaEntreContas,
  movimentoParticipaExtrato,
  totaisEntradaSaidaMovimentos,
} from '@/lib/saldoContaFinanceira';
import { normalizarMovimentoCaixaParaLinha } from '@/lib/gruposMovimentacaoConta';

function dataChaveMovimento(mov) {
  const data = mov.data_pagamento || mov.data_vencimento || getDataMovimentoCaixa(mov);
  return data ? toLocalDateKey(data) : null;
}

function noPeriodo(dataKey, dataInicio, dataFim) {
  if (!dataKey) return false;
  if (dataInicio && dataKey < dataInicio) return false;
  if (dataFim && dataKey > dataFim) return false;
  return true;
}

/** PDV → Caixa Geral → bancos/poupança → demais. */
export function ordenarContasCorteDiario(contas = []) {
  const peso = (conta) => {
    if (contaUsaRegraCaixaPDV(conta)) return 0;
    if (conta.is_caixa_geral) return 1;
    const tipo = String(conta.tipo || '').toLowerCase();
    if (tipo.includes('banc') || tipo.includes('poupan')) return 2;
    return 3;
  };

  return [...contas].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

function nomeConta(contasById, contaId) {
  if (!contaId) return '';
  return contasById[contaId]?.nome || '';
}

function rotuloTransferencia(mov, conta, contasById, parReceita = null) {
  if (mov.origem === 'movimento') {
    if (mov.tipo === 'Reforço') return mov.descricao || mov.observacao || 'Reforço';
    if (isMovimentoTransferenciaCaixaPDV(mov)) {
      const destino = nomeConta(contasById, conta.is_caixa_geral ? null : null);
      return mov.descricao || mov.observacao || `Recolhimento${destino ? ` → ${destino}` : ''}`;
    }
  }

  if (isTransferenciaEntreContas(mov)) {
    if (mov.tipo === 'Despesa') {
      const destino = parReceita?.conta_financeira_id || mov.conta_destino_id;
      const destinoNome = parReceita?.conta_financeira_nome || nomeConta(contasById, destino);
      const nota = mov.descricao || mov.observacoes || parReceita?.descricao;
      if (destinoNome) return nota ? `${nota} → ${destinoNome}` : `→ ${destinoNome}`;
      return nota || 'Transferência';
    }
    if (mov.tipo === 'Receita') {
      const origemNome = mov.conta_financeira_nome || nomeConta(contasById, mov.conta_origem_id);
      const nota = mov.descricao || mov.observacoes;
      if (origemNome) return nota ? `${nota} ← ${origemNome}` : `← ${origemNome}`;
      return nota || 'Transferência recebida';
    }
  }

  return mov.descricao || mov.observacoes || mov.categoria || 'Movimentação';
}

function indexarParesTransferencia(lancamentos = []) {
  const pares = new Map();
  const grupos = new Map();

  lancamentos.forEach((l) => {
    if (!isTransferenciaEntreContas(l) || l.origem === 'movimento') return;
    let key = null;
    if (l.referencia_tipo === 'MovimentosCaixa' && l.referencia_id != null) {
      key = `mc:${l.referencia_id}`;
    } else if (l.categoria === 'Transferência entre Contas' || l.referencia_tipo === 'Manual') {
      const data = l.data_pagamento || l.data_vencimento || '';
      key = `tr:${data}:${Number(l.valor || 0).toFixed(2)}`;
    }
    if (!key) return;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(l);
  });

  grupos.forEach((items, key) => {
    const despesa = items.find((i) => i.tipo === 'Despesa');
    const receita = items.find((i) => i.tipo === 'Receita');
    if (despesa && receita) {
      pares.set(despesa.id, receita);
      pares.set(receita.id, despesa);
    }
  });

  return pares;
}

function isVendaDinheiroPDV(mov, conta) {
  if (!contaUsaRegraCaixaPDV(conta)) return false;
  if (mov.origem === 'movimento') return false;
  if (mov.tipo !== 'Receita') return false;
  if (isTransferenciaEntreContas(mov)) return false;
  if (formaPagamentoNaoDinheiroFisico(mov)) return false;
  return true;
}

function compactarEntradasPDV(entradas, conta) {
  if (!contaUsaRegraCaixaPDV(conta)) return entradas;

  const vendas = [];
  const demais = [];

  entradas.forEach((item) => {
    if (item._raw && isVendaDinheiroPDV(item._raw, conta)) {
      vendas.push(item);
    } else {
      demais.push(item);
    }
  });

  if (!vendas.length) return entradas;

  const total = roundToTwoDecimals(vendas.reduce((acc, item) => acc + item.valor, 0));
  return [
    ...demais,
    {
      id: `pdv-vendas-dinheiro-${conta.id}`,
      descricao: `Vendas em dinheiro (${vendas.length})`,
      valor: total,
      compacto: true,
      transferenciaDestinoId: null,
      transferenciaOrigemId: null,
    },
  ];
}

function montarLinhaCorte(mov, conta, contasById, paresTransferencia) {
  const valor = roundToTwoDecimals(Number(mov.valor || 0));
  const par = paresTransferencia.get(mov.id);
  const descricao = rotuloTransferencia(mov, conta, contasById, par);
  const isTransf =
    isTransferenciaEntreContas(mov) ||
    (mov.origem === 'movimento' && isMovimentoTransferenciaCaixaPDV(mov));

  let lado = 'entrada';
  if (mov.tipo === 'Despesa' || (mov.origem === 'movimento' && isMovimentoTransferenciaCaixaPDV(mov))) {
    lado = 'saida';
  }

  let transferenciaDestinoId = null;
  let transferenciaOrigemId = null;
  if (isTransf) {
    if (lado === 'saida') {
      transferenciaDestinoId = par?.conta_financeira_id || mov.conta_destino_id || null;
      if (!transferenciaDestinoId && mov.origem === 'movimento' && isMovimentoTransferenciaCaixaPDV(mov)) {
        const caixaGeral = Object.values(contasById).find((c) => c.is_caixa_geral);
        transferenciaDestinoId = caixaGeral?.id || null;
      }
    } else {
      transferenciaOrigemId = par?.conta_financeira_id || mov.conta_origem_id || null;
    }
  }

  return {
    id: mov.id || `${mov.origem}-${descricao}-${valor}`,
    descricao,
    valor,
    lado,
    isTransferencia: isTransf,
    transferenciaDestinoId,
    transferenciaOrigemId,
    _raw: mov,
  };
}

function coletarMovimentacoesConta(conta, lancamentos, movimentos, todosLancamentos) {
  const movimentosJaNoFinanceiro = idsMovimentosComLancamentoFinanceiro(todosLancamentos);
  const lancsConta = filtrarLancamentosDaConta(conta, lancamentos);
  const movsConta = filtrarMovimentosDaConta(conta.id, movimentos).filter(
    (m) => !movimentosJaNoFinanceiro.has(String(m.id)),
  );

  return [
    ...lancsConta.map((l) => ({ ...l, origem: 'lancamento' })),
    ...movsConta.map((m) => ({ ...m, origem: 'movimento' })),
  ].filter((mov) => movimentoParticipaExtrato(mov, conta));
}

/**
 * Monta o T de uma conta para o período: saldo inicial, entradas, saídas, saldo final.
 */
export function montarCorteDiarioConta({
  conta,
  lancamentos = [],
  movimentos = [],
  todosLancamentos = [],
  contasById = {},
  dataInicio,
  dataFim,
  mostrarHistoricoAnterior = false,
  dataCorteHistorico = null,
}) {
  if (!conta) {
    return {
      contaId: null,
      contaNome: '',
      saldoInicial: 0,
      saldoFinal: 0,
      entradas: [],
      saidas: [],
    };
  }

  const corteOpts = { mostrarHistoricoAnterior, dataCorte: dataCorteHistorico };
  const todasBrutas = coletarMovimentacoesConta(conta, lancamentos, movimentos, todosLancamentos);
  const todas = todasBrutas.filter((mov) =>
    passaFiltroCorteHistorico(dataChaveMovimento(mov), corteOpts),
  );
  const paresTransferencia = indexarParesTransferencia(todosLancamentos);

  const noPeriodoLista = todas.filter((mov) => noPeriodo(dataChaveMovimento(mov), dataInicio, dataFim));
  const aposPeriodo = todas.filter((mov) => {
    const dataKey = dataChaveMovimento(mov);
    return dataKey && dataFim && dataKey > dataFim;
  });

  const saldoAtual = corteHistoricoAtivo(corteOpts)
    ? calcularSaldoContaAposDataCorte(conta, lancamentos, movimentos, dataCorteHistorico)
    : calcularSaldoContaFinanceira(conta, lancamentos, movimentos);
  const { entradas: entApos, saidas: saiApos } = totaisEntradaSaidaMovimentos(aposPeriodo, conta);
  const saldoFinal = roundToTwoDecimals(saldoAtual - entApos + saiApos);

  const { entradas: entPeriodo, saidas: saiPeriodo } = totaisEntradaSaidaMovimentos(noPeriodoLista, conta);
  const saldoInicial = roundToTwoDecimals(saldoFinal - entPeriodo + saiPeriodo);

  const linhas = noPeriodoLista
    .map((mov) => {
      const normalizado =
        mov.origem === 'movimento' ? normalizarMovimentoCaixaParaLinha(mov) : mov;
      return montarLinhaCorte(normalizado, conta, contasById, paresTransferencia);
    })
    .sort((a, b) => {
      const da = dataChaveMovimento(a._raw) || '';
      const db = dataChaveMovimento(b._raw) || '';
      if (da !== db) return da.localeCompare(db);
      return String(a.descricao).localeCompare(String(b.descricao), 'pt-BR');
    });

  let entradas = linhas.filter((l) => l.lado === 'entrada');
  let saidas = linhas.filter((l) => l.lado === 'saida');

  entradas = compactarEntradasPDV(entradas, conta);

  return {
    contaId: conta.id,
    contaNome: conta.nome,
    isCaixaPDV: contaUsaRegraCaixaPDV(conta),
    isCaixaGeral: conta.is_caixa_geral === true,
    saldoInicial,
    saldoFinal,
    entradas: entradas.map(({ _raw, ...rest }) => rest),
    saidas: saidas.map(({ _raw, ...rest }) => rest),
  };
}

export function montarCorteDiarioMapa({
  contas = [],
  lancamentos = [],
  movimentos = [],
  contasSel = [],
  dataInicio,
  dataFim,
  mostrarHistoricoAnterior = false,
  dataCorteHistorico = null,
}) {
  const contasById = Object.fromEntries(contas.map((c) => [c.id, c]));
  const selecionadas = ordenarContasCorteDiario(
    contas.filter((c) => c.ativo !== false && contasSel.includes(c.id)),
  );

  const contasMapa = selecionadas.map((conta) =>
    montarCorteDiarioConta({
      conta,
      lancamentos,
      movimentos,
      todosLancamentos: lancamentos,
      contasById,
      dataInicio,
      dataFim,
      mostrarHistoricoAnterior,
      dataCorteHistorico,
    }),
  );

  return {
    dataInicio,
    dataFim,
    contas: contasMapa,
  };
}
