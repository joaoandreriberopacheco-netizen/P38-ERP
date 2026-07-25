import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { navigateBackOr } from '@/lib/navigateBackOr';
import { createPageUrl } from '@/components/utils';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MovimentoDialog from './caixa/MovimentoDialog';
import ComprovanteMovimentoDialog from './caixa/ComprovanteMovimentoDialog';
import DespesaDialog from './caixa/DespesaDialog';
import ComprovanteDespesaDialog from './caixa/ComprovanteDespesaDialog';
import ListaMovimentosDialog from './caixa/ListaMovimentosDialog';
import CalculadoraCedulasDialog from './caixa/CalculadoraCedulasDialog';
import RetornoEdicaoDialog from './caixa/RetornoEdicaoDialog';
import VendasTurnoDialog from './caixa/VendasTurnoDialog';
import VendaDetalheDialog from './caixa/VendaDetalheDialog';
import SaldoValeDialog from './caixa/SaldoValeDialog';
import ProcessarVendasView from './caixa/ProcessarVendasView';
import ConfirmarPagamentoDialog from './caixa/ConfirmarPagamentoDialog.jsx';
import PromissoriaDialog from './caixa/PromissoriaDialog';
import FechamentoCaixaButton from '@/components/vendas/FechamentoCaixaButton';
import {
  resolveContaDestinoCaixaPDV,
  transferirRecolhimentoCaixaPDV,
} from '@/lib/contaDestinoCaixaPDV';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import {
  Receipt,
  DollarSign,
  Clock,
  ArrowLeft,
  Wallet,
  PieChart,
  ShoppingCart,
  CheckCircle2,
  Plus,
  Minus,
  Printer,
  Edit,
  Eye,
  Monitor,
  RefreshCw,
  Package,
  X } from
'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';
import LiberacaoEntrega from './LiberacaoEntrega';
import SeletorCaixaPDV from './SeletorCaixaPDV';
import AutorizacoesEstornoPendentes from './AutorizacoesEstornoPendentes';
import { processarVendaCaixa } from '@/functions/processarVendaCaixa';
import ComprovanteCompra from '@/components/vendas/ComprovanteCompra';
import ConfirmarImpressaoDialog from '@/components/vendas/ConfirmarImpressaoDialog';
import { roundToTwoDecimals, resolveValorPedidoVenda, pagamentosCobremTotal } from '@/lib/financialUtils';
import {
  descricaoPadraoVale,
  listarPessoasFolhaParaVale,
  montarTagsValeFolha,
  registrarValeNoFolhaAposLancamento,
} from '@/lib/folhaValeFluxo';
import { getPrazoLiquidacaoMaquininha } from '@/lib/pagamentoPedidoVendaFinanceiro';
import {
  caixaTurnoQueryKey,
  fetchCaixaTurnoSnapshot,
  CAIXA_IDLE_SYNC_AFTER_MS,
  CAIXA_IDLE_SYNC_TICK_MS,
  CAIXA_SUBSCRIBE_DEBOUNCE_MS,
} from '@/lib/caixaTurnoData';
import {
  CAIXA_PRINT,
  CAIXA_TOAST_SUCCESS,
  caixaClasses,
  caixaMain,
  caixaMobileTabBar,
  caixaShell,
  caixaTabPanel,
  caixaTabPanelPad,
  caixaTabPanelPadInLayout,
  caixaTabsRoot,
  caixaTypo,
  conferenciaTone,
  movimentoTone,
} from '@/lib/caixaP38Theme';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import CaixaMovimentacoesTurno from '@/components/vendas/caixa/CaixaMovimentacoesTurno';
import ConsultaVendasCaixa from '@/components/vendas/caixa/ConsultaVendasCaixa';
import { CaixaOverlayStackProvider } from '@/components/vendas/caixa/CaixaOverlayStackContext';
import { cleanupQuickAccessPortalLayers } from '@/lib/quickAccessOverlay';
import { getCachedUserSession } from '@/lib/userSessionCache';
import { isRateLimitApiError } from '@/lib/p38ApiErrors';
import { useCompactShell } from '@/hooks/use-breakpoint';

function RascunhoAguardandoCard({ rascunho, onDetalhes, onEditar, onConfirmar, formatarValorExibicao }) {
  return (
    <div
      className="bg-card dark:bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onDetalhes(rascunho)}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        {rascunho.senha_atendimento && (
          <div className="px-4 py-2 bg-muted/40 dark:bg-muted rounded-xl">
            <div className="text-xs text-muted-foreground dark:text-muted-foreground mb-1">Senha</div>
            <div className="text-3xl font-bold text-foreground dark:text-white font-mono">{rascunho.senha_atendimento.slice(-4)}</div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-medium text-foreground dark:text-white truncate">{rascunho.cliente_nome}</div>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">{rascunho.vendedor_nome}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground dark:text-white font-glacial">
            R$ {formatarValorExibicao(rascunho.valor_total)}
          </div>
          <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
            {rascunho.itens?.length || 0} {rascunho.itens?.length === 1 ? 'item' : 'itens'}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onDetalhes(rascunho); }}
          className="h-12 px-4 bg-muted/40 dark:bg-muted text-foreground/90 dark:text-muted-foreground rounded-xl font-medium hover:bg-muted dark:hover:bg-muted transition-colors flex items-center justify-center"
          style={{ minHeight: '48px' }}
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEditar(rascunho); }}
          className="flex-1 h-12 bg-muted/40 dark:bg-muted text-foreground/90 dark:text-muted-foreground rounded-xl font-medium hover:bg-muted dark:hover:bg-muted transition-colors flex items-center justify-center gap-2"
          style={{ minHeight: '48px' }}
        >
          <Edit className="w-4 h-4" />
          <span>Editar</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onConfirmar(rascunho); }}
          className="flex-1 h-12 p38-btn-primary rounded-xl font-medium hover:shadow-md transition-shadow"
          style={{ minHeight: '48px' }}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

