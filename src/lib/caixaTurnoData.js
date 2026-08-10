import { base44 } from '@/api/base44Client';
import { withRateLimitRetry } from '@/lib/p38ApiErrors';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { hydratePedidosVendaItensFromSql } from '@/lib/fetchPedidoVendaItens';
import {
  buildPedidoIdsReceitasTurno,
  isPedidoVendaNoTurnoCaixa,
  STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA,
} from '@/lib/pdvCaixaTurnoVendas';
import { buildSubstituicoesVendaCaixa } from '@/lib/substituicoesVendaCaixa';

export const CAIXA_TURNO_QUERY_KEY = 'caixa-turno-snapshot';

export function caixaTurnoQueryKey(turnoId, caixaId) {
  return [CAIXA_TURNO_QUERY_KEY, String(turnoId ?? ''), String(caixaId ?? '')];
}

const LIST_LIMIT = 500;

function mergeById(items = []) {
  const map = new Map();
  for (const item of items) {
    if (item?.id != null) map.set(String(item.id), item);
  }
  return [...map.values()];
}

/** Arrays do turno podem estar na coluna ou só em dados (legado Supabase). */
export function resolveTurnoArrayField(turno, field) {
  const direct = turno?.[field];
  if (Array.isArray(direct) && direct.length > 0) return direct;
  const nested = turno?.dados?.[field];
  return Array.isArray(nested) ? nested : [];
}

function movimentoValor(m) {
  return Number(m?.valor ?? 0) || 0;
}

function matchesContaMovimento(m, caixaId) {
  return String(m?.conta_id ?? '') === caixaId;
}

function parsePagamentosVenda(venda) {
  let p = venda?.pagamentos;
  if (p == null) return [];
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch {
      return [];
    }
  }
  return Array.isArray(p) ? p : [];
}

function normalizarRascunho(r) {
  const registro = r?.data || r;
  return { ...registro, id: r?.id || registro?.id };
}

