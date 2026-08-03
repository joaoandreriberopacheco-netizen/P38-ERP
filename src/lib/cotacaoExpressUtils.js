import { pickDefaultPurchaseUnit } from '@/lib/productUnits';

export const COTACAO_STATUS_RASCUNHO = 'Rascunho';
export const COTACAO_STATUS_ANALISE = 'Em Análise';
export const COTACAO_STATUS_FINALIZADA = 'Finalizada';

export const COTACAO_ABERTA_STATUSES = [COTACAO_STATUS_RASCUNHO, COTACAO_STATUS_ANALISE];
export const COTACAO_CONCLUIDA_STATUSES = [COTACAO_STATUS_FINALIZADA];

export function isCotacaoAberta(status) {
  return COTACAO_ABERTA_STATUSES.includes(status);
}

export function isCotacaoConcluida(status) {
  return COTACAO_CONCLUIDA_STATUSES.includes(status);
}

export function cotacaoAccent(status) {
  if (status === COTACAO_STATUS_FINALIZADA) return 'success';
  if (status === COTACAO_STATUS_ANALISE) return 'info';
  return 'muted';
}

export function getPrecoCompraAtual(produto) {
  if (!produto) return 0;
  const pu = pickDefaultPurchaseUnit(produto);
  const custoApresentacao = parseFloat(pu?.valor_unitario) || 0;
  const fator = parseFloat(pu?.fator_conversao) || 1;
  if (custoApresentacao > 0 && fator > 0) {
    return custoApresentacao / fator;
  }
  return parseFloat(produto.valor_compra) || parseFloat(produto.preco_custo_calculado) || 0;
}

export function calcDiferencaPct(precoCotado, precoReferencia) {
  const cotado = parseFloat(precoCotado) || 0;
  const ref = parseFloat(precoReferencia) || 0;
  if (ref <= 0 || cotado <= 0) return null;
  return ((cotado - ref) / ref) * 100;
}

export function formatDiferencaPct(pct) {
  if (pct == null || Number.isNaN(pct)) return '—';
  const sinal = pct > 0 ? '+' : '';
  return `${sinal}${pct.toFixed(1)}%`;
}

export function cotacaoItemToSelectorItem(item, produto) {
  const pu = pickDefaultPurchaseUnit(produto);
  const fator = item.fator_conversao ?? pu?.fator_conversao ?? 1;
  const unidade = item.unidade || item.unidade_medida || pu?.unidade || produto?.unidade_principal || 'UN';
  const qty = parseFloat(item.quantidade) || 1;
  return {
    produto_id: item.produto_id,
    produto_nome: item.produto_nome || produto?.nome || '',
    quantidade: qty,
    unidade_medida: unidade,
    fator_conversao: fator,
    quantidade_base: qty * fator,
    custo_unitario: getPrecoCompraAtual(produto),
    valor_desconto_item: 0,
    desconto_pct_item: 0,
    total: 0,
  };
}

export function selectorItemToCotacaoItem(item) {
  return {
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    quantidade: parseFloat(item.quantidade) || 1,
    unidade: item.unidade_medida || item.unidade || 'UN',
    fator_conversao: parseFloat(item.fator_conversao) || 1,
  };
}

export function mergeCotacaoItemsByProduct(currentItems = [], incomingItems = []) {
  const merged = new Map();
  [...currentItems, ...incomingItems].forEach((item) => {
    const key = item.produto_id;
    const previous = merged.get(key);
    const qty = parseFloat(item.quantidade) || 0;
    if (!previous) {
      merged.set(key, { ...item, quantidade: qty });
      return;
    }
    merged.set(key, {
      ...previous,
      quantidade: (parseFloat(previous.quantidade) || 0) + qty,
    });
  });
  return Array.from(merged.values()).filter((item) => (parseFloat(item.quantidade) || 0) > 0);
}

export function getMenorPrecoPorProduto(respostas = [], produtoId) {
  const precos = respostas
    .filter((r) => r.produto_id === produtoId && parseFloat(r.preco_unitario) > 0)
    .map((r) => parseFloat(r.preco_unitario));
  if (precos.length === 0) return null;
  return Math.min(...precos);
}

export function getResposta(cotacao, fornecedorId, produtoId) {
  return cotacao?.respostas?.find(
    (r) => r.fornecedor_id === fornecedorId && r.produto_id === produtoId,
  );
}

