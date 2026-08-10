import { memo, useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { base44 } from '@/api/base44Client';
import {
  usePedidosVendaListQuery,
  useRascunhosPedidoVendaListQuery,
  useP38QueryInvalidation,
} from '@/hooks/useP38Entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VendasRelatorisFAB from '@/components/vendas/VendasRelatorisFAB';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Edit, ShoppingCart, Eye, FileText, MoreHorizontal, RotateCcw, RefreshCw, CreditCard, Printer, SlidersHorizontal, Ban, Ticket, Receipt, UserRoundPen } from 'lucide-react';
import DetalhesPedidoVenda from '@/components/vendas/DetalhesPedidoVenda';
import AlterarPagamentoDialog from '@/components/vendas/AlterarPagamentoDialog';
import AlterarClientePedidoDialog from '@/components/vendas/AlterarClientePedidoDialog';
import ComprovantePreVenda from '@/components/vendas/ComprovantePreVenda';
import ComprovanteCompra from '@/components/vendas/ComprovanteCompra';

import { createPageUrl } from '@/components/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  listarFormasPagamentoParaFiltro,
  pedidoMatchesFormasPagamento,
} from '@/lib/formasPagamentoVenda';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import MobileDateRangePicker from '@/components/vendas/MobileDateRangePicker';
import ValesTrocaTab from '@/components/vendas/ValesTrocaTab';
import ConsultaVendasCaixa from '@/components/vendas/caixa/ConsultaVendasCaixa';
import FormaPagamentoBadges from '@/components/vendas/FormaPagamentoBadges';
import { STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA } from '@/lib/pdvCaixaTurnoVendas';
import { dataHoje, boundsMesCivil, formatarDataHora, formatarSoData, toLocalDateKey } from '@/components/utils/dateUtils';
const fmtDtHora = (d) => d ? formatarDataHora(d) : '-';
const fmtDataCurta = (d) => d ? formatarSoData(d) : '';

function getPeriodoMesCorrente() {
  const hoje = dataHoje();
  const [year, month] = hoje.split('-').map(Number);
  return boundsMesCivil(year, month - 1);
}
const dateRangeMatches = (valor, inicio, fim) => {
  const chave = toLocalDateKey(valor);
  if (!chave) return false;
  if (inicio && chave < inicio) return false;
  if (fim && chave > fim) return false;
  return true;
};

/** Evita crash do Radix Select quando o status não existe nas opções da aba ativa. */
const STATUS_OPCOES_POR_ABA = {
  rascunhos: ['Criado', 'Em Edição', 'Aguardando Caixa', 'Convertido', 'Cancelado'],
  pedidos: ['Orçamento', 'Aguardando Caixa', 'Financeiro OK', 'Em Separação', 'Pedido Concluído', 'Cancelado'],
  consulta: ['Financeiro OK', 'Em Separação', 'Em Rota de Entrega', 'Pedido Concluído'],
  vales: ['Ativo', 'Utilizado Parcialmente', 'Utilizado', 'Expirado', 'Cancelado'],
};

const STATUS_LABEL_CURTO = {
  'Aguardando Caixa': 'Ag. Caixa',
  'Pedido Concluído': 'Concluído',
};

function statusOpcoesParaAba(activeTab) {
  return STATUS_OPCOES_POR_ABA[activeTab] || STATUS_OPCOES_POR_ABA.pedidos;
}

function resolveStatusFiltroParaAba(statusFiltro, activeTab) {
  if (statusFiltro === 'todos') return 'todos';
  const opcoes = statusOpcoesParaAba(activeTab);
  return opcoes.includes(statusFiltro) ? statusFiltro : 'todos';
}

/** Acima do Drawer (z-310) para o dropdown não ficar atrás do painel de filtros. */
const FILTRO_SELECT_CONTENT =
  'z-[320] max-h-[min(50vh,20rem)] border border-border/40 bg-popover shadow-lg dark:border-white/10 dark:bg-card';

