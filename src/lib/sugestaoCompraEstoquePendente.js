import { pedidoLiberadoParaLogistica } from '@/lib/aprovarPedidoCompraFinanceiro';
import { pedidoCompraItemToLegacyMirror } from '@/lib/pedidoCompraItemContract';

const PEDIDO_COMPRA_APPROVED_STATUSES = new Set([
  'aprovado financeiramente',
  'aprovado',
]);

const PEDIDO_STATUS_LOGISTICA_EM_ABERTO = new Set([
  'aprovado',
  'aguardando recepção',
  'aguardando recepcao',
  'aguardando embarque',
  'enviado',
  'despachado',
  'em recepção',
  'em recepcao',
  'em trânsito',
  'em transito',
  'recebido parcialmente',
  'recebido parcial',
  'pendência',
  'pendencia',
]);

const PEDIDO_STATUS_EXCLUIDOS_ESTOQUE = new Set([
  'rascunho',
  'cancelado',
  'rejeitado financeiramente',
  'rejeitado',
  'concluido',
  'devolvido',
]);

const AGUARDANDO_PAGAMENTO_STATUSES = new Set([
  'aguardando aprovação financeira',
  'aguardando aprovacao financeira',
  'aguardando liberação financeira',
  'aguardando liberacao financeira',
  'aguardando liberação',
  'aguardando liberacao',
]);

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function resolveQuantidadeRecebidaItemEmbarque(item = {}, embarque = {}) {
  const recebida = Number(item.quantidade_recebida) || 0;
  if (recebida > 0) return recebida;

  const statusReceb = normalizeStatus(embarque?.status_recebimento);
  const statusEmbarque = normalizeStatus(embarque?.status);
  const embarqueConcluido =
    statusReceb === 'recebido ok' ||
    statusReceb === 'com divergencia' ||
    statusEmbarque === 'concluido';

  if (!embarqueConcluido) return 0;

  return (
    Number(item.quantidade_embarcada) ||
    Number(item.quantidade_pedida) ||
    Number(item.quantidade) ||
    0
  );
}

function somarRecebidosItensEmbarque(acc, embarque = {}, pedido = null) {
  const itensEmbarcados = Array.isArray(embarque.itens_embarcados)
    ? embarque.itens_embarcados
    : Array.isArray(embarque.itens)
      ? embarque.itens
      : [];
  itensEmbarcados.forEach((item) => {
    const produtoId = item?.produto_id;
    if (!produtoId) return;
    const produtoKey = String(produtoId);
    const pedidoItem = pedido ? resolvePedidoItemParaEmbarque(pedido, item) : null;
    const qtyBase = Number(item.quantidade_recebida_base);
    const qty = Number.isFinite(qtyBase) && qtyBase > 0
      ? qtyBase
      : resolveQuantidadeBaseRecebidaItemEmbarque(item, pedidoItem);
    if (qty > 0) {
      acc[produtoKey] = (acc[produtoKey] || 0) + qty;
    }
  });
  return acc;
}

/** Pedido encerrado para efeito de estoque projetado (não soma pendente). */
export function pedidoCompraEstaConcluido(pedido = {}) {
  const statusDisplay = String(pedido.status || '').trim();
  const statusPedido = normalizeStatus(statusDisplay);
  if (PEDIDO_STATUS_EXCLUIDOS_ESTOQUE.has(statusPedido)) return true;

  const statusRecebDisplay = String(pedido.status_recebimento_geral || '').trim();
  const statusRecebimento = normalizeStatus(statusRecebDisplay);
  if (
    statusRecebDisplay.startsWith('Concluído') ||
    statusRecebDisplay.startsWith('Concluido') ||
    statusRecebimento.startsWith('concluido') ||
    statusRecebimento === 'recebido ok' ||
    statusRecebimento === 'concluido ok' ||
    statusRecebimento.includes('concluido com divergencia')
  ) {
    return true;
  }

  return false;
}

