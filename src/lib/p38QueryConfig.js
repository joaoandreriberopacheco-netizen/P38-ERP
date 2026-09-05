/** Cache React Query P38 — entidades quentes partilhadas entre ecrãs */

/** Dados estáveis por 2 min; evita refetch ao voltar ao mesmo módulo */
export const P38_STALE_TIME = 2 * 60 * 1000;

/** Mantém cache em memória 10 min após último uso */
export const P38_GC_TIME = 10 * 60 * 1000;

export const p38Keys = {
  all: ['p38'],
  produtos: (sort = '-created_date') => [...p38Keys.all, 'produto', 'list', sort],
  terceiros: () => [...p38Keys.all, 'terceiro', 'list'],
  fornecedores: () => [...p38Keys.all, 'terceiro', 'fornecedores'],
  pedidosVenda: (sort = '-created_date') => [...p38Keys.all, 'pedido-venda', 'list', sort],
  pedidosVendaGestao: (dataInicio, dataFim) => [...p38Keys.all, 'pedido-venda', 'gestao', dataInicio, dataFim],
  pedidosVenda90d: () => [...p38Keys.all, 'pedido-venda', '90d'],
  dadosVendaAbcd90d: () => [...p38Keys.pedidosVenda90d(), 'abcd-itens'],
  rascunhosPedidoVenda: (sort = '-created_date') => [...p38Keys.all, 'rascunho-pedido-venda', 'list', sort],
  rascunhosPedidoVendaGestao: (dataInicio, dataFim) => [...p38Keys.all, 'rascunho-pedido-venda', 'gestao', dataInicio, dataFim],
  homeKpis: (dateKey) => [...p38Keys.all, 'home-kpis', dateKey],
  homeVendasHoje: (dateKey) => [...p38Keys.all, 'home-vendas-hoje', dateKey],
  homePedidosPendentes: () => [...p38Keys.all, 'home-pedidos-pendentes'],
  dashboardVendas: (monthKey) => [...p38Keys.all, 'dashboard', 'vendas', monthKey],
  dashboardVendasPedidosSegment: (segmentKey) => [...p38Keys.all, 'dashboard', 'vendas', 'segment', segmentKey],
  dashboardEstoque: () => [...p38Keys.all, 'dashboard', 'estoque'],
  dashboardEstoqueResumo: () => [...p38Keys.all, 'dashboard', 'estoque', 'resumo'],
  dashboardEstoqueHistorico: () => [...p38Keys.all, 'dashboard', 'estoque', 'historico'],
  dashboardConfigVenda: () => [...p38Keys.all, 'dashboard', 'config-venda'],
  dashboardEstoqueLancamentosCmv: (supplyStartISO, supplyEndISO) => [
    ...p38Keys.all,
    'dashboard',
    'estoque',
    'lancamentos-cmv',
    supplyStartISO,
    supplyEndISO,
  ],
  dashboardEstoqueMovimentosAteOntem: (ontemKey, startISO) => [
    ...p38Keys.all,
    'dashboard',
    'estoque',
    'movimentos-ate',
    ontemKey,
    startISO,
  ],
  dashboardEstoqueMovimentosHoje: (hojeKey) => [...p38Keys.all, 'dashboard', 'estoque', 'movimentos-hoje', hojeKey],
  pedidosCompraSugestao: () => [...p38Keys.all, 'pedidos-compra', 'sugestao-estoque'],
  pedidosCompraGestaoInicial: () => [...p38Keys.all, 'pedidos-compra', 'gestao-inicial'],
  produtosAtivosPdv: () => [...p38Keys.all, 'produto', 'ativos-pdv'],
  clientesPdv: () => [...p38Keys.all, 'terceiro', 'clientes-pdv'],
  intervenientes: () => [...p38Keys.all, 'intervenientes'],
  /** Lucro bruto mensal (Relatório de Margem) — partilhado entre Dízimo, Budgets e Visão Financeira */
  lucroBrutoCompetencia: (competencia) => [...p38Keys.all, 'lucro-bruto', competencia],
  logistica: {
    eventos: () => [...p38Keys.all, 'logistica', 'eventos'],
    embarques: () => [...p38Keys.all, 'logistica', 'embarques'],
    lancamentosFretes: () => [...p38Keys.all, 'logistica', 'lancamentos-fretes'],
    contasPrevistas: () => [...p38Keys.all, 'logistica', 'contas-previstas'],
    transportadorasFluvial: () => [...p38Keys.all, 'logistica', 'transportadoras-fluvial'],
    embarquesPorEvento: (eventoId) => [...p38Keys.all, 'logistica', 'embarques-evento', eventoId],
  },
};