export function buildDisputaAutoRegistro({
  cotacao,
  produto,
  fornecedor,
  resposta,
  item,
}) {
  const registros = [];
  const precoCotado = parseFloat(resposta?.preco_unitario) || 0;
  const precoCompra = getPrecoCompraAtual(produto);
  const produtoId = item?.produto_id || resposta?.produto_id;
  const produtoNome = item?.produto_nome || produto?.nome || 'Produto';

  if (precoCotado > 0 && precoCompra > 0) {
    const diff = calcDiferencaPct(precoCotado, precoCompra);
    if (diff != null && Math.abs(diff) >= 0.5) {
      const acima = diff > 0;
      registros.push({
        id: `auto-preco-${fornecedor?.fornecedor_id || fornecedor?.id}-${produtoId}`,
        tipo: acima ? 'preco_acima_custo' : 'preco_abaixo_custo',
        produto_id: produtoId,
        produto_nome: produtoNome,
        fornecedor_id: fornecedor?.fornecedor_id || fornecedor?.id,
        fornecedor_nome: fornecedor?.fornecedor_nome || fornecedor?.nome,
        preco_cotado: precoCotado,
        preco_compra_atual: precoCompra,
        diferenca_pct: diff,
        mensagem: acima
          ? `Proposta ${formatDiferencaPct(diff)} acima do custo de compra atual (R$ ${precoCompra.toFixed(2)})`
          : `Proposta ${formatDiferencaPct(diff)} abaixo do custo de compra atual (R$ ${precoCompra.toFixed(2)})`,
        created_at: new Date().toISOString(),
        automatico: true,
      });
    }
  }

  const qtdPedida = parseFloat(item?.quantidade) || 0;
  const qtdOfertada = parseFloat(resposta?.quantidade_ofertada);
  if (qtdOfertada > 0 && qtdPedida > 0 && qtdOfertada !== qtdPedida) {
    registros.push({
      id: `auto-qtd-${fornecedor?.fornecedor_id || fornecedor?.id}-${produtoId}`,
      tipo: 'qtd_divergente',
      produto_id: produtoId,
      produto_nome: produtoNome,
      fornecedor_id: fornecedor?.fornecedor_id || fornecedor?.id,
      fornecedor_nome: fornecedor?.fornecedor_nome || fornecedor?.nome,
      quantidade_pedida: qtdPedida,
      quantidade_ofertada: qtdOfertada,
      mensagem: `Quantidade ofertada (${qtdOfertada}) diferente da solicitada (${qtdPedida} ${item?.unidade || 'UN'})`,
      created_at: new Date().toISOString(),
      automatico: true,
    });
  }

  return registros;
}

export function sincronizarRegistrosDisputa(cotacao, produtosMap = {}) {
  const existentes = cotacao?.registros_disputa || [];
  const manuais = existentes.filter((r) => !r.automatico);
  const autoMap = new Map();

  (cotacao?.itens || []).forEach((item) => {
    const produto = produtosMap[item.produto_id];
    (cotacao?.fornecedores || []).forEach((fornecedor) => {
      const resposta = getResposta(cotacao, fornecedor.fornecedor_id, item.produto_id);
      if (!resposta) return;
      const novos = buildDisputaAutoRegistro({ cotacao, produto, fornecedor, resposta, item });
      novos.forEach((reg) => autoMap.set(reg.id, reg));
    });
  });

  return [...manuais, ...Array.from(autoMap.values())].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
}

