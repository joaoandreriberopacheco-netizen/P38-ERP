import {
  camposCartaoCreditoPagBankImediato,
  cartaoCreditoUsaPagBankImediato,
  findContaPagBank,
} from '@/lib/contaPagBank';

/**
 * Conta financeira de destino para receitas de cartão (maquininha).
 * Cartão crédito desde 06/11/2026 → PagBank (imediato).
 */
export async function resolveContaDestinoCartao(base44, pag, opts = {}) {
  const forma = opts.formaPagamento || pag?.forma_pagamento;
  const dataVenda = opts.dataVenda;
  const isCredito = forma === 'Cartão de Crédito';

  if (isCredito && cartaoCreditoUsaPagBankImediato(dataVenda)) {
    let contas = opts.contas;
    if (!contas?.length) {
      contas = await base44.entities.ContasFinanceiras.list();
    }
    const pagBank = findContaPagBank(contas);
    if (!pagBank) {
      throw new Error(
        'Conta PagBank não encontrada. Crie a conta "PagBank" em Caixas e Bancos (Conta Bancária).',
      );
    }
    return { id: pagBank.id, nome: pagBank.nome };
  }

  let contaDestinoId = pag.maquininha_conta_id || null;
  let contaDestinoNome = pag.maquininha_conta_nome || pag.maquininha_nome || 'Maquininha';

  if (!contaDestinoId && pag.maquininha_id) {
    try {
      const maq = await base44.entities.Maquininha.get(pag.maquininha_id);
      if (maq?.conta_destino_id) {
        contaDestinoId = maq.conta_destino_id;
        contaDestinoNome = maq.conta_destino_nome || maq.nome || contaDestinoNome;
      }
    } catch {
      /* maquininha não encontrada */
    }
  }

  if (!contaDestinoId) {
    throw new Error(
      `Maquininha "${pag.maquininha_nome || 'sem nome'}" sem conta destino. ` +
        'Configure em Configurações → Maquininhas.',
    );
  }

  return { id: contaDestinoId, nome: contaDestinoNome };
}

export { camposCartaoCreditoPagBankImediato };