export function resolveQuantidadeBaseItemPedido(item = {}) {
  const base = Number(item.quantidade_base);
  if (Number.isFinite(base) && base > 0) return base;

  const qtd = Number(item.quantidade_comercial ?? item.quantidade) || 0;
  if (qtd <= 0) return 0;

  const fator = Number(item.fator_aplicado ?? item.fator_conversao) || 1;
  return qtd * fator;
}

function pedidoCompraFinanceiramenteAprovado(pedido = {}) {
  const statusAprovacao = normalizeStatus(pedido.status_aprovacao_financeira || '');
  const statusPedido = normalizeStatus(pedido.status || '');
  return (
    PEDIDO_COMPRA_APPROVED_STATUSES.has(statusAprovacao) ||
    PEDIDO_STATUS_LOGISTICA_EM_ABERTO.has(statusAprovacao) ||
    PEDIDO_STATUS_LOGISTICA_EM_ABERTO.has(statusPedido) ||
    pedidoLiberadoParaLogistica(pedido)
  );
}

/** Mesma regra do dashboard de estoque: aprovado financeiramente e ainda não concluído. */
export function pedidoCompraAprovadoNaoConcluido(pedido = {}) {
  if (pedidoCompraEstaConcluido(pedido)) return false;

  const statusPedido = normalizeStatus(pedido.status || '');
  if (PEDIDO_STATUS_EXCLUIDOS_ESTOQUE.has(statusPedido)) return false;

  if (pedidoCompraFinanceiramenteAprovado(pedido)) return true;

  const statusDisplay = String(pedido.status || '').trim();
  if (AGUARDANDO_PAGAMENTO_STATUSES.has(normalizeStatus(statusDisplay))) return false;
  if (statusDisplay === 'Aguardando') return false;

  return false;
}

/** @deprecated use pedidoCompraAprovadoNaoConcluido */
export function pedidoCompraAprovadoFinanceiroNaoConcluido(pedido = {}) {
  return pedidoCompraAprovadoNaoConcluido(pedido);
}

export function buildRecebidosPorPedidoProdutoFromEmbarques(embarques = [], pedidosById = null) {
  const pedidosMap = pedidosById instanceof Map
    ? pedidosById
    : new Map((Array.isArray(pedidosById) ? pedidosById : []).filter((p) => p?.id).map((p) => [String(p.id), p]));

  return (embarques || []).reduce((acc, embarque) => {
    const pedidoId = embarque?.pedido_compra_id;
    if (!pedidoId) return acc;
    const pedidoKey = String(pedidoId);
    if (!acc[pedidoKey]) acc[pedidoKey] = {};
    const pedido = pedidosMap.get(pedidoKey) || pedidosMap.get(String(pedidoId)) || null;
    somarRecebidosItensEmbarque(acc[pedidoKey], embarque, pedido);
    return acc;
  }, {});
}

function recebidosEmbeddedNoPedido(pedido = {}) {
  const embarques = Array.isArray(pedido.embarques_registrados) ? pedido.embarques_registrados : [];
  return embarques.reduce((acc, embarque) => somarRecebidosItensEmbarque(acc, embarque, pedido), {});
}

function mergeRecebidosPorProduto(externo = {}, interno = {}) {
  const out = { ...interno };
  for (const [key, qty] of Object.entries(externo)) {
    out[key] = Math.max(Number(out[key] || 0), Number(qty) || 0);
  }
  return out;
}

function recebidosPorProdutoDoPedido(pedido = {}, recebidosPorPedidoProduto = {}) {
  const pedidoKey = String(pedido?.id || '');
  const externo = recebidosPorPedidoProduto[pedidoKey] || {};
  const interno = recebidosEmbeddedNoPedido(pedido);
  return mergeRecebidosPorProduto(externo, interno);
}

export function quantidadePendenteItemPedidoCompra(item = {}, recebidosPorProduto = {}) {
  const produtoId = item?.produto_id;
  const produtoKey = produtoId ? String(produtoId) : '';
  const quantidadeItem = resolveQuantidadeBaseItemPedido(item);
  const quantidadeRecebida = produtoKey ? Number(recebidosPorProduto[produtoKey] || 0) : 0;
  return Math.max(0, quantidadeItem - quantidadeRecebida);
}