export function buildResumoAprovacao(cotacao, fornecedoresMap = {}, produtosMap = {}) {
  const itensVencedores = (cotacao?.respostas || []).filter((r) => r.vencedor);
  const porFornecedor = {};

  itensVencedores.forEach((resp) => {
    const item = cotacao.itens?.find((i) => i.produto_id === resp.produto_id);
    if (!item) return;
    const fid = resp.fornecedor_id;
    if (!porFornecedor[fid]) {
      const forn = fornecedoresMap[fid] || cotacao.fornecedores?.find((f) => f.fornecedor_id === fid);
      porFornecedor[fid] = {
        fornecedor_id: fid,
        fornecedor_nome: forn?.fornecedor_nome || forn?.nome || 'Fornecedor',
        itens: [],
        total: 0,
      };
    }
    const qty = parseFloat(resp.quantidade_ofertada) || parseFloat(item.quantidade) || 0;
    const preco = parseFloat(resp.preco_unitario) || 0;
    const subtotal = qty * preco;
    const produto = produtosMap[item.produto_id];
    const precoCompra = getPrecoCompraAtual(produto);
    porFornecedor[fid].itens.push({
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      quantidade: qty,
      unidade: item.unidade || 'UN',
      preco_unitario: preco,
      subtotal,
      preco_compra_atual: precoCompra,
      economia_vs_custo: precoCompra > 0 ? (precoCompra - preco) * qty : 0,
    });
    porFornecedor[fid].total += subtotal;
  });

  const grupos = Object.values(porFornecedor);
  const totalGeral = grupos.reduce((s, g) => s + g.total, 0);
  const economiaTotal = grupos.reduce(
    (s, g) => s + g.itens.reduce((si, it) => si + (it.economia_vs_custo > 0 ? it.economia_vs_custo : 0), 0),
    0,
  );

  return {
    grupos,
    totalGeral,
    economiaTotal,
    itensVencedoresCount: itensVencedores.length,
    itensPendentesCount: (cotacao?.itens?.length || 0) - itensVencedores.length,
  };
}

export async function gerarProximoNumeroCotacao(base44) {
  const allCots = await base44.entities.Cotacao.list();
  const nextNumber = (allCots.length > 0
    ? Math.max(...allCots.map((c) => parseInt(c.numero?.split('-')[1] || 0, 10)))
    : 0) + 1;
  return `COT-${String(nextNumber).padStart(5, '0')}`;
}

export async function gerarProximoNumeroPedido(base44) {
  const allPOs = await base44.entities.PedidoCompra.list();
  const nextNumber = (allPOs.length > 0
    ? Math.max(...allPOs.map((p) => parseInt(p.numero?.split('-')[1] || 0, 10)))
    : 0) + 1;
  return nextNumber;
}

function roundFinanceiroCotacao(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Normaliza totais extraídos de PDF de cotação.
 * Garante que total_final reflita o valor a pagar após TODOS os descontos
 * (comercial, SUFRAMA/ICMS, etc.) e que desconto_global = subtotal - total_final.
 */
export function normalizarFinanceiroCotacaoPdf(financeiro = {}) {
  const subtotal = roundFinanceiroCotacao(financeiro.subtotal);
  let totalFinal = roundFinanceiroCotacao(financeiro.total_final);
  let descontoGlobal = roundFinanceiroCotacao(financeiro.desconto_global);
  const descontoComercial = roundFinanceiroCotacao(financeiro.desconto_comercial);
  const descontoSuframa = roundFinanceiroCotacao(
    financeiro.desconto_suframa ?? financeiro.desconto_icms_suframa,
  );

  if (descontoSuframa > 0 && totalFinal > descontoSuframa) {
    const totalComSuframa = roundFinanceiroCotacao(totalFinal - descontoSuframa);
    if (totalComSuframa > 0 && totalComSuframa < totalFinal) {
      totalFinal = totalComSuframa;
    }
  }

  if (subtotal > 0 && totalFinal > 0 && totalFinal < subtotal) {
    const descontoImplied = roundFinanceiroCotacao(subtotal - totalFinal);
    if (descontoImplied > descontoGlobal) {
      descontoGlobal = descontoImplied;
    }
  } else if (subtotal > 0 && descontoGlobal > 0 && (totalFinal <= 0 || totalFinal >= subtotal)) {
    totalFinal = roundFinanceiroCotacao(subtotal - descontoGlobal);
  }

  return {
    subtotal,
    desconto_global: descontoGlobal,
    total_final: totalFinal,
    ...(descontoComercial > 0 ? { desconto_comercial: descontoComercial } : {}),
    ...(descontoSuframa > 0 ? { desconto_suframa: descontoSuframa } : {}),
  };
}

/** Ratio para ratear desconto nos preços unitários (0..1). */
export function calcularRatioDescontoCotacaoPdf(subtotalItens, financeiro = {}) {
  const subtotal = roundFinanceiroCotacao(subtotalItens);
  if (subtotal <= 0) return 1;

  const totalFinal = roundFinanceiroCotacao(financeiro.total_final);
  if (totalFinal > 0 && totalFinal < subtotal) {
    return totalFinal / subtotal;
  }

  const descontoGlobal = roundFinanceiroCotacao(financeiro.desconto_global);
  if (descontoGlobal > 0) {
    return 1 - descontoGlobal / subtotal;
  }

  return 1;
}