const VIRTUAL_LIST_STYLE = { maxHeight: 'calc(100vh - 260px)' };
const VIRTUAL_OVERSCAN = 8;

const getVirtualPadding = (virtualItems, totalSize) => {
  if (virtualItems.length === 0) {
    return { paddingTop: 0, paddingBottom: 0 };
  }

  const paddingTop = virtualItems[0]?.start ?? 0;
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingBottom = Math.max(0, totalSize - (lastItem?.end ?? 0));

  return { paddingTop, paddingBottom };
};

function PedidoActionsMenu({
  pedido,
  align = 'end',
  triggerClassName = 'h-8 w-8 text-muted-foreground',
  onVerDetalhes,
  onEdit,
  onReimprimir,
  onCorrigirCliente,
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={triggerClassName}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="dark:bg-muted">
        <DropdownMenuItem onClick={() => onVerDetalhes(pedido)}>
          <Eye className="w-4 h-4 mr-2" /> Ver Detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(pedido)}>
          <Edit className="w-4 h-4 mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCorrigirCliente(pedido)}>
          <UserRoundPen className="w-4 h-4 mr-2" /> Corrigir cliente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReimprimir(pedido)}>
          <Printer className="w-4 h-4 mr-2" /> Reimprimir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PedidoMobileLine({ pedido, onVerDetalhes, onEdit, onReimprimir, onCorrigirCliente, striped }) {
  const tone = p38StatusTone(pedido.status);

  return (
    <P38MobileLine
      striped={striped}
      accent={p38AccentKeyFromTone(tone)}
      title={pedido.cliente_nome || 'Cliente não informado'}
      subtitle={pedido.numero}
      meta={
        <>
          <P38StatusLabel tone={tone}>{pedido.status}</P38StatusLabel>
          <FormaPagamentoBadges pagamentos={pedido.pagamentos} size="xs" />
          {pedido.vendedor_nome ? <span className="truncate">{pedido.vendedor_nome}</span> : null}
        </>
      }
      value={`R$ ${(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      valueSub={fmtDataCurta(pedido.created_date)}
      trailing={
        <PedidoActionsMenu
          pedido={pedido}
          triggerClassName="h-8 w-8 text-muted-foreground shrink-0"
          onVerDetalhes={onVerDetalhes}
          onEdit={onEdit}
          onReimprimir={onReimprimir}
          onCorrigirCliente={onCorrigirCliente}
        />
      }
    />
  );
}

function VirtualizedPedidoCards({ pedidos, onVerDetalhes, onEdit, onReimprimir, onCorrigirCliente }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: pedidos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    getItemKey: (index) => pedidos[index]?.id ?? index,
    overscan: VIRTUAL_OVERSCAN,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <P38MobileLineList ref={parentRef} className="pr-1" style={VIRTUAL_LIST_STYLE}>
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {virtualItems.map((virtualRow) => {
          const pedido = pedidos[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <PedidoMobileLine
                pedido={pedido}
                striped={virtualRow.index % 2 === 1}
                onVerDetalhes={onVerDetalhes}
                onEdit={onEdit}
                onReimprimir={onReimprimir}
                onCorrigirCliente={onCorrigirCliente}
              />
            </div>
          );
        })}
      </div>
    </P38MobileLineList>
  );
}

function VirtualizedPedidosTable({ pedidos, onVerDetalhes, onEdit, onReimprimir, onCorrigirCliente }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: pedidos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    getItemKey: (index) => pedidos[index]?.id ?? index,
    overscan: VIRTUAL_OVERSCAN,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const { paddingTop, paddingBottom } = getVirtualPadding(virtualItems, rowVirtualizer.getTotalSize());

  return (
    <div ref={parentRef} className="hidden desktop-layout:block min-w-0 overflow-auto" style={VIRTUAL_LIST_STYLE}>
      <P38TableShell className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && (
              <TableRow aria-hidden="true" className="border-0">
                <TableCell colSpan={6} style={{ height: `${paddingTop}px`, padding: 0 }} />
              </TableRow>
            )}
            {virtualItems.map((virtualRow) => {
              const pedido = pedidos[virtualRow.index];
              const tone = p38StatusTone(pedido.status);

              return (
                <TableRow
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                >
                  <TableCell>
                    <PedidoActionsMenu
                      pedido={pedido}
                      align="start"
                      onVerDetalhes={onVerDetalhes}
                      onEdit={onEdit}
                      onReimprimir={onReimprimir}
                      onCorrigirCliente={onCorrigirCliente}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{pedido.cliente_nome || '-'}</div>
                    <div className="text-xs text-muted-foreground">{pedido.numero}</div>
                    <FormaPagamentoBadges pagamentos={pedido.pagamentos} className="mt-1" size="xs" />
                  </TableCell>
                  <TableCell>
                    <P38StatusLabel tone={tone}>{pedido.status}</P38StatusLabel>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{pedido.vendedor_nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDtHora(pedido.created_date)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground tabular-nums">
                    R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              );
            })}
            {paddingBottom > 0 && (
              <TableRow aria-hidden="true" className="border-0">
                <TableCell colSpan={6} style={{ height: `${paddingBottom}px`, padding: 0 }} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </P38TableShell>
    </div>
  );
}

function RascunhoInutilizarButton({ rascunho, onInutilizar }) {
  const pedidoVendaVinculado = rascunho.pedido_venda_final_id || rascunho.pedido_venda_id;
  const podeInutilizar = !pedidoVendaVinculado && !['Cancelado','Convertido'].includes(rascunho.status);

  if (!podeInutilizar) {
    return null;
  }

  return (
    <button onClick={() => onInutilizar(rascunho)}
      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
      <Ban className="w-3 h-3" /> Inutilizar
    </button>
  );
}

function RascunhoMobileLine({ rascunho, onInutilizar, striped }) {
  const tone = p38StatusTone(rascunho.status);
  const accentClass = p38AccentKeyFromTone(tone);

  return (
    <P38MobileLine
      striped={striped}
      accent={accentClass}
      title={rascunho.cliente_nome || 'Cliente não informado'}
      subtitle={
        <>
          <span className="font-mono font-semibold text-foreground">{rascunho.senha_atendimento?.slice(-4)}</span>
          {rascunho.senha_atendimento ? (
            <span className="text-muted-foreground"> · {rascunho.senha_atendimento}</span>
          ) : null}
        </>
      }
      meta={
        <>
          <P38StatusLabel tone={tone}>{rascunho.status}</P38StatusLabel>
          {rascunho.vendedor_nome ? <span className="truncate">{rascunho.vendedor_nome}</span> : null}
          <RascunhoInutilizarButton rascunho={rascunho} onInutilizar={onInutilizar} />
        </>
      }
      value={`R$ ${(rascunho.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      valueSub={fmtDataCurta(rascunho.created_date)}
    />
  );
}

function VirtualizedRascunhoLines({ rascunhos, onInutilizar }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: rascunhos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    getItemKey: (index) => rascunhos[index]?.id ?? index,
    overscan: VIRTUAL_OVERSCAN,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <P38MobileLineList ref={parentRef} className="pr-1" style={VIRTUAL_LIST_STYLE}>
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {virtualItems.map((virtualRow) => {
          const rascunho = rascunhos[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <RascunhoMobileLine
                rascunho={rascunho}
                striped={virtualRow.index % 2 === 1}
                onInutilizar={onInutilizar}
              />
            </div>
          );
        })}
      </div>
    </P38MobileLineList>
  );
}

function VirtualizedRascunhosTable({ rascunhos, onInutilizar }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: rascunhos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    getItemKey: (index) => rascunhos[index]?.id ?? index,
    overscan: VIRTUAL_OVERSCAN,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const { paddingTop, paddingBottom } = getVirtualPadding(virtualItems, rowVirtualizer.getTotalSize());

  return (
    <div ref={parentRef} className="hidden desktop-layout:block min-w-0 overflow-auto" style={VIRTUAL_LIST_STYLE}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/40">
            <TableHead>Senha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <TableRow aria-hidden="true" className="border-0">
              <TableCell colSpan={7} style={{ height: `${paddingTop}px`, padding: 0 }} />
            </TableRow>
          )}
          {virtualItems.map((virtualRow) => {
            const rascunho = rascunhos[virtualRow.index];

            return (
              <TableRow
                key={virtualRow.key}
                data-index={virtualRow.index}
                className="border-b border-border/40 hover:bg-muted/40 dark:hover:bg-muted/50"
              >
                <TableCell>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                    <span className="text-2xl font-bold text-foreground font-mono">
                      {rascunho.senha_atendimento?.slice(-4)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{rascunho.senha_atendimento}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{rascunho.cliente_nome || '-'}</div>
                </TableCell>
                <TableCell>
                  <span className={`text-xs ${rascunho.status === 'Cancelado' ? 'text-red-500' : 'text-green-600'}`}>● {rascunho.status}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{rascunho.vendedor_nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDtHora(rascunho.created_date)}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  R$ {(rascunho.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </TableCell>
                <TableCell>
                  <RascunhoInutilizarButton rascunho={rascunho} onInutilizar={onInutilizar} />
                </TableCell>
              </TableRow>
            );
          })}
          {paddingBottom > 0 && (
            <TableRow aria-hidden="true" className="border-0">
              <TableCell colSpan={7} style={{ height: `${paddingBottom}px`, padding: 0 }} />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function VendasGestaoPage() {
  const { invalidateHomeKpis } = useP38QueryInvalidation();
  const {
    data: pedidos = [],
    isLoading: pedidosLoading,
    refetch: refetchPedidos,
  } = usePedidosVendaListQuery();
  const {
    data: rascunhos = [],
    isLoading: rascunhosLoading,
    refetch: refetchRascunhos,
  } = useRascunhosPedidoVendaListQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [formasPagamentoFiltro, setFormasPagamentoFiltro] = useState([]);
  const [dataInicio, setDataInicio] = useState(() => getPeriodoMesCorrente().start);
  const [dataFim, setDataFim] = useState(() => getPeriodoMesCorrente().end);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showDetalhes, setShowDetalhes] = useState(false);
  const [pedidoDetalhes, setPedidoDetalhes] = useState(null);
  const [activeTab, setActiveTab] = useState('pedidos');
  const [showDevolucao, setShowDevolucao] = useState(false); // unused, kept for safety
  const [showTroca, setShowTroca] = useState(false); // unused, kept for safety
  const [showAlterarPagamento, setShowAlterarPagamento] = useState(false);
  const [showAlterarCliente, setShowAlterarCliente] = useState(false);
  const [pedidoParaAlterarCliente, setPedidoParaAlterarCliente] = useState(null);
  const [showComprovante, setShowComprovante] = useState(false);
  const [pedidoParaImprimir, setPedidoParaImprimir] = useState(null);
  const [showFiltros, setShowFiltros] = useState(false);

  const isLoading = pedidosLoading || rascunhosLoading || isRefreshing;

  const formasPagamentoOpcoes = useMemo(
    () => listarFormasPagamentoParaFiltro(pedidos),
    [pedidos],
  );

  const statusFiltroResolvido = useMemo(
    () => resolveStatusFiltroParaAba(statusFiltro, activeTab),
    [statusFiltro, activeTab],
  );

  const statusOpcoesAtivas = useMemo(
    () => statusOpcoesParaAba(activeTab),
    [activeTab],
  );

  const handleActiveTabChange = (tab) => {
    setActiveTab(tab);
    setStatusFiltro((prev) => resolveStatusFiltroParaAba(prev, tab));
    if (tab !== 'pedidos' && tab !== 'consulta') {
      setFormasPagamentoFiltro([]);
    }
  };

  const toggleFormaPagamentoFiltro = (forma) => {
    setFormasPagamentoFiltro((prev) =>
      prev.includes(forma) ? prev.filter((f) => f !== forma) : [...prev, forma],
    );
  };

  const loadPedidos = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchPedidos(), refetchRascunhos()]);
      await invalidateHomeKpis();
    } finally {
      setIsRefreshing(false);
    }
  };

  const pedidosFiltrados = useMemo(() => {
    let currentFiltered = pedidos;

    if (searchTerm) {
      currentFiltered = currentFiltered.filter(p =>
        p.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFiltroResolvido !== 'todos') {
      currentFiltered = currentFiltered.filter(p => p.status === statusFiltroResolvido);
    }

    if (dataInicio || dataFim) {
      currentFiltered = currentFiltered.filter(p => dateRangeMatches(p.created_date, dataInicio, dataFim));
    }

    if (formasPagamentoFiltro.length > 0) {
      currentFiltered = currentFiltered.filter((p) =>
        pedidoMatchesFormasPagamento(p, formasPagamentoFiltro),
      );
    }

    return currentFiltered;
  }, [pedidos, searchTerm, statusFiltroResolvido, dataInicio, dataFim, formasPagamentoFiltro]);

  const rascunhosFiltrados = useMemo(() => {
    let currentFiltered = rascunhos;

    if (searchTerm) {
      currentFiltered = currentFiltered.filter(r =>
        r.senha_atendimento?.includes(searchTerm) ||
        r.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFiltroResolvido !== 'todos') {
      currentFiltered = currentFiltered.filter(r => r.status === statusFiltroResolvido);
    }

    if (dataInicio || dataFim) {
      currentFiltered = currentFiltered.filter(r => dateRangeMatches(r.created_date, dataInicio, dataFim));
    }

    return currentFiltered;
  }, [rascunhos, searchTerm, statusFiltroResolvido, dataInicio, dataFim]);

  const vendasConsulta = useMemo(() => {
    let list = pedidos.filter((p) => STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA.includes(p.status));

    if (searchTerm) {
      list = list.filter(
        (p) =>
          p.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFiltroResolvido !== 'todos') {
      list = list.filter((p) => p.status === statusFiltroResolvido);
    }

    if (dataInicio || dataFim) {
      list = list.filter((p) => dateRangeMatches(p.created_date, dataInicio, dataFim));
    }

    if (formasPagamentoFiltro.length > 0) {
      list = list.filter((p) => pedidoMatchesFormasPagamento(p, formasPagamentoFiltro));
    }

    return list;
  }, [pedidos, searchTerm, statusFiltroResolvido, dataInicio, dataFim, formasPagamentoFiltro]);

  // Calcular subtotal dos pedidos filtrados
  const subtotalFiltrado = activeTab === 'pedidos'
    ? pedidosFiltrados.reduce((acc, p) => acc + (p.valor_total || 0), 0)
    : activeTab === 'consulta'
      ? vendasConsulta.reduce((acc, p) => acc + (p.valor_total || 0), 0)
      : rascunhosFiltrados.reduce((acc, r) => acc + (r.valor_total || 0), 0);
  const quantidadeFiltrada = activeTab === 'pedidos'
    ? pedidosFiltrados.length
    : activeTab === 'consulta'
      ? vendasConsulta.length
      : rascunhosFiltrados.length;

  const handleEdit = (pedido) => {
    // Navegar para edição ou abrir modal conforme necessário
    console.log('Editar pedido:', pedido);
  };

  const handleVerDetalhes = (pedido) => {
    setPedidoDetalhes(pedido);
    setShowDetalhes(true);
  };

  const handleReimprimir = (pedido) => {
    setPedidoParaImprimir(pedido);
    setShowComprovante(true);
  };

  const handleCorrigirCliente = (pedido) => {
    setPedidoParaAlterarCliente(pedido);
    setShowAlterarCliente(true);
  };

  const handleInutilizarRascunho = async (rascunho) => {
    const pedidoVendaVinculado = rascunho.pedido_venda_final_id || rascunho.pedido_venda_id;
    if (pedidoVendaVinculado) {
      alert('Esta senha já está vinculada a um pedido de venda e não pode ser inutilizada.');
      return;
    }
    if (!confirm(`Inutilizar a senha ${rascunho.senha_atendimento?.slice(-4)}? Ela será marcada como Cancelado.`)) return;
    await base44.entities.RascunhoPedidoVenda.update(rascunho.id, { status: 'Cancelado' });
    loadPedidos();
  };

  // getStatusBadge function is no longer used due to direct inline styling, but kept here for completeness
  // if Badge component was to be reintroduced. For this exact change, it could be removed.
  const getStatusBadge = (status) => {
    const variants = {
      "Orçamento": "bg-muted text-foreground",
      "Aguardando Caixa": "bg-yellow-100 text-yellow-800",
      "Aguardando Aprovação": "bg-orange-100 text-orange-800",
      "Aguardando Pagamento": "bg-yellow-100 text-yellow-800",
      "Aprovado": "bg-blue-100 text-blue-800",
      "Pronto para Expedição": "bg-purple-100 text-purple-800",
      "Finalizado": "bg-green-100 text-green-800",
      "Cancelado": "bg-red-100 text-red-800",
    };
    return variants[status] || "bg-muted text-foreground";
  };

  const formatValor = (valor) => {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const limparFiltros = () => {
    setSearchTerm('');
    setStatusFiltro('todos');
    setFormasPagamentoFiltro([]);
    const { start, end } = getPeriodoMesCorrente();
    setDataInicio(start);
    setDataFim(end);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 overflow-x-hidden">
      {/* Header limpo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 pr-2">
          <h1 className="text-lg font-semibold text-foreground font-glacial">Gestão de Vendas</h1>
          <p className="text-xs text-muted-foreground">Orçamentos, pedidos e acompanhamento</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:justify-end flex-shrink-0 w-full sm:w-auto">
          <Button variant="ghost" size="icon" className="h-11 w-full sm:w-10 rounded-2xl bg-muted dark:bg-muted" title="Devolução" onClick={() => window.location.href = createPageUrl('DevolucaoTroca?tipo=Devolução')}>
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-full sm:w-10 rounded-2xl bg-muted dark:bg-muted" title="Troca" onClick={() => window.location.href = createPageUrl('DevolucaoTroca?tipo=Troca')}>
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-full sm:w-10 rounded-2xl bg-muted dark:bg-muted" title="Alterar Pagamento" onClick={() => setShowAlterarPagamento(true)}>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-full sm:hidden rounded-2xl bg-muted dark:bg-muted"
            onClick={() => setShowFiltros(true)}
          >
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Barra de Busca com Filtro */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              variant="search"
              placeholder="Buscar por número, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 h-12 bg-card dark:bg-muted border-0 rounded-2xl min-w-0 shadow-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex h-12 w-12 rounded-2xl bg-muted dark:bg-muted shrink-0"
            onClick={() => setShowFiltros(true)}
          >
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <GlacialTabsList className="w-full" scrollable>
        <GlacialTabsTrigger value="rascunhos" activeValue={activeTab} onSelect={handleActiveTabChange} label="Senhas" icon={FileText} />
        <GlacialTabsTrigger value="pedidos" activeValue={activeTab} onSelect={handleActiveTabChange} label="Pedidos" icon={ShoppingCart} />
        <GlacialTabsTrigger value="consulta" activeValue={activeTab} onSelect={handleActiveTabChange} label="Consulta" icon={Receipt} />
        <GlacialTabsTrigger value="vales" activeValue={activeTab} onSelect={handleActiveTabChange} label="Vales" icon={Ticket} />
      </GlacialTabsList>

      <Drawer open={showFiltros} onOpenChange={setShowFiltros}>
        {showFiltros ? (
        <DrawerContent className="border-0 rounded-t-[28px] bg-card dark:bg-card px-4 pb-6">
          <DrawerHeader className="px-0 pb-2 text-left">
            <DrawerTitle className="font-glacial text-foreground">Filtros</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Tipo</label>
              <GlacialTabsList className="w-full" scrollable>
                <GlacialTabsTrigger value="rascunhos" activeValue={activeTab} onSelect={handleActiveTabChange} label="Senhas" icon={FileText} />
                <GlacialTabsTrigger value="pedidos" activeValue={activeTab} onSelect={handleActiveTabChange} label="Pedidos" icon={ShoppingCart} />
                <GlacialTabsTrigger value="consulta" activeValue={activeTab} onSelect={handleActiveTabChange} label="Consulta" icon={Receipt} />
                <GlacialTabsTrigger value="vales" activeValue={activeTab} onSelect={handleActiveTabChange} label="Vales" icon={Ticket} />
              </GlacialTabsList>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-2">Status</label>
              <Select
                key={`status-filtro-${activeTab}`}
                value={statusFiltroResolvido}
                onValueChange={setStatusFiltro}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-muted dark:bg-muted border-0">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className={FILTRO_SELECT_CONTENT}>
                  <SelectItem value="todos">Todos</SelectItem>
                  {statusOpcoesAtivas.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL_CURTO[status] || status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(activeTab === 'pedidos' || activeTab === 'consulta') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-muted-foreground">Forma de pagamento</label>
                  {formasPagamentoFiltro.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setFormasPagamentoFiltro([])}
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>
                <div className="rounded-2xl bg-muted dark:bg-muted p-3 space-y-2 max-h-48 overflow-y-auto">
                  {formasPagamentoOpcoes.map((forma) => {
                    const checked = formasPagamentoFiltro.includes(forma);
                    return (
                      <label
                        key={forma}
                        className="flex items-center gap-3 py-1.5 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleFormaPagamentoFiltro(forma)}
                        />
                        <span className="text-sm text-foreground">{forma}</span>
                      </label>
                    );
                  })}
                </div>
                {formasPagamentoFiltro.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Mostrando pedidos com pelo menos uma das formas selecionadas.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs text-muted-foreground mb-2">Período</label>
              <MobileDateRangePicker
                nested
                startDate={dataInicio}
                endDate={dataFim}
                onApply={(inicio, fim) => {
                  setDataInicio(inicio);
                  setDataFim(fim);
                }}
                onClear={() => {
                  setDataInicio('');
                  setDataFim('');
                }}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-11 rounded-2xl"
                onClick={limparFiltros}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                className="flex-1 h-11 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/80 dark:border-transparent"
                onClick={() => setShowFiltros(false)}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DrawerContent>
        ) : null}
      </Drawer>

      <div>

        {activeTab === 'rascunhos' && (
        <div className="space-y-4 min-w-0">
          {/* Total no topo */}
          <div className="flex items-start justify-between gap-3 text-sm min-w-0">
            <span className="text-muted-foreground min-w-0">{quantidadeFiltrada} pedido(s)</span>
            <span className="text-base sm:text-lg font-semibold text-foreground text-right break-words leading-tight">R$ {formatValor(subtotalFiltrado)}</span>
          </div>

          {/* Lista de Rascunhos */}
          <div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40"></div>
          </div>
        ) : rascunhosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <>
            <VirtualizedRascunhoLines
              rascunhos={rascunhosFiltrados}
              onInutilizar={handleInutilizarRascunho}
            />
            <VirtualizedRascunhosTable
              rascunhos={rascunhosFiltrados}
              onInutilizar={handleInutilizarRascunho}
            />


          </>
        )}
        </div>
        </div>
        )}

        {activeTab === 'pedidos' && (
        <div className="space-y-4 min-w-0">
          {/* Total no topo */}
          <div className="flex items-start justify-between gap-3 text-sm min-w-0">
            <span className="text-muted-foreground min-w-0">{quantidadeFiltrada} pedido(s)</span>
            <span className="text-base sm:text-lg font-semibold text-foreground text-right break-words leading-tight">R$ {formatValor(subtotalFiltrado)}</span>
          </div>

          {/* Lista de Pedidos */}
          <div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40"></div>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <>
            <VirtualizedPedidoCards
              pedidos={pedidosFiltrados}
              onVerDetalhes={handleVerDetalhes}
              onEdit={handleEdit}
              onReimprimir={handleReimprimir}
              onCorrigirCliente={handleCorrigirCliente}
            />
            <VirtualizedPedidosTable
              pedidos={pedidosFiltrados}
              onVerDetalhes={handleVerDetalhes}
              onEdit={handleEdit}
              onReimprimir={handleReimprimir}
              onCorrigirCliente={handleCorrigirCliente}
            />


          </>
        )}
        </div>
        </div>
        )}

        {activeTab === 'consulta' && (
        <div className="space-y-4 min-w-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40"></div>
            </div>
          ) : (
            <ConsultaVendasCaixa
              vendasFinalizadas={vendasConsulta}
              onVerDetalhes={handleVerDetalhes}
              contextLabel="Consulta de vendas"
              emptyMessage="Nenhuma venda finalizada no período selecionado"
            />
          )}
        </div>
        )}

        {activeTab === 'vales' && (
          <ValesTrocaTab
            searchTerm={searchTerm}
            statusFiltro={statusFiltroResolvido}
            dataInicio={dataInicio}
            dataFim={dataFim}
            activeTab={activeTab}
          />
        )}
      </div>

      {/* Dialogs de operações — montar só quando abertos (evita loops Radix/portals) */}
      {showAlterarPagamento ? (
        <AlterarPagamentoDialog open={showAlterarPagamento} onClose={() => setShowAlterarPagamento(false)} />
      ) : null}
      {showAlterarCliente && pedidoParaAlterarCliente ? (
        <AlterarClientePedidoDialog
        open={showAlterarCliente}
        pedido={pedidoParaAlterarCliente}
        onClose={() => {
          setShowAlterarCliente(false);
          setPedidoParaAlterarCliente(null);
        }}
        onSuccess={(clienteAtualizado) => {
          if (pedidoDetalhes?.id && pedidoParaAlterarCliente?.id === pedidoDetalhes.id) {
            setPedidoDetalhes((prev) =>
              prev
                ? {
                    ...prev,
                    cliente_id: clienteAtualizado.id,
                    cliente_nome: clienteAtualizado.nome,
                  }
                : prev
            );
          }
          loadPedidos();
        }}
      />
      ) : null}

      {/* Dialog de Detalhes — montar só quando aberto (evita loop de updates com outros dialogs) */}
      {showDetalhes && pedidoDetalhes ? (
        <DetalhesPedidoVenda
          pedido={pedidoDetalhes}
          isOpen={showDetalhes}
          onClose={() => {
            setShowDetalhes(false);
            setPedidoDetalhes(null);
          }}
        />
      ) : null}

      {/* Dialog de Reimpressão */}
      {showComprovante && pedidoParaImprimir && (
        pedidoParaImprimir.tipo === 'Pedido' ? (
          <ComprovantePreVenda
            preVenda={pedidoParaImprimir}
            open={showComprovante}
            onClose={() => setShowComprovante(false)}
          />
        ) : (
          <ComprovanteCompra
            pedido={pedidoParaImprimir}
            open={showComprovante}
            onClose={() => setShowComprovante(false)}
          />
        )
      )}

      {/* FAB Relatórios */}
      <VendasRelatorisFAB />
    </div>
  );
}

export default memo(VendasGestaoPage);