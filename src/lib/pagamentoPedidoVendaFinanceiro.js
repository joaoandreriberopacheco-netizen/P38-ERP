/**
 * Regras alinhadas a base44/functions/processarVendaCaixa/entry.ts para receitas de PedidoVenda.
 * Cartão e PIX geram receita (valor bruto / líquido) + despesa de tarifa quando aplicável.
 */

import { roundToTwoDecimals } from '@/lib/financialUtils';
import { resolveContaDestinoCartao } from '@/lib/resolveContaDestinoCartao';
import {
  TAXA_PIX_PERCENTUAL,
  calcularValorLiquidoAposTarifa,
  calcularValorTarifa,
} from '@/lib/taxaMaquininha';

export { TAXA_PIX_PERCENTUAL };

/** Mesmo offset que processarVendaCaixa (America/Rio_Branco simplificado). */
export function getHojeBr() {
  const agora = new Date();
  const offsetMs = -5 * 60 * 60 * 1000;
  return new Date(agora.getTime() + offsetMs).toISOString().split('T')[0];
}

/** Soma dias úteis (pula sábado e domingo), espelhando processarVendaCaixa. */
export function addDiasUteis(dataISO, dias) {
  const d = new Date(`${dataISO}T12:00:00Z`);
  let adicionados = 0;
  while (adicionados < dias) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) adicionados++;
  }
  return d.toISOString().split('T')[0];
}

export function isFormaVale(forma) {
  const f = (forma || '').toLowerCase();
  return f.includes('vale');
}

/** Todas as vendas na maquininha creditam no próximo dia útil (sexta–domingo → segunda). */
export const PRAZO_LIQUIDACAO_MAQUININHA_DIAS = 1;

export function getPrazoLiquidacaoMaquininha() {
  return PRAZO_LIQUIDACAO_MAQUININHA_DIAS;
}

export function isCartaoForma(forma) {
  return forma === 'Cartão de Débito' || forma === 'Cartão de Crédito';
}

/**
 * Monta objeto de pagamento de cartão igual ao PDVCaixa.handleFinalizarVenda.
 */
export function buildPagamentoPix(valor) {
  const v = roundToTwoDecimals(parseFloat(valor) || 0);
  return {
    forma_pagamento: 'PIX',
    valor: v,
    parcelas: 1,
    taxa_tarifa: TAXA_PIX_PERCENTUAL,
  };
}

export function buildPagamentoCartaoFromSelecao(forma, valor, dados) {
  const v = roundToTwoDecimals(parseFloat(valor) || 0);
  const m = dados?.maquininha;
  if (forma === 'Cartão de Débito') {
    return {
      forma_pagamento: 'Cartão de Débito',
      valor: v,
      parcelas: 1,
      maquininha_id: m?.id,
      maquininha_nome: m?.nome,
      maquininha_conta_id: m?.conta_destino_id,
      maquininha_conta_nome: m?.conta_destino_nome,
      bandeira: dados.bandeira,
      taxa_maquininha: dados.taxa || 0,
      prazo_maquininha_dias: dados.prazo_dias ?? getPrazoLiquidacaoMaquininha(),
    };
  }
  if (forma === 'Cartão de Crédito') {
    const parcelas = Math.min(12, Math.max(1, parseInt(dados.parcelas, 10) || 1));
    return {
      forma_pagamento: 'Cartão de Crédito',
      valor: v,
      parcelas,
      maquininha_id: m?.id,
      maquininha_nome: m?.nome,
      maquininha_conta_id: m?.conta_destino_id,
      maquininha_conta_nome: m?.conta_destino_nome,
      bandeira: dados.bandeira,
      taxa_maquininha: dados.taxa || 0,
      prazo_maquininha_dias: dados.prazo_dias ?? getPrazoLiquidacaoMaquininha(),
    };
  }
  return null;
}

/** Remove metadados de cartão ao trocar para outra forma. */
export function stripCartaoFields(pag) {
  const next = { ...pag };
  delete next.maquininha_id;
  delete next.maquininha_nome;
  delete next.maquininha_conta_id;
  delete next.maquininha_conta_nome;
  delete next.bandeira;
  delete next.taxa_maquininha;
  delete next.taxa_tarifa;
  delete next.prazo_maquininha_dias;
  if (!isCartaoForma(next.forma_pagamento)) {
    next.parcelas = 1;
  }
  return next;
}

