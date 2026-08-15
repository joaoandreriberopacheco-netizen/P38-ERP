#!/usr/bin/env python3
"""
P38 Parts Catalog — UI First (System Design)
Gera docs/P38_PARTS_CATALOG_UI_FIRST.pdf

Estrutura em árvore (retrato):
  Módulo → Página → Componente → Função ⚙️ → Tabela 🛢️ (+ FKs e regras)
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
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

OUTPUT = "/workspace/docs/P38_PARTS_CATALOG_UI_FIRST.pdf"

# ── Paleta minimalista ───────────────────────────────────────────────────────
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
RULE = colors.HexColor("#D1D5DB")
ZONE = colors.HexColor("#1E40AF")
PAGE = colors.HexColor("#111827")
COMP = colors.HexColor("#374151")
FN = colors.HexColor("#7C3AED")
DB = colors.HexColor("#0F766E")
ASYNC = colors.HexColor("#B45309")
BIZ = colors.HexColor("#B91C1C")

INDENT = [0, 10, 22, 34, 46]  # mm por nível 0..4


def S(name: str, **kw) -> ParagraphStyle:
    defaults = dict(fontName="Helvetica", fontSize=8, leading=10, textColor=INK, alignment=TA_LEFT)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)


STYLES = {
    "cover_title": S("cover_title", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=INK),
    "cover_sub": S("cover_sub", fontSize=10, leading=14, textColor=MUTED),
    "zone": S("zone", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=ZONE, spaceBefore=8, spaceAfter=2),
    "zone_desc": S("zone_desc", fontSize=7.5, leading=10, textColor=MUTED, spaceAfter=4),
    "page": S("page", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=PAGE, leftIndent=INDENT[1] * mm),
    "comp": S("comp", fontSize=7.5, leading=9.5, textColor=COMP, leftIndent=INDENT[2] * mm),
    "fn": S("fn", fontSize=7.5, leading=9.5, textColor=FN, leftIndent=INDENT[3] * mm),
    "db": S("db", fontSize=7.5, leading=9.5, textColor=DB, leftIndent=INDENT[4] * mm),
    "biz": S("biz", fontSize=7, leading=9, textColor=BIZ, leftIndent=INDENT[3] * mm),
    "async": S("async", fontSize=7, leading=9, textColor=ASYNC, leftIndent=INDENT[3] * mm),
    "meta": S("meta", fontSize=7, leading=9, textColor=MUTED, leftIndent=INDENT[1] * mm),
    "footer": S("footer", fontSize=6.5, leading=8, textColor=MUTED),
}

# ── Catálogo denso (extraído do código) ──────────────────────────────────────
CATALOG: list[dict[str, Any]] = [
    {
        "menu": "PDV",
        "desc": "Venda assistida, self-checkout e totem. Mobile-first fullscreen.",
        "pages": [
            {
                "nome": "PDVVendedor",
                "rota": "/PDVVendedor",
                "feature": "components/vendas/PDVVendedor.jsx",
                "components": [
                    "ComprovantePreVenda · BarcodeScanner · LostSalesForm · ProductUnitSelectorDialog",
                ],
                "regras": [
                    "Bloqueia venda se estoque_atual < qty_base, salvo configVenda.vender_sem_estoque ou permitir_venda_estoque_negativo (configFlags.js)",
                    "Rascunho → conversão no caixa; status espelhados em RascunhoPedidoVenda",
                ],
                "funcoes": [
                    {"nome": "savePedidoVendaItem", "async": False, "nota": "CRUD canónico de linhas + espelho em pedido_venda.itens"},
                    {"nome": "gerarNumeroSequencial", "async": False, "nota": "PV-*, orçamentos"},
                ],
                "tabelas": [
                    {"nome": "rascunho_pedido_venda", "fks": [
                        "cliente_id → terceiro.id (lógico)",
                        "vendedor_id → usuario.id (lógico)",
                        "pedido_venda_final_id → pedido_venda.id (lógico)",
                    ]},
                    {"nome": "pedido_venda_item", "fks": [
                        "pedido_venda_id → pedido_venda.id (lógico, sem FK DB)",
                        "produto_id → produto.id (lógico)",
                    ]},
                    {"nome": "produto", "fks": ["produto_id → movimentacao_estoque (RESTRICT na saída)"]},
                ],
            },
            {
                "nome": "PDV Supermercado",
                "rota": "/PDV?mode=supermercado",
                "feature": "components/vendas/PDVSupermercado.jsx",
                "components": ["BarcodeScanner · SimuladorCartaoSheet"],
                "regras": ["Checkout rápido; mesmas regras de estoque do vendedor"],
                "funcoes": [{"nome": "processarVendaCaixa", "async": False, "nota": "RPC transacional — ver Caixa"}],
                "tabelas": [{"nome": "pedido_venda", "fks": ["cliente_id → terceiro.id (FK DB SET NULL)"]}],
            },
            {
                "nome": "Auto-Atendimento",
                "rota": "/AutoAtendimento",
                "feature": "pages/AutoAtendimento.jsx → auto/*",
                "components": ["AutoHome → AutoIdentification → AutoShop → AutoPayment"],
                "regras": ["Fullscreen totem; venda_perdida registada em abandono"],
                "funcoes": [{"nome": "processarVendaCaixa", "async": False, "nota": "Mesmo RPC atómico do caixa"}],
                "tabelas": [
                    {"nome": "config_auto_atendimento", "fks": []},
                    {"nome": "venda_perdida", "fks": ["produto_id → produto.id (lógico)"]},
                ],
            },
        ],
    },
    {
        "menu": "Caixa",
        "desc": "Recebimento, sangria, reforço, cupom térmico. Turno obrigatório.",
        "pages": [
            {
                "nome": "PDVCaixa",
                "rota": "/PDVCaixa",
                "feature": "components/vendas/PDVCaixa.jsx",
                "components": [
                    "ProcessarVendasView · ConfirmarPagamentoDialog · VendasTurnoDialog · SeletorCaixaPDV",
                ],
                "regras": [
                    "Sem turno vinculado = modo somente leitura (L719)",
                    "Pagamentos devem cobrir total com tolerância R$0,01 (financialUtils)",
                    "Cartão exige maquininha+bandeira; anti-duplo-clique via processandoVenda",
                    "Espelho turno: só pedidos Financeiro OK / Pedido Concluído / Em Separação / Em Rota",
                    "Polling live de rascunhos (CAIXA_LIVE_POLL_MS) — não bloqueia UI principal",
                ],
                "funcoes": [
                    {
                        "nome": "processarVendaCaixa",
                        "async": False,
                        "nota": "RPC atómica: rascunho→pedido, saída estoque, LF receita, vale troca, ordem_separacao se fluxo Completo",
                    },
                    {"nome": "imprimirCupomTermico", "async": False, "nota": "HTML/PDF comprovante"},
                    {"nome": "gerenciarPin", "async": False, "nota": "PIN 6 dígitos SHA-256 (desligado por defeito: VITE_OPERACAO_AUTH_ENABLED)"},
                ],
                "async_bg": [
                    "sincronizarEstoquePorMovimentacao — trigger AFTER em movimentacao_estoque (recalcula produto.estoque_atual)",
                ],
                "tabelas": [
                    {"nome": "turno_caixa", "fks": [
                        "conta_caixa_pdv_id → contas_financeiras.id (lógico)",
                        "operador_id → usuario.id (lógico)",
                    ]},
                    {"nome": "movimentos_caixa", "fks": [
                        "conta_id → contas_financeiras.id (FK RESTRICT)",
                        "turno_caixa_id → turno_caixa.id (FK SET NULL)",
                        "lancamento_financeiro_id → lancamento_financeiro.id (lógico)",
                    ]},
                    {"nome": "lancamento_financeiro", "fks": [
                        "conta_financeira_id → contas_financeiras.id (FK SET NULL)",
                        "turno_caixa_id → turno_caixa.id (lógico)",
                        "referencia_id → polimórfico (pedido_venda, devolucao_troca…)",
                    ]},
                    {"nome": "pedido_venda", "fks": ["cliente_id → terceiro.id (FK DB)"]},
                    {"nome": "vale_compra / devolucao_troca", "fks": [
                        "cliente_id → terceiro.id · pedido_origem_id → pedido_venda.id",
                    ]},
                ],
            },
        ],
    },
    {
        "menu": "Vendas",
        "desc": "Pós-venda, entregas, perdas, painel gerencial.",
        "pages": [
            {
                "nome": "VendasGestao",
                "rota": "/VendasGestao",
                "feature": "pages/VendasGestao.jsx",
                "components": ["DetalhesPedidoVenda · AlterarPagamentoDialog · ValesTrocaTab · ConsultaVendasCaixa"],
                "regras": ["Lista virtualizada; filtros por período e status"],
                "funcoes": [{"nome": "savePedidoVendaItem", "async": False, "nota": "Edição de linhas em pedidos abertos"}],
                "tabelas": [{"nome": "pedido_venda / pedido_venda_item", "fks": [
                    "pedido_venda.cliente_id → terceiro.id (FK)",
                    "pedido_venda_item.pedido_venda_id → pedido_venda.id (lógico)",
                ]}],
            },
            {
                "nome": "ControleEntregas",
                "rota": "/ControleEntregas",
                "feature": "pages/ControleEntregas.jsx → LiberacaoEntrega",
                "components": ["LiberacaoEntrega"],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "agenda_logistica", "fks": [
                    "pedido_venda_id → pedido_venda.id (FK CASCADE)",
                    "cliente_id → terceiro.id (FK RESTRICT)",
                    "motorista_id → usuario.id (lógico)",
                ]}],
            },
            {
                "nome": "VendasPerdidas",
                "rota": "/VendasPerdidas",
                "feature": "inline page",
                "components": ["tabs + VendaPerdida entity"],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "venda_perdida", "fks": ["produto_id → produto.id (lógico)"]}],
            },
        ],
    },
    {
        "menu": "Produtos",
        "desc": "Catálogo, precificação, ABCD/IEP, grade de compra.",
        "pages": [
            {
                "nome": "Produtos",
                "rota": "/Produtos",
                "feature": "pages/Produtos.jsx",
                "components": ["TreeGrid · MobileHierarquica · ProdutoFormCompleto · ProdutoFAB"],
                "regras": [
                    "Termômetro precificação mobile: margem verde ≥30%, amarelo >0<30%, vermelho ≤0% (MobileHierarquica.jsx)",
                    "Markup semáforo: verde ≥40%, amarelo >0<40% — meta Preço Justo GLOBAL_MARKUP_ALVO=40% (precoJustoCalculos.js)",
                    "ABCD ao vivo: pareto A≤70% B≤85% C≤95% D resto, E=sem venda; iep_trava_manual preserva classe",
                    "Margem contribuição = (preco−custo)/preco×100 (productUnits.js)",
                ],
                "funcoes": [
                    {"nome": "calcularIEP", "async": True, "nota": "Job batch 50 SKUs; fases preparar→classificar→gravar; só noturno se ABCD_JOB_NOTURNO"},
                    {"nome": "atualizarMetasEstoque", "async": True, "nota": "Recalcula ponto de pedido (janela 60d vendas)"},
                    {"nome": "importarProdutos", "async": True, "nota": "Bulk XLS/CSV + ImportacaoLog para undo"},
                ],
                "tabelas": [
                    {"nome": "produto", "fks": [
                        "categoria_id → categoria_produto.id (lógico)",
                        "area_id → area.id (lógico)",
                        "fornecedor_padrao_id → terceiro.id (lógico)",
                    ]},
                    {"nome": "movimentacao_estoque", "fks": [
                        "produto_id → produto.id (FK RESTRICT)",
                        "referencia_id → polimórfico (pedido_venda, pedido_compra, consumo_interno)",
                    ]},
                    {"nome": "tabela_preco", "fks": []},
                ],
            },
            {
                "nome": "HierarquiaPortal",
                "rota": "/HierarquiaPortal",
                "feature": "hierarquia-portal/* + CadastroProdutoV2",
                "components": ["PortalTreeGrid · PortalSmartSupplyPanel · CadastroProdutoV2Form"],
                "regras": ["Grade cerâmica: linha_compra → produto_compra → eixo_valor"],
                "funcoes": [],
                "tabelas": [
                    {"nome": "portal_catalog", "fks": ["produto_id → produto.id (texto)"]},
                    {"nome": "linha_compra → produto_compra → eixo_valor", "fks": [
                        "produto_compra.linha_id → linha_compra.id (FK)",
                        "eixo_valor → linha_compra ou produto_compra (FK)",
                    ]},
                ],
            },
        ],
    },
    {
        "menu": "Compras",
        "desc": "Smart Supply, cotações, POs, conferência cega, logística fluvial.",
        "pages": [
            {
                "nome": "SugestoesCompra",
                "rota": "/SugestoesCompra",
                "feature": "components/compras/SugestaoCompra.jsx",
                "components": ["SugestaoCompraTreeGrid · SugestaoCompraMobileCatalog"],
                "regras": ["Filtro curva ABCD; qty sugerida por meta estoque"],
                "funcoes": [{"nome": "atualizarMetasEstoque", "async": True, "nota": "Job background ponto de pedido"}],
                "tabelas": [{"nome": "produto / pedido_compra", "fks": []}],
            },
            {
                "nome": "PedidosCompra",
                "rota": "/PedidosCompra",
                "feature": "pages/PedidosCompra.jsx",
                "components": ["ListaPedidosCompra · ConsultaComprasPedidos · ImportadorNotaFiscal · ActionMenuComprasV2"],
                "regras": [
                    "isLocked quando status/aprovacao ∈ {Aguardando Aprovação, Aprovado*, Rejeitado*}",
                    "Envio financeiro cria LF is_custo_mercadoria:true; bloqueia reenvio se parcela paga",
                    "Trigger DB: status=Aprovado → status_aprovacao_financeira=Aprovado automaticamente",
                    "Reabertura bloqueada se manifesto_entrada_id preenchido (trigger 024)",
                ],
                "funcoes": [
                    {"nome": "savePedidoCompraItem", "async": False, "nota": "qty_base=fator×qty; custo líquido; recomputa valor_total PO"},
                    {"nome": "recalcular-conclusao-pedido-compra", "async": True, "nota": "Recalcula estoque de todos SKUs do PO concluído"},
                    {"nome": "automacaoAprovacaoFinanceira", "async": True, "nota": "Trigger entity PedidoCompra update"},
                ],
                "tabelas": [
                    {"nome": "pedido_compra", "fks": [
                        "fornecedor_id → terceiro.id (FK RESTRICT)",
                        "conta_pagamento_id → contas_financeiras.id (FK SET NULL)",
                        "conferencia_id → conferencia_compra.id (lógico)",
                        "manifesto_entrada_id → manifesto_entrada.id (lógico)",
                    ]},
                    {"nome": "pedido_compra_item", "fks": [
                        "pedido_compra_id → pedido_compra.id (lógico)",
                        "produto_id → produto.id (lógico)",
                    ]},
                    {"nome": "lancamento_financeiro", "fks": [
                        "pedido_compra_vinculado_id → pedido_compra.id (lógico)",
                    ]},
                ],
            },
            {
                "nome": "PedidoCompraDetalhe",
                "rota": "/PedidoCompraDetalhe?id=",
                "feature": "components/compras/PedidoCompraForm.jsx",
                "components": ["InformarEmbarque · RecepcionarEmbarque · PedidoCompraFAB"],
                "regras": ["PIN save só se VITE_PEDIDO_COMPRA_SAVE_AUTH_PIN + status Aguardando Aprovação"],
                "funcoes": [
                    {"nome": "saveEmbarqueItem", "async": False, "nota": "Linhas embarque ↔ pedido_compra_item"},
                    {"nome": "gerarRelatorioPedido/Precificacao/Pendencias", "async": False, "nota": "PDF server-side"},
                ],
                "tabelas": [{"nome": "embarque", "fks": [
                    "pedido_compra_id → pedido_compra.id (FK CASCADE)",
                    "fornecedor_id → terceiro.id (FK SET NULL)",
                    "transportadora_id → transportadora.id (lógico)",
                ]}],
            },
            {
                "nome": "ConferenciaEntrada",
                "rota": "/ConferenciaEntrada",
                "feature": "PainelConferencias + GestaoCodigosConferencia",
                "components": ["validateConferenceCode · generateConferenceCode"],
                "regras": [
                    "Código conferência: só admin/Gerente; 8 chars; status Gerado→Em Uso→Concluído/Expirado",
                    "Finalização volumes permite divergências; itens exige lote se controla_lote",
                ],
                "funcoes": [
                    {"nome": "generateConferenceCode", "async": False, "nota": "Supermanifesto ou ManifestoEntrada"},
                    {"nome": "validateConferenceCode", "async": False, "nota": "Bloqueia Expirado/Concluído"},
                    {"nome": "saveConferenciaItem", "async": False, "nota": "divergencia_base = contada − sistema"},
                ],
                "tabelas": [
                    {"nome": "supermanifesto / manifesto_entrada", "fks": ["supermanifesto_id lógico em embarque"]},
                    {"nome": "conferencia_compra", "fks": ["pedido_compra_id → pedido_compra.id (lógico)"]},
                ],
            },
            {
                "nome": "ItinerarioFluvial",
                "rota": "/ItinerarioFluvial",
                "feature": "logistica-sandbox/*",
                "components": ["TimelineDayGroup · FreteResumoCard"],
                "regras": [],
                "funcoes": [
                    {"nome": "sincronizarViagensTransportadora", "async": True, "nota": "Sync sandbox por transportadora"},
                    {"nome": "atualizarViagensTransportadoras", "async": True, "nota": "Cron dia 1 do mês"},
                ],
                "tabelas": [{"nome": "evento_logistico_sandbox", "fks": [
                    "transportadora_id → transportadora.id (lógico)",
                ]}],
            },
        ],
    },
    {
        "menu": "Estoque",
        "desc": "Contagem, movimentos, conferência, armazenagem, separação.",
        "pages": [
            {
                "nome": "ContagemExpress",
                "rota": "/ContagemExpress",
                "feature": "estoque/contagem-express/*",
                "components": ["ContagemExpressCarrinho · ContagemExpressPainelContagem"],
                "regras": ["Confirmação com PIN; cria conferencia_estoque"],
                "funcoes": [{"nome": "saveConferenciaItem", "async": False, "nota": "Linhas canónicas conferência"}],
                "tabelas": [{"nome": "conferencia_estoque", "fks": [
                    "responsavel_id → usuario.id (lógico); itens_conferidos[].produto_id → produto",
                ]}],
            },
            {
                "nome": "MovimentosInventario",
                "rota": "/MovimentosInventario",
                "feature": "inline page",
                "components": ["productMatchingUtils · productUnits"],
                "regras": [
                    "estoque_atual = Σ Entradas − Σ Saídas − avariado; negativo permitido desde mig.038",
                ],
                "funcoes": [],
                "async_bg": [
                    "trigger recalcular_estoque_produto AFTER INSERT/UPDATE/DELETE em movimentacao_estoque",
                ],
                "tabelas": [{"nome": "movimentacao_estoque", "fks": [
                    "produto_id → produto.id (FK RESTRICT)",
                ]}],
            },
            {
                "nome": "ConferenciaEstoque / Editor",
                "rota": "/ConferenciaEstoque · /ConferenciaEditor?id=",
                "feature": "estoque/auditoria/*",
                "components": ["NovaConferenciaDialog · ConferenciaEditor"],
                "regras": ["Ajuste aplica movimentação compensatória"],
                "funcoes": [{"nome": "saveConferenciaItem", "async": False, "nota": "Espelho canónico itens"}],
                "tabelas": [{"nome": "conferencia_estoque", "fks": []}],
            },
            {
                "nome": "ImportacaoProdutos",
                "rota": "/ImportacaoProdutos",
                "feature": "produtos/massa/*",
                "components": ["ImportarPlanilha · ImportarEstoque · ImportarEmbalagensPlanilha"],
                "regras": ["ImportacaoLog guarda snapshot para undo"],
                "funcoes": [{"nome": "importarProdutos", "async": True, "nota": "Bulk + log"}],
                "tabelas": [{"nome": "importacao_log", "fks": []}],
            },
        ],
    },
    {
        "menu": "Financeiro",
        "desc": "Fluxo, AGEFIN, planejamento, aprovações. Gate senha VITE_FINANCEIRO_GATE_PASSWORD (15 min).",
        "pages": [
            {
                "nome": "FluxoCaixa",
                "rota": "/FluxoCaixa",
                "feature": "financeiro/ExecucaoOrcamentaria.jsx",
                "components": ["ListaLancamentos · FiltrosFluxoCaixa · ConciliacaoBancaria · NovoLancamentoDialog"],
                "regras": ["Filtros: tipo, conta, status, CMV-only, conciliação pendente"],
                "funcoes": [{"nome": "gerarExtratoFluxoCaixa", "async": False, "nota": "PDF extrato"}],
                "tabelas": [{"nome": "lancamento_financeiro", "fks": [
                    "conta_financeira_id → contas_financeiras.id (FK)",
                    "terceiro_id → terceiro.id (lógico)",
                    "categoria_id → categoria_financeira.id (lógico)",
                    "grupo_lancamento_id → lancamento_financeiro.id (self-ref)",
                ]}],
            },
            {
                "nome": "SuperAgefin",
                "rota": "/SuperAgefin",
                "feature": "pages/SuperAgefin.jsx",
                "components": ["SuperAgefinConsultaDrawer · SuperAgefinConsultaOrganizer"],
                "regras": [
                    "Compromissos sintéticos: sócios=sábados do mês; folha=dia 05",
                    "ContaPrevista Pago → trigger cria lancamento_financeiro",
                ],
                "funcoes": [
                    {"nome": "cancelarLancamentoFinanceiro", "async": False, "nota": "Cancela LF + reverte saldo conta"},
                ],
                "async_bg": [
                    "gerarContasPrevistasRecorrentes — cron dia 1 06:00 Rio Branco",
                    "gerarLancamentosCartao — cron diário 05:00",
                    "processarLiquidacaoCartaoCredito — cron 08:00",
                    "atualizarStatusLancamentos — vencidos automático",
                ],
                "tabelas": [
                    {"nome": "conta_recorrente", "fks": [
                        "terceiro_id → terceiro.id (FK RESTRICT)",
                        "categoria_financeira_id → categoria_financeira.id (FK RESTRICT)",
                    ]},
                    {"nome": "conta_prevista", "fks": [
                        "conta_recorrente_id → conta_recorrente.id (FK SET NULL)",
                        "terceiro_id → terceiro.id (FK RESTRICT)",
                    ]},
                ],
            },
            {
                "nome": "AprovacoesFinanceiras",
                "rota": "/AprovacoesFinanceiras",
                "feature": "inline + aprovarPedidoCompraFinanceiro.js",
                "components": [],
                "regras": [
                    "Aprovar: status→Aguardando Recepção; LF is_custo_mercadoria mantidos",
                    "Rejeitar: status→Cancelado; cancela LF Em Aberto/Vencido",
                    "Lista: status ou status_aprovacao = Aguardando Aprovação Financeira",
                ],
                "funcoes": [{"nome": "repararLancamentosPedidosAprovados", "async": True, "nota": "Admin backfill LF"}],
                "tabelas": [{"nome": "pedido_compra + lancamento_financeiro", "fks": [
                    "pedido_compra_vinculado_id → pedido_compra.id",
                ]}],
            },
            {
                "nome": "PlanejamentoFinanceiro / Budgets",
                "rota": "/PlanejamentoFinanceiro · /Budgets",
                "feature": "features/planejamento-financeiro-v2 · budget-previsao/*",
                "components": ["ContasFixasTab · BudgetPlanoCompleto"],
                "regras": [],
                "funcoes": [],
                "tabelas": [
                    {"nome": "budget_modelo / budget_competencia", "fks": []},
                    {"nome": "folha_previsao_modelo / folha_previsao_competencia", "fks": []},
                ],
            },
            {
                "nome": "CaixasAtivos / TurnosFechados",
                "rota": "/CaixasAtivos · /TurnosFechados",
                "feature": "vendas/caixa/VisualizadorCaixa.jsx",
                "components": ["CaixaValorDisplay · ConsumoDetalheDialog"],
                "regras": [],
                "funcoes": [],
                "tabelas": [{"nome": "turno_caixa / movimentos_caixa", "fks": [
                    "movimentos_caixa.turno_caixa_id → turno_caixa.id (FK)",
                ]}],
            },
        ],
    },
    {
        "menu": "Relatórios",
        "desc": "Hub gerencial; mix server PDF + client PDF.",
        "pages": [
            {
                "nome": "Relatorios",
                "rota": "/Relatorios",
                "feature": "pages/Relatorios.jsx",
                "components": ["abas Gerencial·Vendas·Compras·Estoque"],
                "regras": ["Margem: pedidos não Cancelados + STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA"],
                "funcoes": [
                    {"nome": "gerarRelatorioPedidosCompra", "async": False, "nota": "Server PDF (V1)"},
                    {"nome": "gerarRelatorioMargem", "async": False, "nota": "Disponível server; UI usa client PDF"},
                ],
                "tabelas": [{"nome": "pedido_venda / pedido_compra / produto", "fks": []}],
            },
        ],
    },
    {
        "menu": "Configurações",
        "desc": "Admin: perfis, parâmetros, ferramentas perigosas.",
        "pages": [
            {
                "nome": "Configuracoes",
                "rota": "/Configuracoes",
                "feature": "pages/Configuracoes.jsx",
                "components": ["UsuariosManager · PerfisDeAcessoManager · AbcdConfigTool · MetasEstoqueConfigTool"],
                "regras": ["adminOnly no menu; perfilTemEscopoTotal bypass"],
                "funcoes": [
                    {"nome": "zerarEntidade", "async": True, "nota": "⚠ wipe entity — RecomecarDoZero"},
                    {"nome": "p38-auth", "async": False, "nota": "CRUD usuario + Supabase Auth"},
                ],
                "tabelas": [
                    {"nome": "usuario", "fks": ["perfil_acesso_id → perfil_de_acesso.id (lógico)", "empresa_id → empresa.id (FK)"]},
                    {"nome": "perfil_de_acesso", "fks": []},
                ],
            },
        ],
    },
]

HUB_TABLES = [
    ("terceiro", "Hub CRM", "cliente_id/fornecedor_id em vendas, compras, financeiro, agenda"),
    ("produto", "Hub catálogo", "movimentacao_estoque.produto_id FK RESTRICT; linhas PO/PV lógicas"),
    ("pedido_venda", "Hub vendas", "cliente_id FK; turno_caixa_id lógico; origem PDV RPC"),
    ("pedido_compra", "Hub compras", "fornecedor_id FK RESTRICT; embarque CASCADE; LF custo mercadoria"),
    ("lancamento_financeiro", "Hub financeiro", "conta_financeira_id FK; referencia polimórfica"),
    ("turno_caixa", "Hub sessão caixa", "movimentos_caixa.turno_caixa_id FK; pedidos do turno"),
]


def esc(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def render_zone(zone: dict) -> list:
    flow = []
    flow.append(Paragraph(f"<b>{esc(zone['menu'])}</b>", STYLES["zone"]))
    flow.append(Paragraph(esc(zone["desc"]), STYLES["zone_desc"]))

    for page in zone["pages"]:
        rota = page.get("rota", "")
        feat = page.get("feature", "")
        flow.append(
            Paragraph(
                f"● <b>{esc(page['nome'])}</b>  <font color='#6B7280'>{esc(rota)}</font>",
                STYLES["page"],
            )
        )
        if feat:
            flow.append(Paragraph(f"feature: {esc(feat)}", STYLES["meta"]))

        for comp in page.get("components", []):
            flow.append(Paragraph(f"● {esc(comp)}", STYLES["comp"]))

        for regra in page.get("regras", []):
            flow.append(Paragraph(f"▲ {esc(regra)}", STYLES["biz"]))

        for fn in page.get("funcoes", []):
            tag = "⟳ async" if fn.get("async") else "sync"
            flow.append(
                Paragraph(
                    f"◆ <b>{esc(fn['nome'])}</b> <font color='#6B7280'>[{tag}]</font> — {esc(fn.get('nota', ''))}",
                    STYLES["fn"],
                )
            )

        for bg in page.get("async_bg", []):
            flow.append(Paragraph(f"⟳ {esc(bg)}", STYLES["async"]))

        for tbl in page.get("tabelas", []):
            fks = tbl.get("fks", [])
            fk_txt = ""
            if fks:
                fk_txt = "<br/>".join(f"&nbsp;&nbsp;↳ {esc(f)}" for f in fks)
            flow.append(
                Paragraph(
                    f"■ <b>{esc(tbl['nome'])}</b>{('<br/>' + fk_txt) if fk_txt else ''}",
                    STYLES["db"],
                )
            )

    flow.append(Spacer(1, 3 * mm))
    return flow


def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.25)
    canvas.line(1.5 * cm, h - 1.2 * cm, w - 1.5 * cm, h - 1.2 * cm)
    canvas.setFont("Helvetica", 6.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(1.5 * cm, h - 1.0 * cm, "P38 Parts Catalog · UI First · System Design")
    canvas.drawRightString(w - 1.5 * cm, h - 1.0 * cm, f"{doc.page}")
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
        title="P38 Parts Catalog UI First",
    )
    frame = Frame(1.5 * cm, 1.2 * cm, w - 3 * cm, h - 2.7 * cm, id="main")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    story = []

    # Capa compacta
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph("P38 Parts Catalog", STYLES["cover_title"]))
    story.append(Paragraph("UI First · System Design Map", STYLES["cover_title"]))
    story.append(Spacer(1, 0.8 * cm))
    story.append(
        Paragraph(
            "Árvore hierárquica: Módulo → Página → Componente → Função → Tabela (+ FKs, regras, async).<br/>"
            f"Gerado {date.today().strftime('%d/%m/%Y')} · extraído do código P38-ERP · sem snippets de código.",
            STYLES["cover_sub"],
        )
    )
    story.append(Spacer(1, 1.2 * cm))
    story.append(Paragraph("<b>Legenda</b>", STYLES["cover_sub"]))
    for line in [
        "● UI — página ou componente React",
        "◆ FN — Edge/Base44 (sync = bloqueia UI; ⟳ = background/cron/trigger)",
        "■ DB — Postgres/Supabase; ↳ = FK DB ou lógica",
        "▲ Regra de negócio crítica",
    ]:
        story.append(Paragraph(line, STYLES["cover_sub"]))

    story.append(PageBreak())

    # Índice compacto
    story.append(Paragraph("<b>Índice de módulos</b>", STYLES["zone"]))
    story.append(Spacer(1, 2 * mm))
    for i, z in enumerate(CATALOG, 1):
        pages = ", ".join(p["nome"] for p in z["pages"])
        story.append(Paragraph(f"{i}. <b>{esc(z['menu'])}</b> — {esc(pages)}", STYLES["meta"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("<b>Tabelas-hub (correntes entre módulos)</b>", STYLES["zone"]))
    for name, role, links in HUB_TABLES:
        story.append(Paragraph(f"■ <b>{esc(name)}</b> ({esc(role)}) — {esc(links)}", STYLES["db"]))
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "<b>Modelo de pedido ao agente:</b> «No módulo <i>Compras → PedidosCompra</i>, ao aprovar PO, "
            "o LF em lancamento_financeiro (pedido_compra_vinculado_id) não aparece em Aprovações.»",
            STYLES["meta"],
        )
    )

    story.append(PageBreak())

    # Zonas — 2 módulos por página quando possível (denso)
    for i, zone in enumerate(CATALOG):
        story.extend(render_zone(zone))
        # page break a cada 2 módulos grandes, exceto último
        if i % 2 == 1 and i < len(CATALOG) - 1:
            story.append(PageBreak())

    # Apêndice: integridade relacional
    story.append(PageBreak())
    story.append(Paragraph("<b>Apêndice A — FKs DB-enforced (Postgres)</b>", STYLES["zone"]))
    enforced = [
        "pedido_venda.cliente_id → terceiro.id (SET NULL)",
        "pedido_compra.fornecedor_id → terceiro.id (RESTRICT)",
        "pedido_compra.conta_pagamento_id → contas_financeiras.id (SET NULL)",
        "embarque.pedido_compra_id → pedido_compra.id (CASCADE)",
        "movimentacao_estoque.produto_id → produto.id (RESTRICT)",
        "lancamento_financeiro.conta_financeira_id → contas_financeiras.id (SET NULL)",
        "movimentos_caixa.conta_id → contas_financeiras.id (RESTRICT)",
        "movimentos_caixa.turno_caixa_id → turno_caixa.id (SET NULL)",
        "conta_recorrente → terceiro + categoria_financeira (RESTRICT)",
        "conta_prevista → terceiro + categoria_financeira + conta_recorrente",
        "agenda_logistica.pedido_venda_id → pedido_venda.id (CASCADE)",
        "agenda_logistica.cliente_id → terceiro.id (RESTRICT)",
        "linha_compra ← produto_compra ← eixo_valor (grade catálogo)",
    ]
    for line in enforced:
        story.append(Paragraph(f"↳ {esc(line)}", STYLES["db"]))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("<b>Apêndice B — Jobs & triggers (não bloqueiam UI)</b>", STYLES["zone"]))
    jobs = [
        "sincronizarEstoquePorMovimentacao — trigger movimentacao_estoque",
        "automacaoAprovacaoFinanceira — trigger pedido_compra.status",
        "gerarContasPrevistasRecorrentes — cron dia 1",
        "gerarLancamentosCartao + processarLiquidacaoCartaoCredito — cron diário",
        "calcularIEP — batch noturno (ABCD_JOB_NOTURNO)",
        "atualizarViagensTransportadoras — cron mensal",
        "exportFlareToGithub — trigger TargetFlare",
    ]
    for line in jobs:
        story.append(Paragraph(f"⟳ {esc(line)}", STYLES["async"]))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("<b>Apêndice C — Linhas canónicas sem FK DB</b>", STYLES["zone"]))
    story.append(
        Paragraph(
            "pedido_venda_item, pedido_compra_item, embarque_item — integridade via save*Item handlers "
            "(replaceAll, recompute totals). Base44 legacy: IDs text, maioria das relações lógicas.",
            STYLES["meta"],
        )
    )

    doc.build(story)
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
