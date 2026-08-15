#!/usr/bin/env python3
"""
Gera o PDF 'P38 Parts Catalog — UI First' (sem código).
Estrutura: Menu → Página → Funções → Tabelas de dados.
"""

from datetime import date
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUTPUT = "/workspace/docs/P38_PARTS_CATALOG_UI_FIRST.pdf"

# ─── Paleta (carta náutica / CIC) ───────────────────────────────────────────
NAVY = colors.HexColor("#0B1D3A")
DEEP = colors.HexColor("#132F52")
TEAL = colors.HexColor("#1A6B7C")
GRID = colors.HexColor("#B8D4E3")
ACCENT = colors.HexColor("#E8A838")
WHITE = colors.white
MUTED = colors.HexColor("#5A7A8C")
ZONE_COLORS = {
    "inicio": colors.HexColor("#2E5C8A"),
    "dashboard": colors.HexColor("#3D6B99"),
    "pdv": colors.HexColor("#1E7A6E"),
    "caixa": colors.HexColor("#1A6B5C"),
    "vendas": colors.HexColor("#2D7D46"),
    "produtos": colors.HexColor("#5C4D8A"),
    "compras": colors.HexColor("#8B5A2B"),
    "estoque": colors.HexColor("#6B4C2E"),
    "consumo": colors.HexColor("#7A5C3A"),
    "financeiro": colors.HexColor("#1A4A6B"),
    "relatorios": colors.HexColor("#4A5568"),
    "config": colors.HexColor("#374151"),
    "auth": colors.HexColor("#6B7280"),
    "satelite": colors.HexColor("#4B5563"),
}

