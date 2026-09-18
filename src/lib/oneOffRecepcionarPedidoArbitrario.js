/**
 * Marca pedido/embarque como recepcionado (Recebido OK) de forma retroativa.
 * Uso: scripts/recepcionar-pedido-arbitrario.mjs ou window.__recepcionarDT88B8(true) no browser.
 */

import { buildItensCanonicosEmbarque } from '@/lib/buildEmbarqueItensCanonicos';
import { getEmbarqueItensLinhas, hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';
import { fetchPedidoCompraItensPorPedidos, linhasPedidoCompraToLegacyItens } from '@/lib/fetchPedidoCompraItens';
import { criarMovimentosStockRecepcaoEmFalta } from '@/lib/movimentacaoRecepcaoCompra';
import { invokeRecalcularConclusaoPedidoCompra } from '@/lib/p38StockRecalc';
import {
  resolveEmbarqueQuantidadeBase,
  resolveEmbarqueQuantidadeComercial,
} from '@/lib/embarqueQuantityResolve';

function normCodigo(value = '') {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function pedidoNumeroFromCodigoEmbarque(codigo = '') {
  const norm = normCodigo(codigo);
  const match = norm.match(/^(.+)-[A-Z]$/);
  return match ? match[1] : norm;
}

async function encontrarPedidoPorNumero(base44, numero) {
  const norm = normCodigo(numero);
  if (!norm) return null;
  const rows = await base44.entities.PedidoCompra.filter({ numero: norm });
  if (rows?.[0]) return rows[0];
  const recent = await base44.entities.PedidoCompra.list('-created_date', 4000);
  return (recent || []).find((p) => normCodigo(p?.numero) === norm) || null;
}

async function encontrarEmbarquePorCodigo(base44, codigo) {
  const norm = normCodigo(codigo);
  if (!norm) return null;
  const candidatos = [codigo, norm];
  for (const c of candidatos) {
    const rows = await base44.entities.Embarque.filter({ codigo_exibicao: c });
    if (rows?.[0]) return rows[0];
  }
  const recent = await base44.entities.Embarque.filter({}, '-updated_date', 800);
  return (recent || []).find((e) => normCodigo(e?.codigo_exibicao) === norm) || null;
}

async function carregarPedidoItens(base44, pedido) {
  if (Array.isArray(pedido?.itens) && pedido.itens.length) return pedido.itens;
  const byPedido = await fetchPedidoCompraItensPorPedidos(base44, [pedido.id]);
  return linhasPedidoCompraToLegacyItens(byPedido.get(pedido.id) || []);
}

function embarqueJaRecebido(embarque = {}) {
  const status = String(embarque?.status_recebimento || embarque?.status_recebimento_embarque || '').trim();
  return status === 'Recebido OK' || embarque?.status === 'Concluído';
}

function isEmbarqueNecessidade(embarque = {}) {
  if (embarque?.tipo === 'Necessidade') return true;
  return String(embarque?.observacoes || '').includes('criado automaticamente para itens pendentes');
}

function itensComRecepcaoIgualEmbarque(embarque) {
  return getEmbarqueItensLinhas(embarque)
    .map((item) => {
      const qEmbApres = resolveEmbarqueQuantidadeComercial(item, 'embarcada');
      const qEmbBase = resolveEmbarqueQuantidadeBase(item, 'embarcada');
      if (qEmbApres <= 0 && qEmbBase <= 0) return null;
      return {
        ...item,
        quantidade_embarcada_apresentacao: qEmbApres,
        quantidade_recebida_apresentacao: qEmbApres,
        quantidade_recebida: qEmbBase,
        divergencia_tipo: 'Nenhuma',
      };
    })
    .filter(Boolean);
}

async function saveEmbarqueItemsCanonical(base44, embarqueId, itensNorm, pedidoItens) {
  const items = buildItensCanonicosEmbarque(itensNorm, pedidoItens);
  if (!items.length) return { ok: false, reason: 'sem_itens_canonicos' };
  await base44.functions.invoke('saveEmbarqueItem', {
    action: 'replaceAll',
    embarque_id: embarqueId,
    items,
  });
  return { ok: true, count: items.length };
}

async function carregarMovimentosEntradaPedido(base44, pedido) {
  const pid = pedido?.id;
  if (!pid) return [];
  let movs = await base44.entities.MovimentacaoEstoque.filter(
    { referencia_tipo: 'PedidoCompra', referencia_id: pid },
    '-created_date',
    500,
  );
  if (!movs?.length) {
    movs = await base44.entities.MovimentacaoEstoque.filter(
      { referencia_tipo: 'PedidoCompra', referencia_id: String(pid) },
      '-created_date',
      500,
    );
  }
  return (movs || []).filter((m) => m?.tipo === 'Entrada');
}

/**
 * @param {object} base44
 * @param {{
 *   numero?: string,
 *   codigoEmbarque?: string,
 *   pedidoId?: string,
 *   apply?: boolean,
 *   criarStock?: boolean,
 *   dataEntrada?: string,
 * }} opts
 */
export async function recepcionarPedidoArbitrario(
  base44,
  {
    numero = '',
    codigoEmbarque = '',
    pedidoId = '',
    apply = false,
    criarStock = true,
    dataEntrada = new Date().toISOString().slice(0, 10),
  } = {},
) {
  let pedido = null;
  let embarqueAlvo = null;

  if (pedidoId) {
    const rows = await base44.entities.PedidoCompra.filter({ id: pedidoId });
    pedido = rows?.[0] || null;
  }

  if (!pedido && codigoEmbarque) {
    embarqueAlvo = await encontrarEmbarquePorCodigo(base44, codigoEmbarque);
    if (embarqueAlvo?.pedido_compra_id) {
      const rows = await base44.entities.PedidoCompra.filter({ id: embarqueAlvo.pedido_compra_id });
      pedido = rows?.[0] || null;
    }
    if (!pedido) {
      pedido = await encontrarPedidoPorNumero(base44, pedidoNumeroFromCodigoEmbarque(codigoEmbarque));
    }
  }

  if (!pedido && numero) {
    pedido = await encontrarPedidoPorNumero(base44, numero);
  }

  if (!pedido) {
    return { ok: false, error: `Pedido não encontrado (${numero || codigoEmbarque || pedidoId}).` };
  }

  const embarquesRaw = await base44.entities.Embarque.filter(
    { pedido_compra_id: pedido.id },
    'created_date',
    50,
  );
  const embarques = await hydrateEmbarquesPedidoFromSql(base44, pedido.id, embarquesRaw || []);
  const pedidoItens = await carregarPedidoItens(base44, pedido);

  const embarquesReais = embarques.filter((emb) => !isEmbarqueNecessidade(emb));
  const embarquesNecessidade = embarques.filter((emb) => isEmbarqueNecessidade(emb));

  const plano = [];
  for (const emb of embarquesReais) {
    const itensNorm = itensComRecepcaoIgualEmbarque(emb);
    if (!itensNorm.length) continue;
    plano.push({
      embarque_id: emb.id,
      codigo: emb.codigo_exibicao || emb.numero,
      ja_recebido: embarqueJaRecebido(emb),
      itens: itensNorm.length,
      acao: embarqueJaRecebido(emb) ? 'ja_recebido' : 'recepcionar',
    });
  }

  const report = {
    ok: true,
    dryRun: !apply,
    pedido_id: pedido.id,
    numero: pedido.numero,
    codigo_embarque_alvo: codigoEmbarque || null,
    plano,
    embarques_necessidade: embarquesNecessidade.map((e) => ({
      id: e.id,
      codigo: e.codigo_exibicao || e.numero,
    })),
  };

  if (!plano.length) {
    report.message = 'Nenhum embarque real com itens para recepcionar.';
    return report;
  }

  if (!apply) {
    report.message = 'Dry-run: passe apply=true para gravar recepção e concluir o pedido.';
    return report;
  }

  const resultados = [];
  let movimentosCriados = 0;

  for (const emb of embarquesReais) {
    if (embarqueJaRecebido(emb)) {
      resultados.push({ embarque_id: emb.id, status: 'ignorado_ja_recebido' });
      continue;
    }

    const itensNorm = itensComRecepcaoIgualEmbarque(emb);
    if (!itensNorm.length) {
      resultados.push({ embarque_id: emb.id, status: 'sem_itens' });
      continue;
    }

    const saved = await saveEmbarqueItemsCanonical(base44, emb.id, itensNorm, pedidoItens);
    if (!saved.ok) {
      resultados.push({ embarque_id: emb.id, status: 'erro_itens', detail: saved.reason });
      continue;
    }

    const obsAnteriores = String(emb?.observacoes || '').trim();
    const obsRecepcao = `Recepção retroativa arbitrária (${dataEntrada}) — recebido conforme embarcado.`;
    await base44.entities.Embarque.update(emb.id, {
      status: 'Concluído',
      status_recebimento: 'Recebido OK',
      observacoes: obsAnteriores ? `${obsAnteriores}\n\n${obsRecepcao}` : obsRecepcao,
    });

    if (criarStock) {
      const movimentos = await carregarMovimentosEntradaPedido(base44, pedido);
      const embAtualizado = { ...emb, _linhas: itensNorm, itens: itensNorm, itens_embarcados: itensNorm };
      movimentosCriados += await criarMovimentosStockRecepcaoEmFalta(base44, {
        pedido: { ...pedido, itens: pedidoItens },
        embarque: embAtualizado,
        movimentosExistentes: movimentos,
      });
    }

    resultados.push({ embarque_id: emb.id, status: 'recepcionado', itens: saved.count });
  }

  for (const emb of embarquesNecessidade) {
    try {
      await base44.functions.invoke('saveEmbarqueItem', {
        action: 'replaceAll',
        embarque_id: emb.id,
        items: [],
      });
      await base44.entities.Embarque.update(emb.id, {
        status: 'Concluído',
        status_recebimento: 'Recebido OK',
        observacoes: `${String(emb.observacoes || '').trim()}\nEncerrado — saldo absorvido por recepção retroativa (${dataEntrada}).`.trim(),
      });
      resultados.push({ embarque_id: emb.id, status: 'necessidade_encerrada' });
    } catch (error) {
      resultados.push({
        embarque_id: emb.id,
        status: 'necessidade_erro',
        detail: String(error?.message || error),
      });
    }
  }

  const tagHistorico = `\n[RECEPÇÃO RETROATIVA | PC ${pedido.numero || pedido.id} | ${dataEntrada} | ${resultados.length} embarque(s)]`;
  await base44.entities.PedidoCompra.update(pedido.id, {
    status: 'Concluído',
    status_recebimento_geral: 'Concluído OK',
    historico: String(pedido.historico || '') + tagHistorico,
  });

  await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);

  report.resultados = resultados;
  report.movimentos_criados = movimentosCriados;
  report.message = `Pedido ${pedido.numero} marcado como recepcionado/concluído.`;
  return report;
}

/** Atalho para DT8-8B8 / Fortlev (card DT8-8B8-B). */
export function recepcionarDT88B8(base44, apply = false) {
  return recepcionarPedidoArbitrario(base44, {
    numero: 'DT8-8B8',
    codigoEmbarque: 'DT8-8B8-B',
    apply: Boolean(apply),
    criarStock: Boolean(apply),
  });
}
