/**
 * Quarter Master Logic — Resolver de Permissões
 *
 * Combina PerfilDeAcesso (template) + override_permissoes (individual)
 * para retornar o objeto final de permissões de um usuário.
 *
 * FORMATO REAL (salvo por PerfilFormTela):
 *   permissoes.pdv.acesso_vendedor = true
 *   permissoes.estoque.visualizar_produtos = true
 *   permissoes.estoque.compras.sugestoes = true
 *   permissoes.estoque.compras.hub_logistico.manifestos = true
 *   permissoes.consumo_interno.acesso = true
 *   etc.
 */

import {
  resolverPermissoes,
  perfilTemEscopoTotal,
  usuarioLegadoSemMatrizPerfil,
  perfilResolvidoParaUsuario,
} from '@/lib/perfilPermissoes';
import {
  LayoutDashboard, House, Monitor, Banknote, TrendingUp, Package,
  DollarSign, BookOpen, Settings, ShoppingCart, Warehouse, Truck, ClipboardPenLine,
  Users, TrendingDown, Lightbulb, FileText, PackageSearch, Ship,
  ScanLine, ClipboardList, Tags, Upload, CheckSquare, Search, Activity,
  ArrowLeftRight, CreditCard, Clock, Wallet, ReceiptText, AlertCircle, Repeat2, CalendarClock, Target, LineChart
} from 'lucide-react';

export { resolverPermissoes };

export function temPermissao(user, perfilDeAcesso, modulo, permissao, subtipo = null) {
  if (user?.role === 'admin') return true;
  if (usuarioLegadoSemMatrizPerfil(user)) return true;
  const perfil = perfilResolvidoParaUsuario(user, perfilDeAcesso);
  if (user?.perfil_acesso_id && !perfil) return false;
  if (perfilTemEscopoTotal(perfil)) return true;
  const permissoes = resolverPermissoes(perfil, user?.override_permissoes);
  if (subtipo) {
    return permissoes?.[modulo]?.[permissao]?.[subtipo] === true;
  }
  return permissoes?.[modulo]?.[permissao] === true;
}

const MINIMAL_MENU_ITEMS = [
  {
    name: 'Início',
    icon: House,
    page: 'Home',
    permissaoCheck: () => true,
  },
];

export function buildMenuItems(user, perfilDeAcesso) {
  if (user?.role === 'admin') return ALL_MENU_ITEMS;

  const temPerfil = !!user?.perfil_acesso_id;

  if (usuarioLegadoSemMatrizPerfil(user)) return ALL_MENU_ITEMS.filter((item) => !item.adminOnly);

  const perfilEfetivo = perfilResolvidoParaUsuario(user, perfilDeAcesso);
  if (temPerfil && !perfilEfetivo) return MINIMAL_MENU_ITEMS;

  const permissoes = resolverPermissoes(perfilEfetivo, user?.override_permissoes);

  if (perfilTemEscopoTotal(perfilEfetivo)) {
    return ALL_MENU_ITEMS.filter((item) => !item.adminOnly);
  }

  const algumaPermissao = Object.values(permissoes || {}).some((mod) => {
    if (!mod || typeof mod !== 'object') return false;
    const walk = (o) =>
      Object.entries(o).some(([_k, v]) => {
        if (v === true) return true;
        if (v && typeof v === 'object' && !Array.isArray(v)) return walk(v);
        return false;
      });
    return walk(mod);
  });
  if (!algumaPermissao) return MINIMAL_MENU_ITEMS;

  return ALL_MENU_ITEMS
    .map(item => {
      if (!item.submenu) return item;
      const subsFiltrados = item.submenu.filter(sub =>
        sub.permissaoCheck ? sub.permissaoCheck(permissoes) : true
      );
      return { ...item, submenu: subsFiltrados };
    })
    .filter(item => {
      const pass = item.permissaoCheck ? item.permissaoCheck(permissoes) : true;
      if (!pass) return false;
      if (item.submenu) return item.submenu.length > 0;
      return true;
    });
}

