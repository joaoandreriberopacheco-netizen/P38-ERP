import { useState, useEffect, useMemo, useRef } from 'react';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { useScrollChromeVisibility } from '@/hooks/useScrollChromeVisibility';
import { cn } from '@/lib/utils';
import { P38ScrollChromeCollapse } from '@/components/layout/P38ScrollChromeCollapse';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { buildBypassAuthPayload } from '@/components/auth/operacaoAuthFlags';
import { enviarPedidoCompraFinanceiroLote } from '@/lib/enviarPedidoCompraFinanceiro';
import { pedidoLiberadoParaLogistica } from '@/lib/aprovarPedidoCompraFinanceiro';
import { gerarNumeroSequencial } from '@/lib/gerarNumeroSequencial';
import {
  evidenciaAprovacaoFinanceiraProcessada,
  calcValorItensPedidoCompra,
  calcValorTotalPedidoCompra,
  getTotalLinhaPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';

import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';
import { usePedidosCompraGestaoInicialQuery } from '@/hooks/useP38Entities';
import { p38Keys } from '@/lib/p38QueryConfig';
import { calcularPercentuaisLogistica, embarqueRecepcaoDocumentalCompleta, embarqueTemSaldoPendente } from '@/lib/embarqueLogisticaHelpers';
import { getEmbarqueDataRecebimento, recebimentoMatchesFilter } from '@/lib/embarqueRecebimentoDate';
import {
  buildEmbarqueVirtualNecessidade,
  embarqueExcluidoDeNecessidade,
  embarqueNecessidadeTemItensPendentes,
  isNecessidadeRenderizada,
  pedidoDeveExibirCardNecessidade,
  quantidadePendenteNecessidadePedido,
} from '@/lib/pedidoCompraNecessidade';
import { compareEmbarquesConsulta, enrichEmbarqueParaConsulta, buildConsultaItensPendentes, calcConsultaValorEmbarque, buildGruposConsultaEmbarques } from '@/lib/consultaComprasEmbarques';
import { calcValorEmbarqueCard, calcValorEmbarcadoPedido } from '@/lib/embarqueValorFinanceiro';
import { pedidoNaoConcluido } from '@/lib/comprasEmbarqueCards';
import { omitPedidoCompraEspelho } from '@/lib/omitEspelhoPersist';
import ImportadorNotaFiscal from '@/components/compras/ImportadorNotaFiscal';
import FiltrosCompras from '@/components/compras/FiltrosCompras';
import ListaPedidosCompra from '@/components/compras/ListaPedidosCompra';
import ConsultaComprasPedidos from '@/components/compras/ConsultaComprasPedidos';
import StatusPedidoCompraPicker, { statusPedidoCompraExplicitos } from '@/components/compras/StatusPedidoCompraPicker';
import ComprasNovoPedidoFab from '@/components/compras/ComprasNovoPedidoFab';
import { P38TourFab } from '@/components/ui/p38-tour';
import { CONSULTA_EMBARQUES_TOUR, EMBARQUES_LISTA_TOUR } from '@/components/compras/comprasEmbarquesOnboarding';
import ComprasRelatoriosMenu from '@/components/compras/ComprasRelatoriosMenu';
import ComprasOperacoesMenu from '@/components/compras/ComprasOperacoesMenu';
import EnvioFinanceiroLoteDialog from '@/components/compras/EnvioFinanceiroLoteDialog';
import AtualizarPrecosFiltradosDialog from '@/components/compras/AtualizarPrecosFiltradosDialog';
import PedidosCompraOrganizer from '@/components/compras/PedidosCompraOrganizer';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { Package, Receipt } from 'lucide-react';
import {
  COMPRAS_VIEW_TAB_ACTIVE,
  COMPRAS_VIEW_TAB_BTN,
  COMPRAS_VIEW_TAB_GROUP,
  COMPRAS_VIEW_TAB_IDLE,
  COMPRAS_KPI_ACCENT,
} from '@/lib/comprasP38Theme';
import {
  buildPurchaseUnitOptions,
  normalizeUnitCode,
  commercialQuantityFromBase,
  normalizeItemToCanonicalFactorOne,
  getItemCompraExibicaoVitrine,
} from '@/lib/productUnits';
import { toLocalDateKey, formatarSoData, dataHoje } from '@/components/utils/dateUtils';
import {
  FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
  filtroComprasStatusSelInicial,
  passaFiltroVisibilidadePedidosCompra,
} from '@/lib/filtroVisibilidadePedidosCompra';
const toLocalDate = (d) => toLocalDateKey(new Date(d));

const etaMatchesFilter = (embarque, modo, dataRef, inicial, final) => {
  if (!modo) return true;

  const etaKey = embarque?.eta ? toLocalDateKey(embarque.eta) : '';
  if (!etaKey) return false;

  if (modo === 'antes') {
    return !dataRef || etaKey <= dataRef;
  }
  if (modo === 'depois') {
    return !dataRef || etaKey >= dataRef;
  }
  if (modo === 'entre') {
    if (!inicial && !final) return true;
    if (inicial && etaKey < inicial) return false;
    if (final && etaKey > final) return false;
    return true;
  }
  if (modo === 'personalizado') {
    if (!inicial && !final) return true;
    if (inicial && etaKey < inicial) return false;
    if (final && etaKey > final) return false;
    return true;
  }
  return true;
};

const STATUS_EMBARQUE_VIRTUAIS = [
  'Rascunho',
  'Aguardando',
  'Aguardando Aprovação Financeira',
  'Aguardando Liberação Financeira',
  'Aguardando Liberação',
  'Aprovado',
  'Necessidade',
  'Despachado',
  'Concluído',
];

const normalizeStatusFiltro = (status) => {
  if (status === 'Aguardando Liberação') {
    return ['Aguardando Liberação', 'Aguardando Aprovação Financeira', 'Aguardando Liberação Financeira'];
  }
  return [status];
};

const cardMatchesSearch = (card, searchLower, { includeProdutos = false } = {}) => {
  const embarque = card._embarque;
  if (card.numero?.toLowerCase().includes(searchLower)) return true;
  if (card.fornecedor_nome?.toLowerCase().includes(searchLower)) return true;
  if (embarque?.transportadora_nome?.toLowerCase().includes(searchLower)) return true;
  if (includeProdutos && (card.itens || []).some((item) => item.produto_nome?.toLowerCase().includes(searchLower))) {
    return true;
  }
  return false;
};

const passaFiltrosEmbarqueCard = (
  card,
  {
    search,
    statusSel,
    filtroUltimos30Dias,
    filtroSomenteNaoConcluidos,
    tagsSel,
    dataInicial,
    dataFinal,
    etaFiltroModo,
    etaData,
    etaInicial,
    etaFinal,
    recebimentoInicial,
    recebimentoFinal,
    skipSearch = false,
    searchIncludeProdutos = false,
  },
) => {
  const searchLower = search.toLowerCase();
  const dataPedido = card.data_emissao || (card.created_date ? toLocalDate(card.created_date) : '');
  const statusExplicitos = statusSel.filter((status) => status !== '__nao_concluido__');
  const statusPaiSel = statusExplicitos.filter((s) => !STATUS_EMBARQUE_VIRTUAIS.includes(s));
  const statusEmbSel = statusExplicitos.filter((s) => STATUS_EMBARQUE_VIRTUAIS.includes(s));
  const embarque = card._embarque;

  if (!skipSearch && search && !cardMatchesSearch(card, searchLower, { includeProdutos: searchIncludeProdutos })) {
    return false;
  }

  const ocultarConcluidos = (filtroSomenteNaoConcluidos || statusSel.includes('__nao_concluido__'))
    && statusExplicitos.length === 0;
  if (!passaFiltroVisibilidadePedidosCompra(card, {
    somenteNaoConcluidos: ocultarConcluidos,
    ultimos30Dias: filtroUltimos30Dias,
    getDataPedido: (item) => {
      if (item._display_status === 'Concluído') {
        return getEmbarqueDataRecebimento(item)
          || item.data_emissao
          || (item.created_date ? toLocalDate(item.created_date) : '');
      }
      return item.data_emissao || (item.created_date ? toLocalDate(item.created_date) : '');
    },
    isConcluido: (item) => item._display_status === 'Concluído',
  })) return false;

  if (statusExplicitos.length > 0) {
    const statusPaiExpandido = statusPaiSel.flatMap(normalizeStatusFiltro);
    const statusEmbExpandido = statusEmbSel.flatMap(normalizeStatusFiltro);
    const matchPai = statusPaiExpandido.includes(card.status) || statusPaiExpandido.includes(card._display_status);
    const matchEmbarque = statusEmbExpandido.some((s) => {
      if (s === 'Aguardando Embarque') return !embarque?.transportadora_nome && !embarque?.eta;
      if (s === 'Original') return false;
      return embarque?.status_recebimento === s || embarque?.status === s || card._display_status === s;
    });
    if (!matchPai && !matchEmbarque) return false;
  }

  if (tagsSel.length > 0 && !tagsSel.some((t) => (card.tags || []).includes(t))) return false;
  if (dataInicial && (!dataPedido || dataPedido < dataInicial)) return false;
  if (dataFinal && (!dataPedido || dataPedido > dataFinal)) return false;
  if (!etaMatchesFilter(embarque, etaFiltroModo, etaData, etaInicial, etaFinal)) return false;
  if (!recebimentoMatchesFilter(card, recebimentoInicial, recebimentoFinal)) return false;
  return true;
};

const isSemEtaGrupo = (grupo) => {
  const eta = String(grupo?.orderValue || '').split('|')[0];
  return eta === 'sem-eta' || grupo?.key === 'eta_transportadora:sem-dados';
};

const compareGruposPedidosCompra = (a, b, sortOrder, groupBy) => {
  if (groupBy === 'eta_transportadora') {
    const aSem = isSemEtaGrupo(a);
    const bSem = isSemEtaGrupo(b);
    if (aSem !== bSem) return aSem ? -1 : 1;

    const etaA = String(a.orderValue || '').split('|')[0];
    const etaB = String(b.orderValue || '').split('|')[0];

    if (etaA !== 'sem-eta' && etaB !== 'sem-eta') {
      const dateCmp = sortOrder === 'asc'
        ? etaA.localeCompare(etaB, 'pt-BR')
        : etaB.localeCompare(etaA, 'pt-BR');
      if (dateCmp !== 0) return dateCmp;
    }

    return String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR');
  }

  if (sortOrder === 'asc') return String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR');
  return String(b.orderValue).localeCompare(String(a.orderValue), 'pt-BR');
};

function ComprasViewTabsInline({ activeView, onSelect, dataTour }) {
  return (
    <div className={COMPRAS_VIEW_TAB_GROUP} data-tour={dataTour}>
      <button
        type="button"
        className={cn(
          COMPRAS_VIEW_TAB_BTN,
          activeView === 'embarques' ? COMPRAS_VIEW_TAB_ACTIVE : COMPRAS_VIEW_TAB_IDLE,
        )}
        onClick={() => onSelect('embarques')}
        aria-label="Embarques"
        aria-pressed={activeView === 'embarques'}
        data-pulse-sensor="pedidos-compra.tab-embarques"
      >
        <Package className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(
          COMPRAS_VIEW_TAB_BTN,
          activeView === 'consulta' ? COMPRAS_VIEW_TAB_ACTIVE : COMPRAS_VIEW_TAB_IDLE,
        )}
        onClick={() => onSelect('consulta')}
        aria-label="Consulta de compras"
        aria-pressed={activeView === 'consulta'}
        data-pulse-sensor="pedidos-compra.tab-consulta"
      >
        <Receipt className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PedidosCompraPage() {
  const isPhone = useCompactShell();
  const { chromeVisible, scrollRef } = useScrollChromeVisibility(isPhone, {
    revealMode: 'top-only',
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const gestaoQuery = usePedidosCompraGestaoInicialQuery();
  const [pedidos, setPedidos] = useState([]);
  const [embarques, setEmbarques] = useState([]);
  const [produtosMap, setProdutosMap] = useState({});
  const [search, setSearch] = useState('');
  const [statusSel, setStatusSel] = useState(filtroComprasStatusSelInicial);
  const [filtroUltimos30Dias, setFiltroUltimos30Dias] = useState(FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT);
  const [filtroSomenteNaoConcluidos, setFiltroSomenteNaoConcluidos] = useState(FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT);
  const [tagsSel, setTagsSel] = useState([]);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [etaFiltroModo, setEtaFiltroModo] = useState('');
  const [etaData, setEtaData] = useState('');
  const [etaInicial, setEtaInicial] = useState('');
  const [etaFinal, setEtaFinal] = useState('');
  const [recebimentoInicial, setRecebimentoInicial] = useState('');
  const [recebimentoFinal, setRecebimentoFinal] = useState('');
  const [showImportador, setShowImportador] = useState(false);
  const [selecionadosIds, setSelecionadosIds] = useState([]);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [showEnvioDialog, setShowEnvioDialog] = useState(false);
  const [formaPagamentoLote, setFormaPagamentoLote] = useState('Parcelado');
  const [dataPrimeiroVencimentoLote, setDataPrimeiroVencimentoLote] = useState('');
  const [groupBy, setGroupBy] = useState('eta_transportadora');
  const [sortOrder, setSortOrder] = useState('asc');
  const [activeView, setActiveView] = useState('embarques');
  const [showAtualizarPrecosFiltrados, setShowAtualizarPrecosFiltrados] = useState(false);

  useEffect(() => {
    if (!gestaoQuery.data) return;
    setProdutosMap(gestaoQuery.data.produtosMap ?? {});
    setPedidos(gestaoQuery.data.pedidos ?? []);
    setEmbarques(gestaoQuery.data.embarques ?? []);
  }, [gestaoQuery.data]);

  const loading = gestaoQuery.isLoading && !gestaoQuery.data;

  const loadData = async () => {
    await queryClient.invalidateQueries({ queryKey: p38Keys.pedidosCompraGestaoInicial() });
  };

  useEffect(() => {
    if (!gestaoQuery.error) return;
    console.error('Erro ao carregar dados:', gestaoQuery.error);
    toast.error(gestaoQuery.error?.message || 'Erro ao carregar embarques');
  }, [gestaoQuery.error]);

  const handleSave = async (pedidoData) => {
    const sanitizedDataBase = {
      ...pedidoData,
      valor_total: Number(pedidoData.valor_total) || 0,
    };
    const sanitizedData = omitPedidoCompraEspelho(
      (pedidoNaoConcluido(sanitizedDataBase) && Array.isArray(sanitizedDataBase.itens))
        ? { ...sanitizedDataBase, itens: sanitizedDataBase.itens.map((item) => normalizeItemToCanonicalFactorOne(item, 'custo')) }
        : sanitizedDataBase,
    );

    if (sanitizedData.id) {
      await base44.entities.PedidoCompra.update(sanitizedData.id, sanitizedData);
    } else {
      const { id, ...newPedido } = sanitizedData;
      if (!newPedido.numero) {
        newPedido.numero = await gerarNumeroSequencial('PC');
      }
      await base44.entities.PedidoCompra.create(newPedido);
    }
    await loadData();
  };

  const handleDownloadTemplate = () => {
    navigate('/TemplatesCompra');
  };

  const handleOpenPedido = (pedido) => {
    navigate(`/PedidoCompraDetalhe?id=${pedido.id}${pedido._embarque?.id ? `&embarque=${pedido._embarque.id}` : ''}`);
  };

  const handleNovoPedido = () => {
    navigate('/PedidoCompraDetalhe?id=novo');
  };

  const handleImportarPedido = () => {
    navigate('/PedidoCompraDetalhe?id=novo&autoImportador=1');
  };

  const handleToggleSelecao = (pedido) => {
    setSelecionadosIds((prev) => prev.includes(pedido.id)
      ? prev.filter((id) => id !== pedido.id)
      : [...prev, pedido.id]);
  };

  const handleToggleModoSelecao = () => {
    setModoSelecao((prev) => !prev);
    setSelecionadosIds([]);
  };

  const handleAbrirEnvioFinanceiroLote = () => {
    if (!selecionadosIds.length) {
      toast.error('Selecione ao menos um pedido');
      return;
    }
    if (!dataPrimeiroVencimentoLote) {
      setDataPrimeiroVencimentoLote(dataHoje());
    }
    setShowEnvioDialog(true);
  };

  const confirmarEnvioFinanceiroLote = async () => {
    if (!selecionadosIds.length) {
      toast.error('Selecione ao menos um pedido');
      return;
    }

    if (!dataPrimeiroVencimentoLote) {
      toast.error('Informe a data de pagamento ou primeiro vencimento');
      return;
    }

    const pedidosPorId = Object.fromEntries(
      pedidos.filter((p) => selecionadosIds.includes(p.id)).map((p) => [p.id, p]),
    );
    const idsUnicos = [...new Set(selecionadosIds)];

    if (!idsUnicos.length) {
      toast.error('Nenhum pedido válido na seleção');
      return;
    }

    setEnviandoLote(true);
    try {
      const user = await base44.auth.me();
      const authData = await buildBypassAuthPayload(() => base44.auth.me());
      const { enviados, erros } = await enviarPedidoCompraFinanceiroLote({
        base44,
        pedidoIds: idsUnicos,
        pedidosPorId,
        user,
        formaPagamento: formaPagamentoLote,
        dataPrimeiroVencimento: dataPrimeiroVencimentoLote,
        authData,
      });

      setSelecionadosIds([]);
      setModoSelecao(false);
      setShowEnvioDialog(false);

      if (enviados.length) {
        toast.success(`${enviados.length} pedido(s) enviados ao financeiro com conta a pagar criada`);
      }
      if (erros.length) {
        toast.error(
          `${erros.length} pedido(s) não enviados`,
          { description: erros.map((e) => `${e.numero}: ${e.mensagem}`).join(' · ') },
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Erro ao enviar pedidos em lote');
    } finally {
      setEnviandoLote(false);
    }
  };

  const todasTags = useMemo(() => {
    const set = new Set();
    pedidos.forEach(p => (p.tags || []).forEach(t => t && set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [pedidos]);

  const filtrosCompras = useMemo(
    () => ({
      search,
      statusSel,
      filtroUltimos30Dias,
      filtroSomenteNaoConcluidos,
      tagsSel,
      dataInicial,
      dataFinal,
      etaFiltroModo,
      etaData,
      etaInicial,
      etaFinal,
      recebimentoInicial,
      recebimentoFinal,
    }),
    [
      search,
      statusSel,
      filtroUltimos30Dias,
      filtroSomenteNaoConcluidos,
      tagsSel,
      dataInicial,
      dataFinal,
      etaFiltroModo,
      etaData,
      etaInicial,
      etaFinal,
      recebimentoInicial,
      recebimentoFinal,
    ],
  );

  const filtrados = useMemo(
    () => embarques.filter((card) => passaFiltrosEmbarqueCard(card, filtrosCompras)),
    [embarques, filtrosCompras],
  );

  const filtradosSemBusca = useMemo(
    () => embarques.filter((card) => passaFiltrosEmbarqueCard(card, { ...filtrosCompras, skipSearch: true })),
    [embarques, filtrosCompras],
  );

  const calcularValorPendentePedido = (pedido) => {
    const embarques = Array.isArray(pedido._embarques) ? pedido._embarques : [];
    if (!embarques.length) return 0;
    return embarques.reduce((acc, embarque) => {
      const card = { ...pedido, _embarque: embarque, _embarques: embarques };
      return acc + calcConsultaValorEmbarque(card, buildConsultaItensPendentes(card, produtosMap));
    }, 0);
  };

  const pedidosPagosPendentes = useMemo(() => {
    return filtrados.filter((pedido) => {
      const aprovadoFinanceiro =
        pedidoLiberadoParaLogistica(pedido) ||
        pedido._display_status === 'Aprovado';
      const ehNecessidade = !!pedido._is_necessidade || pedido._embarque?.tipo === 'Necessidade';
      const aindaNaoRecebido = pedido._display_status !== 'Concluído';
      const aindaNaoEhAguardandoPagamento = ehNecessidade || !['Aguardando Aprovação Financeira', 'Aguardando Liberação Financeira', 'Aguardando Liberação', 'Aguardando'].includes(pedido._display_status);
      return aprovadoFinanceiro && aindaNaoRecebido && aindaNaoEhAguardandoPagamento;
    });
  }, [filtrados]);

  const valorTotal = useMemo(() => {
    return filtrados.reduce((acc, pedido) => acc + (pedido._display_valor ?? pedido.valor_total ?? 0), 0);
  }, [filtrados]);

  const valorPagoNaoEntregue = useMemo(() => {
    return pedidosPagosPendentes.reduce((acc, pedido) => acc + Number(pedido._display_valor || 0), 0);
  }, [pedidosPagosPendentes]);

  const STATUS_VIRTUAL_CONCLUIDOS = ['Recebido OK', 'Concluído'];

  const grupos = useMemo(() => {
    const getGroupMeta = (pedido, embarque) => {
      if (groupBy === 'fornecedor') {
        const fornecedor = pedido.fornecedor_nome?.trim() || 'Sem fornecedor';
        return { key: `fornecedor:${fornecedor}`, label: fornecedor, orderValue: fornecedor.toLowerCase() };
      }

      if (groupBy === 'status') {
        const status = pedido._display_status || pedido.status || 'Sem status';
        return { key: `status:${status}`, label: status, orderValue: status.toLowerCase() };
      }

      if (groupBy === 'eta_transportadora') {
        const eta = embarque?.eta ? toLocalDate(embarque.eta) : 'sem-eta';
        const transportadora = embarque?.transportadora_nome?.trim() || 'Sem transportadora';
        const semDados = eta === 'sem-eta' && transportadora === 'Sem transportadora';
        return {
          key: semDados ? 'eta_transportadora:sem-dados' : `eta_transportadora:${eta}:${transportadora}`,
          label: semDados ? 'Sem ETA / Sem transportadora' : `${eta === 'sem-eta' ? 'Sem ETA' : formatarSoData(eta)} · ${transportadora}`,
          orderValue: `${eta}|${transportadora.toLowerCase()}`,
          groupDate: semDados || eta === 'sem-eta' ? 'Sem ETA' : formatarSoData(eta),
          groupCarrier: semDados ? 'Sem transportadora' : transportadora,
        };
      }

      const dataKey = pedido.data_emissao || (pedido.created_date ? toLocalDate(pedido.created_date) : null);
      const key = dataKey || 'sem-data';
      const hoje = dataHoje();
      let label = 'Sem data';
      if (key !== 'sem-data') {
        label = key === hoje ? 'Hoje' : formatarSoData(key);
      }
      return { key: `data_pedido:${key}`, label, orderValue: key };
    };

    const compareValues = (a, b) => {
      if (sortOrder === 'asc') return String(a).localeCompare(String(b), 'pt-BR');
      return String(b).localeCompare(String(a), 'pt-BR');
    };

    const map = {};

    filtrados.forEach((pedido) => {
      const embarque = pedido._embarque;
      const meta = getGroupMeta(pedido, embarque);

      if (!map[meta.key]) {
        map[meta.key] = {
          key: meta.key,
          label: meta.label,
          orderValue: meta.orderValue,
          groupDate: meta.groupDate ?? null,
          groupCarrier: meta.groupCarrier ?? null,
          pedidos: [],
        };
      }

      map[meta.key].pedidos.push({
        ...pedido,
        _is_virtual_concluido: STATUS_VIRTUAL_CONCLUIDOS.includes(pedido._display_status),
        valor_pendente_entrega: pedido.status === 'Concluído' ? 0 : calcularValorPendentePedido(pedido)
      });
    });

    return Object.values(map)
      .sort((a, b) => compareGruposPedidosCompra(a, b, sortOrder, groupBy))
      .map((grupo) => {
        const pedidosSort = grupo.pedidos.sort((a, b) => {
          const valorA = a.data_emissao || a.created_date || '';
          const valorB = b.data_emissao || b.created_date || '';
          return compareValues(valorA, valorB);
        });

        return {
          key: grupo.key,
          label: grupo.label,
          groupDate: grupo.groupDate,
          groupCarrier: grupo.groupCarrier,
          pedidos: pedidosSort,
          _total_eta: pedidosSort.reduce((acc, p) => acc + (p._display_valor || 0), 0)
        };
      });
  }, [filtrados, groupBy, sortOrder, produtosMap]);

  const hasEtaFilter = etaFiltroModo && (
    (['antes', 'depois'].includes(etaFiltroModo) && etaData) ||
    (etaFiltroModo === 'entre' && (etaInicial || etaFinal)) ||
    (etaFiltroModo === 'personalizado' && (etaInicial || etaFinal))
  );
  const hasActiveFilters = search || tagsSel.length > 0 || dataInicial || dataFinal || hasEtaFilter
    || recebimentoInicial || recebimentoFinal
    || statusPedidoCompraExplicitos(statusSel).length > 0
    || filtroUltimos30Dias !== FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT
    || filtroSomenteNaoConcluidos !== FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT;

  const pedidosConsulta = useMemo(() => {
    let cards = filtrados;

    if (search) {
      const keysVisiveis = new Set(filtrados.map((card) => card._virtual_key));
      const searchLower = search.toLowerCase();
      const extras = filtradosSemBusca.filter(
        (card) => !keysVisiveis.has(card._virtual_key)
          && cardMatchesSearch(card, searchLower, { includeProdutos: true }),
      );
      if (extras.length) cards = [...filtrados, ...extras];
    }

    return cards
      .map((card) => enrichEmbarqueParaConsulta(card, produtosMap))
      .sort((a, b) => compareEmbarquesConsulta(a, b, sortOrder, groupBy));
  }, [filtrados, filtradosSemBusca, search, sortOrder, groupBy, produtosMap]);

  const gruposConsultaRelatorio = useMemo(
    () => buildGruposConsultaEmbarques(pedidosConsulta, groupBy, sortOrder).map((g) => ({
      key: g.key,
      label: g.label,
      groupDate: g.groupDate,
      groupCarrier: g.groupCarrier,
      pedidos: g.cards,
      _total_eta: g.totalConsulta,
    })),
    [pedidosConsulta, groupBy, sortOrder],
  );

  return (
    <>
    <div
      className={cn(
        'w-full min-w-0 max-w-full font-din-1451 bg-background',
        isPhone
          ? 'flex flex-col h-full min-h-0 overflow-hidden'
          : 'flex flex-col h-full min-h-0 overflow-hidden',
      )}
    >
      {isPhone ? (
        <>
          <P38ScrollChromeCollapse visible={chromeVisible} enabled className="shrink-0">
            <div className="space-y-4 px-4">
              {/* Header */}
              <div className="pb-3 mb-1 flex flex-col gap-3">
                <div
                  className="space-y-1.5 min-w-0"
                  data-tour={activeView === 'consulta' ? 'consulta-header' : 'embarques-header'}
                >
                  <p className="text-xl font-medium text-foreground font-din-1451">
                    {activeView === 'consulta' ? 'Consulta de compras' : 'Embarques'}
                  </p>
                  {activeView === 'consulta' ? (
                    <p className="text-sm leading-normal text-foreground/85 font-din-1451">
                      {pedidosConsulta.length} embarque{pedidosConsulta.length === 1 ? '' : 's'} no período
                    </p>
                  ) : (
                    <>
                      <p className="text-sm leading-normal text-foreground/85 font-din-1451">{filtrados.length} embarques visíveis · R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className={cn('text-sm leading-normal font-din-1451', COMPRAS_KPI_ACCENT)}>Aprovados financeiramente e ainda não recebidos no filtro: R$ {valorPagoNaoEntregue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </>
                  )}
                </div>
                {activeView === 'embarques' || activeView === 'consulta' ? (
                  <div
                    className="flex items-center gap-2 justify-end flex-nowrap max-w-full overflow-x-auto"
                    data-tour={activeView === 'consulta' ? 'consulta-relatorios' : 'embarques-operacoes'}
                  >
                    <P38TourFab
                      key={activeView}
                      steps={activeView === 'consulta' ? CONSULTA_EMBARQUES_TOUR : EMBARQUES_LISTA_TOUR}
                      label={activeView === 'consulta' ? 'Tour: Consulta de embarques' : 'Tour: Embarques'}
                    />
                    <ComprasRelatoriosMenu
                      pedidos={activeView === 'consulta' ? pedidosConsulta : filtrados}
                      grupos={activeView === 'consulta' ? gruposConsultaRelatorio : grupos}
                      produtosMap={produtosMap}
                      groupBy={groupBy}
                      sortOrder={sortOrder}
                      filtrosDesc={`Busca: ${search || 'todas'} · Status: ${statusSel.join(', ') || 'todos'} · Tags: ${tagsSel.length || 0} · Período: ${dataInicial || '-'} até ${dataFinal || '-'} · ETA: ${etaFiltroModo || 'todos'}${etaFiltroModo === 'antes' || etaFiltroModo === 'depois' ? ` (${etaData || '-'})` : ''}${etaFiltroModo === 'entre' || etaFiltroModo === 'personalizado' ? ` (${etaInicial || '-'} até ${etaFinal || '-'})` : ''}`}
                      kpis={{
                        totalPedidos: filtrados.length,
                        totalGeral: valorTotal,
                        totalEmAberto: filtrados.filter(p => ['Rascunho', 'Aguardando Aprovação Financeira', 'Aprovado'].includes(p.status)).reduce((acc, p) => acc + Number(p._display_valor || p.valor_total || 0), 0),
                        totalPagoNaoEntregue: valorPagoNaoEntregue,
                      }}
                    />
                    <ComprasOperacoesMenu
                      onImportarPedido={handleImportarPedido}
                      onImportarNF={() => setShowImportador(true)}
                      onDownloadTemplate={handleDownloadTemplate}
                      onEnviarFinanceiroLote={handleAbrirEnvioFinanceiroLote}
                      onToggleModoSelecao={handleToggleModoSelecao}
                      onAtualizarPrecosFiltrados={() => setShowAtualizarPrecosFiltrados(true)}
                      modoSelecao={modoSelecao}
                      quantidadeSelecionados={selecionadosIds.length}
                      enviandoLote={enviandoLote}
                    />
                    <PedidosCompraOrganizer
                      groupBy={groupBy}
                      sortOrder={sortOrder}
                      onGroupByChange={setGroupBy}
                      onSortOrderToggle={() => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc')}
                    />
                    <StatusPedidoCompraPicker
                      statusSel={statusSel}
                      onStatusSel={setStatusSel}
                      onFiltroSomenteNaoConcluidos={setFiltroSomenteNaoConcluidos}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </P38ScrollChromeCollapse>

          <div className="shrink-0 px-4 pb-2" data-tour={activeView === 'consulta' ? 'consulta-filtros' : 'embarques-filtros'}>
            <FiltrosCompras
              mobileLeading={(
                <ComprasViewTabsInline
                  activeView={activeView}
                  onSelect={setActiveView}
                  dataTour={activeView === 'consulta' ? 'consulta-tabs' : 'embarques-tabs'}
                />
              )}
              search={search} onSearch={setSearch}
              filtroUltimos30Dias={filtroUltimos30Dias} onFiltroUltimos30Dias={setFiltroUltimos30Dias}
              filtroSomenteNaoConcluidos={filtroSomenteNaoConcluidos} onFiltroSomenteNaoConcluidos={setFiltroSomenteNaoConcluidos}
              statusSel={statusSel} onStatusSel={setStatusSel}
              todasTags={todasTags} tagsSel={tagsSel} onTagsSel={setTagsSel}
              dataInicial={dataInicial} onDataInicial={setDataInicial}
              dataFinal={dataFinal} onDataFinal={setDataFinal}
              etaFiltroModo={etaFiltroModo} onEtaFiltroModo={setEtaFiltroModo}
              etaData={etaData} onEtaData={setEtaData}
              etaInicial={etaInicial} onEtaInicial={setEtaInicial}
              etaFinal={etaFinal} onEtaFinal={setEtaFinal}
              recebimentoInicial={recebimentoInicial} onRecebimentoInicial={setRecebimentoInicial}
              recebimentoFinal={recebimentoFinal} onRecebimentoFinal={setRecebimentoFinal}
              hasActiveFilters={hasActiveFilters}
              onLimparFiltros={() => {
                setSearch('');
                setStatusSel(filtroComprasStatusSelInicial());
                setFiltroUltimos30Dias(FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT);
                setFiltroSomenteNaoConcluidos(FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT);
                setTagsSel([]);
                setDataInicial('');
                setDataFinal('');
                setEtaFiltroModo('');
                setEtaData('');
                setEtaInicial('');
                setEtaFinal('');
                setRecebimentoInicial('');
                setRecebimentoFinal('');
              }}
            />
          </div>

          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y px-4 pb-4"
          >
            {activeView === 'embarques' ? (
              <div data-tour="embarques-lista">
                <ListaPedidosCompra
                  grupos={grupos}
                  loading={loading}
                  onEdit={handleOpenPedido}
                  onDelete={loadData}
                  selecionadosIds={selecionadosIds}
                  onToggleSelecao={handleToggleSelecao}
                  modoSelecao={modoSelecao}
                />
              </div>
            ) : loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40" />
              </div>
            ) : (
              <div data-tour="consulta-tabela">
                <ConsultaComprasPedidos
                  pedidosFiltrados={pedidosConsulta}
                  onVerPedido={handleOpenPedido}
                  groupBy={groupBy}
                  sortOrder={sortOrder}
                  contextLabel="Resumo do período"
                  emptyMessage="Nenhum embarque no período selecionado"
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
      <div className="shrink-0 space-y-4 px-4 md:px-6 pt-4 md:pt-6">
      {/* Header */}
      <div className="pb-3 mb-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div
          className="space-y-1.5 min-w-0"
          data-tour={activeView === 'consulta' ? 'consulta-header' : 'embarques-header'}
        >
          <p className="text-xl font-medium text-foreground font-din-1451">
            {activeView === 'consulta' ? 'Consulta de compras' : 'Embarques'}
          </p>
          {activeView === 'consulta' ? (
            <p className="text-sm leading-normal text-foreground/85 font-din-1451">
              {pedidosConsulta.length} embarque{pedidosConsulta.length === 1 ? '' : 's'} no período
            </p>
          ) : (
            <>
              <p className="text-sm leading-normal text-foreground/85 font-din-1451">{filtrados.length} embarques visíveis · R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm leading-normal text-emerald-600 dark:text-emerald-400">Aprovados financeiramente e ainda não recebidos no filtro: R$ {valorPagoNaoEntregue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </>
          )}
        </div>
        {activeView === 'embarques' || activeView === 'consulta' ? (
          <div
            className="flex items-center gap-2 flex-wrap justify-end"
            data-tour={activeView === 'consulta' ? 'consulta-relatorios' : 'embarques-operacoes'}
          >
            <P38TourFab
              key={activeView}
              steps={activeView === 'consulta' ? CONSULTA_EMBARQUES_TOUR : EMBARQUES_LISTA_TOUR}
              label={activeView === 'consulta' ? 'Tour: Consulta de embarques' : 'Tour: Embarques'}
            />
            <ComprasRelatoriosMenu
              pedidos={activeView === 'consulta' ? pedidosConsulta : filtrados}
              grupos={activeView === 'consulta' ? gruposConsultaRelatorio : grupos}
              produtosMap={produtosMap}
              groupBy={groupBy}
              sortOrder={sortOrder}
              filtrosDesc={`Busca: ${search || 'todas'} · Status: ${statusSel.join(', ') || 'todos'} · Tags: ${tagsSel.length || 0} · Período: ${dataInicial || '-'} até ${dataFinal || '-'} · ETA: ${etaFiltroModo || 'todos'}${etaFiltroModo === 'antes' || etaFiltroModo === 'depois' ? ` (${etaData || '-'})` : ''}${etaFiltroModo === 'entre' || etaFiltroModo === 'personalizado' ? ` (${etaInicial || '-'} até ${etaFinal || '-'})` : ''}`}
              kpis={{
                totalPedidos: filtrados.length,
                totalGeral: valorTotal,
                totalEmAberto: filtrados.filter(p => ['Rascunho', 'Aguardando Aprovação Financeira', 'Aprovado'].includes(p.status)).reduce((acc, p) => acc + Number(p._display_valor || p.valor_total || 0), 0),
                totalPagoNaoEntregue: valorPagoNaoEntregue,
              }}
            />
            <ComprasOperacoesMenu
              onImportarPedido={handleImportarPedido}
              onImportarNF={() => setShowImportador(true)}
              onDownloadTemplate={handleDownloadTemplate}
              onEnviarFinanceiroLote={handleAbrirEnvioFinanceiroLote}
              onToggleModoSelecao={handleToggleModoSelecao}
              onAtualizarPrecosFiltrados={() => setShowAtualizarPrecosFiltrados(true)}
              modoSelecao={modoSelecao}
              quantidadeSelecionados={selecionadosIds.length}
              enviandoLote={enviandoLote}
            />
            <PedidosCompraOrganizer
              groupBy={groupBy}
              sortOrder={sortOrder}
              onGroupByChange={setGroupBy}
              onSortOrderToggle={() => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc')}
            />
            <StatusPedidoCompraPicker
              statusSel={statusSel}
              onStatusSel={setStatusSel}
              onFiltroSomenteNaoConcluidos={setFiltroSomenteNaoConcluidos}
            />
          </div>
        ) : null}
      </div>

      <div data-tour={activeView === 'consulta' ? 'consulta-tabs' : 'embarques-tabs'}>
      <GlacialTabsList
        className="w-full"
        scrollable
      >
        <GlacialTabsTrigger value="embarques" activeValue={activeView} onSelect={setActiveView} label="Embarques" icon={Package} pulseSensor="pedidos-compra.tab-embarques" />
        <GlacialTabsTrigger value="consulta" activeValue={activeView} onSelect={setActiveView} label="Consulta" icon={Receipt} pulseSensor="pedidos-compra.tab-consulta" />
      </GlacialTabsList>
      </div>

      <div data-tour={activeView === 'consulta' ? 'consulta-filtros' : 'embarques-filtros'}>
      <FiltrosCompras
        search={search} onSearch={setSearch}
        filtroUltimos30Dias={filtroUltimos30Dias} onFiltroUltimos30Dias={setFiltroUltimos30Dias}
        filtroSomenteNaoConcluidos={filtroSomenteNaoConcluidos} onFiltroSomenteNaoConcluidos={setFiltroSomenteNaoConcluidos}
        statusSel={statusSel} onStatusSel={setStatusSel}
        todasTags={todasTags} tagsSel={tagsSel} onTagsSel={setTagsSel}
        dataInicial={dataInicial} onDataInicial={setDataInicial}
        dataFinal={dataFinal} onDataFinal={setDataFinal}
        etaFiltroModo={etaFiltroModo} onEtaFiltroModo={setEtaFiltroModo}
        etaData={etaData} onEtaData={setEtaData}
        etaInicial={etaInicial} onEtaInicial={setEtaInicial}
        etaFinal={etaFinal} onEtaFinal={setEtaFinal}
        recebimentoInicial={recebimentoInicial} onRecebimentoInicial={setRecebimentoInicial}
        recebimentoFinal={recebimentoFinal} onRecebimentoFinal={setRecebimentoFinal}
        hasActiveFilters={hasActiveFilters}
        onLimparFiltros={() => {
          setSearch('');
          setStatusSel(filtroComprasStatusSelInicial());
          setFiltroUltimos30Dias(FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT);
          setFiltroSomenteNaoConcluidos(FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT);
          setTagsSel([]);
          setDataInicial('');
          setDataFinal('');
          setEtaFiltroModo('');
          setEtaData('');
          setEtaInicial('');
          setEtaFinal('');
          setRecebimentoInicial('');
          setRecebimentoFinal('');
        }}
      />
      </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 md:px-6 pb-4 md:pb-6">
      {activeView === 'embarques' ? (
        <div data-tour="embarques-lista">
        <ListaPedidosCompra
          grupos={grupos}
          loading={loading}
          onEdit={handleOpenPedido}
          onDelete={loadData}
          selecionadosIds={selecionadosIds}
          onToggleSelecao={handleToggleSelecao}
          modoSelecao={modoSelecao}
        />
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40" />
        </div>
      ) : (
        <div data-tour="consulta-tabela">
        <ConsultaComprasPedidos
          pedidosFiltrados={pedidosConsulta}
          onVerPedido={handleOpenPedido}
          groupBy={groupBy}
          sortOrder={sortOrder}
          contextLabel="Resumo do período"
          emptyMessage="Nenhum embarque no período selecionado"
        />
        </div>
      )}
      </div>
        </>
      )}
    </div>

      <ImportadorNotaFiscal 
        isOpen={showImportador}
        onClose={() => setShowImportador(false)}
        onSuccess={loadData}
      />

      <ComprasNovoPedidoFab onNovopedido={handleNovoPedido} dataTour="embarques-novo-pedido" />

      <EnvioFinanceiroLoteDialog
        open={showEnvioDialog}
        onOpenChange={setShowEnvioDialog}
        formaPagamento={formaPagamentoLote}
        onFormaPagamentoChange={setFormaPagamentoLote}
        dataPrimeiroVencimento={dataPrimeiroVencimentoLote}
        onDataPrimeiroVencimentoChange={setDataPrimeiroVencimentoLote}
        quantidadeSelecionados={selecionadosIds.length}
        onConfirm={confirmarEnvioFinanceiroLote}
        loading={enviandoLote}
      />

      <AtualizarPrecosFiltradosDialog
        isOpen={showAtualizarPrecosFiltrados}
        onClose={(updated) => {
          setShowAtualizarPrecosFiltrados(false);
          if (updated) loadData();
        }}
        pedidosFiltrados={pedidosConsulta}
      />

    </>
  );
}