export function pedidoCompraTotalmenteRecebido(pedido = {}, recebidosPorProduto = {}) {
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  if (!itens.length) return false;
  return itens.every(
    (item) => quantidadePendenteItemPedidoCompra(item, recebidosPorProduto) <= 0,
  );
}

function embarqueEmTransitoNaoRecebido(embarque = {}) {
  const statusReceb = normalizeStatus(embarque?.status_recebimento);
  const statusEmb = normalizeStatus(embarque?.status);
  if (statusReceb === 'recebido ok' || statusReceb === 'com divergencia' || statusEmb === 'concluido') {
    return false;
  }
  return true;
}

function resolvePedidoItemParaEmbarque(pedido = {}, item = {}) {
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  if (!itens.length) return null;
  if (item?.pedido_compra_item_id) {
    const porId = itens.find(
      (linha) =>
        linha.pedido_compra_item_id === item.pedido_compra_item_id ||
        linha.id === item.pedido_compra_item_id,
    );
    if (porId) return porId;
  }
  if (item?.produto_id) {
    return itens.find((linha) => linha.produto_id === item.produto_id) || null;
  }
  return null;
}

/** Converte quantidade do embarque para unidade base (estoque_atual). */
export function resolveQuantidadeBaseItemEmbarque(item = {}, pedidoItem = null) {
  const baseDireta = Number(item.quantidade_base);
  if (Number.isFinite(baseDireta) && baseDireta > 0) return baseDireta;

  const qtdComercial =
    Number(item.quantidade_embarcada) ||
    Number(item.quantidade_pedida) ||
    Number(item.quantidade) ||
    0;
  if (qtdComercial <= 0) return 0;

  if (pedidoItem) {
    const basePedido = resolveQuantidadeBaseItemPedido(pedidoItem);
    const qtdPedido = Number(pedidoItem.quantidade_comercial ?? pedidoItem.quantidade) || 0;
    if (basePedido > 0 && qtdPedido > 0) {
      return (qtdComercial / qtdPedido) * basePedido;
    }
  }

  const fator = Number(item.fator_aplicado ?? item.fator_conversao ?? pedidoItem?.fator_conversao) || 1;
  return qtdComercial * fator;
}

function resolveQuantidadeBaseRecebidaItemEmbarque(item = {}, pedidoItem = null) {
  const recebidaBase = Number(item.quantidade_recebida_base);
  if (Number.isFinite(recebidaBase) && recebidaBase > 0) return recebidaBase;

  const recebida = Number(item.quantidade_recebida ?? item.quantidade_recebida_comercial) || 0;
  if (recebida <= 0) return 0;

  const baseEmbarcada = resolveQuantidadeBaseItemEmbarque(
    {
      ...item,
      quantidade_embarcada: recebida,
      quantidade_pedida: recebida,
      quantidade: recebida,
    },
    pedidoItem,
  );
  return baseEmbarcada > 0 ? baseEmbarcada : recebida;
}

/** Pendente por produto a partir de embarques em trânsito (ex.: card E62-67G). */
export function buildPendenteEmbarcadoNaoRecebidoPorProduto(embarques = [], pedidosById = new Map()) {
  const map = {};
  for (const embarque of embarques || []) {
    if (!embarqueEmTransitoNaoRecebido(embarque)) continue;

    const pedido = pedidosById.get(embarque?.pedido_compra_id) || pedidosById.get(String(embarque?.pedido_compra_id));
    // Embarque em trânsito conta no estoque projetado salvo pedido encerrado/cancelado.
    if (pedido && pedidoCompraEstaConcluido(pedido)) continue;

    const itens = embarque?.itens_embarcados || embarque?.itens || [];
    for (const item of itens) {
      const produtoId = item?.produto_id;
      if (!produtoId) continue;
      const pedidoItem = pedido ? resolvePedidoItemParaEmbarque(pedido, item) : null;
      const embarcadoBase = resolveQuantidadeBaseItemEmbarque(item, pedidoItem);
      const recebidoBase = resolveQuantidadeBaseRecebidaItemEmbarque(item, pedidoItem);
      const pendente = Math.max(0, embarcadoBase - recebidoBase);
      if (pendente <= 0) continue;
      const key = String(produtoId);
      map[key] = (map[key] || 0) + pendente;
    }
  }
  return map;
}

