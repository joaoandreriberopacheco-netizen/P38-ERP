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

function nomeContaFinanceira(l) {
  return String(l?.conta_financeira_nome || l?.dados?.conta_financeira_nome || '').trim().toLowerCase();
}

/** Conta física / caixa (ex.: Caixa Geral) — não é operação bancária no ícone. */
export function lancamentoContaCaixa(l) {
  if (!l) return false;
  const conta = nomeContaFinanceira(l);
  if (conta) {
    if (/(^|\s)caixa(\s+geral|\s+f[ií]sico|\s+pdv)?(\s|$)|^caixa$|cofre|gaveta/.test(conta)) return true;
    if (/\bcaixa\b/.test(conta) && !/banc|corrente/.test(conta)) return true;
  }
  const tipoConta = String(l?.conta_financeira_tipo || l?.dados?.conta_financeira_tipo || '').toLowerCase();
  if (/caixa\s+f[ií]sico|^caixa$/.test(tipoConta)) return true;
  const ctx = textoOperacao(l);
  if (/\bcaixa geral\b|\bcaixa f[ií]sic/.test(ctx)) return true;
  return false;
}

/** Dinheiro em espécie ou conta caixa (Caixa Geral, etc.). */
export function lancamentoOperacaoCaixa(l) {
  if (!l) return false;
  const forma = formaPagamentoTexto(l);
  if (/dinheiro|esp[eé]cie|caixa\s*pdv|^caixa$/.test(forma)) return true;
  return lancamentoContaCaixa(l);
}

/** PIX/TED/boleto e menções a conta bancária no texto do lançamento. */
export function lancamentoOperacaoBancaria(l) {
  if (!l) return false;
  if (lancamentoContaCaixa(l)) return false;
  const forma = formaPagamentoTexto(l);
  if (/pix|ted|doc|boleto|transfer[eê]ncia banc|d[eé]bito autom|conta\s+(banc|corrente)/.test(forma)) return true;
  if (/^transfer[eê]ncia$/.test(forma.trim()) && !isTransferenciaEntreContas(l)) return true;
  const ctx = textoOperacao(l);
  if (/banco|banc[aá]ri|transfer[eê]ncia banc|ag[eê]ncia|conta corrente|\bc\/c\b/.test(ctx)) return true;
  const conta = nomeContaFinanceira(l);
  if (conta && /banc|corrente|poupan/.test(conta)) return true;
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
  if (lancamentoOperacaoCaixa(l)) return 'cash';
  if (lancamentoOperacaoBancaria(l)) return 'bank';
  return 'bank';
}

export function rotuloFormaPagamentoExtrato(l) {
  const raw = l?.forma_pagamento_tipo || l?.forma_pagamento
    || l?.dados?.forma_pagamento_tipo || l?.dados?.forma_pagamento;
  return String(raw || '').trim();
}