// ─── Definição do menu alinhada com o formato real salvo pelo PerfilFormTela ──

export const ALL_MENU_ITEMS = [
  {
    name: 'Início',
    icon: House,
    page: 'Home',
    permissaoCheck: () => true
  },
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    page: 'Dashboard',
    permissaoCheck: (p) => p?.dashboard?.acesso === true
  },
  {
    name: 'PDV',
    icon: Monitor,
    permissaoCheck: (p) => p?.pdv?.acesso_vendedor || p?.pdv?.acesso_supermercado || p?.pdv?.acesso_auto_atendimento,
    submenu: [
      {
        name: 'Vendedor',
        page: 'PDVVendedor',
        icon: Users,
        permissaoCheck: (p) => p?.pdv?.acesso_vendedor
      },
      {
        name: 'Supermercado',
        page: 'PDV?mode=supermercado',
        icon: ShoppingCart,
        permissaoCheck: (p) => p?.pdv?.acesso_supermercado
      },
      {
        name: 'Auto-Atendimento',
        page: 'AutoAtendimento',
        icon: Monitor,
        permissaoCheck: (p) => p?.pdv?.acesso_auto_atendimento
      }
    ]
  },
  {
    name: 'Caixa',
    icon: Banknote,
    page: 'PDVCaixa',
    permissaoCheck: (p) => p?.pdv?.acesso_caixa || p?.financeiro?.acesso
  },
  {
    name: 'Vendas',
    icon: TrendingUp,
    permissaoCheck: (p) => p?.vendas?.acesso,
    submenu: [
      {
        name: 'Gestão de Vendas',
        page: 'VendasGestao',
        icon: ClipboardList,
        permissaoCheck: (p) => p?.vendas?.listar_pedidos === true
      },
      {
        name: 'Vendas Perdidas',
        page: 'VendasPerdidas',
        icon: TrendingDown,
        permissaoCheck: (p) => p?.vendas?.vendas_perdidas === true
      },
      {
        name: 'Controle de Entregas',
        page: 'ControleEntregas',
        icon: Truck,
        permissaoCheck: (p) => p?.vendas?.controle_entregas === true
      },
      {
        name: 'Painel Gerencial',
        page: 'PainelGerente',
        icon: Activity,
        permissaoCheck: (p) => p?.vendas?.painel_gerencial === true
      }
    ]
  },
  {
    name: 'Produtos',
    icon: Package,
    page: 'Produtos',
    permissaoCheck: (p) => p?.estoque?.visualizar_produtos === true
  },
  {
    name: 'Compras',
    icon: ShoppingCart,
    permissaoCheck: (p) =>
      p?.estoque?.compras_ativo ||
      p?.estoque?.compras?.sugestoes ||
      p?.estoque?.compras?.cotacoes ||
      p?.estoque?.compras?.pedidos ||
      p?.estoque?.compras?.conferencia ||
      p?.estoque?.compras?.logistica ||
      p?.estoque?.logistica,
    submenu: [
      {
        name: 'Sugestões de Compra',
        page: 'SugestoesCompra',
        icon: Lightbulb,
        permissaoCheck: (p) => p?.estoque?.compras?.sugestoes === true
      },
      {
        name: 'Cotações',
        page: 'Cotacoes',
        icon: FileText,
        permissaoCheck: (p) => p?.estoque?.compras?.cotacoes === true
      },
      {
        name: 'Pedidos de Compra',
        page: 'PedidosCompra',
        icon: PackageSearch,
        permissaoCheck: (p) => p?.estoque?.compras?.pedidos === true
      },

      {
        name: 'Conferência de Entrada',
        page: 'ConferenciaEntrada',
        icon: ScanLine,
        permissaoCheck: (p) => p?.estoque?.compras?.conferencia === true || p?.estoque?.logistica === true
      },
      {
        name: 'Boats',
        page: 'ItinerarioFluvial',
        icon: Ship,
        permissaoCheck: (p) => p?.estoque?.compras?.logistica === true || p?.estoque?.logistica === true
      }
    ]
  },
  {
    name: 'Estoque',
    icon: Warehouse,
    permissaoCheck: (p) =>
      p?.estoque?.conferencia_estoque ||
      p?.estoque?.auditoria_estoque ||
      p?.estoque?.armazenagem ||
      p?.estoque?.separacao_pedidos ||
      p?.estoque?.tabela_precos ||
      p?.estoque?.realizar_ajuste_estoque ||
      p?.estoque?.contagem_express,
    submenu: [
      {
        name: 'Contagem Express',
        page: 'ContagemExpress',
        icon: ClipboardList,
        permissaoCheck: (p) =>
          p?.estoque?.contagem_express === true ||
          p?.estoque?.auditoria_estoque === true
      },
      {
        name: 'Movimentos de Inventário',
        page: 'MovimentosInventario',
        icon: ArrowLeftRight,
        permissaoCheck: (p) => p?.estoque?.realizar_ajuste_estoque === true
      },
      {
        name: 'Conferência',
        page: 'ConferenciaEstoque',
        icon: CheckSquare,
        permissaoCheck: (p) => p?.estoque?.conferencia_estoque === true
      },
      {
        name: 'Auditoria',
        page: 'AuditoriaEstoque',
        icon: Search,
        permissaoCheck: (p) => p?.estoque?.auditoria_estoque === true
      },
      {
        name: 'Armazenagem',
        page: 'Armazenagem',
        icon: Warehouse,
        permissaoCheck: (p) => p?.estoque?.armazenagem === true
      },
      {
        name: 'Separação de Pedidos',
        page: 'InterfaceSeparador',
        icon: PackageSearch,
        permissaoCheck: (p) => p?.estoque?.separacao_pedidos === true
      },
      {
        name: 'Tabela de Preços',
        page: 'TabelaPrecosConsulta',
        icon: Tags,
        permissaoCheck: (p) => p?.estoque?.tabela_precos === true
      },
      {
        name: 'Importação em Massa',
        page: 'ImportacaoProdutos',
        icon: Upload,
        permissaoCheck: (p) => p?.estoque?.visualizar_produtos === true
      }
    ]
  },
  {
    name: 'Consumo Interno',
    icon: ClipboardPenLine,
    page: 'ConsumoInterno',
    permissaoCheck: (p) => p?.consumo_interno?.acesso === true
  },
  {
    name: 'Financeiro',
    icon: DollarSign,
    permissaoCheck: (p) => p?.financeiro?.acesso || p?.financeiro?.caixas_ativos,
    submenu: [
      {
        name: 'Fluxo de Caixa',
        page: 'FluxoCaixa',
        icon: ArrowLeftRight,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'Folha',
        page: 'FolhaPrevisao',
        icon: Users,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'AGEFIN',
        page: 'AgefinConsulta',
        icon: Repeat2,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'Planejamento',
        page: 'PlanejamentoFinanceiro',
        icon: CalendarClock,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'Budgets',
        page: 'Budgets',
        icon: Target,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'Visão Financeira',
        page: 'VisaoFinanceira',
        icon: LineChart,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'Contas',
        page: 'ContasFinanceiras',
        icon: Wallet,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'Aprovações',
        page: 'AprovacoesFinanceiras',
        icon: CreditCard,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      },
      {
        name: 'Caixas Ativos',
        page: 'CaixasAtivos',
        icon: ReceiptText,
        permissaoCheck: (p) => p?.financeiro?.caixas_ativos === true || p?.financeiro?.acesso === true
      },
      {
        name: 'Turnos Fechados',
        page: 'TurnosFechados',
        icon: Clock,
        permissaoCheck: (p) => p?.financeiro?.acesso === true
      }
    ]
  },
  {
    name: 'Relatórios',
    icon: BookOpen,
    page: 'Relatorios',
    permissaoCheck: (p) => p?.relatorios?.acesso === true
  },
  {
    name: 'Configurações',
    icon: Settings,
    page: 'Configuracoes',
    adminOnly: true,
    permissaoCheck: (p) => p?.configuracoes?.acesso === true
  }
];