/**
 * Quarter Master — kit do soldado (páginas permitidas).
 *
 * A lista de páginas permitidas deriva do mesmo menu que o utilizador vê.
 * Rotas filhas herdam a permissão da rota-pai (ex.: PedidoCompraDetalhe → PedidosCompra).
 */
import { buildMenuItems } from '@/components/config/usePermissoesResolvidas';
import {
  podeAcessarConfiguracoes,
  usuarioLegadoSemMatrizPerfil,
} from '@/lib/perfilPermissoes';

export function extrairNomePagina(pageRef) {
  if (!pageRef) return '';
  return String(pageRef).split('?')[0].split('#')[0];
}

/** Utilitários sempre acessíveis para utilizador autenticado. */
export const PAGINAS_SEMPRE_PERMITIDAS = new Set([
  'Home',
  'Manual',
  'Notificacoes',
  'MapaFuncionalidades',
  'AnexoCompartilhado',
  'PreviewTemaClaro',
]);

/**
 * Fluxos detalhe / hub que herdam permissão da página principal no menu.
 * Se o pai está no kit, o filho também está (evita botão voltar para rota órfã).
 */
export const PAGINAS_ALIASES_PERMISSAO = {
  // Compras / supply
  PedidoCompraDetalhe: 'PedidosCompra',
  TemplatesCompra: 'PedidosCompra',
  HubLogistico: 'ItinerarioFluvial',
  Compras: 'SugestoesCompra',

  // Conferência de entrada
  ConferenciaEditor: 'ConferenciaEntrada',
  ConferenciaItens: 'ConferenciaEntrada',
  ConferenciaVolumes: 'ConferenciaEntrada',
  DiscriminarVolumes: 'ConferenciaEntrada',

  // Produtos / catálogo
  CadastroProdutoV2: 'Produtos',
  EditarProdutosEmMassa: 'Produtos',
  EdicaoMassivaCustos: 'Produtos',
  ModeloCatalogo: 'HierarquiaPortal',
  Intervenientes: 'Produtos',
  Terceiros: 'Produtos',

  // Estoque
  Estoque: 'ConferenciaEstoque',
  AuditoriaEstoqueV2: 'AuditoriaEstoque',

  // Financeiro
  FinanceiroModulo: 'FluxoCaixa',
  Financeiro: 'FluxoCaixa',
  FinanceiroAprovacoes: 'AprovacoesFinanceiras',
  AgendaFinanceira: 'FluxoCaixa',
  ExtratoConta: 'FluxoCaixa',
  LixeiraLancamentos: 'FluxoCaixa',
  ReversaoDespesasSangrias: 'FluxoCaixa',
  SimuladorCartao: 'FluxoCaixa',
  AtualizarBoletoRecorrente: 'FluxoCaixa',
  Agefin: 'SuperAgefin',
  AgefinConsulta: 'SuperAgefin',
  LancamentoAnexos: 'FluxoCaixa',
  ControleCaixasAtivos: 'CaixasAtivos',
  PlanejamentoFinanceiroV2: 'PlanejamentoFinanceiro',

  // Vendas / PDV
  Vendas: 'VendasGestao',
  DevolucaoTroca: 'VendasGestao',
  Expedicao: 'ControleEntregas',
  ReimpressaoDocumentos: 'VendasGestao',
  Campanhas: 'VendasGestao',
  DashboardVendedor: 'Dashboard',
  DashboardCaixa: 'PDVCaixa',
  PDVAuditoria: 'PDVVendedor',
  PDV: 'PDVVendedor',

  // Relatórios / ferramentas analíticas
  RelatorioMargem: 'Relatorios',
  RelatorioCatalogoVendas: 'Relatorios',
  RelatorioCatalogoEstoque: 'Relatorios',
  RelatorioPerformance: 'Relatorios',
  RelatorioConsumoInterno: 'Relatorios',
  PrecoJustoDashboard: 'Relatorios',
  OtimizacaoEstoqueIA: 'Relatorios',
  EstimativaEmbalagensIA: 'Relatorios',
  GestaoTemplates: 'Relatorios',
  DesignerDocumento: 'Relatorios',
  EditorLayoutsTres: 'Relatorios',
  LlmTelemetria: 'Relatorios',

  // Operações / logística
  Operacoes: 'Dashboard',
  Veiculos: 'ItinerarioFluvial',
  TabelasPreco: 'TabelaPrecosConsulta',

  // Administração (só entra se Configurações estiver no kit)
  AuditoriaCodigoProjeto: 'Configuracoes',
  AuditoriaPins: 'Configuracoes',
  LogsAutenticacao: 'Configuracoes',
  ExclusaoDocumentos: 'Configuracoes',
};

function flattenMenuPages(menuItems) {
  const pages = new Set();
  for (const item of menuItems || []) {
    if (item.page) pages.add(extrairNomePagina(item.page));
    for (const sub of item.submenu || []) {
      if (sub.page) pages.add(extrairNomePagina(sub.page));
    }
  }
  return pages;
}

function expandirAliases(pages) {
  const expanded = new Set(pages);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [alias, parent] of Object.entries(PAGINAS_ALIASES_PERMISSAO)) {
      if (expanded.has(parent) && !expanded.has(alias)) {
        expanded.add(alias);
        changed = true;
      }
    }
  }
  return expanded;
}

/**
 * @returns {Set<string>|null} null = kit irrestrito (admin técnico ou legado sem matriz)
 */
export function paginasPermitidasNoKit(user, perfilDeAcesso) {
  if (!user) return new Set(PAGINAS_SEMPRE_PERMITIDAS);
  if (user.role === 'admin') return null;
  if (usuarioLegadoSemMatrizPerfil(user)) return null;

  const menuItems = buildMenuItems(user, perfilDeAcesso);
  const allowed = new Set(PAGINAS_SEMPRE_PERMITIDAS);
  flattenMenuPages(menuItems).forEach((p) => allowed.add(p));

  if (podeAcessarConfiguracoes(user, perfilDeAcesso)) {
    allowed.add('Configuracoes');
  }

  return expandirAliases(allowed);
}

export function podeAcessarPagina(user, perfilDeAcesso, pageName) {
  const base = extrairNomePagina(pageName);
  if (!base || PAGINAS_SEMPRE_PERMITIDAS.has(base)) return true;

  const kit = paginasPermitidasNoKit(user, perfilDeAcesso);
  if (kit === null) return true;

  return kit.has(base);
}
