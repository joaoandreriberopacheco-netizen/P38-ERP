import { isTransferenciaEntreContas } from '@/lib/saldoContaFinanceira';

function formaPagamentoTexto(l) {
  const direto = l?.forma_pagamento_tipo || l?.forma_pagamento;
  const dados = l?.dados?.forma_pagamento_tipo || l?.dados?.forma_pagamento;
  return String(direto || dados || '').toLowerCase();
}

function textoOperacao(l) {
  return [
    l?.descricao,
    l?.categoria,
    l?.conta_financeira_nome,
    l?.observacoes,
    l?.dados?.descricao,
    l?.dados?.categoria,
    l?.dados?.conta_financeira_nome,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** PIX/TED/boleto e menções a conta bancária no texto do lançamento. */
export function lancamentoOperacaoBancaria(l) {
  if (!l) return true;
  const forma = formaPagamentoTexto(l);
  if (/pix|ted|doc|boleto|transfer[eê]ncia banc|d[eé]bito autom|conta\s+(banc|corrente)/.test(forma)) return true;
  if (/^transfer[eê]ncia$/.test(forma.trim()) && !isTransferenciaEntreContas(l)) return true;
  const ctx = textoOperacao(l);
  if (/banco|banc[aá]ri|transfer[eê]ncia banc|ag[eê]ncia|conta corrente|\bc\/c\b/.test(ctx)) return true;
  return false;
}

/** Ícone semântico da linha — alinhado ao protótipo extrato v8. */
export function fluxoExtratoIconKind(l) {
  if (!l) return 'bank';
  if (l.isTransferenciaConsolidada || l.perspectivaTransferencia === 'neutra') return 'transfer';
  const tipo = l.tipoExibicao || (isTransferenciaEntreContas(l) ? 'Transferência' : l.tipo);
  if (tipo === 'Transferência' || isTransferenciaEntreContas(l)) return 'transfer';

  const forma = formaPagamentoTexto(l);
  if (/cart[aã]o|credito|crédito|debito|débito|moderninha/.test(forma)) return 'card';
  if (/dinheiro|esp[eé]cie|caixa\s*pdv|^caixa$/.test(forma)) return 'cash';
  if (lancamentoOperacaoBancaria(l)) return 'bank';
  return 'bank';
}

export function rotuloFormaPagamentoExtrato(l) {
  const raw = l?.forma_pagamento_tipo || l?.forma_pagamento
    || l?.dados?.forma_pagamento_tipo || l?.dados?.forma_pagamento;
  return String(raw || '').trim();
}
