/** Registo único Opção B (tipo Transferência + conta destino explícita). */
export function isTransferenciaRegistroUnico(l) {
  return l?.tipo === 'Transferência' && !!l?.conta_destino_id;
}

function contaVisivelNoFiltro(contaId, contasSel = []) {
  if (!contasSel.length) return true;
  return !!contaId && contasSel.includes(contaId);
}

/** Origem e destino canónicos (legado par Despesa/Receita ou registo único). */
export function extrairParTransferencia(l, mapaContrapartes = null) {
  if (!l) return null;
  if (isTransferenciaRegistroUnico(l)) {
    return { origemId: l.conta_financeira_id, destinoId: l.conta_destino_id };
  }
  if (l.tipo === 'Despesa') {
    const destinoId = mapaContrapartes?.get(l.id);
    if (!destinoId) return null;
    return { origemId: l.conta_financeira_id, destinoId };
  }
  if (l.tipo === 'Receita') {
    const origemId = mapaContrapartes?.get(l.id);
    if (!origemId) return null;
    return { origemId, destinoId: l.conta_financeira_id };
  }
  return null;
}

/**
 * Perspectiva de exibição: neutra (A→B), saída (→ destino) ou entrada (← origem).
 * @param {object|null} contaContext — extrato de uma conta (prioridade sobre contasSel).
 */
export function calcularPerspectivaTransferencia(l, contasSel = [], contaContext = null) {
  const par = extrairParTransferencia(l);
  if (!par?.origemId || !par?.destinoId) return 'neutra';

  if (contaContext?.id) {
    if (contaContext.id === par.origemId) return 'saida';
    if (contaContext.id === par.destinoId) return 'entrada';
    return 'neutra';
  }

  const origemVisivel = contaVisivelNoFiltro(par.origemId, contasSel);
  const destinoVisivel = contaVisivelNoFiltro(par.destinoId, contasSel);

  if (origemVisivel && destinoVisivel) return 'neutra';
  if (origemVisivel) return 'saida';
  if (destinoVisivel) return 'entrada';
  return 'neutra';
}

export function lancamentoAfetaConta(l, contaId) {
  if (!l || !contaId) return false;
  if (l.conta_financeira_id === contaId) return true;
  if (l.conta_destino_id === contaId) return true;
  return false;
}

/** Projeta linha de transferência para fluxo/extrato (cor sempre muted via tipoExibicao). */
export function projetarTransferenciaParaExibicao(
  item,
  {
    contasSel = [],
    contaContext = null,
    contasById = {},
    reforcoStatus = null,
  } = {},
) {
  if (!item || item.origem === 'movimento') return null;

  const par = extrairParTransferencia(item);
  if (!par && !isTransferenciaRegistroUnico(item)) return null;
  if (!isTransferenciaRegistroUnico(item) && item.tipo !== 'Despesa' && item.tipo !== 'Receita') {
    return null;
  }
  if (!isTransferenciaRegistroUnico(item)) return null;

  const perspectiva = calcularPerspectivaTransferencia(item, contasSel, contaContext);
  const origemNome =
    item.conta_financeira_nome || contasById[item.conta_financeira_id]?.nome || 'Origem';
  const destinoNome =
    item.conta_destino_nome || contasById[item.conta_destino_id]?.nome || 'Destino';

  return {
    id: `transfer-unico-${item.id}`,
    isTransferenciaConsolidada: perspectiva === 'neutra',
    perspectivaTransferencia: perspectiva,
    tipoExibicao: 'Transferência',
    tipo: 'Transferência',
    valor: item.valor,
    data_pagamento: item.data_pagamento,
    data_vencimento: item.data_vencimento,
    data_lancamento: item.data_lancamento,
    codigo_lancamento: item.codigo_lancamento,
    created_date: item.created_date,
    updated_date: item.updated_date,
    descricao: item.descricao,
    contaOrigemNome: origemNome,
    contaDestinoNome: destinoNome,
    conta_origem_id: item.conta_financeira_id,
    conta_destino_id: item.conta_destino_id,
    notaTransferencia: item.observacoes || null,
    reforcoCaixaStatus: reforcoStatus,
    status: item.status,
    status_conciliacao: item.status_conciliacao,
    categoria: item.categoria || 'Transferência entre Contas',
    tags: item.tags,
    _lancamentoTransferencia: item,
  };
}
