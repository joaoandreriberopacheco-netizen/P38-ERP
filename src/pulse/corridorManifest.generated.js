// Auto-gerado por scripts/generate-pulse-sensors-geral.mjs — não editar à mão.
export const PULSE_CORRIDOR = {
  "version": "1.0",
  "description": "Corredor vertical Pulso — estações e sacas de cartas (auto-gerado).",
  "stations": [
    {
      "pageName": "Home",
      "route": "/",
      "label": "Home (pós-login)",
      "module": null,
      "letters": [
        {
          "id": "Home.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "home.personalizar",
          "label": "Personalizar atalhos",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Compras",
      "route": "/Compras",
      "label": "Compras",
      "module": null,
      "letters": [
        {
          "id": "Compras.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "compras.tab-sugestoes",
          "label": "Aba sugestões",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "PedidosCompra",
      "route": "/PedidosCompra",
      "label": "Pedidos de compra",
      "module": null,
      "letters": [
        {
          "id": "PedidosCompra.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "pedidos-compra.tab-embarques",
          "label": "Aba embarques",
          "type": "presence"
        },
        {
          "id": "pedidos-compra.tab-consulta",
          "label": "Aba consulta",
          "type": "click"
        },
        {
          "id": "pedidos-compra.novo-pedido",
          "label": "FAB novo pedido",
          "type": "click"
        }
      ]
    },
    {
      "pageName": "Estoque",
      "route": "/Estoque",
      "label": "Estoque",
      "module": null,
      "letters": [
        {
          "id": "Estoque.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "estoque.link-contagem",
          "label": "Atalho contagem express",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Configuracoes",
      "route": "/Configuracoes",
      "label": "Configurações",
      "module": null,
      "letters": [
        {
          "id": "Configuracoes.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "configuracoes.tab-vendas",
          "label": "Aba vendas",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "PlanejamentoFinanceiro",
      "route": "/PlanejamentoFinanceiro",
      "label": "Planejamento financeiro",
      "module": null,
      "letters": [
        {
          "id": "PlanejamentoFinanceiro.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "planejamento-financeiro.tab-contas",
          "label": "Aba contas",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "PDVVendedor",
      "route": "/PDVVendedor",
      "label": "PDV Vendedor",
      "module": "vendas",
      "letters": [
        {
          "id": "PDVVendedor.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "pdv.busca-produto",
          "label": "Busca produto",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "PDVCaixa",
      "route": "/PDVCaixa",
      "label": "PDV Caixa",
      "module": "vendas",
      "letters": [
        {
          "id": "PDVCaixa.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "pdv-caixa.titulo",
          "label": "Título caixa",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "AutoAtendimento",
      "route": "/AutoAtendimento",
      "label": "Auto-atendimento",
      "module": "vendas",
      "letters": [
        {
          "id": "AutoAtendimento.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "auto-atendimento.iniciar",
          "label": "Iniciar",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "TurnosFechados",
      "route": "/TurnosFechados",
      "label": "Turnos fechados",
      "module": "vendas",
      "letters": [
        {
          "id": "TurnosFechados.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "turnos-fechados.busca",
          "label": "Busca",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "VendasGestao",
      "route": "/VendasGestao",
      "label": "Gestão de vendas",
      "module": "vendas",
      "letters": [
        {
          "id": "VendasGestao.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "vendas-gestao.busca",
          "label": "Busca",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "VendasPerdidas",
      "route": "/VendasPerdidas",
      "label": "Vendas perdidas",
      "module": "vendas",
      "letters": [
        {
          "id": "VendasPerdidas.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "vendas-perdidas.tab-mix",
          "label": "Aba mix",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "ControleEntregas",
      "route": "/ControleEntregas",
      "label": "Controle de entregas",
      "module": "vendas",
      "letters": [
        {
          "id": "ControleEntregas.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "controle-entregas.busca-cliente",
          "label": "Busca cliente",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "DevolucaoTroca",
      "route": "/DevolucaoTroca",
      "label": "Devolução e troca",
      "module": "vendas",
      "letters": [
        {
          "id": "DevolucaoTroca.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "devolucao-troca.busca-pedido",
          "label": "Busca pedido",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "SugestoesCompra",
      "route": "/SugestoesCompra",
      "label": "Sugestões de compra",
      "module": "logistica",
      "letters": [
        {
          "id": "SugestoesCompra.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "sugestoes-compra.busca",
          "label": "Busca",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Cotacoes",
      "route": "/Cotacoes",
      "label": "Cotações",
      "module": "logistica",
      "letters": [
        {
          "id": "Cotacoes.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "cotacoes.busca",
          "label": "Busca",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "ConferenciaEntrada",
      "route": "/ConferenciaEntrada",
      "label": "Conferência de entrada",
      "module": "logistica",
      "letters": [
        {
          "id": "ConferenciaEntrada.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "conferencia-entrada.tab-codigos",
          "label": "Aba códigos",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "ConferenciaEstoque",
      "route": "/ConferenciaEstoque",
      "label": "Conferência de estoque",
      "module": "logistica",
      "letters": [
        {
          "id": "ConferenciaEstoque.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "conferencia-estoque.nova",
          "label": "Nova conferência",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Armazenagem",
      "route": "/Armazenagem",
      "label": "Armazenagem",
      "module": "logistica",
      "letters": [
        {
          "id": "Armazenagem.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "armazenagem.tab-separacao",
          "label": "Aba separação",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "InterfaceSeparador",
      "route": "/InterfaceSeparador",
      "label": "Interface separador",
      "module": "logistica",
      "letters": [
        {
          "id": "InterfaceSeparador.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "interface-separador.codigo-pedido",
          "label": "Código pedido",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "ItinerarioFluvial",
      "route": "/ItinerarioFluvial",
      "label": "Itinerário fluvial",
      "module": "logistica",
      "letters": [
        {
          "id": "ItinerarioFluvial.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "itinerario-fluvial.modo-fluvial",
          "label": "Modo fluvial",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Expedicao",
      "route": "/Expedicao",
      "label": "Expedição",
      "module": "logistica",
      "letters": [
        {
          "id": "Expedicao.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "expedicao.titulo",
          "label": "Título expedição",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "ImportacaoProdutos",
      "route": "/ImportacaoProdutos",
      "label": "Importação de produtos",
      "module": "logistica",
      "letters": [
        {
          "id": "ImportacaoProdutos.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "importacao-produtos.tab-produtos",
          "label": "Aba produtos",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "FluxoCaixa",
      "route": "/FluxoCaixa",
      "label": "Fluxo de caixa",
      "module": "financeiro",
      "letters": [
        {
          "id": "FluxoCaixa.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "fluxo-caixa.titulo",
          "label": "Título financeiro",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "ContasFinanceiras",
      "route": "/ContasFinanceiras",
      "label": "Contas financeiras",
      "module": "financeiro",
      "letters": [
        {
          "id": "ContasFinanceiras.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "contas-financeiras.busca",
          "label": "Busca",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "AprovacoesFinanceiras",
      "route": "/AprovacoesFinanceiras",
      "label": "Aprovações financeiras",
      "module": "financeiro",
      "letters": [
        {
          "id": "AprovacoesFinanceiras.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "aprovacoes-financeiras.aprovar-lote",
          "label": "Aprovar lote",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "CaixasAtivos",
      "route": "/CaixasAtivos",
      "label": "Caixas ativos",
      "module": "financeiro",
      "letters": [
        {
          "id": "CaixasAtivos.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "caixas-ativos.atualizar",
          "label": "Atualizar",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "ExtratoConta",
      "route": "/ExtratoConta",
      "label": "Extrato de conta",
      "module": "financeiro",
      "letters": [
        {
          "id": "ExtratoConta.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "extrato-conta.voltar",
          "label": "Voltar (sem conta)",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Dashboard",
      "route": "/Dashboard",
      "label": "Dashboard",
      "module": "gestao",
      "letters": [
        {
          "id": "Dashboard.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "dashboard.tab-geral",
          "label": "Aba geral",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "PainelGerente",
      "route": "/PainelGerente",
      "label": "Painel gerente",
      "module": "gestao",
      "letters": [
        {
          "id": "PainelGerente.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "painel-gerente.busca-cliente",
          "label": "Busca cliente",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Produtos",
      "route": "/Produtos",
      "label": "Produtos",
      "module": "gestao",
      "letters": [
        {
          "id": "Produtos.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "produtos.busca",
          "label": "Busca catálogo",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "Relatorios",
      "route": "/Relatorios",
      "label": "Relatórios",
      "module": "gestao",
      "letters": [
        {
          "id": "Relatorios.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "relatorios.tab-vendas",
          "label": "Aba vendas",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "RelatorioMargem",
      "route": "/RelatorioMargem",
      "label": "Relatório de margem",
      "module": "gestao",
      "letters": [
        {
          "id": "RelatorioMargem.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "relatorio-margem.busca",
          "label": "Busca",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "RelatorioPerformance",
      "route": "/RelatorioPerformance",
      "label": "Relatório de performance",
      "module": "gestao",
      "letters": [
        {
          "id": "RelatorioPerformance.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "relatorio-performance.pdf",
          "label": "Exportar PDF",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "PDV",
      "route": "/PDV?mode=vendedor",
      "label": "PDV vendedor",
      "module": null,
      "letters": [
        {
          "id": "PDV.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "pdv.busca-produto",
          "label": "Busca produto",
          "type": "presence"
        },
        {
          "id": "pdv.scanner-codigo",
          "label": "Scanner",
          "type": "presence"
        }
      ]
    },
    {
      "pageName": "SuperAgefin",
      "route": "/SuperAgefin",
      "label": "SuperAgefin (destino Agefin)",
      "module": "financeiro",
      "letters": [
        {
          "id": "SuperAgefin.shell",
          "label": "Shell página",
          "type": "attached"
        },
        {
          "id": "agefin.titulo",
          "label": "Título Agefin",
          "type": "presence"
        }
      ]
    }
  ]
};