# ─── Catálogo UI-first ──────────────────────────────────────────────────────
# Cada zona do menu → páginas → funções → tabelas
CATALOG = [
    {
        "id": "inicio",
        "menu": "Início",
        "icon": "🏠",
        "desc": "Porta de entrada após login. Atalhos personalizados e alertas do dia.",
        "pages": [
            {
                "nome": "Home",
                "rota": "/  ·  /Home",
                "papel": "Landing principal; quick actions para módulos frequentes",
                "funcoes": ["— (leitura de entidades via camada p38)"],
                "tabelas": ["usuario", "tarefa", "avisos_auto", "pedido_venda (alertas)"],
                "filhos": [],
            },
            {
                "nome": "Notificações / Agenda",
                "rota": "/Notificacoes",
                "papel": "Agenda e notificações (bottom nav mobile)",
                "funcoes": ["—"],
                "tabelas": ["agenda_item", "tarefa"],
                "filhos": [],
            },
        ],
    },
    {
        "id": "dashboard",
        "menu": "Dashboard",
        "icon": "📊",
        "desc": "Visão executiva — KPIs por domínio (vendas, compras, estoque, financeiro).",
        "pages": [
            {
                "nome": "Dashboard",
                "rota": "/Dashboard",
                "papel": "Painel gerencial com abas Geral · Vendas · Compras · Estoque · Financeiro",
                "funcoes": ["fechar-dashboard-kpi (cron, snapshots)"],
                "tabelas": [
                    "dashboard_kpi_diario",
                    "dashboard_kpi_mensal",
                    "pedido_venda",
                    "pedido_compra",
                    "produto",
                    "lancamento_financeiro",
                ],
                "filhos": [
                    {"nome": "Dashboard Caixa", "rota": "/DashboardCaixa", "tabelas": ["turno_caixa", "movimentos_caixa"]},
                    {"nome": "Dashboard Vendedor", "rota": "/DashboardVendedor", "tabelas": ["pedido_venda", "agenda_logistica"]},
                ],
            },
            {
                "nome": "Painel Gerente",
                "rota": "/PainelGerente",
                "papel": "Painel de vendas para gestores (menu Vendas)",
                "funcoes": ["—"],
                "tabelas": ["pedido_venda", "rascunho_pedido_venda", "terceiro"],
                "filhos": [],
            },
        ],
    },
    {
        "id": "pdv",
        "menu": "PDV",
        "icon": "🛒",
        "desc": "Ponto de venda — vendedor, supermercado e auto-atendimento.",
        "pages": [
            {
                "nome": "PDV Vendedor",
                "rota": "/PDVVendedor",
                "papel": "Venda assistida; rascunhos e orçamentos",
                "funcoes": [
                    "savePedidoVendaItem",
                    "gerarNumeroSequencial",
                    "gerenciarPin",
                ],
                "tabelas": [
                    "rascunho_pedido_venda",
                    "pedido_venda",
                    "pedido_venda_item",
                    "produto",
                    "terceiro",
                    "tabela_preco",
                    "configuracoes_venda",
                ],
                "filhos": [],
            },
            {
                "nome": "PDV Supermercado",
                "rota": "/PDV?mode=supermercado",
                "papel": "Checkout rápido estilo supermercado",
                "funcoes": ["savePedidoVendaItem", "processarVendaCaixa"],
                "tabelas": ["produto", "pedido_venda", "configuracoes_venda"],
                "filhos": [],
            },
            {
                "nome": "Auto-Atendimento",
                "rota": "/AutoAtendimento",
                "papel": "Totem self-service (fullscreen)",
                "funcoes": ["processarVendaCaixa"],
                "tabelas": ["config_auto_atendimento", "produto", "venda_perdida", "pedido_venda"],
                "filhos": [],
            },
            {
                "nome": "PDV (multi-modo)",
                "rota": "/PDV?mode=vendedor|caixa|supermercado",
                "papel": "Rota unificada legada / alternativa",
                "funcoes": ["processarVendaCaixa", "imprimirCupomTermico"],
                "tabelas": ["pedido_venda", "turno_caixa", "produto"],
                "filhos": [
                    {"nome": "PDV Auditoria", "rota": "/PDVAuditoria?conferencia_id=", "tabelas": ["conferencia_estoque", "movimentacao_estoque"]},
                    {"nome": "Simulador Cartão", "rota": "→ /PDV (sheet)", "tabelas": ["maquininha", "formas_de_pagamento"]},
                ],
            },
        ],
    },
    {
        "id": "caixa",
        "menu": "Caixa",
        "icon": "💵",
        "desc": "Operação de caixa — recebimento, sangria, fechamento de turno.",
        "pages": [
            {
                "nome": "PDV Caixa",
                "rota": "/PDVCaixa",
                "papel": "Registro de pagamentos, reforço, sangria, cupom",
                "funcoes": [
                    "processarVendaCaixa",
                    "imprimirCupomTermico",
                    "gerenciarPin",
                    "gerarNumeroSequencial",
                ],
                "tabelas": [
                    "turno_caixa",
                    "movimentos_caixa",
                    "pedido_venda",
                    "pedido_venda_item",
                    "lancamento_financeiro",
                    "contas_financeiras",
                    "formas_de_pagamento",
                    "vale_compra",
                    "devolucao_troca",
                    "ordem_separacao",
                ],
                "filhos": [
                    {"nome": "Devolução / Troca", "rota": "/DevolucaoTroca", "tabelas": ["devolucao_troca", "vale_compra", "autorizacao_estorno"]},
                ],
            },
        ],
    },
    {
        "id": "vendas",
        "menu": "Vendas",
        "icon": "📈",
        "desc": "Gestão pós-venda — pedidos, entregas, perdas e painel gerencial.",
        "pages": [
            {
                "nome": "Gestão de Vendas",
                "rota": "/VendasGestao",
                "papel": "Lista virtualizada de pedidos e orçamentos",
                "funcoes": ["savePedidoVendaItem"],
                "tabelas": ["pedido_venda", "pedido_venda_item", "rascunho_pedido_venda", "terceiro"],
                "filhos": [],
            },
            {
                "nome": "Vendas Perdidas",
                "rota": "/VendasPerdidas",
                "papel": "Registro de oportunidades perdidas",
                "funcoes": ["—"],
                "tabelas": ["venda_perdida", "produto"],
                "filhos": [],
            },
            {
                "nome": "Controle de Entregas",
                "rota": "/ControleEntregas",
                "papel": "Agenda e status de entregas",
                "funcoes": ["—"],
                "tabelas": ["agenda_logistica", "protocolo_entrega", "pedido_venda", "terceiro"],
                "filhos": [],
            },
            {
                "nome": "Clientes (Terceiros)",
                "rota": "/Terceiros",
                "papel": "Cadastro de clientes e fornecedores (atalho Home)",
                "funcoes": ["—"],
                "tabelas": ["terceiro"],
                "filhos": [
                    {"nome": "Vendas (legado)", "rota": "/Vendas", "tabelas": ["pedido_venda"]},
                    {"nome": "Campanhas", "rota": "/Campanhas", "tabelas": ["campanha"]},
                    {"nome": "Expedição", "rota": "/Expedicao", "tabelas": ["protocolo_entrega", "ordem_separacao"]},
                ],
            },
        ],
    },
    {
        "id": "produtos",
        "menu": "Produtos",
        "icon": "📦",
        "desc": "Catálogo central — preço, stock, grade de compra, relatórios embutidos.",
        "pages": [
            {
                "nome": "Produtos",
                "rota": "/Produtos",
                "papel": "Catálogo, estoque, precificação; ?relatorioVendas=1 · ?relatorioEstoque=1",
                "funcoes": [
                    "gerarRelatorioCatalogoEstoque (cliente)",
                    "gerarRelatorioCatalogoVendas (cliente)",
                    "calcularIEP",
                    "atualizarMetasEstoque",
                ],
                "tabelas": [
                    "produto",
                    "categoria_produto",
                    "tabela_preco",
                    "movimentacao_estoque",
                    "linha_compra",
                    "produto_compra",
                    "eixo_valor",
                    "area",
                ],
                "filhos": [
                    {"nome": "Edição em Massa", "rota": "/EditarProdutosEmMassa", "tabelas": ["produto"]},
                    {"nome": "Custos em Massa", "rota": "/EdicaoMassivaCustos", "tabelas": ["produto"]},
                    {"nome": "Otimização IA", "rota": "/OtimizacaoEstoqueIA", "tabelas": ["produto", "pedido_venda"]},
                    {"nome": "Embalagens IA", "rota": "/EstimativaEmbalagensIA", "tabelas": ["produto"]},
                    {"nome": "Tabelas de Preço", "rota": "/TabelasPreco", "tabelas": ["tabela_preco"]},
                    {"nome": "Portal Catálogo", "rota": "/HierarquiaPortal", "tabelas": ["portal_catalog", "linha_compra", "modelo_linha"]},
                ],
            },
        ],
    },
    {
        "id": "compras",
        "menu": "Compras",
        "icon": "🛍️",
        "desc": "Ciclo de compra — sugestão, cotação, pedido, conferência, logística fluvial.",
        "pages": [
            {
                "nome": "Sugestões de Compra",
                "rota": "/SugestoesCompra",
                "papel": "Smart Supply — reabastecimento inteligente",
                "funcoes": ["atualizarMetasEstoque"],
                "tabelas": ["produto", "pedido_compra", "pedido_venda"],
                "filhos": [],
            },
            {
                "nome": "Cotações",
                "rota": "/Cotacoes",
                "papel": "Cotação com fornecedores",
                "funcoes": ["gerarNumeroSequencial"],
                "tabelas": ["cotacao", "terceiro", "produto"],
                "filhos": [],
            },
            {
                "nome": "Pedidos de Compra",
                "rota": "/PedidosCompra",
                "papel": "Lista e gestão de POs",
                "funcoes": [
                    "savePedidoCompraItem",
                    "gerarNumeroSequencial",
                    "enviarFinanceiroLote",
                    "recalcularEstoqueProduto",
                    "recalcular-conclusao-pedido-compra",
                ],
                "tabelas": ["pedido_compra", "pedido_compra_item", "terceiro", "embarque", "lancamento_financeiro"],
                "filhos": [
                    {"nome": "Detalhe PO", "rota": "/PedidoCompraDetalhe?id=", "tabelas": ["pedido_compra", "pedido_compra_item", "embarque", "anexo_documento"]},
                    {"nome": "Templates", "rota": "/TemplatesCompra", "tabelas": ["pedido_compra"]},
                    {"nome": "Compras (hub)", "rota": "/Compras", "tabelas": ["pedido_compra", "cotacao"]},
                    {"nome": "Hub Logístico", "rota": "/HubLogistico", "tabelas": ["supermanifesto", "manifesto_entrada"]},
                ],
            },
            {
                "nome": "Conferência de Entrada",
                "rota": "/ConferenciaEntrada",
                "papel": "Recepção cega de mercadoria",
                "funcoes": [
                    "validateConferenceCode",
                    "generateConferenceCode",
                    "gerarRelatorioConferencia",
                ],
                "tabelas": ["conferencia_compra", "supermanifesto", "manifesto_entrada", "divergencia_compra"],
                "filhos": [
                    {"nome": "Conferência Itens", "rota": "/ConferenciaItens", "tabelas": ["manifesto_entrada", "lote_estoque"]},
                    {"nome": "Conferência Volumes", "rota": "/ConferenciaVolumes", "tabelas": ["supermanifesto", "manifesto_entrada"]},
                ],
            },
            {
                "nome": "Boats (Itinerário Fluvial)",
                "rota": "/ItinerarioFluvial",
                "papel": "Logística fluvial / sandbox de viagens",
                "funcoes": ["sincronizarViagensTransportadora", "gerarViagensTransportadora"],
                "tabelas": ["evento_logistico_sandbox", "transportadora", "eventos_logisticos"],
                "filhos": [
                    {"nome": "Veículos", "rota": "/Veiculos", "tabelas": ["Veiculo (Base44)"]},
                    {"nome": "Discriminar Volumes", "rota": "/DiscriminarVolumes", "tabelas": ["embarque"]},
                ],
            },
        ],
    },
    {
        "id": "estoque",
        "menu": "Estoque",
        "icon": "🏭",
        "desc": "Movimentação, contagem, conferência, armazenagem e separação.",
        "pages": [
            {
                "nome": "Contagem Express",
                "rota": "/ContagemExpress",
                "papel": "Contagem rápida com carrinho e PIN",
                "funcoes": ["gerenciarPin", "saveConferenciaItem"],
                "tabelas": ["conferencia_estoque", "produto", "movimentacao_estoque"],
                "filhos": [],
            },
            {
                "nome": "Movimentos de Inventário",
                "rota": "/MovimentosInventario",
                "papel": "Ajustes manuais de stock",
                "funcoes": ["sincronizarEstoquePorMovimentacao (trigger)"],
                "tabelas": ["movimentacao_estoque", "produto"],
                "filhos": [],
            },
            {
                "nome": "Conferência de Estoque",
                "rota": "/ConferenciaEstoque",
                "papel": "Contagens formais com ajuste",
                "funcoes": ["saveConferenciaItem"],
                "tabelas": ["conferencia_estoque", "produto"],
                "filhos": [
                    {"nome": "Editor Conferência", "rota": "/ConferenciaEditor?id=", "tabelas": ["conferencia_estoque"]},
                ],
            },
            {
                "nome": "Auditoria de Estoque",
                "rota": "/AuditoriaEstoque",
                "papel": "Busca e auditoria de divergências",
                "funcoes": ["—"],
                "tabelas": ["produto", "movimentacao_estoque", "conferencia_estoque"],
                "filhos": [],
            },
            {
                "nome": "Armazenagem",
                "rota": "/Armazenagem",
                "papel": "Localização física no depósito",
                "funcoes": ["—"],
                "tabelas": ["produto", "area"],
                "filhos": [],
            },
            {
                "nome": "Separação de Pedidos",
                "rota": "/InterfaceSeparador",
                "papel": "Fila de separação para expedição",
                "funcoes": ["—"],
                "tabelas": ["ordem_separacao", "pedido_venda", "produto"],
                "filhos": [],
            },
            {
                "nome": "Tabela de Preços (consulta)",
                "rota": "/TabelaPrecosConsulta",
                "papel": "Consulta rápida de preços",
                "funcoes": ["—"],
                "tabelas": ["tabela_preco", "produto", "dados_empresa"],
                "filhos": [],
            },
            {
                "nome": "Importação em Massa",
                "rota": "/ImportacaoProdutos",
                "papel": "Import XLS/CSV de produtos",
                "funcoes": ["importarProdutos", "importarAreas"],
                "tabelas": ["produto", "importacao_log", "categoria_produto", "area"],
                "filhos": [
                    {"nome": "Estoque (hub)", "rota": "/Estoque", "tabelas": ["produto"]},
                    {"nome": "Operações", "rota": "/Operacoes", "tabelas": ["—"]},
                ],
            },
        ],
    },
    {
        "id": "consumo",
        "menu": "Consumo Interno",
        "icon": "🍽️",
        "desc": "Baixa de produtos para uso interno (refeitório, manutenção, etc.).",
        "pages": [
            {
                "nome": "Consumo Interno",
                "rota": "/ConsumoInterno",
                "papel": "Registro de consumo com aprovação",
                "funcoes": ["gerarNumeroSequencial"],
                "tabelas": [
                    "consumo_interno",
                    "destinacao_consumo_interno",
                    "responsavel_consumo_interno",
                    "produto",
                    "movimentacao_estoque",
                    "turno_caixa",
                ],
                "filhos": [
                    {"nome": "Relatório Consumo", "rota": "/RelatorioConsumoInterno", "tabelas": ["consumo_interno"]},
                ],
            },
        ],
    },
    {
        "id": "financeiro",
        "menu": "Financeiro",
        "icon": "💰",
        "desc": "Fluxo de caixa, contas, AGEFIN, planejamento, aprovações e turnos.",
        "pages": [
            {
                "nome": "Fluxo de Caixa",
                "rota": "/FluxoCaixa",
                "papel": "Execução orçamentária e extrato (?aba=agefin)",
                "funcoes": ["gerarExtratoFluxoCaixa"],
                "tabelas": ["lancamento_financeiro", "contas_financeiras", "budget_competencia", "categoria_financeira"],
                "filhos": [],
            },
            {
                "nome": "Folha (Previsão)",
                "rota": "/FolhaPrevisao",
                "papel": "Previsão de folha de pagamento",
                "funcoes": ["—"],
                "tabelas": ["folha_previsao_modelo", "folha_previsao_competencia", "folha_centro_custo"],
                "filhos": [],
            },
            {
                "nome": "AGEFIN (SuperAgefin)",
                "rota": "/SuperAgefin",
                "papel": "Contas recorrentes e previstas",
                "funcoes": [
                    "gerarContasPrevistasRecorrentes (cron)",
                    "sincronizarContaPrevia (trigger)",
                    "cancelarLancamentoFinanceiro",
                    "uploadAnexoDrive",
                ],
                "tabelas": [
                    "conta_recorrente",
                    "conta_prevista",
                    "lancamento_financeiro",
                    "categoria_financeira",
                    "terceiro",
                    "anexo_documento",
                    "agefin_serie_modelo",
                    "agefin_serie_competencia",
                ],
                "filhos": [
                    {"nome": "Extrato Conta", "rota": "/ExtratoConta?id=", "tabelas": ["contas_financeiras", "lancamento_financeiro", "movimentos_caixa"]},
                    {"nome": "Anexos Lançamento", "rota": "/LancamentoAnexos?id=", "tabelas": ["anexo_documento", "lancamento_financeiro"]},
                    {"nome": "Atualizar Boleto", "rota": "/AtualizarBoletoRecorrente", "tabelas": ["conta_recorrente"]},
                    {"nome": "Reversão Sangrias", "rota": "/ReversaoDespesasSangrias", "tabelas": ["movimentos_caixa", "lancamento_financeiro"]},
                ],
            },
            {
                "nome": "Planejamento Financeiro",
                "rota": "/PlanejamentoFinanceiro",
                "papel": "Planejamento v2 — metas e cenários",
                "funcoes": ["gerarRelatorioVisaoFinanceira (cliente)"],
                "tabelas": ["budget_modelo", "budget_competencia", "lancamento_financeiro"],
                "filhos": [],
            },
            {
                "nome": "Budgets",
                "rota": "/Budgets",
                "papel": "Orçamentos e metas por competência",
                "funcoes": ["gerarRelatorioBudgets (cliente)"],
                "tabelas": ["budget_modelo", "budget_competencia"],
                "filhos": [],
            },
            {
                "nome": "Visão Financeira",
                "rota": "/VisaoFinanceira",
                "papel": "Analytics consolidado de despesas previstas",
                "funcoes": ["gerarRelatorioVisaoFinanceira (cliente)"],
                "tabelas": ["conta_prevista", "lancamento_financeiro", "categoria_financeira"],
                "filhos": [],
            },
            {
                "nome": "Contas Financeiras",
                "rota": "/ContasFinanceiras",
                "papel": "Cadastro de contas bancárias e caixas",
                "funcoes": ["auditarSaldosContas"],
                "tabelas": ["contas_financeiras", "formas_de_pagamento"],
                "filhos": [],
            },
            {
                "nome": "Aprovações Financeiras",
                "rota": "/AprovacoesFinanceiras",
                "papel": "Aprovar pagamentos de POs e lançamentos",
                "funcoes": ["automacaoAprovacaoFinanceira (trigger)", "repararLancamentosPedidosAprovados"],
                "tabelas": ["pedido_compra", "lancamento_financeiro"],
                "filhos": [],
            },
            {
                "nome": "Caixas Ativos",
                "rota": "/CaixasAtivos",
                "papel": "Monitoramento de caixas PDV abertos",
                "funcoes": ["—"],
                "tabelas": ["turno_caixa", "contas_financeiras", "consumo_interno"],
                "filhos": [],
            },
            {
                "nome": "Turnos Fechados",
                "rota": "/TurnosFechados",
                "papel": "Histórico de fechamentos de turno",
                "funcoes": ["—"],
                "tabelas": ["turno_caixa", "movimentos_caixa", "pedido_venda"],
                "filhos": [],
            },
        ],
    },
    {
        "id": "relatorios",
        "menu": "Relatórios",
        "icon": "📋",
        "desc": "Hub de relatórios gerenciais — vendas, compras, estoque, margem.",
        "pages": [
            {
                "nome": "Relatórios",
                "rota": "/Relatorios",
                "papel": "Central com abas Gerencial · Vendas · Compras · Estoque",
                "funcoes": [
                    "gerarRelatorioPedidosCompra",
                    "gerarRelatorioConsolidadoCompra",
                    "gerarRelatorioContasAbertas",
                ],
                "tabelas": ["pedido_venda", "pedido_compra", "produto", "lancamento_financeiro"],
                "filhos": [
                    {"nome": "Margem", "rota": "/RelatorioMargem", "tabelas": ["pedido_venda", "produto", "movimentacao_estoque"]},
                    {"nome": "Performance", "rota": "/RelatorioPerformance", "tabelas": ["pedido_venda"]},
                    {"nome": "Preço Justo", "rota": "/PrecoJustoDashboard", "tabelas": ["produto", "pedido_venda"]},
                ],
            },
        ],
    },
    {
        "id": "config",
        "menu": "Configurações",
        "icon": "⚙️",
        "desc": "Parametrização — vendas, operações, financeiro, ferramentas admin.",
        "pages": [
            {
                "nome": "Configurações",
                "rota": "/Configuracoes",
                "papel": "Hub com abas Vendas · Operações · Financeiro · Parâmetros · Ferramentas",
                "funcoes": [
                    "gerenciarPin",
                    "p38-auth",
                    "zerarEntidade",
                    "calcularIEP",
                    "atualizarMetasEstoque",
                    "limparAbcdJobProdutos",
                ],
                "tabelas": [
                    "usuario",
                    "perfil_de_acesso",
                    "dados_empresa",
                    "configuracoes_venda",
                    "configuracoes_estoque",
                    "formas_de_pagamento",
                    "politicas_desconto",
                    "comprovante_template",
                    "layout_template",
                ],
                "filhos": [
                    {"nome": "Reimpressão Docs", "rota": "/ReimpressaoDocumentos", "tabelas": ["pedido_venda", "comprovante_template"]},
                    {"nome": "Exclusão Docs", "rota": "/ExclusaoDocumentos", "tabelas": ["pedido_venda", "pedido_compra", "lancamento_financeiro"]},
                    {"nome": "Telemetria LLM", "rota": "/LlmTelemetria", "tabelas": ["p38_llm_telemetry"]},
                    {"nome": "Intervenientes", "rota": "/Intervenientes", "tabelas": ["interveniente"]},
                ],
            },
        ],
    },
    {
        "id": "auth",
        "menu": "Autenticação (fora do menu)",
        "icon": "🔐",
        "desc": "Rotas públicas — sem shell lateral.",
        "pages": [
            {
                "nome": "Login",
                "rota": "/login",
                "papel": "Entrada no sistema",
                "funcoes": ["p38-auth", "gerenciarPin"],
                "tabelas": ["usuario", "perfil_de_acesso"],
                "filhos": [
                    {"nome": "Auth Callback", "rota": "/auth/callback", "tabelas": ["usuario"]},
                    {"nome": "Ativar Acesso", "rota": "/ativar-acesso", "tabelas": ["usuario"]},
                ],
            },
        ],
    },
    {
        "id": "satelite",
        "menu": "Satélites / PWA",
        "icon": "📡",
        "desc": "Fluxos auxiliares acessados por atalho, share-target ou deep link.",
        "pages": [
            {
                "nome": "Anexo Compartilhado",
                "rota": "/AnexoCompartilhado",
                "papel": "PWA iOS — anexar PDF/boleto a lançamento ou PO",
                "funcoes": ["uploadAnexoDrive", "listarAnexos"],
                "tabelas": ["anexo_documento", "lancamento_financeiro", "pedido_compra", "conta_prevista"],
                "filhos": [],
            },
        ],
    },
]