function mergePendenteMaps(pedidoMap = {}, embarqueMap = {}) {
  const out = { ...pedidoMap };
  for (const [key, qty] of Object.entries(embarqueMap)) {
    const atual = Number(out[key] || 0);
    const novo = Number(qty) || 0;
    out[key] = Math.max(atual, novo);
  }
  return out;
}

/** Soma por produto o que falta receber em pedidos aprovados financeiramente e não concluídos. */
export function buildPendenteAprovadoFinanceiroPorProduto(
  pedidos = [],
  recebidosPorPedidoProduto = {},
  options = {},
) {
  const pedidoMap = {};
  (pedidos || []).forEach((pedido) => {
    if (!pedidoCompraAprovadoNaoConcluido(pedido)) return;
    const recebidos = recebidosPorProdutoDoPedido(pedido, recebidosPorPedidoProduto);
    if (pedidoCompraTotalmenteRecebido(pedido, recebidos)) return;

    (pedido.itens || []).forEach((item) => {
      const produtoId = item?.produto_id;
      if (!produtoId) return;
      const produtoKey = String(produtoId);
      const pendente = quantidadePendenteItemPedidoCompra(item, recebidos);
      if (pendente > 0) {
        pedidoMap[produtoKey] = (pedidoMap[produtoKey] || 0) + pendente;
      }
    });
  });

  const embarques = options.embarques || [];
  if (!embarques.length) return pedidoMap;

  const pedidosParaEmbarque = options.pedidosParaEmbarque || pedidos;
  const pedidosById = new Map(
    (pedidosParaEmbarque || []).filter((p) => p?.id).map((p) => [String(p.id), p]),
  );
  const embarqueMap = buildPendenteEmbarcadoNaoRecebidoPorProduto(embarques, pedidosById);
  return mergePendenteMaps(pedidoMap, embarqueMap);
}

export function resolvePendentePorProduto(pendentePorProduto = {}, produtoId) {
  if (!produtoId) return 0;
  return Number(pendentePorProduto[produtoId] ?? pendentePorProduto[String(produtoId)]) || 0;
}

/** Preenche `pedido.itens` a partir de PedidoCompraItem quando o espelho legado vier vazio. */
export async function hydratePedidosCompraItens(base44, pedidos = []) {
  const semItens = (pedidos || []).filter((p) => !Array.isArray(p.itens) || p.itens.length === 0);
  if (!semItens.length) return pedidos;

  const pci = base44?.entities?.PedidoCompraItem;
  if (!pci?.filter) return pedidos;

  const hydratedById = new Map();
  await Promise.all(
    semItens.map(async (pedido) => {
      if (!pedido?.id) return;
      try {
        const rows = await pci.filter({ pedido_compra_id: pedido.id });
        const itens = (rows || []).map(pedidoCompraItemToLegacyMirror).filter((item) => item?.produto_id);
        if (itens.length) hydratedById.set(pedido.id, itens);
      } catch {
        // mantém pedido sem itens
      }
    }),
  );

  if (!hydratedById.size) return pedidos;

  return pedidos.map((pedido) => {
    const itens = hydratedById.get(pedido.id);
    if (!itens?.length) return pedido;
    return { ...pedido, itens };
  });
}

/** estoque_atual efetivo = físico + pendente aprovado (quando o toggle está ligado). */
export function aplicarPendenteAprovadoNoEstoqueProdutos(produtos = [], pendentePorProduto = {}) {
  return (produtos || []).map((produto) => {
    const pendente = resolvePendentePorProduto(pendentePorProduto, produto?.id);
    if (pendente <= 0) return produto;
    const estoqueFisico = Number(produto.estoque_atual) || 0;
    return {
      ...produto,
      estoque_atual: estoqueFisico + pendente,
      estoque_fisico: estoqueFisico,
      estoque_pedidos_aprovados: pendente,
    };
  });
}