function MovimentoTimelineCard({ item }) {
  const toneKey = item.tone || item.cor;
  const tone = caixaClasses(toneKey);
  const Icon = toneKey === 'success' || toneKey === 'emerald' ? Plus : toneKey === 'info' || toneKey === 'blue' ? Minus : DollarSign;
  const valorTone = toneKey === 'muted' ? 'neutral' : (toneKey === 'emerald' ? 'success' : toneKey === 'blue' ? 'info' : toneKey === 'red' ? 'danger' : toneKey);
  return (
    <div className="bg-card dark:bg-card rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${tone.well}`}>
        <Icon className={`w-4 h-4 ${tone.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`${caixaTypo.section} truncate normal-case`}>{item.descricao}</div>
        <div className={caixaTypo.meta}>{item.tipo} · {item.hora ? format(new Date(item.hora), 'HH:mm') : ''}</div>
      </div>
      <div className="flex-shrink-0">
        <CaixaValorDisplay valor={item.valor} tone={valorTone} signed={valorTone !== 'neutral'} size="md" />
      </div>
    </div>
  );
}

export default function PDVCaixa({
  overlayMode = false,
  onClose,
  initialActiveTab = 'balanco',
  initialVendasView = 'aguardando',
} = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobileShell = useCompactShell();
  const inAppLayout = isMobileShell && !overlayMode;
  const tabPanelPad = inAppLayout ? caixaTabPanelPadInLayout : caixaTabPanelPad;
  const fechamentoSectionRef = useRef(null);
  const handleClose = () => {
    if (overlayMode && onClose) {
      setRascunhoDetalhesTab(null);
      cleanupQuickAccessPortalLayers();
      onClose();
      return;
    }
    navigateBackOr(navigate);
  };
  const [configVenda, setConfigVenda] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => getCachedUserSession()?.user ?? null);

  useEffect(() => {
    base44.entities.ConfiguracoesVenda.list().
    then((configs) => {
      if (configs.length > 0) setConfigVenda(configs[0]);
    }).
    catch(console.error);
    
    base44.auth.me().then(setCurrentUser).catch(console.error);
  }, []);
  const [pedidosAguardando, setPedidosAguardando] = useState([]);
  const [rascunhosAguardando, setRascunhosAguardando] = useState([]);
  const [vendasFinalizadas, setVendasFinalizadas] = useState([]);
  const [vendasTurnoTodos, setVendasTurnoTodos] = useState([]);
  const [substituicoesCtx, setSubstituicoesCtx] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [contaCaixaPDV, setContaCaixaPDV] = useState(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [view, setView] = useState('dashboard'); // Renamed telaAtual to view

  const [showMovimentoDialog, setShowMovimentoDialog] = useState(false);
  const [tipoMovimento, setTipoMovimento] = useState('');
  const [valorMovimento, setValorMovimento] = useState('');
  const [observacaoMovimento, setObservacaoMovimento] = useState('');
  const [movimentoCriado, setMovimentoCriado] = useState(null);
  const [showComprovanteMovimento, setShowComprovanteMovimento] = useState(false);
  const [movimentoStep, setMovimentoStep] = useState('obs'); // 'obs' | 'valor'
  const valorMovimentoRef = React.useRef(null);
  const obsMovimentoRef = React.useRef(null);

  // Despesa - mesmo fluxo do movimento
  const [despesaStep, setDespesaStep] = useState('obs'); // 'obs' | 'valor'
  const [valorDespesaNum, setValorDespesaNum] = useState('');
  const obsDespesaRef = React.useRef(null);
  const valorDespesaRef = React.useRef(null);

  const [showFechamentoDialog, setShowFechamentoDialog] = useState(false);
  const [valorContadoCaixa, setValorContadoCaixa] = useState('');
  const [showCalculadoraCedulas, setShowCalculadoraCedulas] = useState(false);
  const [cedulas, setCedulas] = useState({
    nota200: 0,
    nota100: 0,
    nota50: 0,
    nota20: 0,
    nota10: 0,
    nota5: 0,
    nota2: 0,
    moeda1: 0,
    moeda050: 0,
    moeda025: 0,
    moeda010: 0,
    moeda005: 0
  });
  const [recebimentosDinheiro, setRecebimentosDinheiro] = useState('');
  const [recebimentosPix, setRecebimentosPix] = useState('');
  const [recebimentosCredito, setRecebimentosCredito] = useState('');
  const [recebimentosDebito, setRecebimentosDebito] = useState('');

  const [pagamentosDinheiro, setPagamentosDinheiro] = useState(0);
  const [pagamentosPix, setPagamentosPix] = useState(0);
  const [pagamentosDebito, setPagamentosDebito] = useState(0);
  const [pagamentosCredito, setPagamentosCredito] = useState(0);
  const [pagamentosVale, setPagamentosVale] = useState(0);
  const [pagamentosContaPagar, setPagamentosContaPagar] = useState(0);
  const [parcelasCredito, setParcelasCredito] = useState(1);
  const [formaPagamentoAtiva, setFormaPagamentoAtiva] = useState(0);
  // Maquininhas selecionadas para débito e crédito
  const [maquininhaDebito, setMaquininhaDebito] = useState(null);   // { maquininha, bandeira, taxa, prazo_dias }
  const [maquininhaCredito, setMaquininhaCredito] = useState(null);
  const [codigoVale, setCodigoVale] = useState('');
  const [valeEncontrado, setValeEncontrado] = useState(null);
  const [buscandoVale, setBuscandoVale] = useState(false);

  // Valores como strings para edição livre
  const [inputDinheiro, setInputDinheiro] = useState('');
  const [inputPix, setInputPix] = useState('');
  const [inputDebito, setInputDebito] = useState('');
  const [inputCredito, setInputCredito] = useState('');
  const [inputVale, setInputVale] = useState('');
  const [inputContaPagar, setInputContaPagar] = useState('');

  // Refs para os inputs
  const inputRefs = {
    dinheiro: React.useRef(null),
    pix: React.useRef(null),
    debito: React.useRef(null),
    credito: React.useRef(null),
    vale: React.useRef(null),
    contaPagar: React.useRef(null),
  };

  const [showLiberacaoEntrega, setShowLiberacaoEntrega] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(null);
  const [clienteVenda, setClienteVenda] = useState(null);
  const [saldoResidualVale, setSaldoResidualVale] = useState(null); // { codigo, saldo }
  const [processandoVenda, setProcessandoVenda] = useState(false); // Trava de duplo clique
  const [rascunhoDetalhesTab, setRascunhoDetalhesTab] = useState(null);
  const [showPromissoria, setShowPromissoria] = useState(false);
  const [dadosPromissoria, setDadosPromissoria] = useState(null); // { pedido, valorFiado }
  const [showComprovanteCaixa, setShowComprovanteCaixa] = useState(false);
  const [showConfirmarImpressao, setShowConfirmarImpressao] = useState(false);
  const [showRetornoDialog, setShowRetornoDialog] = useState(false);
  const [motivoRetorno, setMotivoRetorno] = useState('');
  const [showVendasDialog, setShowVendasDialog] = useState(false);
  const [showReforcosDialog, setShowReforcosDialog] = useState(false);
  const [showSangriasDialog, setShowSangriasDialog] = useState(false);
  const [vendaDetalhada, setVendaDetalhada] = useState(null);
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [vendasView, setVendasView] = useState(initialVendasView);
  const [showDespesaDialog, setShowDespesaDialog] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [showSaldoConsolidadoDialog, setShowSaldoConsolidadoDialog] = useState(false);
  const [showGerenciarMovimentoDialog, setShowGerenciarMovimentoDialog] = useState(false);
  const [movimentoSelecionado, setMovimentoSelecionado] = useState(null);
  const [valorDespesa, setValorDespesa] = useState('');
  const [descricaoDespesa, setDescricaoDespesa] = useState('');
  const [categoriaDespesa, setCategoriaDespesa] = useState('Outros');
  const [isValeFolhaDespesa, setIsValeFolhaDespesa] = useState(false);
  const [valeFolhaModeloIdDespesa, setValeFolhaModeloIdDespesa] = useState('');
  const [pessoasFolhaDespesa, setPessoasFolhaDespesa] = useState([]);
  const [loadingPessoasFolhaDespesa, setLoadingPessoasFolhaDespesa] = useState(false);
  const [turnoAtivo, setTurnoAtivo] = useState(null);
  const [caixaSelecionado, setCaixaSelecionado] = useState(null);
  const [modoVisualizacao, setModoVisualizacao] = useState(false);
  const [showSeletorCaixa, setShowSeletorCaixa] = useState(true);
  const [fechandoCaixa, setFechandoCaixa] = useState(false);

  const scrollToFechamento = useCallback(() => {
    if (modoVisualizacao) return;

    const scrollElementIntoPanel = () => {
      const target = fechamentoSectionRef.current;
      if (!target) return;
      const panel = target.closest('[data-caixa-tab-scroll]');
      if (panel instanceof HTMLElement) {
        const panelTop = panel.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        panel.scrollTo({
          top: panel.scrollTop + (targetTop - panelTop) - 12,
          behavior: 'smooth',
        });
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (activeTab !== 'balanco') {
      setActiveTab('balanco');
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollElementIntoPanel);
      });
      return;
    }
    scrollElementIntoPanel();
  }, [activeTab, modoVisualizacao]);

  const lastUserActivityAtRef = useRef(Date.now());
  const loadDataRef = useRef(null);
  const hasSnapshotRef = useRef(false);
  const subscribeDebounceRef = useRef(null);
  const idleSyncBlockedRef = useRef(false);

  // Renamed stats to caixaData and updated structure based on outline
  const [caixaData, setCaixaData] = useState({
    saldoAtual: 0,
    liquidez: 0,
    totalVendas: 0,
    saldoInicial: 0,
    recebimentos: {
      dinheiro: 0,
      pix: 0,
      credito: 0,
      debito: 0
    },
    reforcos: 0,
    sangrias: 0,
    despesas: 0,
    despesasLista: [],
  });
  const [showDespesasDialog, setShowDespesasDialog] = useState(false);
  const [despesaCriada, setDespesaCriada] = useState(null);
  const [showComprovanteDespesa, setShowComprovanteDespesa] = useState(false);
  const { toast } = useToast();

  const valorTotalPedido = pedidoSelecionado ? resolveValorPedidoVenda(pedidoSelecionado) : 0;

  const totalPago = roundToTwoDecimals(
    pagamentosDinheiro + pagamentosPix + pagamentosDebito + pagamentosCredito + pagamentosVale + pagamentosContaPagar
  );
  const valorRestante = pedidoSelecionado
    ? roundToTwoDecimals(valorTotalPedido - totalPago)
    : 0;
  const troco = valorRestante < 0 ? Math.abs(valorRestante) : 0;
  const pagamentoValido = pedidoSelecionado
    ? pagamentosCobremTotal(totalPago, valorTotalPedido)
    : false;

  // Formatar valor para exibição (1234.56 -> "1.234,56")
  const formatarValorExibicao = (valor) => {
    const num = roundToTwoDecimals(valor ?? 0);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Máscara de valor - digita números e formata automaticamente (centavos -> reais)
  const aplicarMascaraValor = (valorAtual, tecla) => {
    // Remove tudo que não é número
    let numeros = valorAtual.replace(/\D/g, '');

    // Adiciona o novo dígito
    if (/^\d$/.test(tecla)) {
      numeros += tecla;
    }

    // Converte para número e divide por 100 (centavos)
    const valor = parseInt(numeros) / 100;
    return formatarValorExibicao(valor);
  };

  const handleInputMascara = (e, setInput, setValor) => {
    const tecla = e.key;

    // Backspace - remove último dígito
    if (tecla === 'Backspace') {
      e.preventDefault();
      let numeros = e.target.value.replace(/\D/g, '');
      numeros = numeros.slice(0, -1) || '0';
      const valor = parseInt(numeros) / 100;
      setInput(formatarValorExibicao(valor));
      setValor(valor);
      return;
    }

    // Só aceita números
    if (/^\d$/.test(tecla)) {
      e.preventDefault();
      const novoValor = aplicarMascaraValor(e.target.value, tecla);
      setInput(novoValor);
      const valorNumerico = parseFloat(novoValor.replace(/\./g, '').replace(',', '.'));
      setValor(valorNumerico);
      return;
    }

    // Navegação
    if (tecla === 'ArrowUp' || tecla === 'ArrowDown') {
      handleNavegacaoPagamento(e);
    }
  };

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    hasSnapshotRef.current = true;
    setContaCaixaPDV(snapshot.caixa);
    setPedidosAguardando(snapshot.pedidosAguardando);
    setRascunhosAguardando(snapshot.rascunhosAguardando);
    setSubstituicoesCtx(snapshot.substituicoesCtx);
    setVendasTurnoTodos(snapshot.vendasTurno);
    setVendasFinalizadas(snapshot.vendasFinalizadas);
    setMovimentos(snapshot.movimentos);
    setCaixaData(snapshot.caixaData);
  }, []);

  // Subscription em tempo real para novos rascunhos (debounce evita rajadas)
  useEffect(() => {
    const unsubscribe = base44.entities.RascunhoPedidoVenda.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        if (subscribeDebounceRef.current) clearTimeout(subscribeDebounceRef.current);
        subscribeDebounceRef.current = setTimeout(() => {
          loadDataRef.current?.(undefined, undefined, { force: true, silent: true });
        }, CAIXA_SUBSCRIBE_DEBOUNCE_MS);
      }
    });
    return () => {
      unsubscribe?.();
      if (subscribeDebounceRef.current) clearTimeout(subscribeDebounceRef.current);
    };
  }, [caixaSelecionado, turnoAtivo]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (pedidoSelecionado) {
      const totalArredondado = resolveValorPedidoVenda(pedidoSelecionado);
      const valorFormatado = formatarValorExibicao(totalArredondado);
      setPagamentosDinheiro(totalArredondado);
      setInputDinheiro(valorFormatado);
      setPagamentosPix(0);
      setInputPix('0,00');
      setPagamentosDebito(0);
      setInputDebito('0,00');
      setPagamentosCredito(0);
      setInputCredito('0,00');
      setPagamentosVale(0);
      setInputVale('0,00');
      setPagamentosContaPagar(0);
      setInputContaPagar('0,00');
      setCodigoVale('');
      setValeEncontrado(null);
      setParcelasCredito(1);
      setFormaPagamentoAtiva(0);
      setMaquininhaDebito(null);
      setMaquininhaCredito(null);

      // Auto-focus no primeiro input
      setTimeout(() => inputRefs.dinheiro.current?.focus(), 100);
    }
  }, [pedidoSelecionado]);

  // Foco gerenciado diretamente pelo clique do usuário — sem useEffect automático

  // Navegação entre formas de pagamento via teclado — sem efeitos colaterais de foco
  const handleNavegacaoPagamento = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFormaPagamentoAtiva((prev) => (prev + 1) % 6);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFormaPagamentoAtiva((prev) => (prev - 1 + 6) % 6);
    }
  };

  // Callback para abrir seletor de maquininha a partir do ConfirmarPagamentoDialog
  const [solicitarMaquininha, setSolicitarMaquininha] = React.useState(null); // 'debito' | 'credito' | null

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showConfirmarImpressao) return;

      if (e.key === 'F1') {
        e.preventDefault();
        toast({
          title: "Atalhos do PDV Caixa",
          description: "F1: Ajuda | F2: Processar Vendas | F3: Balanço | F4: Reforço | F6: Fechar Caixa | F7: Atualizar | Enter: Confirmar Pagamento | ESC: Voltar",
          duration: 8000
        });
        return;
      }

      if (e.key === 'Enter' && isDialogOpen && pagamentoValido) {
        e.preventDefault();
        handleFinalizarVenda();
        return;
      }

      if (e.key === 'F2' && view === 'dashboard') {// Updated telaAtual to view
        e.preventDefault();
        handleProcessarVendas(); // Changed to new function
        return;
      }

      if (e.key === 'F3' && view === 'dashboard') {
        e.preventDefault();
        setShowVendasDialog(true);
        return;
      }

      if (e.key === 'F4' && view === 'dashboard') {// Updated telaAtual to view
        e.preventDefault();
        handleAbrirMovimento('Reforço');
        return;
      }

      // F5: reservado para refresh nativo do browser (sem atribuição)

      if (e.key === 'F6' && view === 'dashboard') {
        e.preventDefault();
        scrollToFechamento();
        return;
      }

      if (e.key === 'F7') {
        e.preventDefault();
        loadData(undefined, undefined, { force: true });
        toast({
          title: "✓ Atualizado!",
          className: CAIXA_TOAST_SUCCESS,
          duration: 1000
        });
        return;
      }

      if (e.key === 'Enter' && view === 'processar' && !isDialogOpen && pedidosAguardando.length > 0) {// Updated telaAtual to view
        e.preventDefault();
        handleAbrirPedido(pedidosAguardando[0]);
        return;
      }

      if (e.key === 'Escape' && view !== 'dashboard' && !isDialogOpen && !showMovimentoDialog && !showFechamentoDialog && !showConfirmarImpressao) {// Updated telaAtual to view
        e.preventDefault();
        setView('dashboard'); // Updated setTelaAtual to setView
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isDialogOpen, showMovimentoDialog, showFechamentoDialog, showConfirmarImpressao, valorRestante, pedidosAguardando, scrollToFechamento]); // Updated telaAtual to view

  // loadData aceita parâmetros opcionais para contornar stale closure no primeiro carregamento
  const loadData = useCallback(async (caixaParam, turnoParam, { force = false, silent = false } = {}) => {
    const caixa = caixaParam || caixaSelecionado;
    const turno = turnoParam || turnoAtivo;
    if (!caixa || !turno) return;

    const queryKey = [...caixaTurnoQueryKey(turno.id, caixa.id), 'live', 'sem-itens'];

    try {
      if (force) {
        await queryClient.invalidateQueries({ queryKey: caixaTurnoQueryKey(turno.id, caixa.id) });
      }

      const snapshot = await queryClient.fetchQuery({
        queryKey,
        queryFn: () =>
          fetchCaixaTurnoSnapshot({
            turno,
            caixa,
            incluirRascunhos: true,
            rascunhoExigirItens: false,
          }),
        staleTime: force ? 0 : 30_000,
      });
      applySnapshot(snapshot);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      const suppressToast =
        silent ||
        (hasSnapshotRef.current && isRateLimitApiError(error));
      if (!suppressToast) {
        toast({
          title: 'Erro ao carregar dados',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  }, [caixaSelecionado, turnoAtivo, queryClient, applySnapshot, toast]);

  loadDataRef.current = loadData;

  idleSyncBlockedRef.current =
    showSeletorCaixa ||
    isDialogOpen ||
    showMovimentoDialog ||
    showFechamentoDialog ||
    showDespesaDialog ||
    processandoVenda ||
    fechandoCaixa ||
    showComprovanteCaixa ||
    showConfirmarImpressao ||
    showPromissoria ||
    showRetornoDialog ||
    showComprovanteMovimento ||
    showCalculadoraCedulas ||
    salvandoDespesa ||
    showVendasDialog ||
    showReforcosDialog ||
    showSangriasDialog ||
    showDespesasDialog ||
    showSaldoConsolidadoDialog ||
    showGerenciarMovimentoDialog ||
    showLiberacaoEntrega ||
    showComprovanteDespesa ||
    buscandoVale ||
    vendaDetalhada != null ||
    saldoResidualVale != null;

  useEffect(() => {
    const cap = { capture: true };
    const bump = () => {
      lastUserActivityAtRef.current = Date.now();
    };
    window.addEventListener('pointerdown', bump, cap);
    window.addEventListener('keydown', bump, cap);
    window.addEventListener('touchstart', bump, cap);
    return () => {
      window.removeEventListener('pointerdown', bump, cap);
      window.removeEventListener('keydown', bump, cap);
      window.removeEventListener('touchstart', bump, cap);
    };
  }, []);

  useEffect(() => {
    if (showSeletorCaixa || !turnoAtivo?.id || !caixaSelecionado?.id) return undefined;
    const tick = window.setInterval(() => {
      if (idleSyncBlockedRef.current) return;
      if (Date.now() - lastUserActivityAtRef.current < CAIXA_IDLE_SYNC_AFTER_MS) return;
      const run = loadDataRef.current;
      if (typeof run === 'function') {
        void run(undefined, undefined, { silent: true }).finally(() => {
          lastUserActivityAtRef.current = Date.now();
        });
      }
    }, CAIXA_IDLE_SYNC_TICK_MS);
    return () => window.clearInterval(tick);
  }, [showSeletorCaixa, turnoAtivo?.id, caixaSelecionado?.id]);

  const handleAbrirPedido = (pedido) => {
    if (modoVisualizacao) {
      toast({
        title: "Acesso Restrito",
        description: "Você não pode processar vendas neste caixa. Solicite vinculação ao administrador.",
        variant: "destructive"
      });
      return;
    }
    setPedidoSelecionado(pedido);
    setIsDialogOpen(true);
  };

  const handleSelecionarCaixa = (caixa, turno, somenteLeitura) => {
    lastUserActivityAtRef.current = Date.now();
    hasSnapshotRef.current = false;
    setCaixaSelecionado(caixa);
    setTurnoAtivo(turno);
    setModoVisualizacao(somenteLeitura);
    setShowSeletorCaixa(false);
    setContaCaixaPDV(caixa);
    if (turno) {
      loadData(caixa, turno);
    }
  };

  const handleRetornarParaEdicao = async () => {
    if (!motivoRetorno.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe o motivo do retorno para edição.",
        variant: "destructive"
      });
      return;
    }

    try {
      await base44.entities.RascunhoPedidoVenda.update(pedidoSelecionado.id, {
        status: 'Retornado para Edição',
        motivo_retorno: motivoRetorno,
        data_retorno: new Date().toISOString()
      });

      toast({
        title: "✓ Retornado para edição",
        description: "O rascunho foi devolvido ao vendedor.",
        className: CAIXA_TOAST_SUCCESS
      });

      const rascunhoId = pedidoSelecionado.id;
      setRascunhosAguardando((prev) => prev.filter((r) => r.id !== rascunhoId));
      setShowRetornoDialog(false);
      setIsDialogOpen(false);
      setMotivoRetorno('');
      setPedidoSelecionado(null);
      loadData(undefined, undefined, { force: true });
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleFinalizarVenda = async () => {
    if (!pagamentoValido) {
      toast({ title: "Pagamento insuficiente", description: `Falta R$ ${formatarValorExibicao(valorRestante)}`, variant: "destructive", duration: 2000 });
      return;
    }
    if (pagamentosDebito > 0 && !maquininhaDebito?.maquininha?.id) {
      toast({
        title: "Selecione a maquininha do débito",
        description: "Defina maquininha e bandeira antes de confirmar o pagamento.",
        variant: "destructive",
        duration: 2500,
      });
      return;
    }
    if (pagamentosCredito > 0 && !maquininhaCredito?.maquininha?.id) {
      toast({
        title: "Selecione a maquininha do crédito",
        description: "Defina maquininha e bandeira antes de confirmar o pagamento.",
        variant: "destructive",
        duration: 2500,
      });
      return;
    }
    if (!contaCaixaPDV) {
      toast({ title: "Conta de Caixa PDV não encontrada", variant: "destructive" });
      return;
    }
    // Trava de duplo clique no frontend
    if (processandoVenda) return;
    setProcessandoVenda(true);

    try {
       const pagamentosArray = [];
       // Dinheiro: registra o valor líquido (pago menos troco)
       if (pagamentosDinheiro > 0) pagamentosArray.push({ forma_pagamento: 'Dinheiro', valor: pagamentosDinheiro - troco, parcelas: 1 });
       if (pagamentosPix > 0) pagamentosArray.push({ forma_pagamento: 'PIX', valor: pagamentosPix, parcelas: 1 });
       if (pagamentosDebito > 0) pagamentosArray.push({
         forma_pagamento: 'Cartão de Débito',
         valor: pagamentosDebito,
         parcelas: 1,
         maquininha_id: maquininhaDebito?.maquininha?.id,
         maquininha_nome: maquininhaDebito?.maquininha?.nome,
         maquininha_conta_id: maquininhaDebito?.maquininha?.conta_destino_id,
         maquininha_conta_nome: maquininhaDebito?.maquininha?.conta_destino_nome,
         bandeira: maquininhaDebito?.bandeira,
         taxa_maquininha: maquininhaDebito?.taxa || 0,
         prazo_maquininha_dias: maquininhaDebito?.prazo_dias ?? getPrazoLiquidacaoMaquininha(),
       });
       if (pagamentosCredito > 0) pagamentosArray.push({
         forma_pagamento: 'Cartão de Crédito',
         valor: pagamentosCredito,
         parcelas: parcelasCredito,
         maquininha_id: maquininhaCredito?.maquininha?.id,
         maquininha_nome: maquininhaCredito?.maquininha?.nome,
         maquininha_conta_id: maquininhaCredito?.maquininha?.conta_destino_id,
         maquininha_conta_nome: maquininhaCredito?.maquininha?.conta_destino_nome,
         bandeira: maquininhaCredito?.bandeira,
         taxa_maquininha: maquininhaCredito?.taxa || 0,
         prazo_maquininha_dias: maquininhaCredito?.prazo_dias ?? getPrazoLiquidacaoMaquininha(),
       });
       if (pagamentosVale > 0 && valeEncontrado) {
         pagamentosArray.push({ forma_pagamento: 'Vale Troca', valor: pagamentosVale, parcelas: 1, vale_codigo: valeEncontrado.codigo, vale_id: valeEncontrado.id });
       }
       if (pagamentosContaPagar > 0) {
         pagamentosArray.push({ forma_pagamento: 'Conta a Pagar', valor: pagamentosContaPagar, parcelas: 1 });
       }

      let substituiPedidoId = null;
      let substituiPedidoNumero = null;
      if (valeEncontrado?.pedido_origem_id) {
        substituiPedidoId = valeEncontrado.pedido_origem_id;
        substituiPedidoNumero = valeEncontrado.pedido_origem_numero;
      } else if (pedidoSelecionado.cliente_id) {
        const todasDevolucoes = await base44.entities.DevolucaoTroca.list();
        const pendente = todasDevolucoes.find(
          (d) =>
            d.aguarda_substituto &&
            !d.pedido_substituto_id &&
            d.pedido_origem_id &&
            d.cliente_id === pedidoSelecionado.cliente_id
        );
        if (pendente) {
          substituiPedidoId = pendente.pedido_origem_id;
          substituiPedidoNumero = pendente.pedido_origem_numero;
        }
      }

      // ── CHAMADA AO BACKEND (atômico + selo frio + número único) ──
      const { data } = await processarVendaCaixa({
        rascunho_id: pedidoSelecionado.id,
        pagamentos: pagamentosArray,
        turno_id: turnoAtivo?.id,
        conta_caixa_id: contaCaixaPDV?.id,
        saldo_atual_caixa: contaCaixaPDV?.saldo_atual,
        config_venda: configVenda ? { fluxo_venda_padrao: configVenda.fluxo_venda_padrao, auto_delivery_balcao: configVenda.auto_delivery_balcao } : null,
        substitui_pedido_id: substituiPedidoId,
        substitui_pedido_numero: substituiPedidoNumero,
      });

      if (!data?.success) {
        const msg = data?.error || 'Erro desconhecido no processamento.';
        // Mensagem amigável para duplicidade
        if (data?.ja_processado || data?.em_processamento) {
          toast({ title: "⚠️ Pedido já processado", description: msg, variant: "destructive", duration: 5000 });
        } else {
          toast({ title: "Erro ao processar venda", description: msg, variant: "destructive" });
        }
        return;
      }

      const pedidoVenda = data.pedido_venda;

      // Saldo residual do vale troca
      if (data.saldo_residual_vale) {
        setSaldoResidualVale(data.saldo_residual_vale);
      }

      // Avisos de operações secundárias que falharam (não críticos)
      if (data.avisos?.length) {
        console.warn('Avisos pós-venda:', data.avisos);
      }

      // Não altera saldo_atual localmente; o financeiro deve ser apurado pelos lançamentos válidos.

      // Buscar dados do cliente para o comprovante (falha não bloqueia o fluxo pós-venda)
      if (pedidoSelecionado.cliente_id) {
        try {
          const cliente = await base44.entities.Terceiro.get(pedidoSelecionado.cliente_id);
          setClienteVenda(cliente);
        } catch (clienteErr) {
          console.warn('Cliente não carregado para comprovante:', clienteErr);
        }
      }

      if (configVenda?.fluxo_venda_padrao === 'Completo') {
        toast({ title: "Ordem de Separação Criada", description: "Enviado para o estoque." });
      }

      toast({
        title: "✓ Pagamento aprovado!",
        description: "Venda finalizada com sucesso.",
        className: CAIXA_TOAST_SUCCESS,
        duration: 2000
      });

      const rascunhoProcessado = pedidoSelecionado;
      const rascunhoId = rascunhoProcessado.id;

      setRascunhosAguardando((prev) => prev.filter((r) => r.id !== rascunhoId));
      setIsDialogOpen(false);

      // Prepara promissória se houver fiado (será aberta após fechar o comprovante)
      if (pagamentosContaPagar > 0) {
        setDadosPromissoria({ pedido: { ...pedidoVenda, pagamentos: pagamentosArray }, valorFiado: pagamentosContaPagar });
      } else {
        setDadosPromissoria(null);
      }

      // Sempre mostra o comprovante primeiro; ao fechar, segue o fluxo normal
      setVendaFinalizada({
        ...rascunhoProcessado,
        ...pedidoVenda,
        itens: pedidoVenda.itens?.length ? pedidoVenda.itens : rascunhoProcessado.itens,
        pagamentos: pagamentosArray,
      });
      setShowConfirmarImpressao(true);
      setPedidoSelecionado(null);

      loadData(undefined, undefined, { force: true });
    } catch (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setProcessandoVenda(false);
    }
  };

  const handleAbrirMovimento = (tipo) => {
    if (!contaCaixaPDV) {
      toast({
        title: "Conta de Caixa PDV não encontrada",
        description: "Não foi possível realizar o movimento. Recarregue a página.",
        variant: "destructive"
      });
      return;
    }
    setTipoMovimento(tipo);
    setValorMovimento('');
    setObservacaoMovimento('');
    setMovimentoStep('obs');
    setShowMovimentoDialog(true);
  };

  useEffect(() => {
    if (!showDespesaDialog) {
      setIsValeFolhaDespesa(false);
      setValeFolhaModeloIdDespesa('');
      return;
    }
    setLoadingPessoasFolhaDespesa(true);
    listarPessoasFolhaParaVale()
      .then(setPessoasFolhaDespesa)
      .catch(() => setPessoasFolhaDespesa([]))
      .finally(() => setLoadingPessoasFolhaDespesa(false));
  }, [showDespesaDialog]);

  const handleValeFolhaDespesaToggle = (ativo) => {
    setIsValeFolhaDespesa(ativo);
    if (ativo) {
      if (!valeFolhaModeloIdDespesa && pessoasFolhaDespesa.length === 1) {
        setValeFolhaModeloIdDespesa(pessoasFolhaDespesa[0].id);
        setDescricaoDespesa(descricaoPadraoVale(pessoasFolhaDespesa[0].nome));
      }
    } else {
      setValeFolhaModeloIdDespesa('');
    }
  };

  const handleValeFolhaDespesaPessoa = (modeloId) => {
    setValeFolhaModeloIdDespesa(modeloId);
    const pessoa = pessoasFolhaDespesa.find((p) => p.id === modeloId);
    if (pessoa) setDescricaoDespesa(descricaoPadraoVale(pessoa.nome));
  };

  const handleSalvarDespesaNum = async (valorStr) => {
    const valorFloat = parseFloat((valorStr || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (valorFloat <= 0 || !descricaoDespesa.trim() || salvandoDespesa) return;
    if (isValeFolhaDespesa && !valeFolhaModeloIdDespesa) {
      toast({ title: 'Selecione quem vai receber o vale', variant: 'destructive' });
      return;
    }
    setSalvandoDespesa(true);
    try {
      const dataHoje = format(new Date(), 'yyyy-MM-dd');
      const pessoaVale = isValeFolhaDespesa
        ? pessoasFolhaDespesa.find((p) => p.id === valeFolhaModeloIdDespesa)
        : null;
      const descricaoFinal = isValeFolhaDespesa && pessoaVale
        ? (descricaoDespesa.trim() || descricaoPadraoVale(pessoaVale.nome))
        : descricaoDespesa;
      const tags = isValeFolhaDespesa && pessoaVale ? montarTagsValeFolha([], pessoaVale) : [];

      const lancamento = await base44.entities.LancamentoFinanceiro.create({
        tipo: 'Despesa',
        descricao: descricaoFinal,
        valor: valorFloat,
        conta_financeira_id: contaCaixaPDV?.id,
        conta_financeira_nome: contaCaixaPDV?.nome,
        data_vencimento: dataHoje,
        data_pagamento: dataHoje,
        status: 'Pago',
        categoria: categoriaDespesa,
        tags,
        turno_caixa_id: turnoAtivo?.id,
        observacoes: `Despesa registrada via PDV Caixa por ${currentUser?.full_name}`
      });
      if (turnoAtivo) {
        await base44.entities.TurnoCaixa.update(turnoAtivo.id, {
          despesas_ids: [...(turnoAtivo.despesas_ids || []), lancamento.id]
        });
      }

      if (isValeFolhaDespesa && valeFolhaModeloIdDespesa && lancamento?.id) {
        try {
          await registrarValeNoFolhaAposLancamento({
            modeloId: valeFolhaModeloIdDespesa,
            valor: valorFloat,
            data: dataHoje,
            lancamentoId: lancamento.id,
            descricao: descricaoFinal,
            lancamentoPago: true,
          });
        } catch (err) {
          toast({
            title: 'Despesa salva, mas vale não entrou na folha',
            description: err?.message || 'Abra a Folha e registre o vale manualmente.',
            variant: 'destructive',
          });
        }
      }

      setDespesaCriada({ ...lancamento, descricao: descricaoFinal, valor: valorFloat, categoria: categoriaDespesa });
      setShowDespesaDialog(false);
      setShowComprovanteDespesa(true);
      setDespesaStep('obs');
      setValorDespesaNum('');
      setValorDespesa('');
      setDescricaoDespesa('');
      setCategoriaDespesa('Outros');
      setIsValeFolhaDespesa(false);
      setValeFolhaModeloIdDespesa('');
      loadData();
    } catch (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSalvandoDespesa(false);
    }
  };

  const handleSalvarDespesa = async () => {
    if (!valorDespesa || parseFloat(valorDespesa.replace(',', '.')) <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor maior que zero.",
        variant: "destructive"
      });
      return;
    }

    if (!descricaoDespesa.trim()) {
      toast({
        title: "Descrição obrigatória",
        description: "Informe a descrição da despesa.",
        variant: "destructive"
      });
      return;
    }

    try {
      const valorFloat = parseFloat(valorDespesa.replace(',', '.'));

      // Criar lançamento financeiro
      const lancamento = await base44.entities.LancamentoFinanceiro.create({
        tipo: 'Despesa',
        descricao: descricaoDespesa,
        valor: valorFloat,
        conta_financeira_id: contaCaixaPDV?.id,
        conta_financeira_nome: contaCaixaPDV?.nome,
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        data_pagamento: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pago',
        categoria: categoriaDespesa,
        turno_caixa_id: turnoAtivo?.id,
        observacoes: `Despesa registrada via PDV Caixa por ${currentUser?.full_name}`
      });

      // Atualizar turno com despesa
      if (turnoAtivo) {
        await base44.entities.TurnoCaixa.update(turnoAtivo.id, {
          despesas_ids: [...(turnoAtivo.despesas_ids || []), lancamento.id]
        });
      }

      toast({
        title: "✓ Despesa registrada!",
        description: `${descricaoDespesa} - ${formatValor(valorFloat)}`,
        className: CAIXA_TOAST_SUCCESS,
        duration: 2000
      });

      setShowDespesaDialog(false);
      setValorDespesa('');
      setDescricaoDespesa('');
      setCategoriaDespesa('Outros');
      loadData();
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSalvarMovimento = async () => {
    if (!valorMovimento || parseFloat(valorMovimento.replace(/\./g, '').replace(',', '.')) <= 0) {
      toast({
        title: "Valor inválido",
        description: "Informe um valor maior que zero.",
        variant: "destructive"
      });
      return;
    }

    if (!contaCaixaPDV) {
      toast({
        title: "Conta de Caixa PDV não encontrada",
        description: "Não foi possível identificar a conta do caixa.",
        variant: "destructive"
      });
      return;
    }

    try {
      const valorFloat = parseFloat(valorMovimento.replace(/\./g, '').replace(',', '.'));
      const todosMovimentos = await base44.entities.MovimentosCaixa.list();
      const nextNumber = (todosMovimentos.length > 0 ? Math.max(...todosMovimentos.map((m) => parseInt(m.numero?.split('-')[1] || 0) || 0)) : 0) + 1;
      const numeroMovimento = `MCX-${String(nextNumber).padStart(5, '0')}`;

      // Recolhimento: saída no caixa PDV (MovimentosCaixa) + entrada na conta destino configurada
      if (tipoMovimento === 'Recolhimento de Caixa') {
      const todasContas = await base44.entities.ContasFinanceiras.list();
      const contaDestino = resolveContaDestinoCaixaPDV(todasContas);

      if (!contaDestino) {
        toast({
          title: "Conta destino não configurada",
          description: "Em Configurações → Financeiro → Contas, defina a conta que recebe recolhimentos e fechamento do caixa PDV.",
          variant: "destructive"
        });
        return;
      }

      const movimento = await base44.entities.MovimentosCaixa.create({
        numero: numeroMovimento,
        tipo: tipoMovimento,
        valor: valorFloat,
        observacao: `Transferência para ${contaDestino.nome}${observacaoMovimento ? '. ' + observacaoMovimento : ''}`,
        conta_id: contaCaixaPDV.id,
        turno_caixa_id: turnoAtivo?.id,
        usuario_responsavel_id: currentUser.id,
        usuario_responsavel_nome: currentUser.full_name
      });

      await transferirRecolhimentoCaixaPDV({
        base44,
        contaOrigem: contaCaixaPDV,
        contaDestino,
        valor: valorFloat,
        descricao: movimento.observacao,
        movimentoId: movimento.id,
      });

      if (turnoAtivo) {
        await base44.entities.TurnoCaixa.update(turnoAtivo.id, {
          movimentos_ids: [...(turnoAtivo.movimentos_ids || []), movimento.id]
        });
      }

      setMovimentoCriado(movimento);
      } else {
      // Reforço
      const movimento = await base44.entities.MovimentosCaixa.create({
        numero: numeroMovimento,
        tipo: tipoMovimento,
        valor: valorFloat,
        observacao: observacaoMovimento,
        conta_id: contaCaixaPDV.id,
        turno_caixa_id: turnoAtivo?.id,
        usuario_responsavel_id: currentUser.id,
        usuario_responsavel_nome: currentUser.full_name
      });

      setMovimentoCriado(movimento);

      // Atualizar turno com movimento
      if (turnoAtivo) {
        await base44.entities.TurnoCaixa.update(turnoAtivo.id, {
          movimentos_ids: [...(turnoAtivo.movimentos_ids || []), movimento.id]
        });
      }
      }

      setShowMovimentoDialog(false);
      setShowComprovanteMovimento(true);

      toast({
        title: `✓ ${tipoMovimento} registrado!`,
        description: `Movimento ${numeroMovimento} realizado.`,
        className: CAIXA_TOAST_SUCCESS,
        duration: 2000
      });

      loadData();
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const calcularTotalCedulas = () => {
    const total = (
      cedulas.nota200 * 200 +
      cedulas.nota100 * 100 +
      cedulas.nota50 * 50 +
      cedulas.nota20 * 20 +
      cedulas.nota10 * 10 +
      cedulas.nota5 * 5 +
      cedulas.nota2 * 2 +
      cedulas.moeda1 * 1 +
      cedulas.moeda050 * 0.50 +
      cedulas.moeda025 * 0.25 +
      cedulas.moeda010 * 0.10 +
      cedulas.moeda005 * 0.05
    );
    return roundToTwoDecimals(total);
  };

  useEffect(() => {
    // Auto-preencher recebimentos: Dinheiro = Liquidez - (PIX + Crédito + Débito + Vale)
    const dinheiroCalculado = roundToTwoDecimals(
      caixaData.liquidez -
        (caixaData.recebimentos?.pix || 0) -
        (caixaData.recebimentos?.credito || 0) -
        (caixaData.recebimentos?.debito || 0) -
        (caixaData.recebimentos?.vale || 0)
    );
    setRecebimentosDinheiro(formatarValorExibicao(dinheiroCalculado));
    setRecebimentosPix(formatarValorExibicao(caixaData.recebimentos?.pix || 0));
    setRecebimentosCredito(formatarValorExibicao(caixaData.recebimentos?.credito || 0));
    setRecebimentosDebito(formatarValorExibicao(caixaData.recebimentos?.debito || 0));
  }, [caixaData]);

  const handleFecharCaixa = async () => {
    if (fechandoCaixa) return;

    const dinheiroContado = roundToTwoDecimals(
      parseFloat(recebimentosDinheiro.replace(/\./g, '').replace(',', '.')) || 0
    );
    const totalConferido = roundToTwoDecimals(
      dinheiroContado + caixaData.recebimentos.pix + (caixaData.recebimentos.credito || 0) + (caixaData.recebimentos.debito || 0)
    );
    const esperado = roundToTwoDecimals(caixaData.liquidez - (caixaData.recebimentos.vale || 0));
    const diferenca = roundToTwoDecimals(totalConferido - esperado);

    if (Math.abs(diferenca) > 0.01) {
      toast({
        title: "Valores não conferem",
        description: `Faltando ${formatValor(Math.abs(diferenca))}. Ajuste antes de fechar.`,
        variant: "destructive"
      });
      return;
    }

    setShowFechamentoDialog(true);
  };

  const handleConfirmarFechamentoCaixa = async () => {
    if (fechandoCaixa) return;

    const dinheiroContado = roundToTwoDecimals(
      parseFloat(recebimentosDinheiro.replace(/\./g, '').replace(',', '.')) || 0
    );
    const totalConferido = roundToTwoDecimals(
      dinheiroContado + caixaData.recebimentos.pix + (caixaData.recebimentos.credito || 0) + (caixaData.recebimentos.debito || 0)
    );
    const esperado = roundToTwoDecimals(caixaData.liquidez - (caixaData.recebimentos.vale || 0));
    const diferenca = roundToTwoDecimals(totalConferido - esperado);

    setFechandoCaixa(true);
    try {
      await base44.entities.TurnoCaixa.update(turnoAtivo.id, {
        status: 'Fechado',
        data_fechamento: new Date().toISOString(),
        usuario_fechamento_id: currentUser?.id,
        usuario_fechamento_nome: currentUser?.full_name,
        saldo_final: caixaData.liquidez,
        total_vendas: caixaData.totalVendas,
        total_reforcos: caixaData.reforcos,
        total_sangrias: caixaData.sangrias,
        total_despesas: caixaData.despesas,
        recebimentos_dinheiro: caixaData.recebimentos.dinheiro,
        recebimentos_pix: caixaData.recebimentos.pix,
        recebimentos_credito: caixaData.recebimentos.credito || 0,
        recebimentos_debito: caixaData.recebimentos.debito || 0,
        recebimentos_vale_troca: caixaData.recebimentos.vale || 0,
        dinheiro_conferido: dinheiroContado,
        diferenca,
        vendas_ids: vendasTurnoTodos.map(v => v.id),
        movimentos_ids: movimentos.map(m => m.id),
        despesas_ids: (caixaData.despesasLista || []).map(d => d.id)
      });

      const todasContas = await base44.entities.ContasFinanceiras.list();
      const caixaGeral = todasContas.find((c) => c.is_caixa_geral === true);
      if (caixaGeral && dinheiroContado > 0) {
        await base44.entities.MovimentosCaixa.create({
          numero: `MCX-${String(Date.now()).slice(-5)}`,
          tipo: 'Sangria',
          valor: dinheiroContado,
          observacao: `Fechamento de turno ${turnoAtivo.numero} - Transferido para ${caixaGeral.nome}`,
          conta_id: contaCaixaPDV.id,
          turno_caixa_id: turnoAtivo.id,
          usuario_responsavel_id: currentUser?.id,
          usuario_responsavel_nome: currentUser?.full_name,
        });
      }

      setShowFechamentoDialog(false);
      handleConcluirFechamentoSucesso();
    } catch (error) {
      toast({
        title: "Erro ao fechar caixa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setFechandoCaixa(false);
    }
  };

  const handleConcluirFechamentoSucesso = () => {
    setShowSeletorCaixa(true);
    setCaixaSelecionado(null);
    setTurnoAtivo(null);
    setContaCaixaPDV(null);
    setModoVisualizacao(false);
    setView('dashboard');
    toast({
      title: "✓ Caixa fechado com sucesso!",
      className: CAIXA_TOAST_SUCCESS,
      duration: 2000
    });
  };

  const formatValor = (valor) => {
    const num = roundToTwoDecimals(valor ?? 0);
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const movimentosTimelineItems = useMemo(() => {
    const itensMovimentos = movimentos.map(m => ({
      id: m.id,
      tipo: m.tipo,
      valor: m.valor,
      descricao: m.observacao || m.tipo,
      hora: m.created_date,
      operador: m.usuario_responsavel_nome,
      tone: movimentoTone(m.tipo),
      icone: m.tipo === 'Reforço' ? '+' : '−',
    }));
    const itensDespesas = (caixaData.despesasLista || []).map(d => ({
      id: d.id,
      tipo: 'Despesa',
      valor: d.valor,
      descricao: d.descricao,
      hora: d.created_date,
      operador: null,
      tone: 'danger',
      icone: '−',
    }));

    return [...itensMovimentos, ...itensDespesas].sort((a, b) => new Date(a.hora) - new Date(b.hora));
  }, [movimentos, caixaData.despesasLista]);

  // New helper functions for view navigation
  const handleProcessarVendas = () => {
    setView('processar');
  };

  const handleAbrirBalanco = () => {
    // Não faz nada, pois o balanço está sempre visível
  };

  const screenShellBg = overlayMode ? 'bg-muted dark:bg-background' : 'bg-muted/40 dark:bg-background';

  const rootClassName = overlayMode || inAppLayout
    ? `h-full min-h-0 flex flex-col ${screenShellBg} ${caixaTypo.screen}`
    : `${caixaShell} ${screenShellBg} ${caixaTypo.screen}`;

  return (
    <CaixaOverlayStackProvider active={overlayMode}>
    <div className={rootClassName}>
      {showSeletorCaixa && (
        <SeletorCaixaPDV 
          open={showSeletorCaixa} 
          onSelect={handleSelecionarCaixa}
          currentUser={currentUser}
          onClose={handleClose}
          elevatedStack={overlayMode}
        />
      )}

      {/* Notificações de Autorizações de Estorno Pendentes */}
      {turnoAtivo && caixaSelecionado && (
        <AutorizacoesEstornoPendentes
          turnoAtivo={turnoAtivo}
          contaCaixa={contaCaixaPDV}
          currentUser={currentUser}
        />
      )}

      {/* Header Minimalista */}
      <div className="flex-shrink-0 bg-card dark:bg-card border-b border-border/40 dark:border-border/40 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleClose}
          className="p-2 -ml-2 hover:bg-muted dark:hover:bg-muted rounded-lg transition-colors"
          style={{ minWidth: '44px', minHeight: '44px' }}>
          <ArrowLeft className="w-6 h-6 text-foreground/90 dark:text-muted-foreground" />
        </button>
        
        <div className="flex-1 text-center">
          <h1 className={`${caixaTypo.title} text-foreground dark:text-white`}>
            {caixaSelecionado?.nome || 'Caixa'}
          </h1>
          {modoVisualizacao && (
            <p className={`${caixaTypo.labelSm} text-amber-600 dark:text-amber-400`}>Somente visualização</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadData(undefined, undefined, { force: true }); toast({ title: "✓ Atualizado!", className: CAIXA_TOAST_SUCCESS, duration: 1000 }); }}
            className="p-2 hover:bg-muted dark:hover:bg-muted rounded-lg transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
            title="Atualizar (F7)">
            <RefreshCw className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
          </button>
          <div className="text-sm text-muted-foreground dark:text-muted-foreground flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {format(new Date(), 'HH:mm')}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className={`${caixaMain} relative ${screenShellBg}`}>
        {!caixaSelecionado ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground dark:text-muted-foreground">
              <Monitor className="w-16 h-16 mx-auto mb-4" />
              <p>Selecione um caixa para continuar</p>
            </div>
          </div>
        ) : view === 'dashboard' &&
        <>
            {/* Desktop e Mobile - Sistema de Abas Unificado */}
              <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="balanco" className={caixaTabsRoot}>
                {/* Abas mobile — abaixo do header; bottom nav fica no shell global */}
                <TabsList className={`${caixaMobileTabBar} grid grid-cols-3 h-14 bg-card dark:bg-card border-b border-border/40 dark:border-border/40 rounded-none p-0`}>
                  <TabsTrigger value="balanco" className="flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-muted/40 dark:data-[state=active]:bg-muted h-full rounded-none border-0">
                    <PieChart className="w-5 h-5" />
                    <span className={caixaTypo.labelSm}>Balanço</span>
                  </TabsTrigger>
                  <TabsTrigger value="vendas" className="flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-muted/40 dark:data-[state=active]:bg-muted h-full rounded-none border-0">
                    <ShoppingCart className="w-5 h-5" />
                    <span className={caixaTypo.labelSm}>Vendas</span>
                  </TabsTrigger>
                  <TabsTrigger value="movimentos" className="flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-muted/40 dark:data-[state=active]:bg-muted h-full rounded-none border-0">
                    <Wallet className="w-5 h-5" />
                    <span className={caixaTypo.labelSm}>Movimentos</span>
                  </TabsTrigger>
                </TabsList>

                {/* KPIs Superiores - Apenas Desktop */}
                <div className="hidden md:block p-4 pb-0">
                  <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
                    <div className="bg-card dark:bg-card rounded-2xl p-5 shadow-sm">
                     <div className="text-xs text-muted-foreground dark:text-muted-foreground mb-2">Saldo do Turno</div>
                     <div className="text-3xl font-bold text-foreground dark:text-white font-glacial">
                       {formatValor(caixaData.liquidez)}
                     </div>
                     <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">Inicial + vendas + reforços − recolhimentos</div>
                    </div>
                    <div className="bg-card dark:bg-card rounded-2xl p-5 shadow-sm">
                      <div className="text-xs text-muted-foreground dark:text-muted-foreground mb-2">Dinheiro na Gaveta</div>
                      <div className="text-3xl font-bold text-foreground dark:text-white font-glacial">
                        {formatValor(caixaData.liquidez - (caixaData.recebimentos?.pix || 0) - (caixaData.recebimentos?.credito || 0) - (caixaData.recebimentos?.debito || 0) - (caixaData.recebimentos?.vale || 0))}
                      </div>
                      <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">Liquidez − (PIX + Crédito + Débito + Vale)</div>
                    </div>
                  </div>
                </div>

                {/* Tabs Navigation - Desktop */}
                <div className="hidden md:block border-b border-border/40 dark:border-border/40 px-4">
                  <TabsList className="h-auto bg-transparent border-0 gap-1 justify-start max-w-4xl mx-auto p-0">
                    <TabsTrigger value="balanco" className="flex items-center gap-2 data-[state=active]:bg-card dark:data-[state=active]:bg-card data-[state=active]:shadow-sm h-12 px-6 rounded-t-xl rounded-b-none border-0">
                      <PieChart className="w-4 h-4" />
                      <span className={caixaTypo.tab}>Balanço</span>
                    </TabsTrigger>
                    <TabsTrigger value="vendas" className="flex items-center gap-2 data-[state=active]:bg-card dark:data-[state=active]:bg-card data-[state=active]:shadow-sm h-12 px-6 rounded-t-xl rounded-b-none border-0">
                      <Receipt className="w-4 h-4" />
                      <span className={caixaTypo.tab}>Vendas</span>
                    </TabsTrigger>
                    <TabsTrigger value="movimentos" className="flex items-center gap-2 data-[state=active]:bg-card dark:data-[state=active]:bg-card data-[state=active]:shadow-sm h-12 px-6 rounded-t-xl rounded-b-none border-0">
                      <Wallet className="w-4 h-4" />
                      <span className={caixaTypo.tab}>Movimentos</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="balanco" data-caixa-tab-scroll className={`${caixaTabPanel} ${tabPanelPad}`}>
                  <div className="max-w-4xl mx-auto space-y-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CaixaMovimentacoesTurno
                  saldoInicial={caixaData.saldoInicial ?? turnoAtivo?.saldo_inicial ?? 0}
                  totalVendas={caixaData.totalVendas}
                  reforcos={caixaData.reforcos}
                  sangrias={caixaData.sangrias}
                  despesas={caixaData.despesas}
                  liquidez={caixaData.liquidez}
                  fiado={caixaData.recebimentos?.fiado || 0}
                  onVendas={() => setShowVendasDialog(true)}
                  onReforcos={() => setShowReforcosDialog(true)}
                  onSangrias={() => setShowSangriasDialog(true)}
                  onDespesas={() => setShowDespesasDialog(true)}
                  onLiquidez={() => setShowSaldoConsolidadoDialog(true)}
                />

                {/* Recebimentos do Turno */}
                <div className="bg-card dark:bg-card rounded-2xl p-5 shadow-sm">
                  <h3 className={`${caixaTypo.title} mb-4 text-foreground dark:text-white`}>
                    Recebimentos do Turno
                  </h3>
                  <div className="space-y-2">
                    {/* Dinheiro - campo editável clicável (bloqueado em modo visualização) */}
                    <div
                      className={`flex items-center justify-between py-2 px-3 rounded-xl ${modoVisualizacao ? 'bg-muted dark:bg-card' : 'bg-muted/40 dark:bg-muted/50 cursor-pointer hover:bg-muted dark:hover:bg-muted'} transition-colors group`}
                      onClick={() => {
                        if (modoVisualizacao) return;
                        const el = document.getElementById('input-dinheiro-conferido');
                        el?.focus();
                        el?.select();
                      }}>
                      <div>
                        <span className={caixaTypo.label}>Dinheiro</span>
                        <p className={caixaTypo.meta}>{modoVisualizacao ? 'somente leitura' : 'toque para conferir'}</p>
                      </div>
                      <input autoComplete="off"
                        id="input-dinheiro-conferido"
                        type="text"
                        inputMode="decimal"
                        value={recebimentosDinheiro}
                        onChange={(e) => !modoVisualizacao && setRecebimentosDinheiro(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        disabled={modoVisualizacao}
                        className={`w-36 text-right text-lg font-bold bg-transparent border-0 focus:outline-none text-foreground dark:text-white ${modoVisualizacao ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        placeholder={formatarValorExibicao(caixaData.saldoAtual || 0)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 px-3">
                      <span className={caixaTypo.label}>PIX</span>
                      <CaixaValorDisplay valor={caixaData.recebimentos.pix} tone="neutral" signed={false} size="md" />
                    </div>
                    <div className="flex items-center justify-between py-2 px-3">
                      <span className={caixaTypo.label}>Cartão Crédito</span>
                      <CaixaValorDisplay valor={caixaData.recebimentos.credito || 0} tone="neutral" signed={false} size="md" />
                    </div>
                    <div className="flex items-center justify-between py-2 px-3">
                      <span className={caixaTypo.label}>Cartão Débito</span>
                      <CaixaValorDisplay valor={caixaData.recebimentos.debito || 0} tone="neutral" signed={false} size="md" />
                    </div>
                    {(caixaData.recebimentos.vale || 0) > 0 && (
                     <div className="flex items-center justify-between py-2 px-3">
                       <div className="flex items-center gap-2">
                         <span className={caixaTypo.label}>Vale Troca</span>
                         <span className={`text-xs px-1.5 py-0.5 rounded ${caixaClasses('success').pill}`}>não monetário</span>
                       </div>
                       <CaixaValorDisplay valor={caixaData.recebimentos.vale || 0} tone="neutral" signed={false} size="md" />
                     </div>
                    )}
                    {(caixaData.recebimentos.fiado || 0) > 0 && (
                     <div className="flex items-center justify-between py-2 px-3">
                       <div className="flex items-center gap-2">
                         <span className={caixaTypo.label}>Conta a Pagar</span>
                         <span className={`text-xs px-1.5 py-0.5 rounded ${caixaClasses('warning').pill}`}>a receber</span>
                       </div>
                       <CaixaValorDisplay valor={caixaData.recebimentos.fiado || 0} tone="warning" signed={false} size="md" />
                     </div>
                    )}

                    {/* Total e Diferença */}
                    <div className="pt-3 mt-1 border-t border-border/40 dark:border-border/40 space-y-3">
                      {(() => {
                        const dinheiroConferido = roundToTwoDecimals(
                          parseFloat(recebimentosDinheiro.replace(/\./g, '').replace(',', '.')) || 0
                        );
                        // Total conferido = dinheiro(conferido) + pix + crédito + débito (fiado não entra — é a receber)
                        const totalConferido = roundToTwoDecimals(
                          dinheiroConferido + caixaData.recebimentos.pix + (caixaData.recebimentos.credito || 0) + (caixaData.recebimentos.debito || 0)
                        );
                        // Esperado = liquidez (já exclui fiado e vale)
                        const esperado = roundToTwoDecimals(caixaData.liquidez - (caixaData.recebimentos.vale || 0));
                        const diferenca = roundToTwoDecimals(totalConferido - esperado);
                        const temDiferenca = Math.abs(diferenca) > 0.01;

                        return (
                          <>
                            <div className="flex items-center justify-between px-1">
                              <span className={caixaTypo.section}>Total Conferido</span>
                              <CaixaValorDisplay valor={totalConferido} tone="neutral" signed={false} size="lg" />
                            </div>
                            <div className={`p-4 rounded-xl transition-colors ${caixaClasses(conferenciaTone({ temDiferenca, diferenca })).panel}`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-medium ${caixaClasses(conferenciaTone({ temDiferenca, diferenca })).panelText}`}>
                                  {!temDiferenca ? '✓ Confere' : diferenca > 0 ? 'Sobrando' : 'Faltando'}
                                </span>
                                <CaixaValorDisplay
                                  valor={!temDiferenca ? 0 : Math.abs(diferenca)}
                                  tone={conferenciaTone({ temDiferenca, diferenca })}
                                  signed={temDiferenca}
                                  size="lg"
                                />
                              </div>
                              {temDiferenca && (
                                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                                  Esperado: {formatValor(esperado)}
                                </p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                </div>
                </div>

                   {/* Fechamento inline no balanço */}
                   {!modoVisualizacao && (() => {
                     const dinheiroConferido = roundToTwoDecimals(
                       parseFloat(recebimentosDinheiro.replace(/\./g, '').replace(',', '.')) || 0
                     );
                     const totalConferido = roundToTwoDecimals(
                       dinheiroConferido + caixaData.recebimentos.pix + (caixaData.recebimentos.credito || 0) + (caixaData.recebimentos.debito || 0)
                     );
                     // Vale é não-monetário, então não entra na comparação do fechamento
                     const esperado = roundToTwoDecimals(caixaData.liquidez - (caixaData.recebimentos.vale || 0));
                     const diferenca = roundToTwoDecimals(totalConferido - esperado);
                     const temDiferenca = Math.abs(diferenca) > 0.01;
                     const imprimirRelatorio = async () => {
                        const cancelamentos = (turnoAtivo?.cancelamentos_rastro || []);
                        // Vendas: linha principal + sub-linhas por forma de pagamento
                      const linhasVendas = vendasFinalizadas.map(v => {
                         const pagamentos = (v.pagamentos || []);
                         const meta = substituicoesCtx?.metaPorPedidoId?.[v.id];
                         const subLinhas = pagamentos.length > 1
                           ? pagamentos.map(p => `<div style="display:flex;justify-content:space-between;padding:2px 0 2px 16px;font-size:10px;color:#6b7280"><span>${p.forma_pagamento}</span><span>R$ ${(p.valor||0).toFixed(2)}</span></div>`).join('')
                           : '';
                         const formasSingle = pagamentos.length === 1 ? ` · ${pagamentos[0].forma_pagamento} R$ ${(pagamentos[0].valor||0).toFixed(2)}` : '';
                         const linhaSub = meta?.papel === 'substituto' && meta.origem
                           ? `<div style="font-size:10px;color:#b45309;padding-top:2px">↔ Substitui ${meta.origem.numero} (R$ ${(meta.origem.valor_total||0).toFixed(2)})</div>`
                           : '';
                         return `<div style="border-bottom:1px solid #f3f4f6;padding:5px 0">
                           <div style="display:flex;justify-content:space-between;font-size:11px">
                             <span>${v.numero} · ${v.cliente_nome} · ${new Date(v.created_date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${formasSingle}</span>
                             <span style="font-weight:600;color:${CAIXA_PRINT.success};white-space:nowrap;margin-left:8px">+R$ ${(v.valor_total||0).toFixed(2)}</span>
                           </div>${linhaSub}${subLinhas}</div>`;
                       }).join('');
                       // Reforços
                       const linhasReforcos = movimentos.filter(m => m.tipo === 'Reforço').map(m =>
                         `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>${m.numero} · ${format(new Date(m.created_date),'HH:mm')}${m.observacao ? ' · ' + m.observacao : ''}</span><span style="color:${CAIXA_PRINT.success}">+R$ ${(m.valor||0).toFixed(2)}</span></div>`
                       ).join('') || '<p style="color:#9ca3af;font-size:11px;margin:4px 0">Nenhum reforço</p>';
                       // Recolhimentos
                       const linhasRecolhimentos = movimentos.filter(m => m.tipo === 'Sangria' || m.tipo === 'Recolhimento de Caixa').map(m =>
                         `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>${m.numero} · ${format(new Date(m.created_date),'HH:mm')}${m.observacao ? ' · ' + m.observacao : ''}</span><span style="color:${CAIXA_PRINT.info}">-R$ ${(m.valor||0).toFixed(2)}</span></div>`
                       ).join('') || '<p style="color:#9ca3af;font-size:11px;margin:4px 0">Nenhum recolhimento</p>';
                       // Despesas
                       const linhasDespesas = (caixaData.despesasLista || []).map(d =>
                         `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>${d.descricao} · ${d.created_date ? format(new Date(d.created_date),'HH:mm') : ''}</span><span style="color:${CAIXA_PRINT.danger}">-R$ ${(d.valor||0).toFixed(2)}</span></div>`
                       ).join('') || '<p style="color:#9ca3af;font-size:11px;margin:4px 0">Nenhuma despesa</p>';
                       
                       const linhasCancelamentos = cancelamentos.length > 0
                         ? cancelamentos.map(c => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span style="color:${CAIXA_PRINT.danger}">${c.pedido_numero} · ${c.cliente_nome || ''}</span><span style="color:${CAIXA_PRINT.danger}">CANCELADO R$ ${(c.valor_total||0).toFixed(2)}</span></div><div style="font-size:10px;color:${CAIXA_PRINT.muted};padding-bottom:4px">${c.motivo_cancelamento || ''} · ${c.cancelado_por || ''}</div>`).join('')
                         : '<p style="color:#9ca3af;font-size:11px;margin:4px 0">Nenhuma venda cancelada</p>';
                       const html = `<html><head><title>Relatório de Fechamento</title><style>
                         body{font-family:'DIN 1451',DINish,system-ui,sans-serif;font-size:13px;padding:20px;max-width:700px;margin:0 auto}
                         h2{font-size:14px;font-weight:600;margin:14px 0 6px;color:#374151}
                         .row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
                         .total{font-size:15px;font-weight:700}
                         .dashed{border-top:1px dashed #aaa;margin:8px 0}
                       </style></head><body>
                         <div style="text-align:center;margin-bottom:14px"><b style="font-size:16px">VAREJOSYNC</b><br/><span style="color:#9ca3af;font-size:11px">Relatório de Fechamento de Caixa</span></div>
                         <div class="dashed"></div>
                         <h2>Turno</h2>
                         <div class="row"><span>Número:</span><b>${turnoAtivo?.numero}</b></div>
                         <div class="row"><span>Abertura:</span><span>${turnoAtivo?.data_abertura ? new Date(turnoAtivo.data_abertura).toLocaleString('pt-BR') : '-'}</span></div>
                         <div class="row"><span>Fechamento:</span><span>${new Date().toLocaleString('pt-BR')}</span></div>
                         <div class="row"><span>Operador:</span><span>${currentUser?.full_name}</span></div>
                         <div class="dashed"></div>
                         <h2>Movimentações</h2>
                         <div class="row"><span>Saldo Inicial:</span><span>R$ ${(caixaData.saldoInicial||0).toFixed(2)}</span></div>
                         <div class="row"><span>+ Total Vendas:</span><span>R$ ${(caixaData.totalVendas||0).toFixed(2)}</span></div>
                         <div class="row"><span>+ Reforços:</span><span>R$ ${(caixaData.reforcos||0).toFixed(2)}</span></div>
                         <div class="row"><span>− Recolhimentos:</span><span>R$ ${(caixaData.sangrias||0).toFixed(2)}</span></div>
                         <div class="row"><span>− Despesas:</span><span>R$ ${(caixaData.despesas||0).toFixed(2)}</span></div>
                         <div class="dashed"></div>
                         <div class="row total"><span>Liquidez do Turno:</span><span>R$ ${(caixaData.liquidez||0).toFixed(2)}</span></div>
                         <div class="dashed"></div>
                         <h2>Recebimentos por Forma</h2>
                         <div class="row"><span>Dinheiro (gaveta):</span><span>R$ ${(caixaData.saldoAtual||0).toFixed(2)}</span></div>
                         <div class="row"><span>PIX:</span><span>R$ ${(caixaData.recebimentos?.pix||0).toFixed(2)}</span></div>
                         <div class="row"><span>Cartão Crédito:</span><span>R$ ${(caixaData.recebimentos?.credito||0).toFixed(2)}</span></div>
                         <div class="row"><span>Cartão Débito:</span><span>R$ ${(caixaData.recebimentos?.debito||0).toFixed(2)}</span></div>
                         <div class="dashed"></div>
                         <h2>Reforços do Turno</h2>
                         ${linhasReforcos}
                         <div class="dashed"></div>
                         <h2>Recolhimentos do Turno</h2>
                         ${linhasRecolhimentos}
                         <div class="dashed"></div>
                         <h2>Despesas do Turno</h2>
                         ${linhasDespesas}
                         <div class="dashed"></div>
                         <h2>Vendas do Turno (${vendasFinalizadas.length})</h2>
                         ${linhasVendas || '<p style="color:#9ca3af;font-size:11px">Nenhuma venda registrada</p>'}
                         <div class="dashed"></div>
                         <h2>Cancelamentos do Turno (${cancelamentos.length})</h2>
                         ${linhasCancelamentos}
                         <div class="dashed"></div>
                         <p style="text-align:center;font-size:10px;color:#9ca3af;margin-top:14px">Não é documento fiscal</p>
                       </body></html>`;
                       try {
                         await openPrintWindowOrShareHtml(html, `fechamento-pdv-${turnoAtivo?.numero || 'caixa'}.html`, 'Relatório de fechamento', { windowFeatures: 'width=800,height=900' });
                       } catch {
                         alert('Permita pop-ups para imprimir.');
                       }
                     };
                     return (
                       <div ref={fechamentoSectionRef} id="secao-fechamento-caixa" className="bg-card dark:bg-card rounded-2xl p-4 shadow-sm max-w-4xl mx-auto">
                         <div className="flex items-center justify-between mb-3">
                           <h3 className="text-sm font-semibold text-foreground/90 dark:text-muted-foreground">Fechamento de Caixa</h3>
                           {!temDiferenca ? (
                             <span className={`text-xs flex items-center gap-1 ${caixaClasses('success').text}`}><CheckCircle2 className="w-3 h-3" /> Valores conferem</span>
                           ) : (
                             <span className={`text-xs ${caixaClasses(diferenca > 0 ? 'info' : 'danger').text}`}>{diferenca > 0 ? 'Sobrando' : 'Faltando'} {formatValor(Math.abs(diferenca))}</span>
                           )}
                         </div>
                         <div className="flex gap-2">
                           <button onClick={imprimirRelatorio} className="flex-1 h-12 bg-muted dark:bg-muted text-foreground/90 dark:text-muted-foreground rounded-2xl font-medium flex items-center justify-center gap-2 text-sm" style={{ minHeight: '48px' }} disabled={fechandoCaixa}>
                             <Printer className="w-4 h-4" /> Imprimir
                           </button>
                           <FechamentoCaixaButton
                             caixaData={{ ...caixaData, saldoAtual: dinheiroConferido }}
                             recebimentosDinheiro={recebimentosDinheiro}
                             turnoAtivo={turnoAtivo}
                             currentUser={currentUser}
                             contaCaixaPDV={contaCaixaPDV}
                             onFechado={() => {
                               setFechandoCaixa(false);
                               loadData();
                               setView('dashboard');
                             }}
                           />
                         </div>
                       </div>
                     );
                     })()}
                 </TabsContent>

                 <TabsContent value="vendas" data-caixa-tab-scroll className={`${caixaTabPanel} ${tabPanelPad} space-y-3`}>
                   <div className="max-w-4xl mx-auto space-y-4">
                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                       <div className="flex rounded-2xl bg-muted/50 p-1 gap-1">
                         <button
                           type="button"
                           onClick={() => setVendasView('aguardando')}
                           className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${vendasView === 'aguardando' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                         >
                           Aguardando ({rascunhosAguardando.length})
                         </button>
                         <button
                           type="button"
                           onClick={() => setVendasView('consulta')}
                           className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${vendasView === 'consulta' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                         >
                           Consulta ({vendasFinalizadas.length})
                         </button>
                       </div>
                       <button
                         onClick={() => { loadData(undefined, undefined, { force: true }); toast({ title: "✓ Atualizado!", className: CAIXA_TOAST_SUCCESS, duration: 1000 }); }}
                         className="p-2 hover:bg-muted dark:hover:bg-muted rounded-xl transition-colors self-end sm:self-auto"
                         style={{ minWidth: '44px', minHeight: '44px' }}
                         title="Atualizar">
                         <RefreshCw className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
                       </button>
                     </div>

                    {vendasView === 'consulta' ? (
                      <ConsultaVendasCaixa
                        vendasFinalizadas={vendasFinalizadas}
                        onVerDetalhes={setVendaDetalhada}
                      />
                    ) : rascunhosAguardando.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-20 h-20 bg-muted dark:bg-card rounded-full flex items-center justify-center mb-4">
                          <Receipt className="w-10 h-10 text-muted-foreground dark:text-muted-foreground" />
                        </div>
                        <p className={caixaTypo.meta}>Nenhuma venda aguardando</p>
                      </div>
                    ) : (
                      <VirtualizedList
                        items={rascunhosAguardando}
                        estimateSize={174}
                        className="pr-1 md:h-[calc(100vh-220px)]"
                        itemClassName="pb-3"
                        getItemKey={(rascunho) => rascunho.id}
                        renderItem={(rascunho) => (
                          <RascunhoAguardandoCard
                            rascunho={rascunho}
                            onDetalhes={setRascunhoDetalhesTab}
                            onEditar={(item) => window.open(createPageUrl('PDV') + `?mode=vendedor&rascunho_id=${item.id}`, '_blank')}
                            onConfirmar={handleAbrirPedido}
                            formatarValorExibicao={formatarValorExibicao}
                          />
                        )}
                      />
                    )}
                            </div>
                            </TabsContent>

                <TabsContent value="movimentos" data-caixa-tab-scroll className={`${caixaTabPanel} ${tabPanelPad} space-y-3`}>
                  <div className="max-w-4xl mx-auto space-y-3">
                    {/* Botões de ação */}
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => handleAbrirMovimento('Reforço')} disabled={modoVisualizacao}
                        className="h-16 bg-card dark:bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center gap-1 disabled:opacity-40">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${caixaClasses('success').well}`}>
                          <Plus className={`w-4 h-4 ${caixaClasses('success').icon}`} />
                        </div>
                        <div className={caixaTypo.labelSm}>Reforço</div>
                      </button>
                      <button onClick={() => handleAbrirMovimento('Recolhimento de Caixa')} disabled={modoVisualizacao}
                        className="h-16 bg-card dark:bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center gap-1 disabled:opacity-40">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${caixaClasses('info').well}`}>
                          <Minus className={`w-4 h-4 ${caixaClasses('info').icon}`} />
                        </div>
                        <div className={caixaTypo.labelSm}>Recolhimento</div>
                      </button>
                      <button onClick={() => setShowDespesaDialog(true)} disabled={modoVisualizacao}
                        className="h-16 bg-card dark:bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center gap-1 disabled:opacity-40">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${caixaClasses('danger').well}`}>
                          <DollarSign className={`w-4 h-4 ${caixaClasses('danger').icon}`} />
                        </div>
                        <div className={caixaTypo.labelSm}>Despesa</div>
                      </button>
                    </div>

                    {/* Histórico cronológico de movimentos + despesas */}
                    {movimentosTimelineItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground dark:text-muted-foreground">
                          <Wallet className="w-10 h-10 mb-2" />
                          <p className="text-sm">Nenhuma movimentação registrada</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className={`${caixaTypo.meta} px-1`}>Histórico do turno</p>
                          <VirtualizedList
                            items={movimentosTimelineItems}
                            estimateSize={68}
                            className="pr-1 md:h-[calc(100vh-290px)]"
                            itemClassName="pb-2"
                            getItemKey={(item) => item.id}
                            renderItem={(item) => (
                              <MovimentoTimelineCard item={item} />
                            )}
                          />
                        </div>
                      )}
                  </div>
                </TabsContent>

                </Tabs>
                </>
                }

        {view === 'processar' && (
          <ProcessarVendasView
            rascunhosAguardando={rascunhosAguardando}
            onBack={() => setView('dashboard')}
            onRefresh={() => { loadData(undefined, undefined, { force: true }); toast({ title: "✓ Atualizado!", className: CAIXA_TOAST_SUCCESS, duration: 1000 }); }}
            onAbrirPedido={handleAbrirPedido}
            formatarValorExibicao={formatarValorExibicao}
          />
        )}

        <ConfirmarPagamentoDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          pedidoSelecionado={pedidoSelecionado}
          pagamentosDinheiro={pagamentosDinheiro}
          setPagamentosDinheiro={setPagamentosDinheiro}
          inputDinheiro={inputDinheiro}
          setInputDinheiro={setInputDinheiro}
          pagamentosPix={pagamentosPix}
          setPagamentosPix={setPagamentosPix}
          inputPix={inputPix}
          setInputPix={setInputPix}
          pagamentosDebito={pagamentosDebito}
          setPagamentosDebito={setPagamentosDebito}
          inputDebito={inputDebito}
          setInputDebito={setInputDebito}
          pagamentosCredito={pagamentosCredito}
          setPagamentosCredito={setPagamentosCredito}
          inputCredito={inputCredito}
          setInputCredito={setInputCredito}
          parcelasCredito={parcelasCredito}
          setParcelasCredito={setParcelasCredito}
          formaPagamentoAtiva={formaPagamentoAtiva}
          setFormaPagamentoAtiva={setFormaPagamentoAtiva}
          inputRefs={inputRefs}
          handleInputMascara={handleInputMascara}
          pagamentosVale={pagamentosVale}
          setPagamentosVale={setPagamentosVale}
          inputVale={inputVale}
          setInputVale={setInputVale}
          pagamentosContaPagar={pagamentosContaPagar}
          setPagamentosContaPagar={setPagamentosContaPagar}
          inputContaPagar={inputContaPagar}
          setInputContaPagar={setInputContaPagar}
          codigoVale={codigoVale}
          setCodigoVale={setCodigoVale}
          valeEncontrado={valeEncontrado}
          setValeEncontrado={setValeEncontrado}
          buscandoVale={buscandoVale}
          setBuscandoVale={setBuscandoVale}
          maquininhaDebito={maquininhaDebito}
          setMaquininhaDebito={setMaquininhaDebito}
          maquininhaCredito={maquininhaCredito}
          setMaquininhaCredito={setMaquininhaCredito}
          troco={troco}
          valorRestante={valorRestante}
          pagamentoValido={pagamentoValido}
          processandoVenda={processandoVenda}
          formatValor={formatValor}
          formatarValorExibicao={formatarValorExibicao}
          handleFinalizarVenda={handleFinalizarVenda}
          setShowRetornoDialog={setShowRetornoDialog}
          toast={toast}
          base44={base44}
        />

        {/* Dialogs extraídos */}
        <MovimentoDialog
          open={showMovimentoDialog} onOpenChange={setShowMovimentoDialog}
          tipoMovimento={tipoMovimento} setTipoMovimento={setTipoMovimento}
          valorMovimento={valorMovimento} setValorMovimento={setValorMovimento}
          observacaoMovimento={observacaoMovimento} setObservacaoMovimento={setObservacaoMovimento}
          movimentoStep={movimentoStep} setMovimentoStep={setMovimentoStep}
          contaCaixaPDV={contaCaixaPDV}
          onSalvar={handleSalvarMovimento}
          formatarValorExibicao={formatarValorExibicao}
        />
        <ComprovanteMovimentoDialog
          open={showComprovanteMovimento} onOpenChange={setShowComprovanteMovimento}
          movimentoCriado={movimentoCriado} tipoMovimento={tipoMovimento}
          currentUser={currentUser} formatValor={formatValor}
        />

        <CalculadoraCedulasDialog
          open={showCalculadoraCedulas} onOpenChange={setShowCalculadoraCedulas}
          cedulas={cedulas} setCedulas={setCedulas}
          formatValor={formatValor}
          onConfirmar={(total) => {
            setRecebimentosDinheiro(formatarValorExibicao(total));
            setShowCalculadoraCedulas(false);
          }}
        />

        <ConfirmarImpressaoDialog
          open={showConfirmarImpressao}
          onOpenChange={(open) => {
            setShowConfirmarImpressao(open);
            if (!open) {
              setPedidoSelecionado(null);
            }
          }}
          tipo="cupom"
          numero={vendaFinalizada?.numero || (vendaFinalizada?.senha_atendimento || '').slice(-4) || 'S/N'}
          numeroCompleto={
            vendaFinalizada?.numero && vendaFinalizada?.senha_atendimento
              ? `Senha ${(vendaFinalizada.senha_atendimento || '').slice(-4)}`
              : vendaFinalizada?.senha_atendimento || undefined
          }
          onSim={() => setShowComprovanteCaixa(true)}
          onNao={() => {
            setPedidoSelecionado(null);
            if (dadosPromissoria) {
              setShowPromissoria(true);
            }
          }}
        />

        {/* Comprovante de Caixa - aparece após confirmar impressão */}
        <ComprovanteCompra
          pedido={vendaFinalizada}
          open={showComprovanteCaixa}
          onClose={() => {
            setShowComprovanteCaixa(false);
            if (dadosPromissoria) {
              setShowPromissoria(true);
            }
          }}
        />

        {/* Documento de Liberação para Entrega */}
        <LiberacaoEntrega
          open={showLiberacaoEntrega}
          onClose={() => setShowLiberacaoEntrega(false)}
          pedido={vendaFinalizada}
          cliente={clienteVenda} />

        <SaldoValeDialog
          saldoResidualVale={saldoResidualVale}
          onClose={() => setSaldoResidualVale(null)}
          formatValor={formatValor}
        />

        <VendasTurnoDialog
          open={showVendasDialog} onOpenChange={setShowVendasDialog}
          vendasFinalizadas={vendasFinalizadas} turnoAtivo={turnoAtivo}
          caixaData={caixaData} formatValor={formatValor}
          metaPorPedidoId={substituicoesCtx?.metaPorPedidoId}
          onVerDetalhes={setVendaDetalhada}
        />
        <VendaDetalheDialog
          venda={vendaDetalhada} onClose={() => setVendaDetalhada(null)}
          formatValor={formatValor}
        />
        <ListaMovimentosDialog open={showReforcosDialog} onOpenChange={setShowReforcosDialog} tipo="reforcos" movimentos={movimentos} despesasLista={caixaData.despesasLista} totalReforcos={caixaData.reforcos} totalSangrias={caixaData.sangrias} totalDespesas={caixaData.despesas} formatValor={formatValor} onRefresh={loadData} />
        <ListaMovimentosDialog open={showSangriasDialog} onOpenChange={setShowSangriasDialog} tipo="sangrias" movimentos={movimentos} despesasLista={caixaData.despesasLista} totalReforcos={caixaData.reforcos} totalSangrias={caixaData.sangrias} totalDespesas={caixaData.despesas} formatValor={formatValor} onRefresh={loadData} />
        <ListaMovimentosDialog open={showDespesasDialog} onOpenChange={setShowDespesasDialog} tipo="despesas" movimentos={movimentos} despesasLista={caixaData.despesasLista} totalReforcos={caixaData.reforcos} totalSangrias={caixaData.sangrias} totalDespesas={caixaData.despesas} formatValor={formatValor} onRefresh={loadData} />
        <ComprovanteDespesaDialog open={showComprovanteDespesa} onOpenChange={setShowComprovanteDespesa} despesaCriada={despesaCriada} currentUser={currentUser} formatValor={formatValor} />
        <DespesaDialog open={showDespesaDialog} onOpenChange={setShowDespesaDialog} despesaStep={despesaStep} setDespesaStep={setDespesaStep} descricaoDespesa={descricaoDespesa} setDescricaoDespesa={setDescricaoDespesa} categoriaDespesa={categoriaDespesa} setCategoriaDespesa={setCategoriaDespesa} valorDespesaNum={valorDespesaNum} setValorDespesaNum={setValorDespesaNum} contaCaixaPDV={contaCaixaPDV} onSalvar={handleSalvarDespesaNum} salvando={salvandoDespesa} formatarValorExibicao={formatarValorExibicao} isValeFolha={isValeFolhaDespesa} onValeFolhaToggle={handleValeFolhaDespesaToggle} valeFolhaModeloId={valeFolhaModeloIdDespesa} onValeFolhaPessoaChange={handleValeFolhaDespesaPessoa} pessoasFolha={pessoasFolhaDespesa} loadingPessoasFolha={loadingPessoasFolhaDespesa} />
        <RetornoEdicaoDialog open={showRetornoDialog} onOpenChange={setShowRetornoDialog} motivo={motivoRetorno} onMotivoChange={setMotivoRetorno} onConfirmar={handleRetornarParaEdicao} />
        <PromissoriaDialog
          open={showPromissoria}
          onClose={() => { setShowPromissoria(false); }}
          pedido={dadosPromissoria?.pedido}
          valorFiado={dadosPromissoria?.valorFiado}
          empresaNome={configVenda?.nome_empresa || 'VAREJOSYNC'}
        />

        {/* Modal de Detalhes do Rascunho (Aba Vendas) */}
        {rascunhoDetalhesTab && (
          <div
            className="absolute inset-0 z-50 flex items-end bg-black/40 p-4 md:items-center"
            onClick={() => setRascunhoDetalhesTab(null)}
            role="presentation"
          >
            <div
              className="bg-card dark:bg-background rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 dark:border-border/40">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Senha</div>
                  <div className="text-3xl font-bold font-mono text-foreground dark:text-white">{rascunhoDetalhesTab.senha_atendimento?.slice(-4)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-foreground/90 dark:text-muted-foreground">{rascunhoDetalhesTab.cliente_nome || 'Avulso'}</div>
                  <div className="text-xs text-muted-foreground">{rascunhoDetalhesTab.vendedor_nome}</div>
                </div>
                <button onClick={() => setRascunhoDetalhesTab(null)} className="p-2 hover:bg-muted dark:hover:bg-card rounded-xl">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Itens</div>
                {(rascunhoDetalhesTab.itens || []).map((item, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border/30 dark:border-border/40 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-muted dark:bg-card flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground dark:text-white leading-snug">{item.produto_nome}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">R$ {(item.preco_unitario_praticado || 0).toFixed(2)} × {item.quantidade}</div>
                    </div>
                    <div className="text-sm font-semibold text-foreground dark:text-white flex-shrink-0">R$ {formatarValorExibicao(item.total || 0)}</div>
                  </div>
                ))}
                {rascunhoDetalhesTab.valor_desconto > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Desconto</span><span>-R$ {formatarValorExibicao(rascunhoDetalhesTab.valor_desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-foreground dark:text-white pt-2 border-t border-border/40 dark:border-border/40">
                  <span>Total</span><span>R$ {formatarValorExibicao(rascunhoDetalhesTab.valor_total || 0)}</span>
                </div>
                <button
                  onClick={() => { setRascunhoDetalhesTab(null); handleAbrirPedido(rascunhoDetalhesTab); }}
                  className="w-full h-12 p38-btn-primary rounded-2xl font-semibold mt-2">
                  Confirmar Pagamento
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </CaixaOverlayStackProvider>
  );

}