# ─── Legenda de símbolos (metáfora carta náutica) ───────────────────────────
LEGEND = [
    ("Zona do menu", "Sector colorido — equivalente a uma área da carta náutica"),
    ("Página / rota", "Ponto de ancoragem — o que o utilizador abre"),
    ("Função backend", "Bóia de dados — processamento server-side (Base44 / Supabase Edge)"),
    ("Tabela", "Profundidade / camada — onde os dados ficam persistidos (Postgres/Supabase)"),
    ("Filho / satélite", "Derivação — sub-rota ou fluxo acessado a partir da página pai"),
    ("→ redirect", "Corrente — rota legada que redireciona para destino canónico"),
]

# ─── Estilos ──────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", fontSize=26, leading=32, textColor=WHITE, alignment=TA_CENTER, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="CoverSub", fontSize=13, leading=18, textColor=GRID, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="SectionTitle", fontSize=16, leading=20, textColor=WHITE, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="SectionDesc", fontSize=9, leading=12, textColor=WHITE))
styles.add(ParagraphStyle(name="PageName", fontSize=11, leading=14, textColor=NAVY, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="Meta", fontSize=8, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="Body", fontSize=9, leading=12, textColor=NAVY))
styles.add(ParagraphStyle(name="LegendHead", fontSize=12, leading=16, textColor=NAVY, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle(name="SmallWhite", fontSize=8, leading=10, textColor=GRID))


def draw_cover(canvas, doc):
    canvas.saveState()
    w, h = landscape(A4)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    # grid lines
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.3)
    for x in range(0, int(w), 40):
        canvas.line(x, 0, x, h)
    for y in range(0, int(h), 40):
        canvas.line(0, y, w, y)
    canvas.restoreState()


