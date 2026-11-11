import { isTransferenciaEntreContas } from '@/lib/saldoContaFinanceira';

function formaPagamentoTexto(l) {
  const direto = l?.forma_pagamento_tipo || l?.forma_pagamento;
  const dados = l?.dados?.forma_pagamento_tipo || l?.dados?.forma_pagamento;
  return String(direto || dados || '').toLowerCase();
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
  if (/pix|ted|doc|boleto|transfer|conta/.test(forma)) return 'bank';
  return 'bank';
}

export function rotuloFormaPagamentoExtrato(l) {
  const raw = l?.forma_pagamento_tipo || l?.forma_pagamento
    || l?.dados?.forma_pagamento_tipo || l?.dados?.forma_pagamento;
  return String(raw || '').trim();
}
