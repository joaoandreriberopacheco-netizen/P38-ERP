/**
 * Árvore de destinos da Torre de controle (pais → filhos → netos).
 * Folhas com `action` disparam handlers em AnexoCompartilhado.
 */

export const TORRE_WIDGET_ACTIONS = {
  PEDIDO_NOVO: 'pedido_novo',
  PEDIDO_EXISTENTE: 'pedido_existente',
  FINANCEIRO_NOVO: 'financeiro_novo',
  FINANCEIRO_EXISTENTE: 'financeiro_existente',
  FINANCEIRO_IMPORTAR_BOLETO: 'financeiro_importar_boleto',
  FINANCEIRO_ATUALIZAR_BOLETO: 'financeiro_atualizar_boleto',
  LOGISTICA_EVENTO: 'logistica_evento',
};

/** @typedef {'raiz' | 'pedidos' | 'pedido_novo' | 'pedido_existente' | 'financeiro' | 'financeiro_comprovante' | 'financeiro_novo' | 'financeiro_existente' | 'financeiro_boleto' | 'financeiro_importar_boleto' | 'financeiro_atualizar_boleto' | 'logistica' | 'logistica_evento'} TorreWidgetNodeId */

/** @type {Record<string, { titulo: string, descricao?: string, icon: string, children?: string[], action?: string, requiresFile?: boolean }>} */
export const TORRE_WIDGET_NODES = {
  raiz: {
    titulo: 'Destinos',
    icon: 'radio-tower',
    children: ['pedidos', 'financeiro', 'logistica'],
  },
  pedidos: {
    titulo: 'Pedidos de compra',
    descricao: 'Novo pedido com PDF ou anexar a pedido existente',
    icon: 'shopping-cart',
    children: ['pedido_novo', 'pedido_existente'],
  },
  pedido_novo: {
    titulo: 'Novo pedido',
    descricao: 'Criar pedido e importar itens do PDF',
    icon: 'file-up',
    action: TORRE_WIDGET_ACTIONS.PEDIDO_NOVO,
    requiresFile: true,
  },
  pedido_existente: {
    titulo: 'Pedido existente',
    descricao: 'Anexar comprovante a um pedido já criado',
    icon: 'link',
    action: TORRE_WIDGET_ACTIONS.PEDIDO_EXISTENTE,
    requiresFile: true,
  },
  financeiro: {
    titulo: 'Financeiro',
    descricao: 'Comprovantes de pagamento, boletos e contas',
    icon: 'wallet',
    children: ['financeiro_comprovante', 'financeiro_boleto'],
  },
  financeiro_comprovante: {
    titulo: 'Comprovante de pagamento',
    descricao: 'PIX, TED, transferência ou pagamento já feito',
    icon: 'receipt',
    children: ['financeiro_novo', 'financeiro_existente'],
  },
  financeiro_novo: {
    titulo: 'Novo lançamento',
    descricao: 'Registrar despesa e anexar comprovante',
    icon: 'plus',
    action: TORRE_WIDGET_ACTIONS.FINANCEIRO_NOVO,
  },
  financeiro_existente: {
    titulo: 'Lançamento existente',
    descricao: 'Buscar conta a pagar ou despesa e anexar',
    icon: 'link',
    action: TORRE_WIDGET_ACTIONS.FINANCEIRO_EXISTENTE,
  },
  financeiro_boleto: {
    titulo: 'Boleto / conta a pagar',
    descricao: 'Ler PDF de cobrança ou atualizar recorrente',
    icon: 'file-text',
    children: ['financeiro_importar_boleto', 'financeiro_atualizar_boleto'],
  },
  financeiro_importar_boleto: {
    titulo: 'Importar conta (AGEFIN)',
    descricao: 'Ler PDF e criar conta a pagar',
    icon: 'file-text',
    action: TORRE_WIDGET_ACTIONS.FINANCEIRO_IMPORTAR_BOLETO,
    requiresFile: true,
  },
  financeiro_atualizar_boleto: {
    titulo: 'Atualizar boleto recorrente',
    descricao: 'Escolher o mês e substituir o PDF',
    icon: 'refresh-cw',
    action: TORRE_WIDGET_ACTIONS.FINANCEIRO_ATUALIZAR_BOLETO,
    requiresFile: true,
  },
  logistica: {
    titulo: 'Logística',
    descricao: 'Frete fluvial e eventos de embarque',
    icon: 'anchor',
    children: ['logistica_evento'],
  },
  logistica_evento: {
    titulo: 'Viagem / frete fluvial',
    descricao: 'Anexar a evento logístico (itinerário)',
    icon: 'anchor',
    action: TORRE_WIDGET_ACTIONS.LOGISTICA_EVENTO,
    requiresFile: true,
  },
};

/** Caminhos iniciais para deep links (?destino=…) */
export const TORRE_WIDGET_DEEP_LINKS = {
  pedidos: ['pedidos'],
  pedido: ['pedidos'],
  pedido_compra: ['pedidos'],
  financeiro: ['financeiro'],
  financeiro_comprovante: ['financeiro', 'financeiro_comprovante'],
  comprovante: ['financeiro', 'financeiro_comprovante'],
  boleto: ['financeiro', 'financeiro_boleto'],
  boletos: ['financeiro', 'financeiro_boleto'],
  atualizar_boleto: ['financeiro', 'financeiro_boleto', 'financeiro_atualizar_boleto'],
  importar_pdf: ['financeiro', 'financeiro_boleto', 'financeiro_importar_boleto'],
  conta_pdf: ['financeiro', 'financeiro_boleto', 'financeiro_importar_boleto'],
  frete: ['logistica'],
  evento: ['logistica', 'logistica_evento'],
  logistica: ['logistica'],
};

/** Ao voltar de um overlay (busca, AGEFIN…), reabre o widget neste caminho. */
export const TORRE_WIDGET_RETURN_PATH = {
  vincular: ['financeiro', 'financeiro_comprovante'],
  vincular_pedido: ['pedidos'],
  vincular_evento: ['logistica'],
  importar_pdf_conta: ['financeiro', 'financeiro_boleto'],
  atualizar_boleto: ['financeiro', 'financeiro_boleto'],
  atualizar_boleto_import: ['financeiro', 'financeiro_boleto'],
};

export function resolverWidgetPath(destinoRaw) {
  if (!destinoRaw || typeof destinoRaw !== 'string') return [];
  const k = destinoRaw.trim().toLowerCase();
  return TORRE_WIDGET_DEEP_LINKS[k] ? [...TORRE_WIDGET_DEEP_LINKS[k]] : [];
}

export function obterNoWidget(nodeId) {
  return TORRE_WIDGET_NODES[nodeId] || null;
}

export function obterFilhosWidget(nodeId) {
  const no = obterNoWidget(nodeId);
  if (!no?.children?.length) return [];
  return no.children.map((id) => ({ id, ...TORRE_WIDGET_NODES[id] })).filter((n) => n.titulo);
}

export function obterNoAtualWidget(path) {
  if (!path?.length) return obterNoWidget('raiz');
  const id = path[path.length - 1];
  return obterNoWidget(id);
}

export function titulosBreadcrumb(path) {
  return (path || []).map((id) => TORRE_WIDGET_NODES[id]?.titulo || id).filter(Boolean);
}

export function widgetPathParent(path) {
  if (!path?.length) return [];
  return path.slice(0, -1);
}