def draw_zone_header(canvas, doc, zone_color, menu_name):
    canvas.saveState()
    w, _ = landscape(A4)
    canvas.setFillColor(zone_color)
    canvas.rect(0, landscape(A4)[1] - 1.6 * cm, w, 1.6 * cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(1.5 * cm, landscape(A4)[1] - 1.1 * cm, menu_name)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 1.5 * cm, landscape(A4)[1] - 1.1 * cm, f"P38 Parts Catalog · {date.today().isoformat()}")
    canvas.restoreState()


def on_page(canvas, doc):
    canvas.saveState()
    w, h = landscape(A4)
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.2)
    for x in range(0, int(w), 20):
        canvas.line(x, 0, x, h)
    for y in range(0, int(h), 20):
        canvas.line(0, y, w, y)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(w / 2, 0.5 * cm, f"Página {doc.page}")
    canvas.restoreState()


def bullet_list(items, style=styles["Body"]):
    return [Paragraph(f"• {item}", style) for item in items]


def make_page_card(page, zone_id):
    rows = []
    rows.append([Paragraph(f"<b>{page['nome']}</b>", styles["PageName"])])
    rows.append([Paragraph(f"<font color='#1A6B7C'><b>ROTA</b></font>  {page['rota']}", styles["Meta"])])
    rows.append([Paragraph(page["papel"], styles["Body"])])

    fn = page.get("funcoes", [])
    if fn:
        rows.append([Paragraph("<b>Funções (bóias)</b>", styles["Meta"])])
        rows.append([Paragraph(" · ".join(fn), styles["Body"])])

    tbl = page.get("tabelas", [])
    if tbl:
        rows.append([Paragraph("<b>Tabelas (profundidade)</b>", styles["Meta"])])
        rows.append([Paragraph(" · ".join(tbl), styles["Body"])])

    filhos = page.get("filhos", [])
    if filhos:
        child_lines = []
        for c in filhos:
            t = c.get("tabelas", [])
            t_str = f" → [{', '.join(t)}]" if t else ""
            child_lines.append(f"↳ {c['nome']} ({c['rota']}){t_str}")
        rows.append([Paragraph("<b>Satélites / filhos</b>", styles["Meta"])])
        rows.append([Paragraph("<br/>".join(child_lines), styles["Body"])])

    t = Table(rows, colWidths=[24 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F0F7FB")),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, GRID),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, 0), (-1, 0), 2, ZONE_COLORS.get(zone_id, TEAL)),
            ]
        )
    )
    return t