async function safeFilter(entity, filter, sort, limit) {
  try {
    const rows = await entity.filter(filter, sort, limit);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function fetchPedidoById(id) {
  try {
    const rows = await base44.entities.PedidoVenda.filter({ id });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row?.id) return row;
  } catch {
    /* filter por id pode falhar */
  }
  try {
    return await base44.entities.PedidoVenda.get(id);
  } catch {
    return null;
  }
}

/**
 * Pedidos necessários para fila + vendas do turno (sem list() global).
 */
export async function fetchPedidosParaCaixaTurno({ turno, caixa, receitasTurno }) {
  const receitas =
    receitasTurno ??
    (await safeFilter(base44.entities.LancamentoFinanceiro, {
      turno_caixa_id: turno.id,
      tipo: 'Receita',
    }));

  const batches = await Promise.all([
    safeFilter(base44.entities.PedidoVenda, { status: 'Aguardando Caixa' }),
    safeFilter(base44.entities.PedidoVenda, { turno_caixa_id: turno.id }),
  ]);

  if (!turno.data_fechamento && turno.data_abertura) {
    const retroBatches = await Promise.all(
      STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA.map((status) =>
        safeFilter(base44.entities.PedidoVenda, {
          status,
          updated_date: { $gte: turno.data_abertura },
        })
      )
    );
    batches.push(...retroBatches);
  }

  const pedidos = mergeById(batches.flat());

  const pedidoIdsReceita = buildPedidoIdsReceitasTurno(receitas);
  const vendasIds = resolveTurnoArrayField(turno, 'vendas_ids');
  const extraIds = new Set([
    ...pedidoIdsReceita,
    ...vendasIds.map((id) => String(id)),
  ]);

  const missing = [...extraIds].filter((id) => !pedidos.some((p) => String(p.id) === id));
  if (missing.length) {
    const extras = await Promise.all(missing.map((id) => fetchPedidoById(id)));
    pedidos.push(...extras.filter(Boolean));
  }

  return { pedidos: mergeById(pedidos), receitasTurno: receitas };
}

export async function fetchMovimentosTurno({ turno, caixa }) {
  const caixaId = String(caixa?.id ?? '');
  const turnoId = String(turno?.id ?? '');
  if (!turnoId || !caixaId) return [];

  const byTurno = await safeFilter(base44.entities.MovimentosCaixa, {
    turno_caixa_id: turno.id,
  });

  const movimentoIds = resolveTurnoArrayField(turno, 'movimentos_ids');
  const byIds = (
    await Promise.all(
      movimentoIds.map((id) =>
        base44.entities.MovimentosCaixa.get(id).catch(() => null)
      )
    )
  ).filter(Boolean);

  let merged = mergeById([...byTurno, ...byIds]);
  let result = merged.filter((m) => matchesContaMovimento(m, caixaId));

  if (result.length === 0) {
    const fallback = await base44.entities.MovimentosCaixa.list('-created_date', LIST_LIMIT);
    result = (fallback || []).filter(
      (m) =>
        String(m.turno_caixa_id ?? m.dados?.turno_caixa_id ?? '') === turnoId &&
        matchesContaMovimento(m, caixaId)
    );
  }

  return result;
}

async function fetchValesParaTurno(turno) {
  if (turno?.data_abertura) {
    const filtered = await safeFilter(
      base44.entities.ValeCompra,
      { updated_date: { $gte: turno.data_abertura } },
      '-updated_date',
      LIST_LIMIT
    );
    if (filtered.length) return filtered;
  }
  return base44.entities.ValeCompra.list('-updated_date', LIST_LIMIT);
}

async function fetchDevolucoesParaTurno(turno) {
  if (turno?.data_abertura) {
    const filtered = await safeFilter(
      base44.entities.DevolucaoTroca,
      { created_date: { $gte: turno.data_abertura } },
      '-created_date',
      LIST_LIMIT
    );
    if (filtered.length) return filtered;
  }
  return base44.entities.DevolucaoTroca.list('-created_date', LIST_LIMIT);
}

export async function fetchRascunhosAguardando() {
  const filtered = await safeFilter(base44.entities.RascunhoPedidoVenda, {
    status: 'Aguardando Caixa',
  });
  if (filtered.length) return filtered;
  const all = await base44.entities.RascunhoPedidoVenda.list('-created_date', LIST_LIMIT);
  return all || [];
}

/**
 * Carrega dados brutos do turno (filtros na BD quando possível).
 */
export async function fetchCaixaTurnoRawData({
  turno,
  caixa,
  incluirRascunhos = true,
}) {
  if (!turno?.id || !caixa?.id) {
    throw new Error('Turno e caixa são obrigatórios');
  }

  const [caixaFresh, turnoFresh, despesasRaw, receitasTurno, movimentos, vales, devolucoes, rascunhosRaw] =
    await Promise.all([
      base44.entities.ContasFinanceiras.get(caixa.id).catch(() => caixa),
      base44.entities.TurnoCaixa.get(turno.id).catch(() => turno),
      safeFilter(base44.entities.LancamentoFinanceiro, {
        turno_caixa_id: turno.id,
        tipo: 'Despesa',
      }),
      safeFilter(base44.entities.LancamentoFinanceiro, {
        turno_caixa_id: turno.id,
        tipo: 'Receita',
      }),
      fetchMovimentosTurno({ turno, caixa }),
      fetchValesParaTurno(turno),
      fetchDevolucoesParaTurno(turno),
      incluirRascunhos ? fetchRascunhosAguardando() : Promise.resolve([]),
    ]);

  const { pedidos } = await fetchPedidosParaCaixaTurno({
    turno: turnoFresh || turno,
    caixa: caixaFresh || caixa,
    receitasTurno,
  });

  const dataAberturaTurno = (turnoFresh || turno)?.data_abertura
    ? new Date((turnoFresh || turno).data_abertura)
    : null;

  const despesas = (despesasRaw || []).filter((d) => {
    if (d.referencia_tipo === 'MovimentosCaixa') return false;
    if (!dataAberturaTurno) return true;
    const raw = d.created_date || d.created_at;
    const criado = raw ? new Date(raw) : null;
    if (!criado || Number.isNaN(criado.getTime())) return true;
    return criado >= dataAberturaTurno;
  });

  return {
    turno: turnoFresh || turno,
    caixa: caixaFresh || caixa,
    pedidos,
    rascunhosRaw,
    movimentos,
    despesas,
    receitasTurno,
    vales,
    devolucoes,
  };
}

export function filterRascunhosAguardando(rascunhosRaw, { exigirItens = true } = {}) {
  return (rascunhosRaw || [])
    .map(normalizarRascunho)
    .filter((r) => {
      const status = r.status;
      const pedidoVendaVinculado = r.pedido_venda_final_id || r.pedido_venda_id;
      const temSenha = !!r.senha_atendimento;
      const temItens = Array.isArray(r.itens) && r.itens.length > 0;
      if (status !== 'Aguardando Caixa' || !temSenha || pedidoVendaVinculado) return false;
      return exigirItens ? temItens : true;
    });
}

/** Resumo de liquidez no formato de CaixasAtivos / SeletorCaixaPDV (totalVendasUtil). */
export function buildPainelCaixaResumo(snapshot, { rascunhosPendentesCaixa = [] } = {}) {
  const { turno, substituicoesCtx, caixaData } = snapshot;
  const totalVendas = substituicoesCtx.totalVendasUtil;
  const liquidezTurno =
    (turno.saldo_inicial || 0) +
    totalVendas +
    (caixaData.reforcos || 0) -
    (caixaData.sangrias || 0) -
    (caixaData.despesas || 0);
  const { pix = 0, credito = 0, debito = 0, vale = 0 } = caixaData.recebimentos || {};
  const totalFiado = caixaData.fiado || 0;
  const dinheiroNaGaveta = liquidezTurno - pix - credito - debito - vale - totalFiado;

  return {
    turnoAberto: true,
    saldoInicial: turno.saldo_inicial || 0,
    totalVendas,
    liquidez: liquidezTurno,
    dinheiroNaGaveta,
    totalFiado,
    quantidadeFiado: (caixaData.fiadoLista || []).length,
    senhasAguardando: rascunhosPendentesCaixa,
  };
}

/**
 * Transforma dados brutos no snapshot usado por PDVCaixa / VisualizadorCaixa.
 */
export function buildCaixaTurnoSnapshot(raw, { incluirRascunhos = true, rascunhoExigirItens = true } = {}) {
  const { turno, caixa, pedidos, rascunhosRaw, movimentos, despesas, receitasTurno, vales, devolucoes } =
    raw;

  const pedidosAguardando = pedidos.filter((p) => p.status === 'Aguardando Caixa');

  const rascunhosAguardando = incluirRascunhos
    ? filterRascunhosAguardando(rascunhosRaw, { exigirItens: rascunhoExigirItens })
    : [];

  const pedidoIdsReceitaTurno = buildPedidoIdsReceitasTurno(receitasTurno || []);
  const vendasTurno = pedidos.filter((p) =>
    isPedidoVendaNoTurnoCaixa(p, {
      turno,
      caixa,
      pedidoIdsDasReceitasDoTurno: pedidoIdsReceitaTurno,
      incluirRetrocompatSemTurno: !turno.data_fechamento,
    })
  );

  const subCtx = buildSubstituicoesVendaCaixa({
    vendas: vendasTurno,
    vales,
    devolucoes,
  });

  let totalDinheiro = 0;
  let totalPix = 0;
  let totalCredito = 0;
  let totalDebito = 0;
  let totalVale = 0;
  let totalFiado = 0;

  vendasTurno.forEach((venda) => {
    parsePagamentosVenda(venda).forEach((pag) => {
      const valor = Number(pag.valor ?? 0) || 0;
      const fp = (pag.forma_pagamento || '').toLowerCase();
      if (fp === 'dinheiro') totalDinheiro += valor;
      else if (fp === 'pix') totalPix += valor;
      else if (fp.includes('crédito') || fp.includes('credito')) totalCredito += valor;
      else if (fp.includes('débito') || fp.includes('debito')) totalDebito += valor;
      else if (fp.includes('vale')) totalVale += valor;
      else if (fp.includes('conta a pagar') || fp.includes('fiado')) totalFiado += valor;
    });
  });

  const totalVendasMonetarias = totalDinheiro + totalPix + totalCredito + totalDebito + totalVale;
  const totalReforcos = movimentos
    .filter((m) => m.tipo === 'Reforço')
    .reduce((sum, m) => sum + movimentoValor(m), 0);
  const totalSangrias = movimentos
    .filter((m) => m.tipo === 'Sangria' || m.tipo === 'Recolhimento de Caixa')
    .reduce((sum, m) => sum + movimentoValor(m), 0);
  const totalDespesas = despesas.reduce((sum, d) => sum + (Number(d.valor ?? 0) || 0), 0);

  const saldoInicial = roundToTwoDecimals(turno.saldo_inicial || 0);
  const saldoCaixaCalculado = roundToTwoDecimals(
    saldoInicial + totalDinheiro + totalReforcos - totalSangrias - totalDespesas
  );
  const liquidezTurno = roundToTwoDecimals(
    saldoInicial + totalVendasMonetarias + totalReforcos - totalSangrias - totalDespesas
  );

  const fiados = (receitasTurno || []).filter((l) => l.forma_pagamento === 'Conta a Pagar');

  return {
    turno,
    caixa,
    pedidosAguardando,
    rascunhosAguardando,
    vendasTurno,
    vendasFinalizadas: subCtx.vendasParaExibicao,
    substituicoesCtx: subCtx,
    movimentos,
    caixaData: {
      saldoInicial,
      saldoAtual: saldoCaixaCalculado,
      liquidez: liquidezTurno,
      totalVendas: roundToTwoDecimals(subCtx.totalVendasUtil),
      qtdSubstituicoes: subCtx.qtdSubstituicoes,
      valorSubstituidoNaoSoma: subCtx.valorSubstituidoNaoSoma,
      recebimentos: {
        dinheiro: roundToTwoDecimals(totalDinheiro),
        pix: roundToTwoDecimals(totalPix),
        credito: roundToTwoDecimals(totalCredito),
        debito: roundToTwoDecimals(totalDebito),
        vale: roundToTwoDecimals(totalVale),
        fiado: roundToTwoDecimals(totalFiado),
      },
      reforcos: roundToTwoDecimals(totalReforcos),
      sangrias: roundToTwoDecimals(totalSangrias),
      despesas: roundToTwoDecimals(totalDespesas),
      despesasLista: despesas,
      fiado: roundToTwoDecimals(totalFiado),
      fiadoLista: fiados,
    },
  };
}

export async function appendTurnoArrayId(base44Client, turnoId, field, newId) {
  if (!turnoId || !newId || !field) return;
  const fresh = await base44Client.entities.TurnoCaixa.get(turnoId).catch(() => null);
  if (!fresh?.id) return;
  const current = resolveTurnoArrayField(fresh, field);
  const idStr = String(newId);
  if (current.some((item) => String(item) === idStr)) return;
  await base44Client.entities.TurnoCaixa.update(turnoId, {
    [field]: [...current, newId],
  });
}

export async function fetchCaixaTurnoSnapshot({
  turno,
  caixa,
  incluirRascunhos = true,
  rascunhoExigirItens = true,
}) {
  return withRateLimitRetry(async () => {
    const raw = await fetchCaixaTurnoRawData({ turno, caixa, incluirRascunhos });
    const pedidos = await hydratePedidosVendaItensFromSql(base44, raw.pedidos || []);
    return buildCaixaTurnoSnapshot(
      { ...raw, pedidos },
      { incluirRascunhos, rascunhoExigirItens },
    );
  });
}

/** Polling / idle sync — menos agressivo que antes */
export const CAIXA_POLL_MS = 60_000;
/** Polling ativo no PDV Caixa (fila de vendas + balanço) */
export const CAIXA_LIVE_POLL_MS = 30_000;
export const CAIXA_IDLE_SYNC_AFTER_MS = 5 * 60 * 1000;
export const CAIXA_IDLE_SYNC_TICK_MS = 90_000;
export const CAIXA_SUBSCRIBE_DEBOUNCE_MS = 600;