async function resolveContaCaixaPDV(base44, pedido, receitas) {
  const fromLanc = receitas.find(
    (l) => l.forma_pagamento === 'Dinheiro' || l.forma_pagamento === 'PIX'
  );
  if (fromLanc?.conta_financeira_id) {
    return {
      id: fromLanc.conta_financeira_id,
      nome: fromLanc.conta_financeira_nome || 'Caixa',
    };
  }
  if (pedido.turno_caixa_id) {
    try {
      const turno = await base44.entities.TurnoCaixa.get(pedido.turno_caixa_id);
      if (turno?.conta_caixa_pdv_id) {
        const conta = await base44.entities.ContasFinanceiras.get(turno.conta_caixa_pdv_id);
        return {
          id: turno.conta_caixa_pdv_id,
          nome: conta?.nome || 'Caixa',
        };
      }
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

async function criarDespesaTarifa(base44, {
  descricao,
  valorTarifa,
  contaDestinoId,
  contaDestinoNome,
  dataVencimento,
  dataPagamento,
  status,
  tags,
  pedidoId,
  numeroPedido,
  turnoCaixaId,
  categoria = 'Custos de Maquininha',
}) {
  if (!valorTarifa || valorTarifa <= 0) return;
  await base44.entities.LancamentoFinanceiro.create({
    tipo: 'Despesa',
    descricao,
    valor: valorTarifa,
    valor_liquido: valorTarifa,
    data_vencimento: dataVencimento,
    ...(dataPagamento ? { data_pagamento: dataPagamento } : {}),
    status: status || 'Em Aberto',
    status_conciliacao: 'Pendente',
    categoria,
    tags: ['tarifa', ...(tags || [])],
    conta_financeira_id: contaDestinoId,
    conta_financeira_nome: contaDestinoNome,
    turno_caixa_id: turnoCaixaId,
    referencia_id: pedidoId,
    referencia_tipo: 'PedidoVenda',
    referencia_numero: numeroPedido,
  });
}

/**
 * Recria todos os lançamentos de Receita do pedido a partir do array de pagamentos
 * (mesma semântica de processarVendaCaixa, sem alterar estoque nem vale).
 */
export async function rebuildReceitasLancamentosPedidoVenda(
  base44,
  pedido,
  pagamentos,
  formasDePagamento
) {
  const todos = await base44.entities.LancamentoFinanceiro.filter({
    referencia_id: pedido.id,
    referencia_tipo: 'PedidoVenda',
  });
  const turnoCaixaId =
    todos.find((l) => l.turno_caixa_id)?.turno_caixa_id ?? pedido.turno_caixa_id ?? null;

  const contaCaixaPDV = await resolveContaCaixaPDV(base44, pedido, todos);

  for (const l of todos) {
    await base44.entities.LancamentoFinanceiro.delete(l.id);
  }

  const hoje = getHojeBr();
  const numeroPedido = pedido.numero || '';
  const clienteId = pedido.cliente_id || null;
  const clienteNome = pedido.cliente_nome || null;

  const formaPorNome = (nome) => formasDePagamento.find((f) => f.nome === nome);

  for (const pag of pagamentos) {
    const valor = roundToTwoDecimals(parseFloat(pag.valor) || 0);
    if (valor <= 0) continue;
    if (isFormaVale(pag.forma_pagamento)) continue;

    if (pag.forma_pagamento === 'Conta a Pagar') {
      await base44.entities.LancamentoFinanceiro.create({
        tipo: 'Receita',
        descricao: `Fiado - Venda ${numeroPedido}${clienteNome ? ` - ${clienteNome}` : ''}`,
        terceiro_id: clienteId,
        terceiro_nome: clienteNome,
        valor,
        valor_liquido: valor,
        data_vencimento: hoje,
        status: 'Em Aberto',
        status_conciliacao: 'N/A',
        forma_pagamento: 'Conta a Pagar',
        forma_pagamento_tipo: 'Boleto',
        categoria: 'Venda de Produto',
        tags: ['FIADO'],
        conta_financeira_id: contaCaixaPDV?.id || null,
        conta_financeira_nome: contaCaixaPDV?.nome || 'A Receber',
        turno_caixa_id: turnoCaixaId,
        referencia_id: pedido.id,
        referencia_tipo: 'PedidoVenda',
        referencia_numero: numeroPedido,
      });
      continue;
    }

    if (isCartaoForma(pag.forma_pagamento)) {
      const taxa = pag.taxa_maquininha || 0;
      const valorBruto = valor;
      const valorTarifa = calcularValorTarifa(valorBruto, taxa);
      const valorLiquido = calcularValorLiquidoAposTarifa(valorBruto, taxa);
      const prazoDias = pag.prazo_maquininha_dias ?? getPrazoLiquidacaoMaquininha();
      const dataVencimento = addDiasUteis(hoje, prazoDias);
      const isCredito = pag.forma_pagamento === 'Cartão de Crédito';
      const maquininhaNome = pag.maquininha_nome || pag.forma_pagamento;
      const bandeira = pag.bandeira || '';
      const parcelas = pag.parcelas || 1;
      const descricao = `${pag.forma_pagamento}${bandeira ? ` ${bandeira}` : ''}${parcelas > 1 ? ` ${parcelas}x` : ''} - ${maquininhaNome} - Venda ${numeroPedido}`;
      const { id: contaDestinoId, nome: contaDestinoNome } = await resolveContaDestinoCartao(
        base44,
        pag,
      );

      await base44.entities.LancamentoFinanceiro.create({
        tipo: 'Receita',
        descricao,
        terceiro_id: clienteId,
        terceiro_nome: clienteNome,
        valor: valorBruto,
        valor_liquido: valorLiquido,
        data_vencimento: dataVencimento,
        data_liquidacao_prevista: dataVencimento,
        status: 'Em Aberto',
        status_conciliacao: 'Pendente',
        forma_pagamento: pag.forma_pagamento,
        forma_pagamento_tipo:
          pag.forma_pagamento === 'Cartão de Débito' ? 'Cartão Débito' : 'Cartão Crédito',
        categoria: 'Venda de Produto',
        tags: ['CARTAO', ...(isCredito ? ['conta_receber'] : []), maquininhaNome, ...(bandeira ? [bandeira] : [])],
        conta_financeira_id: contaDestinoId,
        conta_financeira_nome: contaDestinoNome,
        turno_caixa_id: turnoCaixaId,
        referencia_id: pedido.id,
        referencia_tipo: 'PedidoVenda',
        referencia_numero: numeroPedido,
        observacoes: JSON.stringify({
          maquininha_id: pag.maquininha_id,
          maquininha_nome: maquininhaNome,
          bandeira,
          taxa_pct: taxa,
          parcelas,
          data_venda: hoje,
        }),
      });

      await criarDespesaTarifa(base44, {
        descricao: `Tarifa Maquininha ${maquininhaNome} — ${taxa.toFixed(2)}% — ${bandeira} ${pag.forma_pagamento} — Venda ${numeroPedido}`,
        valorTarifa,
        contaDestinoId,
        contaDestinoNome,
        dataVencimento,
        status: 'Em Aberto',
        tags: ['taxa-maquininha', maquininhaNome, ...(bandeira ? [bandeira] : [])],
        pedidoId: pedido.id,
        numeroPedido,
        turnoCaixaId,
      });
      continue;
    }

    let contaDestinoId = contaCaixaPDV?.id;
    let contaDestinoNome = contaCaixaPDV?.nome || 'Caixa';
    let formaPgId = null;

    if (pag.forma_pagamento !== 'Dinheiro') {
      const forma = formaPorNome(pag.forma_pagamento);
      if (forma?.conta_destino_id) {
        contaDestinoId = forma.conta_destino_id;
        contaDestinoNome = forma.conta_destino_nome || pag.forma_pagamento;
        formaPgId = forma.id;
      }
    }

    if (!contaDestinoId && contaCaixaPDV?.id) {
      contaDestinoId = contaCaixaPDV.id;
      contaDestinoNome = contaCaixaPDV.nome;
    }

    if (pag.forma_pagamento === 'Dinheiro' && !contaDestinoId) {
      throw new Error(
        'Não foi possível determinar a conta do caixa para Dinheiro. Verifique o turno do pedido ou lançamentos anteriores.'
      );
    }

    const isPix = pag.forma_pagamento === 'PIX';
    const taxaPix = isPix ? (pag.taxa_tarifa ?? TAXA_PIX_PERCENTUAL) : 0;
    const valorBruto = valor;
    const valorTarifaPix = isPix ? calcularValorTarifa(valorBruto, taxaPix) : 0;
    const valorLiquido = isPix
      ? calcularValorLiquidoAposTarifa(valorBruto, taxaPix)
      : (pag.valor_liquido_recebido != null ? roundToTwoDecimals(pag.valor_liquido_recebido) : valor);

    await base44.entities.LancamentoFinanceiro.create({
      tipo: 'Receita',
      descricao: isPix
        ? `PIX - Venda ${numeroPedido}${clienteNome ? ` - ${clienteNome}` : ''}`
        : `Venda ${numeroPedido}${clienteNome ? ` - ${clienteNome}` : ''}`,
      terceiro_id: clienteId,
      terceiro_nome: clienteNome,
      valor: valorBruto,
      valor_liquido: valorLiquido,
      data_vencimento: hoje,
      data_pagamento: hoje,
      status: 'Pago',
      status_conciliacao: pag.forma_pagamento === 'Dinheiro' ? 'N/A' : 'Pendente',
      forma_pagamento: pag.forma_pagamento,
      forma_pagamento_id: formaPgId,
      forma_pagamento_tipo: pag.forma_pagamento,
      categoria: 'Venda de Produto',
      conta_financeira_id: contaDestinoId,
      conta_financeira_nome: contaDestinoNome,
      turno_caixa_id: turnoCaixaId,
      referencia_id: pedido.id,
      referencia_tipo: 'PedidoVenda',
      referencia_numero: numeroPedido,
      ...(isPix
        ? {
            observacoes: JSON.stringify({
              taxa_pct: taxaPix,
              data_venda: hoje,
            }),
          }
        : {}),
    });

    if (isPix && valorTarifaPix > 0) {
      await criarDespesaTarifa(base44, {
        descricao: `Tarifa PIX — ${taxaPix.toFixed(2)}% — Venda ${numeroPedido}`,
        valorTarifa: valorTarifaPix,
        contaDestinoId,
        contaDestinoNome,
        dataVencimento: hoje,
        dataPagamento: hoje,
        status: 'Pago',
        tags: ['taxa-pix', 'PIX'],
        pedidoId: pedido.id,
        numeroPedido,
        turnoCaixaId,
        categoria: 'Custos Financeiros',
      });
    }
  }
}