def build_pdf():
    w, h = landscape(A4)
    doc = BaseDocTemplate(
        OUTPUT,
        pagesize=landscape(A4),
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=2 * cm,
        bottomMargin=1.2 * cm,
    )

    cover_frame = Frame(2 * cm, 2 * cm, w - 4 * cm, h - 4 * cm, id="cover")
    body_frame = Frame(1.2 * cm, 1.2 * cm, w - 2.4 * cm, h - 2.8 * cm, id="body")

    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover),
            PageTemplate(id="body", frames=[body_frame], onPage=on_page),
        ]
    )

    story = []

    # ── Capa ──
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("P38 ERP", styles["CoverTitle"]))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Parts Catalog — UI First", styles["CoverTitle"]))
    story.append(Spacer(1, 1 * cm))
    story.append(
        Paragraph(
            "Carta arquitetural: menu → páginas → funções → tabelas<br/>"
            "Metáfora: carta náutica + bóias de dados (como NOAA tsunami buoys)",
            styles["CoverSub"],
        )
    )
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph(f"Gerado em {date.today().strftime('%d/%m/%Y')} · sem código · comunicação agente↔humano", styles["CoverSub"]))
    story.append(Paragraph("Repositório P38-ERP (VarejoSync) · Base de dados Supabase/Postgres", styles["CoverSub"]))

    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    # ── Legenda ──
    story.append(Paragraph("Legenda da carta", styles["LegendHead"]))
    story.append(Spacer(1, 0.3 * cm))
    legend_data = [[Paragraph(f"<b>{sym}</b>", styles["Body"]), Paragraph(desc, styles["Body"])] for sym, desc in LEGEND]
    lt = Table(legend_data, colWidths=[4 * cm, 20 * cm])
    lt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FBFD")),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(lt)
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Como ler este documento", styles["LegendHead"]))
    story.append(
        Paragraph(
            "A estrutura é <b>UI first</b>: começa pelo que o utilizador vê no menu lateral/mobile. "
            "Cada zona desce em camadas — página (ponto de ancoragem), funções backend (bóias que processam), "
            "tabelas (profundidade onde os dados repousam). Use este mapa ao pedir alterações a agentes Cursor: "
            "indique a <b>zona do menu</b>, a <b>rota</b> e as <b>tabelas</b> envolvidas.",
            styles["Body"],
        )
    )
    story.append(PageBreak())

    # ── Índice de zonas ──
    story.append(Paragraph("Índice de zonas (menu)", styles["LegendHead"]))
    story.append(Spacer(1, 0.3 * cm))
    idx_rows = [["#", "Zona", "Páginas principais", "Tabelas âncora"]]
    anchor_tables = {
        "inicio": "usuario, tarefa",
        "dashboard": "dashboard_kpi_*",
        "pdv": "pedido_venda, produto",
        "caixa": "turno_caixa, movimentos_caixa",
        "vendas": "pedido_venda, terceiro",
        "produtos": "produto, tabela_preco",
        "compras": "pedido_compra, embarque",
        "estoque": "movimentacao_estoque, produto",
        "consumo": "consumo_interno",
        "financeiro": "lancamento_financeiro, contas_financeiras",
        "relatorios": "pedido_venda, pedido_compra",
        "config": "usuario, perfil_de_acesso",
        "auth": "usuario",
        "satelite": "anexo_documento",
    }
    for i, zone in enumerate(CATALOG, 1):
        pages_str = ", ".join(p["nome"] for p in zone["pages"][:4])
        if len(zone["pages"]) > 4:
            pages_str += f" (+{len(zone['pages']) - 4})"
        idx_rows.append([str(i), f"{zone['icon']} {zone['menu']}", pages_str, anchor_tables.get(zone["id"], "—")])

    idx_table = Table(idx_rows, colWidths=[1 * cm, 4.5 * cm, 11 * cm, 7.5 * cm])
    idx_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, GRID),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F9FC")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(idx_table)
    story.append(PageBreak())

    # ── Zonas detalhadas ──
    for zone in CATALOG:
        zc = ZONE_COLORS.get(zone["id"], TEAL)

        # Header band via table trick
        header = Table(
            [[Paragraph(f"{zone['icon']}  {zone['menu']}", styles["SectionTitle"])]],
            colWidths=[24 * cm],
        )
        header.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), zc),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        story.append(header)
        story.append(Paragraph(zone["desc"], styles["Body"]))
        story.append(Spacer(1, 0.4 * cm))

        for page in zone["pages"]:
            story.append(make_page_card(page, zone["id"]))
            story.append(Spacer(1, 0.35 * cm))

        story.append(PageBreak())

    # ── Mapa de relacionamentos (hub tables) ──
    story.append(Paragraph("Tabelas-hub (correntes entre zonas)", styles["LegendHead"]))
    story.append(Spacer(1, 0.3 * cm))
    hubs = [
        ("terceiro", "Clientes e fornecedores", "Vendas · Compras · Financeiro · PDV"),
        ("produto", "Catálogo e stock", "Produtos · PDV · Estoque · Compras"),
        ("pedido_venda", "Vendas e PDV", "PDV · Vendas · Expedição · Financeiro"),
        ("pedido_compra", "Compras", "Compras · Logística · Financeiro · Estoque"),
        ("lancamento_financeiro", "Movimentação financeira", "Financeiro · Caixa · Compras"),
        ("turno_caixa", "Sessão de caixa", "Caixa · PDV · Consumo interno"),
        ("movimentacao_estoque", "Histórico de stock", "Estoque · PDV · Compras"),
        ("usuario / perfil_de_acesso", "Quem acede a quê", "Todas as zonas (permissões)"),
    ]
    hub_rows = [["Tabela-hub", "Papel", "Zonas que a tocam"]]
    hub_rows.extend(hubs)
    hub_t = Table(hub_rows, colWidths=[5 * cm, 7 * cm, 12 * cm])
    hub_t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), DEEP),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, GRID),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F9FC")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(hub_t)
    story.append(Spacer(1, 0.6 * cm))

    story.append(Paragraph("Como pedir ao agente Cursor", styles["LegendHead"]))
    story.append(
        Paragraph(
            "<b>Modelo de pedido:</b> «Na zona <i>Compras → Pedidos de Compra</i> (/PedidosCompra), "
            "quando aprovo um PO, o lançamento em <i>lancamento_financeiro</i> não aparece em "
            "<i>Financeiro → Aprovações</i>.» — O agente localiza página, função (automacaoAprovacaoFinanceira) "
            "e tabelas sem ambiguidade.",
            styles["Body"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "<b>Evitar:</b> pedidos só por nome de tabela ou só por ficheiro de código. "
            "<b>Preferir:</b> menu → rota → comportamento esperado → tabelas suspeitas.",
            styles["Body"],
        )
    )

    doc.build(story)
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
