#!/usr/bin/env python3
"""
P38 Parts Catalog — Manual arquitetural UI First
Gera docs/P38_PARTS_CATALOG_UI_FIRST.pdf

Formato manual: cada peça descreve papel, caminho, conexões, filhas, lógica e dados.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

OUTPUT = "/workspace/docs/P38_PARTS_CATALOG_UI_FIRST.pdf"

INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
RULE = colors.HexColor("#D1D5DB")
ZONE = colors.HexColor("#1E40AF")
LINK = colors.HexColor("#0369A1")
FN = colors.HexColor("#7C3AED")
DB = colors.HexColor("#0F766E")
ASYNC = colors.HexColor("#B45309")
BIZ = colors.HexColor("#B91C1C")

INDENT = [0, 8, 18, 28, 38]


def S(name: str, **kw) -> ParagraphStyle:
    defaults = dict(fontName="Helvetica", fontSize=8.5, leading=11, textColor=INK, alignment=TA_LEFT)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)


STYLES = {
    "cover_title": S("cover_title", fontName="Helvetica-Bold", fontSize=22, leading=28, textColor=INK),
    "cover_sub": S("cover_sub", fontSize=10, leading=14, textColor=MUTED),
    "zone": S("zone", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=ZONE, spaceBefore=6, spaceAfter=4),
    "zone_intro": S("zone_intro", fontSize=9, leading=12, textColor=MUTED, spaceAfter=8),
    "piece_title": S("piece_title", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK, spaceBefore=10, spaceAfter=3),
    "piece_route": S("piece_route", fontSize=8, leading=10, textColor=MUTED, spaceAfter=6),
    "section_lbl": S("section_lbl", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=INK, spaceBefore=5, spaceAfter=2),
    "body": S("body", fontSize=8.5, leading=11.5, textColor=INK, leftIndent=INDENT[1] * mm),
    "child": S("child", fontSize=8, leading=10.5, textColor=INK, leftIndent=INDENT[2] * mm),
    "link": S("link", fontSize=8, leading=10.5, textColor=LINK, leftIndent=INDENT[1] * mm),
    "fn": S("fn", fontSize=8, leading=10.5, textColor=FN, leftIndent=INDENT[2] * mm),
    "db": S("db", fontSize=8, leading=10.5, textColor=DB, leftIndent=INDENT[2] * mm),
    "biz": S("biz", fontSize=8, leading=10.5, textColor=BIZ, leftIndent=INDENT[2] * mm),
    "async": S("async", fontSize=8, leading=10.5, textColor=ASYNC, leftIndent=INDENT[2] * mm),
    "meta": S("meta", fontSize=8, leading=10.5, textColor=MUTED),
}

# ── Catálogo manual (peça a peça) ─────────────────────────────────────────────
CATALOG: list[dict[str, Any]] = [
    {
        "menu": "Início",
        "intro": (
            "Porta de entrada após login. Não processa vendas nem stock — agrega atalhos, "
            "alertas e tarefas do dia. É o hub de navegação rápida para quem acumula papéis."
        ),
        "pages": [
            {
                "nome": "Home",
                "rota": "/  ·  /Home",
                "feature": "pages/Home.jsx",
                "papel": "Landing personalizada: quick actions filtradas por permissão do perfil; cards de alerta (pedidos pendentes, tarefas).",
                "caminho": [
                    "Login → Home (mainPage em pages.config.js)",
                    "Utilizador toca atalho → navigate('/RotaDestino')",
                    "Alertas leem entidades em tempo real (React Query) sem gravar dados",
                ],
                "vem_de": ["Auth/login", "perfil_de_acesso (define atalhos visíveis)"],
                "envia_para": ["Qualquer módulo do menu", "Notificacoes (bottom nav mobile)"],
                "filhas": [
                    {"nome": "quickActions.jsx", "papel": "Lista de atalhos configuráveis (PDV, Compras, FluxoCaixa…)"},
                    {"nome": "Central de Ações / tarefa", "papel": "Tarefas com referencia_tipo/id polimórfica"},
                ],
                "regras": ["admin vê tudo; perfil sem permissões → menu mínimo (só Home)"],
                "funcoes": [],
                "tabelas": [{"nome": "usuario / tarefa / avisos_auto", "fks": ["tarefa.referencia_id → polimórfico"]}],
            },
            {
                "nome": "Notificações / Agenda",
                "rota": "/Notificacoes",
                "feature": "pages/Notificacoes.jsx",
                "papel": "Agenda operacional e lembretes; ícone 'Agenda' na bottom nav mobile.",
                "caminho": ["Bottom nav → Notificacoes", "Itens de agenda_item com status e responsável"],
                "vem_de": ["agendaService", "módulos que criam tarefas"],
                "envia_para": ["Páginas referenciadas em tarefa.referencia_tipo"],
                "filhas": [{"nome": "agendaService.js", "papel": "CRUD AgendaItem + AgendaLogistica"}],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "agenda_item", "fks": ["responsavel_id → usuario.id (lógico)"]}],
            },
        ],
    },
    {
        "menu": "Dashboard",
        "intro": (
            "Visão executiva por domínio. Lê snapshots KPI e entidades ao vivo — "
            "não é ponto de entrada operacional (venda/compra faz-se nos módulos)."
        ),
        "pages": [
            {
                "nome": "Dashboard",
                "rota": "/Dashboard",
                "feature": "paiol/pages/Dashboard",
                "papel": "Painel com abas Geral · Vendas · Compras · Estoque · Financeiro; gráficos e KPIs.",
                "caminho": [
                    "Menu Dashboard → carrega KPIs do dia/mês",
                    "Aba escolhida filtra domínio (vendas, compras…)",
                    "Drill-down navega para módulo fonte (ex.: Produtos, PedidosCompra)",
                ],
                "vem_de": ["dashboard_kpi_diario/mensal (snapshots)", "pedido_venda, pedido_compra, produto, lancamento_financeiro"],
                "envia_para": ["Módulos operacionais via links contextuais"],
                "filhas": [
                    {"nome": "Dashboard tabs (Geral/Vendas/…)", "papel": "Cada aba agrega queries por domínio"},
                    {"nome": "dashboardKpiSnapshotApi.js", "papel": "Leitura RPC snapshots Supabase"},
                ],
                "regras": ["KPIs fechados por cron fechar-dashboard-kpi (ontem)"],
                "funcoes": [{"nome": "fechar-dashboard-kpi", "async": True, "nota": "Cron: materializa KPI do dia anterior"}],
                "async_bg": ["job_fechar_dashboard_kpi_ontem via pg_cron"],
                "tabelas": [{"nome": "dashboard_kpi_diario / dashboard_kpi_mensal", "fks": []}],
            },
            {
                "nome": "Painel Gerente",
                "rota": "/PainelGerente",
                "feature": "pages/PainelGerente.jsx",
                "papel": "Visão de vendas para gestor: ranking, metas, pedidos do período.",
                "caminho": ["Menu Vendas → Painel Gerente", "Filtro período → lista pedido_venda"],
                "vem_de": ["pedido_venda", "rascunho_pedido_venda", "usuario (vendedor)"],
                "envia_para": ["VendasGestao (detalhe pedido)", "PDVVendedor (novo pedido)"],
                "filhas": [{"nome": "Tabela virtualizada + p38-mobile-line", "papel": "Lista responsiva mobile/desktop"}],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "pedido_venda", "fks": ["cliente_id → terceiro.id (FK)"]}],
            },
        ],
    },
    {
        "menu": "PDV",
        "intro": (
            "Ponto de venda — onde nasce o rascunho. Três portas (vendedor, supermercado, totem) "
            "convergem no mesmo funil: rascunho → caixa → pedido_venda."
        ),
        "pages": [
            {
                "nome": "PDVVendedor",
                "rota": "/PDVVendedor",
                "feature": "components/vendas/PDVVendedor.jsx",
                "papel": "Venda assistida: monta carrinho, identifica cliente, gera orçamento ou envia ao caixa.",
                "caminho": [
                    "1. Operador abre turno (opcional no vendedor) e escaneia/busca produto",
                    "2. ProductUnitSelectorDialog resolve unidade comercial → quantidade_base",
                    "3. savePedidoVendaItem grava linhas em rascunho_pedido_venda",
                    "4. 'Enviar ao caixa' → status rascunho aguarda PDVCaixa",
                    "5. Caixa chama processarVendaCaixa → pedido_venda definitivo",
                ],
                "vem_de": ["Produtos (catálogo, preço, estoque)", "Terceiros (cliente)", "tabela_preco do vendedor"],
                "envia_para": ["PDVCaixa (rascunho)", "VendasGestao (consulta)", "InterfaceSeparador (se fluxo Completo)"],
                "filhas": [
                    {"nome": "BarcodeScanner", "papel": "Resolve código de barras → produto.id via matching"},
                    {"nome": "ComprovantePreVenda", "papel": "Pré-visualização antes do caixa (não baixa estoque)"},
                    {"nome": "LostSalesForm", "papel": "Regista venda_perdida quando cliente desiste"},
                    {"nome": "ProductUnitSelectorDialog", "papel": "Escolhe embalagem/unidade; calcula fator_conversao → qty_base"},
                ],
                "regras": [
                    "Bloqueia add se estoque_atual < qty_base, salvo vender_sem_estoque ou permitir_venda_estoque_negativo",
                    "Rascunho é a 'peça-mãe' até o caixa converter — não cria pedido_venda ainda",
                ],
                "funcoes": [
                    {"nome": "savePedidoVendaItem", "async": False, "nota": "Espelha linhas no JSON legado + tabela canónica"},
                    {"nome": "gerarNumeroSequencial", "async": False, "nota": "PV-* para orçamentos"},
                ],
                "tabelas": [
                    {"nome": "rascunho_pedido_venda", "fks": [
                        "cliente_id → terceiro.id", "vendedor_id → usuario.id",
                        "pedido_venda_final_id → pedido_venda.id (após conversão)",
                    ]},
                    {"nome": "pedido_venda_item", "fks": [
                        "pedido_venda_id → pedido_venda.id (lógico)",
                        "produto_id → produto.id (lógico)",
                    ]},
                ],
            },
            {
                "nome": "PDV Supermercado",
                "rota": "/PDV?mode=supermercado",
                "feature": "components/vendas/PDVSupermercado.jsx",
                "papel": "Checkout rápido: menos passos, pode finalizar venda no próprio ecrã.",
                "caminho": ["Scan contínuo → pagamento → processarVendaCaixa (se caixa embutido)"],
                "vem_de": ["produto", "configuracoes_venda"],
                "envia_para": ["pedido_venda", "movimentacao_estoque (saída)"],
                "filhas": [
                    {"nome": "SimuladorCartaoSheet", "papel": "Simula taxa maquininha antes de confirmar"},
                ],
                "regras": ["Mesmas regras de estoque do vendedor"],
                "funcoes": [{"nome": "processarVendaCaixa", "async": False, "nota": "RPC atómica — ver Caixa"}],
                "tabelas": [{"nome": "pedido_venda", "fks": ["cliente_id → terceiro.id (FK DB)"]}],
            },
            {
                "nome": "Auto-Atendimento",
                "rota": "/AutoAtendimento",
                "feature": "pages/AutoAtendimento.jsx",
                "papel": "Totem fullscreen: jornada guiada sem operador.",
                "caminho": [
                    "AutoHome → AutoIdentification (CPF/telefone)",
                    "→ AutoShop (grade produtos config_auto_atendimento)",
                    "→ AutoPayment → processarVendaCaixa",
                ],
                "vem_de": ["config_auto_atendimento", "produto (ativos na vitrine)"],
                "envia_para": ["pedido_venda", "venda_perdida (abandono)"],
                "filhas": [
                    {"nome": "AutoShop", "papel": "Grelha de produtos com fotos e destaques"},
                    {"nome": "AutoPayment", "papel": "Seleção forma pagamento + confirmação"},
                    {"nome": "ProductDetailDialog", "papel": "Detalhe embalagem no totem"},
                ],
                "regras": ["Fullscreen; sem sidebar; timeout pode registar venda_perdida"],
                "funcoes": [{"nome": "processarVendaCaixa", "async": False, "nota": "Mesmo RPC do caixa"}],
                "tabelas": [
                    {"nome": "config_auto_atendimento", "fks": []},
                    {"nome": "venda_perdida", "fks": ["produto_id → produto.id"]},
                ],
            },
        ],
    },
    {
        "menu": "Caixa",
        "intro": (
            "Onde o rascunho vira venda real. É o único ponto que chama processarVendaCaixa — "
            "baixa estoque, cria lançamentos financeiros e liga ao turno_caixa."
        ),
        "pages": [
            {
                "nome": "PDVCaixa",
                "rota": "/PDVCaixa",
                "feature": "components/vendas/PDVCaixa.jsx",
                "papel": "Recebimento, sangria, reforço, cupom, devolução. Centro nervoso do PDV.",
                "caminho": [
                    "1. SeletorCaixaPDV: operador escolhe conta_caixa_pdv + abre turno_caixa",
                    "2. ProcessarVendasView: lista rascunhos do turno (polling live)",
                    "3. ConfirmarPagamentoDialog: formas pagamento, maquininha, vale troca",
                    "4. processarVendaCaixa (RPC): rascunho→pedido, saída estoque, LF receita",
                    "5. imprimirCupomTermico → comprovante",
                    "6. Sangria/Reforço → movimentos_caixa + lancamento_financeiro",
                ],
                "vem_de": [
                    "PDVVendedor (rascunho_pedido_venda)",
                    "DevolucaoTroca / vale_compra (crédito cliente)",
                    "FormasDePagamento + Maquininha (regras cartão)",
                ],
                "envia_para": [
                    "turno_caixa + movimentos_caixa",
                    "lancamento_financeiro (receitas, sangrias)",
                    "movimentacao_estoque (saída venda)",
                    "ordem_separacao (se fluxo Completo)",
                    "CaixasAtivos / TurnosFechados (monitoramento)",
                ],
                "filhas": [
                    {"nome": "ProcessarVendasView", "papel": "Fila de rascunhos; botão processar abre ConfirmarPagamentoDialog"},
                    {"nome": "ConfirmarPagamentoDialog", "papel": "Valida cobertura R$0,01; exige maquininha em cartão"},
                    {"nome": "VendasTurnoDialog", "papel": "Espelho vendas do turno (status elegíveis)"},
                    {"nome": "SeletorCaixaPDV", "papel": "Vincula operador à conta_caixa_pdv_id"},
                    {"nome": "VisualizadorCaixa", "papel": "Reutilizado em CaixasAtivos/TurnosFechados"},
                ],
                "regras": [
                    "Sem turno = somente leitura",
                    "Anti-duplo-clique: processandoVenda trava reentrada",
                    "Cartão: liquido = bruto × (1−taxa/100); vencimento dias úteis",
                    "Fiado cria LF Receita Em Aberto tag FIADO",
                ],
                "funcoes": [
                    {"nome": "processarVendaCaixa", "async": False, "nota": "RPC transacional; idempotente (409 se já processado)"},
                    {"nome": "imprimirCupomTermico", "async": False, "nota": "Template ComprovanteTemplate + DadosEmpresa"},
                    {"nome": "gerenciarPin", "async": False, "nota": "PIN 6 dígitos (opcional via env)"},
                ],
                "async_bg": [
                    "Trigger sincronizarEstoquePorMovimentacao após cada movimentacao_estoque",
                    "Polling rascunhos (CAIXA_LIVE_POLL_MS) — UI não bloqueia",
                ],
                "tabelas": [
                    {"nome": "turno_caixa", "fks": [
                        "conta_caixa_pdv_id → contas_financeiras.id",
                        "operador_id → usuario.id",
                    ]},
                    {"nome": "movimentos_caixa", "fks": [
                        "conta_id → contas_financeiras.id (FK RESTRICT)",
                        "turno_caixa_id → turno_caixa.id (FK SET NULL)",
                    ]},
                    {"nome": "lancamento_financeiro", "fks": [
                        "conta_financeira_id → contas_financeiras.id (FK)",
                        "referencia_id → pedido_venda | devolucao_troca (polimórfico)",
                    ]},
                    {"nome": "pedido_venda", "fks": ["cliente_id → terceiro.id (FK)"]},
                ],
            },
        ],
    },
    {
        "menu": "Vendas",
        "intro": "Pós-venda: consulta, alteração, entregas e perdas. Não substitui o PDV para venda nova.",
        "pages": [
            {
                "nome": "VendasGestao",
                "rota": "/VendasGestao",
                "feature": "pages/VendasGestao.jsx",
                "papel": "Lista virtualizada de pedidos/orçamentos com filtros e ações em lote.",
                "caminho": [
                    "Filtro período/status → query pedido_venda",
                    "Clique linha → DetalhesPedidoVenda (sheet)",
                    "Alterar pagamento / reimprimir / devolver",
                ],
                "vem_de": ["PDVCaixa (pedidos processados)", "PDVVendedor (orçamentos)"],
                "envia_para": ["DevolucaoTroca", "ControleEntregas", "PDVCaixa (retorno edição)"],
                "filhas": [
                    {"nome": "DetalhesPedidoVenda", "papel": "Sheet com itens, pagamentos, histórico"},
                    {"nome": "AlterarPagamentoDialog", "papel": "Ajusta pagamentos pós-venda (regras financeiras)"},
                    {"nome": "ValesTrocaTab", "papel": "Lista vales do cliente"},
                    {"nome": "ConsultaVendasCaixa", "papel": "Visão caixa integrada na gestão"},
                ],
                "regras": ["Lista virtualizada para performance em alto volume"],
                "funcoes": [{"nome": "savePedidoVendaItem", "async": False, "nota": "Edição linhas em pedidos abertos"}],
                "tabelas": [{"nome": "pedido_venda / pedido_venda_item", "fks": [
                    "cliente_id → terceiro.id (FK)",
                    "pedido_venda_item.pedido_venda_id → pedido_venda.id",
                ]}],
            },
            {
                "nome": "ControleEntregas",
                "rota": "/ControleEntregas",
                "feature": "pages/ControleEntregas.jsx → LiberacaoEntrega",
                "papel": "Agenda e liberação de entregas ao cliente.",
                "caminho": ["Pedido Em Rota → agenda_logistica → motorista → protocolo_entrega"],
                "vem_de": ["pedido_venda (status entrega)", "PDV fluxo Completo + ordem_separacao"],
                "envia_para": ["protocolo_entrega", "Expedicao"],
                "filhas": [{"nome": "LiberacaoEntrega", "papel": "Confirma saída e atualiza status pedido"}],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "agenda_logistica", "fks": [
                    "pedido_venda_id → pedido_venda.id (FK CASCADE)",
                    "cliente_id → terceiro.id (FK RESTRICT)",
                ]}],
            },
        ],
    },
    {
        "menu": "Produtos",
        "intro": (
            "Catálogo-mãe do sistema. Quase todos os módulos leem produto; "
            "alterações aqui propagam para PDV, compras, estoque e margem."
        ),
        "pages": [
            {
                "nome": "Produtos",
                "rota": "/Produtos",
                "feature": "pages/Produtos.jsx",
                "papel": "CRUD catálogo, precificação, ABCD/IEP, relatórios embutidos (?relatorioVendas/Estoque=1).",
                "caminho": [
                    "TreeGrid (desktop) ou MobileHierarquica (mobile) lista SKUs",
                    "ProdutoFAB → ProdutoFormCompleto (cadastro completo)",
                    "Painel precificação mobile: semáforo margem/markup em tempo real",
                    "Job noturno calcularIEP grava curva ABCD (se ABCD_JOB_NOTURNO)",
                ],
                "vem_de": ["ImportacaoProdutos", "HierarquiaPortal (grade)", "pedido_compra (custos)"],
                "envia_para": ["PDV (preço, estoque)", "SugestoesCompra (metas)", "RelatorioMargem"],
                "filhas": [
                    {"nome": "TreeGrid", "papel": "Grelha hierárquica h1..h5 com windowing performance"},
                    {"nome": "MobileHierarquica", "papel": "Precificação mobile + termômetro margem≥30% markup≥40%"},
                    {"nome": "ProdutoFormCompleto", "papel": "Formulário completo: unidades, custos, fornecedor"},
                    {"nome": "ProdutoFAB", "papel": "Ações rápidas: novo, importar, relatório"},
                ],
                "regras": [
                    "Margem = (preco−custo)/preco×100; markup alvo global 40% (Preço Justo)",
                    "ABCD pareto ao vivo; iep_trava_manual preserva classe gravada",
                    "estoque_atual recalculado por trigger em movimentacao_estoque",
                ],
                "funcoes": [
                    {"nome": "calcularIEP", "async": True, "nota": "Batch 50 SKUs; preparar→classificar→gravar"},
                    {"nome": "atualizarMetasEstoque", "async": True, "nota": "Ponto de pedido; janela 60d"},
                    {"nome": "importarProdutos", "async": True, "nota": "Bulk + ImportacaoLog undo"},
                ],
                "tabelas": [
                    {"nome": "produto", "fks": [
                        "categoria_id → categoria_produto.id",
                        "fornecedor_padrao_id → terceiro.id",
                    ]},
                    {"nome": "movimentacao_estoque", "fks": [
                        "produto_id → produto.id (FK RESTRICT)",
                    ]},
                ],
            },
            {
                "nome": "HierarquiaPortal",
                "rota": "/HierarquiaPortal",
                "feature": "hierarquia-portal/*",
                "papel": "Grade de compra (linha→produto_compra→eixos) + cadastro v2 cerâmica.",
                "caminho": ["PortalTreeGrid navega grade → CadastroProdutoV2Form cria SKU portal"],
                "vem_de": ["modelo_linha / modelo_produto_compra (laboratório)"],
                "envia_para": ["produto (vínculo portal_catalog)", "SugestoesCompra"],
                "filhas": [
                    {"nome": "PortalTreeGrid", "papel": "Árvore linha/eixo com reserva portal"},
                    {"nome": "CadastroProdutoV2Form", "papel": "Wizard cadastro com grade"},
                ],
                "regras": ["Grade: linha_compra → produto_compra → eixo_valor (FKs DB na grade)"],
                "funcoes": [],
                "tabelas": [{"nome": "portal_catalog / linha_compra / eixo_valor", "fks": [
                    "produto_compra.linha_id → linha_compra.id (FK)",
                ]}],
            },
        ],
    },
    {
        "menu": "Compras",
        "intro": (
            "Ciclo procure-to-receive: sugestão → cotação → PO → aprovação financeira → "
            "embarque → conferência → entrada estoque."
        ),
        "pages": [
            {
                "nome": "SugestoesCompra",
                "rota": "/SugestoesCompra",
                "feature": "components/compras/SugestaoCompra.jsx",
                "papel": "Smart Supply: quanto comprar com base em metas, ABCD e vendas.",
                "caminho": ["Filtro curva → árvore produtos → qty sugerida → gera rascunho PO"],
                "vem_de": ["produto (estoque, metas)", "pedido_venda (demanda)"],
                "envia_para": ["PedidosCompra (novo PO)", "HierarquiaPortalEntry"],
                "filhas": [
                    {"nome": "SugestaoCompraTreeGrid", "papel": "Desktop: árvore com qty editável"},
                    {"nome": "SugestaoCompraMobileCatalog", "papel": "Mobile: catálogo compacto"},
                ],
                "regras": ["Filtro ABCD; velocidade de venda editável"],
                "funcoes": [{"nome": "atualizarMetasEstoque", "async": True, "nota": "Job background"}],
                "tabelas": [{"nome": "produto / pedido_compra", "fks": []}],
            },
            {
                "nome": "PedidosCompra",
                "rota": "/PedidosCompra",
                "feature": "pages/PedidosCompra.jsx",
                "papel": "Lista e gestão de POs; ponto de envio ao financeiro.",
                "caminho": [
                    "1. Criar PO → savePedidoCompraItem (linhas canónicas)",
                    "2. Enviar financeiro → LF is_custo_mercadoria:true",
                    "3. AprovacoesFinanceiras aprova → Aguardando Recepção",
                    "4. Embarque → conferência → recepção → estoque",
                ],
                "vem_de": ["SugestoesCompra", "Cotacoes", "ImportadorNotaFiscal"],
                "envia_para": [
                    "AprovacoesFinanceiras", "PedidoCompraDetalhe",
                    "ConferenciaEntrada", "lancamento_financeiro",
                ],
                "filhas": [
                    {"nome": "ListaPedidosCompra", "papel": "Tabela principal com status workflow"},
                    {"nome": "ConsultaComprasPedidos", "papel": "Consulta avançada embarques pendentes"},
                    {"nome": "ImportadorNotaFiscal", "papel": "PDF NF → linhas PO"},
                    {"nome": "ActionMenuComprasV2", "papel": "Ações: aprovar, PDF, financeiro"},
                ],
                "regras": [
                    "isLocked após envio financeiro (não edita sem reabertura)",
                    "Trigger: status Aprovado → aprovacao_financeira automática",
                    "Reabertura bloqueada se manifesto_entrada_id preenchido",
                ],
                "funcoes": [
                    {"nome": "savePedidoCompraItem", "async": False, "nota": "qty_base, custo líquido, total PO"},
                    {"nome": "recalcular-conclusao-pedido-compra", "async": True, "nota": "Estoque pós-recepção"},
                ],
                "tabelas": [
                    {"nome": "pedido_compra", "fks": [
                        "fornecedor_id → terceiro.id (FK RESTRICT)",
                        "conta_pagamento_id → contas_financeiras.id (FK SET NULL)",
                    ]},
                    {"nome": "pedido_compra_item", "fks": [
                        "pedido_compra_id → pedido_compra.id (lógico)",
                        "produto_id → produto.id (lógico)",
                    ]},
                ],
            },
            {
                "nome": "PedidoCompraDetalhe",
                "rota": "/PedidoCompraDetalhe?id=",
                "feature": "components/compras/PedidoCompraForm.jsx",
                "papel": "Fullscreen: edição completa PO, embarques, anexos, relatórios.",
                "caminho": ["Lista PO → detalhe → abas itens/embarques/financeiro/anexos"],
                "vem_de": ["PedidosCompra"],
                "envia_para": ["embarque", "ConferenciaEntrada", "Financeiro"],
                "filhas": [
                    {"nome": "InformarEmbarque", "papel": "Regista embarque + saveEmbarqueItem"},
                    {"nome": "RecepcionarEmbarque", "papel": "Confirma recepção física"},
                    {"nome": "PedidoCompraFAB", "papel": "PDF pedido, precificação, pendências"},
                ],
                "regras": ["PIN save opcional em Aguardando Aprovação Financeira"],
                "funcoes": [
                    {"nome": "saveEmbarqueItem", "async": False, "nota": "qty embarcada/recebida por linha"},
                    {"nome": "uploadAnexoDrive", "async": False, "nota": "Anexo NF/contrato no Drive"},
                ],
                "tabelas": [{"nome": "embarque / embarque_item", "fks": [
                    "embarque.pedido_compra_id → pedido_compra.id (FK CASCADE)",
                    "embarque_item.pedido_compra_item_id → pedido_compra_item.id",
                ]}],
            },
            {
                "nome": "ConferenciaEntrada",
                "rota": "/ConferenciaEntrada",
                "feature": "PainelConferencias + GestaoCodigosConferencia",
                "papel": "Recepção cega: código → volumes ou itens → entrada estoque.",
                "caminho": [
                    "Gerente gera código (generateConferenceCode)",
                    "Conferente escaneia em ConferenciaVolumes ou ConferenciaItens",
                    "validateConferenceCode → status Em Uso",
                    "Finalizar → movimentacao_estoque Entrada motivo Compra",
                ],
                "vem_de": ["supermanifesto / manifesto_entrada", "embarque"],
                "envia_para": ["movimentacao_estoque", "produto.estoque_atual (trigger)"],
                "filhas": [
                    {"nome": "GestaoCodigosConferencia", "papel": "Admin: gera/expira códigos"},
                    {"nome": "PainelConferencias", "papel": "Lista conferências ativas"},
                ],
                "regras": [
                    "Código 8 chars; só admin/Gerente gera",
                    "Volumes: permite divergência; Itens: exige lote se controla_lote",
                ],
                "funcoes": [
                    {"nome": "generateConferenceCode", "async": False, "nota": ""},
                    {"nome": "validateConferenceCode", "async": False, "nota": ""},
                    {"nome": "saveConferenciaItem", "async": False, "nota": "divergencia_base = contada−sistema"},
                ],
                "tabelas": [{"nome": "supermanifesto / manifesto_entrada / conferencia_compra", "fks": []}],
            },
        ],
    },
    {
        "menu": "Estoque",
        "intro": "Movimentação física e contagem. Toda entrada/saída passa por movimentacao_estoque.",
        "pages": [
            {
                "nome": "ContagemExpress",
                "rota": "/ContagemExpress",
                "feature": "estoque/contagem-express/*",
                "papel": "Contagem rápida com carrinho; confirma com PIN.",
                "caminho": ["Scan produto → carrinho qty → PIN → conferencia_estoque"],
                "vem_de": ["produto"],
                "envia_para": ["conferencia_estoque → ajuste movimentacao"],
                "filhas": [
                    {"nome": "ContagemExpressCarrinho", "papel": "Lista itens contados"},
                    {"nome": "ContagemExpressPainelContagem", "papel": "Input qty + scan"},
                ],
                "regras": ["PIN confirmação (se operacao auth ativo)"],
                "funcoes": [{"nome": "saveConferenciaItem", "async": False, "nota": ""}],
                "tabelas": [{"nome": "conferencia_estoque", "fks": ["itens[].produto_id → produto"]}],
            },
            {
                "nome": "MovimentosInventario",
                "rota": "/MovimentosInventario",
                "feature": "pages/MovimentosInventario.jsx",
                "papel": "Ajuste manual: entrada, saída, transferência entre áreas.",
                "caminho": ["Busca produto → tipo movimento → grava movimentacao_estoque → trigger recalcula"],
                "vem_de": ["produto", "area"],
                "envia_para": ["movimentacao_estoque → produto.estoque_atual"],
                "filhas": [{"nome": "productMatchingUtils", "papel": "Resolve busca por código/nome"}],
                "regras": ["Negativo permitido desde mig.038"],
                "funcoes": [],
                "async_bg": ["trigger recalcular_estoque_produto"],
                "tabelas": [{"nome": "movimentacao_estoque", "fks": [
                    "produto_id → produto.id (FK RESTRICT)",
                ]}],
            },
            {
                "nome": "InterfaceSeparador",
                "rota": "/InterfaceSeparador",
                "feature": "pages/InterfaceSeparador.jsx",
                "papel": "Fila de separação: pedidos prontos para expedição.",
                "caminho": ["ordem_separacao Pendente → separador confirma itens → Em Separação/Concluído"],
                "vem_de": ["processarVendaCaixa (ordem_separacao se fluxo Completo)"],
                "envia_para": ["ControleEntregas", "Expedicao"],
                "filhas": [],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "ordem_separacao", "fks": [
                    "pedido_venda_id → pedido_venda.id (lógico)",
                ]}],
            },
        ],
    },
    {
        "menu": "Consumo Interno",
        "intro": "Baixa de mercadoria para uso interno (refeitório, manutenção). Gera movimentação de saída.",
        "pages": [
            {
                "nome": "ConsumoInterno",
                "rota": "/ConsumoInterno",
                "feature": "pages/ConsumoInterno.jsx",
                "papel": "Registo de consumo com destinação, responsável e aprovação.",
                "caminho": [
                    "1. Seleciona destinação + responsável (lookups)",
                    "2. Adiciona itens produto × qty",
                    "3. Confirma → movimentacao_estoque Saída + consumo_interno",
                    "4. Pode vincular turno_caixa se PDV aberto",
                ],
                "vem_de": ["produto", "destinacao_consumo_interno", "responsavel_consumo_interno"],
                "envia_para": ["movimentacao_estoque", "CaixasAtivos (monitor)"],
                "filhas": [{"nome": "RelatorioConsumoInterno", "papel": "Relatório por período/destinação"}],
                "regras": ["gerarNumeroSequencial CI-*"],
                "funcoes": [{"nome": "gerarNumeroSequencial", "async": False, "nota": "CI-*"}],
                "tabelas": [{"nome": "consumo_interno", "fks": [
                    "turno_caixa_id → turno_caixa.id (lógico)",
                    "itens[].produto_id → produto.id",
                ]}],
            },
        ],
    },
    {
        "menu": "Financeiro",
        "intro": (
            "Dinheiro do negócio: lançamentos, contas, recorrência, aprovações. "
            "Gate opcional VITE_FINANCEIRO_GATE_PASSWORD (15 min)."
        ),
        "pages": [
            {
                "nome": "FluxoCaixa",
                "rota": "/FluxoCaixa",
                "feature": "financeiro/ExecucaoOrcamentaria.jsx",
                "papel": "Execução orçamentária: lista lançamentos, filtros, conciliação, novo LF.",
                "caminho": [
                    "FiltrosFluxoCaixa → ListaLancamentos",
                    "NovoLancamentoDialog → grava lancamento_financeiro",
                    "ConciliacaoBancaria → agrupa LF por extrato",
                    "?aba=agefin integra visão AGEFIN",
                ],
                "vem_de": [
                    "PDVCaixa (receitas)", "PedidosCompra (CMV)",
                    "SuperAgefin (contas previstas pagas)", "movimentos_caixa",
                ],
                "envia_para": ["ExtratoConta", "ContasFinanceiras (saldo)"],
                "filhas": [
                    {"nome": "ListaLancamentos", "papel": "Grelha principal com ações inline"},
                    {"nome": "FiltrosFluxoCaixa", "papel": "Tipo, conta, status, CMV, conciliação"},
                    {"nome": "ConciliacaoBancaria", "papel": "Match LF ↔ extrato bancário"},
                    {"nome": "NovoLancamentoDialog", "papel": "Cria LF manual ou transferência"},
                ],
                "regras": ["Filtro CMV-only isola custo mercadoria de POs"],
                "funcoes": [{"nome": "gerarExtratoFluxoCaixa", "async": False, "nota": "PDF extrato período"}],
                "tabelas": [{"nome": "lancamento_financeiro", "fks": [
                    "conta_financeira_id → contas_financeiras.id (FK)",
                    "terceiro_id → terceiro.id", "grupo_lancamento_id → self",
                ]}],
            },
            {
                "nome": "SuperAgefin",
                "rota": "/SuperAgefin",
                "feature": "pages/SuperAgefin.jsx",
                "papel": "Contas recorrentes e previstas; calendário de compromissos.",
                "caminho": [
                    "conta_recorrente define série",
                    "Cron gera conta_prevista (3 meses)",
                    "Operador marca Pago → trigger cria lancamento_financeiro",
                    "Compromissos sintéticos: sócios (sábados), folha (dia 05)",
                ],
                "vem_de": ["PlanejamentoFinanceiro (contas fixas)", "conta_recorrente"],
                "envia_para": ["lancamento_financeiro", "FluxoCaixa"],
                "filhas": [
                    {"nome": "SuperAgefinConsultaDrawer", "papel": "Detalhe conta prevista/recorrente"},
                    {"nome": "SuperAgefinConsultaOrganizer", "papel": "Organização por mês/categoria"},
                ],
                "regras": [
                    "ContaPrevista Pago → sincronizarContaPrevia cria LF",
                    "Exclusão recorrente cascata previstas + LF vinculados",
                ],
                "funcoes": [{"nome": "cancelarLancamentoFinanceiro", "async": False, "nota": "Reverte saldo conta"}],
                "async_bg": [
                    "gerarContasPrevistasRecorrentes — cron dia 1",
                    "gerarLancamentosCartao — cron 05:00",
                    "processarLiquidacaoCartaoCredito — cron 08:00",
                ],
                "tabelas": [
                    {"nome": "conta_recorrente", "fks": [
                        "terceiro_id → terceiro.id (FK RESTRICT)",
                        "categoria_financeira_id → categoria_financeira.id (FK RESTRICT)",
                    ]},
                    {"nome": "conta_prevista", "fks": [
                        "conta_recorrente_id → conta_recorrente.id (FK SET NULL)",
                    ]},
                ],
            },
            {
                "nome": "AprovacoesFinanceiras",
                "rota": "/AprovacoesFinanceiras",
                "feature": "pages/AprovacoesFinanceiras.jsx + aprovarPedidoCompraFinanceiro.js",
                "papel": "Aprovar/rejeitar pagamentos de pedidos de compra.",
                "caminho": [
                    "Lista POs Aguardando Aprovação Financeira",
                    "Aprovar → status Aguardando Recepção + LF mantidos",
                    "Rejeitar → Cancelado + LF cancelados",
                ],
                "vem_de": ["PedidosCompra (envio financeiro)"],
                "envia_para": ["PedidoCompraDetalhe (recepção)", "ConferenciaEntrada"],
                "filhas": [{"nome": "aprovarPedidoCompraFinanceiro.js", "papel": "Lógica aprovar/rejeitar + LF"}],
                "regras": [
                    "Bloqueia reenvio se parcela LF já paga",
                    "automacaoAprovacaoFinanceira trigger em status Aprovado",
                ],
                "funcoes": [{"nome": "repararLancamentosPedidosAprovados", "async": True, "nota": "Admin backfill"}],
                "tabelas": [{"nome": "pedido_compra + lancamento_financeiro", "fks": [
                    "pedido_compra_vinculado_id → pedido_compra.id",
                ]}],
            },
            {
                "nome": "PlanejamentoFinanceiro / Budgets",
                "rota": "/PlanejamentoFinanceiro · /Budgets",
                "feature": "planejamento-financeiro-v2 + budget-previsao",
                "papel": "Planejamento estratégico: contas fixas, projeção, orçamento por competência.",
                "caminho": ["Modelo → competências mensais → comparação realizado (LF)"],
                "vem_de": ["lancamento_financeiro", "folha_previsao", "budget_competencia"],
                "envia_para": ["SuperAgefin (contas fixas)", "VisaoFinanceira"],
                "filhas": [
                    {"nome": "ContasFixasTab", "papel": "Série recorrente planejada"},
                    {"nome": "BudgetPlanoCompleto", "papel": "Orçamento anual por centro"},
                ],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "budget_modelo / budget_competencia / folha_previsao_*", "fks": []}],
            },
        ],
    },
    {
        "menu": "Relatórios",
        "intro": "Hub de relatórios; muitos migraram para PDF client-side para evitar lag de deploy.",
        "pages": [
            {
                "nome": "Relatorios",
                "rota": "/Relatorios",
                "feature": "pages/Relatorios.jsx",
                "papel": "Central: Gerencial, Vendas, Compras, Estoque; lança sub-relatórios.",
                "caminho": ["Aba → escolhe relatório → PDF client ou server"],
                "vem_de": ["pedido_venda, pedido_compra, produto, lancamento_financeiro"],
                "envia_para": ["RelatorioMargem, RelatorioPerformance, PrecoJustoDashboard"],
                "filhas": [{"nome": "Abas por domínio", "papel": "Cada aba agrega links de relatório"}],
                "regras": ["Margem: exclui Cancelado; usa STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA"],
                "funcoes": [
                    {"nome": "gerarRelatorioPedidosCompra", "async": False, "nota": "Server PDF"},
                    {"nome": "gerarRelatorioMargem", "async": False, "nota": "UI prefere client PDF"},
                ],
                "tabelas": [{"nome": "pedido_venda / pedido_compra / produto", "fks": []}],
            },
        ],
    },
    {
        "menu": "Configurações",
        "intro": "Admin: utilizadores, perfis, parâmetros globais, ferramentas de manutenção.",
        "pages": [
            {
                "nome": "Configuracoes",
                "rota": "/Configuracoes",
                "feature": "pages/Configuracoes.jsx",
                "papel": "Hub com abas Vendas · Operações · Financeiro · Parâmetros · Ferramentas.",
                "caminho": ["Admin abre aba → edita entidade config → propaga para módulos"],
                "vem_de": ["perfil_de_acesso (quem pode entrar)"],
                "envia_para": ["Todos os módulos (configuracoes_venda, estoque, formas pagamento)"],
                "filhas": [
                    {"nome": "UsuariosManager", "papel": "CRUD usuario + p38-auth"},
                    {"nome": "PerfisDeAcessoManager", "papel": "Matriz permissoes → menu lateral"},
                    {"nome": "AbcdConfigTool", "papel": "Dispara calcularIEP manual"},
                    {"nome": "MetasEstoqueConfigTool", "papel": "Dispara atualizarMetasEstoque"},
                ],
                "regras": ["adminOnly no menu; perfilTemEscopoTotal = acesso total"],
                "funcoes": [
                    {"nome": "p38-auth", "async": False, "nota": "Login, ativar, CRUD users"},
                    {"nome": "zerarEntidade", "async": True, "nota": "⚠ wipe — RecomecarDoZero"},
                ],
                "tabelas": [
                    {"nome": "usuario", "fks": [
                        "perfil_acesso_id → perfil_de_acesso.id",
                        "empresa_id → empresa.id (FK)",
                    ]},
                    {"nome": "perfil_de_acesso", "fks": []},
                ],
            },
        ],
    },
]

FLOW_CHAINS = [
    {
        "titulo": "Venda completa (PDV → Caixa → Estoque → Financeiro)",
        "passos": [
            "PDVVendedor monta rascunho_pedido_venda + pedido_venda_item",
            "PDVCaixa recebe rascunho → processarVendaCaixa",
            "→ pedido_venda (Financeiro OK) + movimentacao_estoque Saída",
            "→ lancamento_financeiro Receita + movimentos_caixa (dinheiro)",
            "→ trigger recalcula produto.estoque_atual",
            "→ ordem_separacao (se fluxo Completo) → InterfaceSeparador → ControleEntregas",
        ],
    },
    {
        "titulo": "Compra completa (Sugestão → PO → Financeiro → Recepção)",
        "passos": [
            "SugestoesCompra sugere qty → PedidosCompra cria pedido_compra",
            "savePedidoCompraItem grava linhas → envio financeiro cria LF CMV",
            "AprovacoesFinanceiras aprova → Aguardando Recepção",
            "PedidoCompraDetalhe registra embarque → ConferenciaEntrada",
            "movimentacao_estoque Entrada → trigger estoque",
            "recalcular-conclusao-pedido-compra (async) confirma todos SKUs",
        ],
    },
    {
        "titulo": "Compromisso recorrente (AGEFIN → Fluxo)",
        "passos": [
            "conta_recorrente definida em SuperAgefin ou Planejamento",
            "Cron gerarContasPrevistasRecorrentes → conta_prevista",
            "Operador marca Pago → trigger sincronizarContaPrevia",
            "→ lancamento_financeiro → FluxoCaixa / saldo contas_financeiras",
        ],
    },
]


def esc(text: str) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_piece(page: dict) -> list:
    flow: list = []
    flow.append(Paragraph(f"● {esc(page['nome'])}", STYLES["piece_title"]))
    flow.append(Paragraph(esc(page.get("rota", "")), STYLES["piece_route"]))
    if page.get("feature"):
        flow.append(Paragraph(f"<i>{esc(page['feature'])}</i>", STYLES["meta"]))

    if page.get("papel"):
        flow.append(Paragraph("<b>Papel</b>", STYLES["section_lbl"]))
        flow.append(Paragraph(esc(page["papel"]), STYLES["body"]))

    if page.get("caminho"):
        flow.append(Paragraph("<b>Caminho (pathway)</b>", STYLES["section_lbl"]))
        for i, step in enumerate(page["caminho"], 1):
            flow.append(Paragraph(f"{i}. {esc(step)}", STYLES["body"]))

    if page.get("vem_de") or page.get("envia_para"):
        flow.append(Paragraph("<b>Conexões</b>", STYLES["section_lbl"]))
        for src in page.get("vem_de", []):
            flow.append(Paragraph(f"↑ recebe de: {esc(src)}", STYLES["link"]))
        for dst in page.get("envia_para", []):
            flow.append(Paragraph(f"↓ envia para: {esc(dst)}", STYLES["link"]))

    filhas = page.get("filhas", [])
    if filhas:
        flow.append(Paragraph("<b>Filhas (componentes)</b>", STYLES["section_lbl"]))
        for f in filhas:
            if isinstance(f, dict):
                flow.append(Paragraph(f"● <b>{esc(f['nome'])}</b> — {esc(f['papel'])}", STYLES["child"]))
            else:
                flow.append(Paragraph(f"● {esc(f)}", STYLES["child"]))

    regras = page.get("regras", [])
    if regras:
        flow.append(Paragraph("<b>Regras de negócio</b>", STYLES["section_lbl"]))
        for regra in regras:
            flow.append(Paragraph(f"▲ {esc(regra)}", STYLES["biz"]))

    funcoes = page.get("funcoes", [])
    if funcoes:
        flow.append(Paragraph("<b>Funções (lógica server)</b>", STYLES["section_lbl"]))
        for fn in funcoes:
            tag = "⟳ background" if fn.get("async") else "sync (bloqueia UI)"
            flow.append(
                Paragraph(
                    f"◆ <b>{esc(fn['nome'])}</b> [{tag}] — {esc(fn.get('nota', ''))}",
                    STYLES["fn"],
                )
            )

    async_bg = page.get("async_bg", [])
    if async_bg:
        flow.append(Paragraph("<b>Background / performance</b>", STYLES["section_lbl"]))
        for bg in async_bg:
            flow.append(Paragraph(f"⟳ {esc(bg)}", STYLES["async"]))

    tabelas = page.get("tabelas", [])
    if tabelas:
        flow.append(Paragraph("<b>Dados (Supabase)</b>", STYLES["section_lbl"]))
        for tbl in tabelas:
            fks = tbl.get("fks", [])
            fk_html = ""
            if fks:
                fk_html = "<br/>".join(f"&nbsp;&nbsp;↳ {esc(f)}" for f in fks)
            flow.append(
                Paragraph(
                    f"■ <b>{esc(tbl['nome'])}</b>{('<br/>' + fk_html) if fk_html else ''}",
                    STYLES["db"],
                )
            )

    flow.append(Spacer(1, 4 * mm))
    return flow


def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.25)
    canvas.line(1.5 * cm, h - 1.2 * cm, w - 1.5 * cm, h - 1.2 * cm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(1.5 * cm, h - 1.0 * cm, "P38 Parts Catalog · Manual UI First")
    canvas.drawRightString(w - 1.5 * cm, h - 1.0 * cm, str(doc.page))
    canvas.restoreState()


def build_pdf():
    w, h = A4
    doc = BaseDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.2 * cm,
    )
    frame = Frame(1.5 * cm, 1.2 * cm, w - 3 * cm, h - 2.7 * cm, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    story: list = []

    # Capa
    story.append(Spacer(1, 3.5 * cm))
    story.append(Paragraph("P38 Parts Catalog", STYLES["cover_title"]))
    story.append(Paragraph("Manual arquitetural · UI First", STYLES["cover_title"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(
        Paragraph(
            f"Cada peça descreve: papel, caminho (pathway), conexões, filhas, regras e dados.<br/>"
            f"Gerado {date.today().strftime('%d/%m/%Y')} · sem prints · para comunicação com agentes Cursor.",
            STYLES["cover_sub"],
        )
    )
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("<b>Como ler</b>", STYLES["cover_sub"]))
    for line in [
        "● Peça = página ou componente React",
        "Caminho = sequência operacional (o que o utilizador/operador faz)",
        "↑↓ Conexões = de quem recebe dados e para quem envia",
        "◆ Função sync bloqueia ecrã; ⟳ roda em background/cron/trigger",
        "■ Tabela + ↳ FK = onde os dados repousam e como se ligam",
    ]:
        story.append(Paragraph(line, STYLES["cover_sub"]))

    story.append(PageBreak())

    # Índice
    story.append(Paragraph("Índice", STYLES["zone"]))
    story.append(Spacer(1, 3 * mm))
    for i, z in enumerate(CATALOG, 1):
        pages = ", ".join(p["nome"] for p in z["pages"])
        story.append(Paragraph(f"{i}. <b>{esc(z['menu'])}</b> — {esc(pages)}", STYLES["body"]))
    story.append(PageBreak())

    # Cadeias de fluxo end-to-end
    story.append(Paragraph("Cadeias de fluxo (peças ligadas)", STYLES["zone"]))
    story.append(Spacer(1, 4 * mm))
    for chain in FLOW_CHAINS:
        story.append(Paragraph(f"<b>{esc(chain['titulo'])}</b>", STYLES["section_lbl"]))
        for i, step in enumerate(chain["passos"], 1):
            story.append(Paragraph(f"{i}. {esc(step)}", STYLES["body"]))
        story.append(Spacer(1, 5 * mm))
    story.append(PageBreak())

    # Módulos — uma peça por bloco, page break entre peças grandes
    for zone in CATALOG:
        story.append(Paragraph(esc(zone["menu"]), STYLES["zone"]))
        story.append(Paragraph(esc(zone.get("intro", "")), STYLES["zone_intro"]))

        for j, page in enumerate(zone["pages"]):
            story.extend(render_piece(page))
            # page break entre peças (manual espaçado)
            if j < len(zone["pages"]) - 1:
                story.append(PageBreak())

        story.append(PageBreak())

    # Apêndice
    story.append(Paragraph("Apêndice — Tabelas-hub", STYLES["zone"]))
    hubs = [
        ("terceiro", "CRM", "cliente_id em pedido_venda; fornecedor_id em pedido_compra; terceiro_id em LF"),
        ("produto", "Catálogo", "movimentacao_estoque.produto_id FK RESTRICT; todas as linhas PO/PV"),
        ("pedido_venda", "Vendas", "Origem PDV; alimenta margem, entregas, financeiro"),
        ("pedido_compra", "Compras", "embarque CASCADE; LF is_custo_mercadoria"),
        ("lancamento_financeiro", "Financeiro", "referencia polimórfica; saldo em contas_financeiras"),
        ("turno_caixa", "Sessão", "movimentos_caixa FK; agrupa vendas do operador"),
    ]
    for name, role, desc in hubs:
        story.append(Paragraph(f"■ <b>{esc(name)}</b> ({esc(role)}) — {esc(desc)}", STYLES["db"]))

    doc.build(story)
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
