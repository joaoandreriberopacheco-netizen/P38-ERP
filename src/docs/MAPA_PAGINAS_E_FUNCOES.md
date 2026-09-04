# Mapa de páginas e funcionalidades (P38 / VarejoSync)

Referência rápida para localizar rotas, ecrãs e o que o menu expõe. Atualizar quando surgirem páginas novas em `src/pages/` (registo em `pages.config.js`) ou rotas extra em `App.jsx`.

## Navegação principal (menu lateral / mobile)

Definição em `src/components/config/usePermissoesResolvidas.jsx` (`ALL_MENU_ITEMS`). Permissões filtram o que cada perfil vê.

| Secção        | Destinos (página React) |
|---------------|-------------------------|
| Início        | `Home` |
| Dashboard     | `Dashboard`, `PainelGerente` |
| PDV           | `PDVVendedor`, `PDV` (query `?mode=supermercado`), `AutoAtendimento` |
| Caixa         | `PDVCaixa` |
| Vendas        | `VendasGestao`, `VendasPerdidas`, `ControleEntregas`, `PainelGerente` |
| Produtos      | `Produtos` |
| Compras       | `SugestoesCompra`, `Cotacoes`, `PedidosCompra`, `ConferenciaEntrada`, `ItinerarioFluvial` |
| Estoque       | `ConferenciaEstoque`, `AuditoriaEstoque`, `Armazenagem`, `InterfaceSeparador`, `TabelaPrecosConsulta`, `ImportacaoProdutos` |
| Consumo interno | `ConsumoInterno` |
| Financeiro    | `FluxoCaixa`, `ContasFinanceiras`, `AprovacoesFinanceiras`, `CaixasAtivos`, `TurnosFechados`, `Agefin` |
| Relatórios    | `Relatorios` |
| Configurações | `Configuracoes` (admin / permissão) |

## Páginas registadas em `pages.config.js` (`PAGES`)

Cada chave corresponde à rota `/<Chave>` (ex.: `/Financeiro`).

- **Operação / vendas:** `Agefin`, `AnexoCompartilhado`, `Armazenagem`, `AtualizarBoletoRecorrente`, `AuditoriaEstoque`, `AuditoriaEstoqueV2`, `AutoAtendimento`, `CaixasAtivos`, `Campanhas`, `Compras`, `Configuracoes`, `ContasFinanceiras`, `ControleCaixasAtivos`, `ControleEntregas`, `Dashboard`, `DashboardCaixa`, `DashboardVendedor`, `DevolucaoTroca`, `DiscriminarVolumes`, `EdicaoMassivaCustos`, `EditarProdutosEmMassa`, `EstimativaEmbalagensIA`, `Estoque`, `ExclusaoDocumentos`, `Expedicao`, `ExtratoConta`, `Financeiro`, `FinanceiroAprovacoes`, `FinanceiroModulo`, `FluxoCaixa`, `Home`, `HubLogistico`, `ImportacaoProdutos`, `InterfaceSeparador`, `Intervenientes`, `LogsAutenticacao`, `LancamentoAnexos`, `Manual`, `MapaFuncionalidades`, `Operacoes`, `OtimizacaoEstoqueIA`, `PDV`, `PDVAuditoria`, `PainelGerente`, `Produtos`, `ReimpressaoDocumentos`, `RelatorioMargem`, `RelatorioPerformance`, `Relatorios`, `TabelasPreco`, `Terceiros`, `TurnosFechados`, `Veiculos`, `Vendas`, `VendasGestao`, `VendasPerdidas`
- **Conferência / logística (ficheiros em `pages/`):** `ConferenciaEditor`, `ConferenciaEntrada`, `ConferenciaEstoque`, `ConferenciaItens`, `ConferenciaVolumes`

**Landing:** `mainPage` em `pages.config.js` (atualmente `Dashboard`).

## Rotas adicionais só em `App.jsx`

Não duplicadas em `PAGES` ou com path dedicado: `Notificacoes`, `ReimpressaoDocumentos`, `PDVCaixa`, `PDVVendedor`, `CaixasAtivos`, `SugestoesCompra`, `Cotacoes`, `PedidosCompra`, `AprovacoesFinanceiras`, `TemplatesCompra`, `PedidoCompraDetalhe`, `ConferenciaEntrada`, `TabelaPrecosConsulta`, `ImportacaoProdutos`, `EditorLayoutsTres`, `DesignerDocumento`, `GestaoTemplates`, `LixeiraLancamentos`, `SimuladorCartao`, `ReversaoDespesasSangrias`, `ConsumoInterno`, `AuditoriaPins`, `AgefinConsulta`, `ItinerarioFluvial`, `AuditoriaCodigoProjeto`, raiz `/` com `Home`.

## Partilha de ficheiros / PWA

- `AnexoCompartilhado` — fluxo por etapas (torre de controlo → destinos → vincular lançamento, pedido, evento, importar PDF AGEFIN, atualizar boleto, novo lançamento, **novo pedido + importador PDF**). **Lançamento existente:** lista de hoje + valor OCR ordena (não filtra). **Novo lançamento:** anexo automático após salvar (incl. transferência); fim = Outro lançamento ou Concluir. Ver `src/docs/PWA_ATALHO_IOS_TORRE.md`. Deep link: `?destino=importar_pedido`. Integra `BuscarLancamentoSheet`, `AgefinImportador`, `BoletoRecorrentePicker`, `torrePedidoImportBridge`, `torreLancamentoBridge`, etc.

## Nota sobre “voltar” no browser

Navegação via `navigate()` (React Router) mantém o histórico do SPA; recargas completas (`window.location.href = …`) substituem entradas ou reiniciam o estado. O helper `navigateBackOr` (`src/lib/navigateBackOr.js`) usa `navigate(-1)` quando existe histórico interno e cai para `Dashboard` quando não há stack.
