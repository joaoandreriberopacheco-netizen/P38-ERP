import {
  Monitor, Banknote, TrendingUp, Package, DollarSign, ShoppingCart,
  Ship, LayoutDashboard, Users, QrCode, Tag, Settings, Upload, MonitorCheck,
  Tablet, ClipboardPenLine, ReceiptText, Percent, BarChart3, CalendarClock,
} from 'lucide-react';

/**
 * permissaoCheck(permissoes) → boolean
 * Controla se este atalho aparece na lista de opções do "Personalizar"
 * para o usuário em questão.
 * Admins sempre veem tudo (tratado em Home.jsx antes de filtrar).
 * `deprecated: true` — não aparece na home nem no seletor (funcionalidade descontinuada).
 */
export const ALL_QUICK_ACTIONS = [
  {
    id: 'pdv',
    icon: Monitor,
    label: 'PDV',
    page: 'PDVVendedor',
    permissaoCheck: (p) => p?.pdv?.acesso_vendedor || p?.pdv?.acesso_supermercado,
  },
  {
    id: 'caixa',
    icon: Banknote,
    label: 'Caixa',
    page: 'PDVCaixa',
    permissaoCheck: (p) => p?.pdv?.acesso_caixa || p?.financeiro?.acesso,
  },
  {
    id: 'vendas',
    icon: TrendingUp,
    label: 'Vendas',
    page: 'VendasGestao',
    permissaoCheck: (p) => p?.vendas?.acesso,
  },
  {
    id: 'produtos',
    icon: Package,
    label: 'Produtos',
    page: 'Produtos',
    permissaoCheck: (p) => p?.estoque?.visualizar_produtos,
  },
  {
    id: 'financeiro',
    icon: DollarSign,
    label: 'Financeiro',
    page: 'FluxoCaixa',
    permissaoCheck: (p) => p?.financeiro?.acesso,
  },
  {
    id: 'compras',
    icon: ShoppingCart,
    label: 'Ped. Compra',
    page: 'PedidosCompra',
    permissaoCheck: (p) => p?.estoque?.compras?.pedidos || p?.estoque?.compras?.sugestoes || p?.estoque?.compras?.cotacoes,
  },
  {
    id: 'logistica',
    icon: Ship,
    label: 'Boats',
    page: 'ItinerarioFluvial',
    permissaoCheck: (p) =>
      p?.estoque?.compras?.pedidos === true ||
      p?.estoque?.compras?.conferencia === true ||
      p?.estoque?.compras?.sugestoes === true,
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    page: 'Dashboard',
    permissaoCheck: (p) => p?.dashboard?.acesso,
  },
  {
    id: 'tabelaprecos',
    icon: Tag,
    label: 'Tabela Preços',
    page: 'TabelaPrecosConsulta',
    permissaoCheck: (p) => p?.estoque?.tabela_precos || p?.estoque?.visualizar_produtos,
  },

  {
    id: 'conferencia',
    icon: QrCode,
    label: 'Conferência',
    page: 'ConferenciaEntrada',
    permissaoCheck: (p) => p?.estoque?.compras?.conferencia === true,
  },
  {
    id: 'relatorios',
    icon: BarChart3,
    label: 'Relatórios',
    page: 'Relatorios',
    permissaoCheck: (p) => p?.relatorios?.acesso,
  },
  {
    id: 'relatorio_margem',
    icon: Percent,
    label: 'Margem',
    page: 'RelatorioMargem',
    permissaoCheck: (p) =>
      p?.relatorios?.relatorio_margem === true || p?.relatorios?.acesso === true,
  },
  {
    id: 'terceiros',
    icon: Users,
    label: 'Clientes',
    page: 'Terceiros',
    permissaoCheck: (p) => p?.vendas?.acesso,
  },
  {
    id: 'importacao',
    icon: Upload,
    label: 'Importação',
    page: 'ImportacaoProdutos',
    permissaoCheck: (p) => p?.estoque?.visualizar_produtos,
  },
  {
    id: 'caixas_ativos',
    icon: MonitorCheck,
    label: 'Caixas Ativos',
    page: 'CaixasAtivos',
    permissaoCheck: (p) => p?.pdv?.acesso_caixa || p?.financeiro?.caixas_ativos || p?.financeiro?.acesso,
  },
  {
    id: 'agefin_consulta',
    icon: ReceiptText,
    label: 'AGEFIN',
    page: 'SuperAgefin',
    permissaoCheck: (p) => p?.financeiro?.acesso || p?.dashboard?.acesso,
  },
  {
    id: 'planejamento_financeiro',
    icon: CalendarClock,
    label: 'Planejamento',
    page: 'PlanejamentoFinanceiro',
    permissaoCheck: (p) => p?.financeiro?.acesso,
  },
  {
    id: 'consumo_interno',
    icon: ClipboardPenLine,
    label: 'Consumo',
    page: 'ConsumoInterno',
    permissaoCheck: (p) => p?.homepage?.acoes_rapidas || p?.estoque?.visualizar_produtos || p?.financeiro?.caixas_ativos,
  },

  {
    id: 'autoatendimento',
    icon: Tablet,
    label: 'Autoatendimento',
    page: 'AutoAtendimento',
    permissaoCheck: (p) => p?.pdv?.acesso_auto_atendimento,
  },
  {
    id: 'configuracoes',
    icon: Settings,
    label: 'Configurações',
    page: 'Configuracoes',
    permissaoCheck: (p) => p?.configuracoes?.acesso,
  },
];

export const DEFAULT_QUICK_ACTIONS = ['pdv', 'vendas', 'logistica', 'compras', 'financeiro', 'caixas_ativos', 'agefin_consulta'];

/** Atalhos ativos (exclui descontinuados). */
export function quickActionsAtivos() {
  return ALL_QUICK_ACTIONS.filter((a) => !a.deprecated);
}

/**
 * Remove ids desconhecidos e troca o atalho legado `estoque` (página descontinuada) por `logistica` (Boats).
 */
export function normalizeQuickActionIds(ids) {
  if (!Array.isArray(ids)) return [];
  const valid = new Set(quickActionsAtivos().map((a) => a.id));
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    const next = id === 'estoque' ? 'logistica' : id;
    if (!valid.has(next) || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out.slice(0, 9);
}