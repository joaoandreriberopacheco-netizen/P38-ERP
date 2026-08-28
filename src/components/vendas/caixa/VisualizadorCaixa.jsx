import React, { useState, useEffect, useMemo } from 'react';
import { useCaixaTurnoData } from '@/hooks/useCaixaTurnoData';
import { createPortal } from 'react-dom';
import { createPageUrl } from '@/components/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { PieChart, Receipt, Wallet, Plus, Minus, DollarSign, Eye, Printer, ArrowLeft, Clock, RefreshCw, RotateCcw, Edit, Package, X, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import VendasTurnoDialog from './VendasTurnoDialog';
import VendaDetalheDialog from './VendaDetalheDialog';
import ListaMovimentosDialog from './ListaMovimentosDialog';
import SaldoConsolidadoDialog from './SaldoConsolidadoDialog';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { CAIXA_POLL_MS } from '@/lib/caixaTurnoData';
import { CAIXA_MIRROR_DIALOG_CHILD_CLASS } from '@/lib/quickAccessOverlay';
import {
  CAIXA_PRINT,
  caixaClasses,
  caixaMain,
  caixaMobileTabBar,
  caixaOverlayShell,
  caixaTabPanel,
  caixaTabPanelPad,
  caixaTabsRoot,
  caixaTypo,
  movimentoTone,
} from '@/lib/caixaP38Theme';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import CaixaMovimentacoesTurno from '@/components/vendas/caixa/CaixaMovimentacoesTurno';
import CaixaRecebimentosTurno from '@/components/vendas/caixa/CaixaRecebimentosTurno';
import ConsultaVendasCaixa from '@/components/vendas/caixa/ConsultaVendasCaixa';
import VendasFormaPagamentoDialog from '@/components/vendas/caixa/VendasFormaPagamentoDialog';
import { CaixaOverlayStackProvider } from '@/components/vendas/caixa/CaixaOverlayStackContext';
import { cleanupQuickAccessPortalLayers } from '@/lib/quickAccessOverlay';

function RascunhoAguardandoCardEspelho({ rascunho, onDetalhes, onEditar, formatarValorExibicao }) {
  return (
    <div
      className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onDetalhes(rascunho)}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        {rascunho.senha_atendimento && (
          <div className="px-4 py-2 bg-muted/40 rounded-xl">
            <div className="text-xs text-muted-foreground mb-1">Senha</div>
            <div className="text-3xl font-bold text-foreground font-mono">{rascunho.senha_atendimento.slice(-4)}</div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-medium text-foreground truncate">{rascunho.cliente_nome}</div>
          <div className="text-sm text-muted-foreground mt-1">{rascunho.vendedor_nome}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground font-glacial">
            R$ {formatarValorExibicao(rascunho.valor_total)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {rascunho.itens?.length || 0} {rascunho.itens?.length === 1 ? 'item' : 'itens'}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDetalhes(rascunho); }}
          className="h-12 px-4 bg-muted/40 text-foreground/90 rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center"
          style={{ minHeight: '48px' }}
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEditar(rascunho); }}
          className="flex-1 h-12 bg-muted/40 text-foreground/90 rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
          style={{ minHeight: '48px' }}
        >
          <Edit className="w-4 h-4" />
          <span>Ver no PDV</span>
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
    <div className="bg-card rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
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

/** Espelho do PDVCaixa — dados via cache partilhado (useCaixaTurnoData). */
export default function VisualizadorCaixa({
  turnoAtivo,
  caixaSelecionado,
  onVoltar,
  modoFechado = false,
  onSolicitarReabertura,
  reabrindo = false,
}) {
  const [caixaData, setCaixaData] = useState({
    saldoInicial: 0,
    liquidez: 0,
    totalVendas: 0,
    recebimentos: { dinheiro: 0, pix: 0, credito: 0, debito: 0, vale: 0, fiado: 0 },
    reforcos: 0,
    sangrias: 0,
    despesas: 0,
    despesasLista: [],
    fiado: 0,
    fiadoLista: [],
  });
  const [vendasFinalizadas, setVendasFinalizadas] = useState([]);
  const [substituicoesCtx, setSubstituicoesCtx] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [activeTab, setActiveTab] = useState('balanco');
  const [showVendasDialog, setShowVendasDialog] = useState(false);
  const [showReforcosDialog, setShowReforcosDialog] = useState(false);
  const [showSangriasDialog, setShowSangriasDialog] = useState(false);
  const [showDespesasDialog, setShowDespesasDialog] = useState(false);
  const [vendaDetalhada, setVendaDetalhada] = useState(null);
  const [showSaldoConsolidadoDialog, setShowSaldoConsolidadoDialog] = useState(false);
  const [formaPagamentoDialog, setFormaPagamentoDialog] = useState(null);
  const [recebimentosDinheiro, setRecebimentosDinheiro] = useState('0,00');
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [rascunhosAguardando, setRascunhosAguardando] = useState([]);
  const [vendasView, setVendasView] = useState(modoFechado ? 'consulta' : 'aguardando');
  const [rascunhoDetalhesTab, setRascunhoDetalhesTab] = useState(null);

  const formatarValorExibicaoLocal = (valor) => {
    const n = roundToTwoDecimals(valor ?? 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const { data: snapshot, isLoading, refetch } = useCaixaTurnoData(turnoAtivo, caixaSelecionado, {
    enabled: !!turnoAtivo?.id && !!caixaSelecionado?.id,
    incluirRascunhos: !modoFechado,
    rascunhoExigirItens: true,
  });

  const refreshCaixa = () => {
    void refetch();
  };

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  useEffect(() => {
    if (!snapshot) return;
    setSubstituicoesCtx(snapshot.substituicoesCtx);
    setVendasFinalizadas(snapshot.vendasFinalizadas);
    setCaixaData(snapshot.caixaData);
    setMovimentos(snapshot.movimentos);
    setRascunhosAguardando(modoFechado ? [] : snapshot.rascunhosAguardando);

    const liquidez = snapshot.caixaData.liquidez || 0;
    const { pix = 0, credito = 0, debito = 0, vale = 0 } = snapshot.caixaData.recebimentos || {};
    const dinheiroNaGaveta = roundToTwoDecimals(liquidez - pix - credito - debito - vale);
    setRecebimentosDinheiro(formatarValorExibicaoLocal(dinheiroNaGaveta));
    setUltimaAtualizacao(new Date());
  }, [snapshot, modoFechado]);

  // Portal no body: evita contentor overflow-hidden do Layout bloquear toque/scroll no mobile.
  useEffect(() => {
    cleanupQuickAccessPortalLayers();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      cleanupQuickAccessPortalLayers();
    };
  }, []);

  // Realtime: no cliente P38, subscribe() é no-op — mantemos vínculo com polling + foco na aba.
  useEffect(() => {
    if (modoFechado) return undefined;
    if (!turnoAtivo?.id || !caixaSelecionado?.id) return undefined;

    const poll = () => {
      void refetch();
    };

    const id = window.setInterval(poll, CAIXA_POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [modoFechado, turnoAtivo?.id, caixaSelecionado?.id, refetch]);

  const formatValor = (valor) => {
    const num = valor || 0;
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Espelha PDVCaixa: liquidez já exclui fiado do núcleo monetário.
  const dinheiroNaGaveta = roundToTwoDecimals(
    (caixaData.liquidez || 0) -
      (caixaData.recebimentos?.pix || 0) -
      (caixaData.recebimentos?.credito || 0) -
      (caixaData.recebimentos?.debito || 0) -
      (caixaData.recebimentos?.vale || 0)
  );

  const dinheiroConferidoFechamento = roundToTwoDecimals(turnoAtivo?.dinheiro_conferido ?? 0);
  const totalConferidoFechamento = roundToTwoDecimals(
    dinheiroConferidoFechamento +
      (caixaData.recebimentos?.pix || 0) +
      (caixaData.recebimentos?.credito || 0) +
      (caixaData.recebimentos?.debito || 0)
  );
  const esperadoFechamento = roundToTwoDecimals(
    (caixaData.liquidez || 0) - (caixaData.recebimentos?.vale || 0)
  );
  const diferencaFechamento =
    modoFechado && turnoAtivo?.diferenca != null
      ? roundToTwoDecimals(turnoAtivo.diferenca)
      : roundToTwoDecimals(totalConferidoFechamento - esperadoFechamento);
  const conferenciaOk = Math.abs(diferencaFechamento) < 0.01;

  const movimentosTimelineItems = useMemo(() => {
    const itensMovimentos = movimentos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      valor: m.valor,
      descricao: m.observacao || m.tipo,
      hora: m.created_date,
      tone: movimentoTone(m.tipo),
    }));
    const itensDespesas = (caixaData.despesasLista || []).map((d) => ({
      id: d.id,
      tipo: 'Despesa',
      valor: d.valor,
      descricao: d.descricao,
      hora: d.created_date,
      tone: 'danger',
    }));
    return [...itensMovimentos, ...itensDespesas].sort((a, b) => new Date(a.hora) - new Date(b.hora));
  }, [movimentos, caixaData.despesasLista]);

  const imprimirRelatorio = async () => {
    const linhasVendas = (vendasFinalizadas || []).map(v => {
      const pagamentos = (v.pagamentos || []);
      const subLinhas = pagamentos.length > 1
        ? pagamentos.map(p => `<div style="display:flex;justify-content:space-between;padding:2px 0 2px 16px;font-size:10px;color:#6b7280"><span>${p.forma_pagamento}</span><span>R$ ${(p.valor || 0).toFixed(2)}</span></div>`).join('')
        : '';
      const formasSingle = pagamentos.length === 1 ? ` · ${pagamentos[0].forma_pagamento} R$ ${(pagamentos[0].valor || 0).toFixed(2)}` : '';
      return `<div style="border-bottom:1px solid #f3f4f6;padding:5px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px">
          <span>${v.numero} · ${v.cliente_nome} · ${new Date(v.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${formasSingle}</span>
          <span style="font-weight:600;color:${CAIXA_PRINT.success};white-space:nowrap;margin-left:8px">+R$ ${(v.valor_total || 0).toFixed(2)}</span>
        </div>${subLinhas}</div>`;
    }).join('');

    const linhasReforcos = movimentos.filter(m => m.tipo === 'Reforço').map(m =>
      `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>${m.numero} · ${format(new Date(m.created_date), 'HH:mm')}${m.observacao ? ' · ' + m.observacao : ''}</span><span style="color:${CAIXA_PRINT.success}">+R$ ${(m.valor || 0).toFixed(2)}</span></div>`
    ).join('') || '<p style="color:#9ca3af;font-size:11px;margin:4px 0">Nenhum reforço</p>';

    const linhasRecolhimentos = movimentos.filter(m => m.tipo === 'Sangria' || m.tipo === 'Recolhimento de Caixa').map(m =>
      `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>${m.numero} · ${format(new Date(m.created_date), 'HH:mm')}${m.observacao ? ' · ' + m.observacao : ''}</span><span style="color:${CAIXA_PRINT.info}">-R$ ${(m.valor || 0).toFixed(2)}</span></div>`
    ).join('') || '<p style="color:#9ca3af;font-size:11px;margin:4px 0">Nenhum recolhimento</p>';

    const linhasDespesas = (caixaData.despesasLista || []).map(d =>
      `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span>${d.descricao} · ${d.created_date ? format(new Date(d.created_date), 'HH:mm') : ''}</span><span style="color:${CAIXA_PRINT.danger}">-R$ ${(d.valor || 0).toFixed(2)}</span></div>`
    ).join('') || '<p style="color:#9ca3af;font-size:11px;margin:4px 0">Nenhuma despesa</p>';

    const html = `<html><head><title>Relatório - ${caixaSelecionado.nome}</title><style>
      body{font-family:'DIN 1451',DINish,system-ui,sans-serif;font-size:13px;padding:20px;max-width:700px;margin:0 auto}
      h2{font-size:14px;font-weight:600;margin:14px 0 6px;color:#374151}
      .row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
      .total{font-size:15px;font-weight:700}
      .dashed{border-top:1px dashed #aaa;margin:8px 0}
    </style></head><body>
      <div style="text-align:center;margin-bottom:14px"><b style="font-size:16px">VAREJOSYNC</b><br/><span style="color:#9ca3af;font-size:11px">Relatório de Caixa - ${caixaSelecionado.nome}</span></div>
      <div class="dashed"></div>
      <h2>Turno</h2>
      <div class="row"><span>Número:</span><b>${turnoAtivo.numero}</b></div>
      <div class="row"><span>Abertura:</span><span>${new Date(turnoAtivo.data_abertura).toLocaleString('pt-BR')}</span></div>
      <div class="row"><span>Operador:</span><span>${turnoAtivo.usuario_abertura_nome}</span></div>
      <div class="row"><span>Status:</span><span>${turnoAtivo.status}</span></div>
      <div class="dashed"></div>
      <h2>Movimentações</h2>
      <div class="row"><span>Saldo Inicial:</span><span>R$ ${(caixaData.saldoInicial || 0).toFixed(2)}</span></div>
      <div class="row"><span>+ Total Vendas:</span><span>R$ ${(caixaData.totalVendas || 0).toFixed(2)}</span></div>
      <div class="row"><span>+ Reforços:</span><span>R$ ${(caixaData.reforcos || 0).toFixed(2)}</span></div>
      <div class="row"><span>− Recolhimentos:</span><span>R$ ${(caixaData.sangrias || 0).toFixed(2)}</span></div>
      <div class="row"><span>− Despesas:</span><span>R$ ${(caixaData.despesas || 0).toFixed(2)}</span></div>
      <div class="dashed"></div>
      <div class="row total"><span>Liquidez do Turno:</span><span>R$ ${(caixaData.liquidez || 0).toFixed(2)}</span></div>
      <div class="dashed"></div>
      <h2>Recebimentos por Forma</h2>
      <div class="row"><span>Dinheiro (gaveta):</span><span>R$ ${(caixaData.recebimentos.dinheiro || 0).toFixed(2)}</span></div>
      <div class="row"><span>PIX:</span><span>R$ ${(caixaData.recebimentos.pix || 0).toFixed(2)}</span></div>
      <div class="row"><span>Cartão Crédito:</span><span>R$ ${(caixaData.recebimentos.credito || 0).toFixed(2)}</span></div>
      <div class="row"><span>Cartão Débito:</span><span>R$ ${(caixaData.recebimentos.debito || 0).toFixed(2)}</span></div>
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
      <h2>Vendas do Turno (${(vendasFinalizadas || []).length})</h2>
      ${linhasVendas || '<p style="color:#9ca3af;font-size:11px">Nenhuma venda registrada</p>'}
      <div class="dashed"></div>
      <p style="text-align:center;font-size:10px;color:#9ca3af;margin-top:14px">Relatório gerado em ${new Date().toLocaleString('pt-BR')} - Não é documento fiscal</p>
    </body></html>`;
    try {
      await openPrintWindowOrShareHtml(html, `relatorio-caixa-${caixaSelecionado?.nome || 'caixa'}.html`, `Relatório ${caixaSelecionado?.nome || ''}`, {
        windowFeatures: 'width=800,height=900',
      });
    } catch {
      alert('Permita pop-ups para imprimir.');
    }
  };

  const renderInPortal = (node) => {
    if (typeof document === 'undefined') return node;
    return createPortal(node, document.body);
  };

  if (loading) {
    return renderInPortal(
      <div className={`${caixaOverlayShell} ${caixaTypo.screen} items-center justify-center`}>
        <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return renderInPortal(
    <CaixaOverlayStackProvider active stack="mirror">
    <div className={`${caixaOverlayShell} ${caixaTypo.screen}`}>
      {/* Header */}
      <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button onClick={onVoltar} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors" style={{ minWidth: '44px', minHeight: '44px' }}>
          <ArrowLeft className="w-6 h-6 text-foreground/90" />
        </button>
        
        <div className="flex-1 text-center min-w-0 px-2">
          <h1 className="text-lg font-semibold text-foreground font-glacial">
            {caixaSelecionado?.nome || 'Caixa'}
          </h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {modoFechado
              ? turnoAtivo?.data_fechamento
                ? `Fechado · ${format(new Date(turnoAtivo.data_fechamento), 'dd/MM/yyyy HH:mm')}`
                : 'Turno fechado'
              : ultimaAtualizacao
                ? `Atualizado · ${format(ultimaAtualizacao, 'HH:mm:ss')}`
                : '…'}
          </p>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={refreshCaixa}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {format(new Date(), 'HH:mm')}
          </div>
        </div>
      </div>

      {/* Conteúdo — caixaMain estabelece flex-col para TabsContent poder rolar no mobile */}
      <div className={`${caixaMain} bg-background`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className={caixaTabsRoot}>
          <TabsList className={`${caixaMobileTabBar} grid grid-cols-3 h-14 bg-card border-b border-border/40 rounded-none p-0`}>
            <TabsTrigger value="balanco" className="flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-muted h-full rounded-none border-0">
              <PieChart className="w-5 h-5" />
              <span className="text-xs">Balanço</span>
            </TabsTrigger>
            <TabsTrigger value="vendas" className="flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-muted h-full rounded-none border-0">
              <ShoppingCart className="w-5 h-5" />
              <span className={caixaTypo.labelSm}>Vendas</span>
            </TabsTrigger>
            <TabsTrigger value="movimentos" className="flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-muted h-full rounded-none border-0">
              <Wallet className="w-5 h-5" />
              <span className="text-xs">Movimentos</span>
            </TabsTrigger>
          </TabsList>

          {/* KPIs - Desktop */}
          <div className="hidden md:block p-4 pb-0 bg-background">
            <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
              <div className="bg-card rounded-2xl p-5 shadow-sm">
                <div className="text-xs text-muted-foreground mb-2">Saldo do Turno</div>
                <div className="text-3xl font-bold text-foreground font-glacial">{formatValor(caixaData.liquidez)}</div>
                <div className="text-xs text-muted-foreground mt-1">Inicial + vendas + reforços − recolhimentos</div>
              </div>
              <div className="bg-card rounded-2xl p-5 shadow-sm">
                <div className="text-xs text-muted-foreground mb-2">Dinheiro na Gaveta</div>
                <div className="text-3xl font-bold text-foreground font-glacial">
                  {formatValor(dinheiroNaGaveta)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Liquidez − (PIX + Crédito + Débito + Vale)</div>
              </div>
            </div>
          </div>

          {/* Tabs - Desktop */}
          <div className="hidden md:block border-b border-border/40 px-4 bg-background">
            <TabsList className="h-auto bg-transparent border-0 gap-1 justify-start max-w-4xl mx-auto p-0">
              <TabsTrigger value="balanco" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm h-12 px-6 rounded-t-xl rounded-b-none border-0">
                <PieChart className="w-4 h-4" />
                <span className="text-sm">Balanço</span>
              </TabsTrigger>
              <TabsTrigger value="vendas" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm h-12 px-6 rounded-t-xl rounded-b-none border-0">
                <ShoppingCart className="w-4 h-4" />
                <span className="text-sm">Vendas</span>
              </TabsTrigger>
              <TabsTrigger value="movimentos" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm h-12 px-6 rounded-t-xl rounded-b-none border-0">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">Movimentos</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="relative flex-1 min-h-0 h-0 overflow-hidden">
          <TabsContent value="balanco" className={`${caixaTabPanel} ${caixaTabPanelPad} bg-background`}>
            <div className="max-w-4xl mx-auto space-y-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CaixaMovimentacoesTurno
                  saldoInicial={caixaData.saldoInicial}
                  totalVendas={caixaData.totalVendas}
                  reforcos={caixaData.reforcos}
                  sangrias={caixaData.sangrias}
                  despesas={caixaData.despesas}
                  liquidez={caixaData.liquidez}
                  fiado={caixaData.fiado || 0}
                  onVendas={() => setShowVendasDialog(true)}
                  onReforcos={() => setShowReforcosDialog(true)}
                  onSangrias={() => setShowSangriasDialog(true)}
                  onDespesas={() => setShowDespesasDialog(true)}
                  onLiquidez={() => setShowSaldoConsolidadoDialog(true)}
                />

                {/* Recebimentos - BLOQUEADO */}
                <CaixaRecebimentosTurno
                  dinheiroNaGaveta={dinheiroNaGaveta}
                  recebimentos={caixaData.recebimentos}
                  fiado={caixaData.fiado || 0}
                  totalConferido={caixaData.liquidez}
                  modoFechado={modoFechado}
                  dinheiroConferidoFechamento={dinheiroConferidoFechamento}
                  totalConferidoFechamento={totalConferidoFechamento}
                  diferencaFechamento={diferencaFechamento}
                  conferenciaOk={conferenciaOk}
                  usuarioFechamentoNome={turnoAtivo?.usuario_fechamento_nome}
                  formatValor={formatValor}
                  onVerFormaPagamento={setFormaPagamentoDialog}
                />
              </div>

              <div className="bg-card rounded-2xl p-4 shadow-sm space-y-2">
                <button onClick={imprimirRelatorio} className="w-full h-12 bg-primary text-primary-foreground rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm hover:opacity-90 transition-opacity" style={{ minHeight: '48px' }}>
                  <Printer className="w-4 h-4" /> Imprimir Relatório
                </button>
                {modoFechado && onSolicitarReabertura && (
                  <button
                    type="button"
                    onClick={onSolicitarReabertura}
                    disabled={reabrindo}
                    className="w-full h-12 rounded-2xl border border-border bg-muted text-foreground font-semibold flex items-center justify-center gap-2 text-sm hover:bg-muted/80 transition-colors disabled:opacity-50"
                    style={{ minHeight: '48px' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {reabrindo ? 'Reabrindo…' : 'Solicitar Reabertura'}
                  </button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vendas" className={`${caixaTabPanel} ${caixaTabPanelPad} space-y-3`}>
            <div className="max-w-4xl mx-auto space-y-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex rounded-2xl bg-muted/50 p-1 gap-1">
                  {!modoFechado && (
                    <button
                      type="button"
                      onClick={() => setVendasView('aguardando')}
                      className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${vendasView === 'aguardando' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                      Aguardando ({rascunhosAguardando.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVendasView('consulta')}
                    className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${vendasView === 'consulta' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  >
                    Consulta ({vendasFinalizadas.length})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={refreshCaixa}
                  className="p-2 hover:bg-muted rounded-xl transition-colors self-end sm:self-auto"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                  title="Atualizar"
                >
                  <RefreshCw className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {vendasView === 'consulta' || modoFechado ? (
                <ConsultaVendasCaixa
                  vendasFinalizadas={vendasFinalizadas}
                  metaPorPedidoId={substituicoesCtx?.metaPorPedidoId}
                  onVerDetalhes={setVendaDetalhada}
                />
              ) : rascunhosAguardando.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Receipt className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className={caixaTypo.meta}>Nenhuma venda aguardando</p>
                </div>
              ) : (
                <VirtualizedList
                  items={rascunhosAguardando}
                  estimateSize={150}
                  className="pr-1 md:h-[calc(100vh-220px)]"
                  itemClassName="pb-3"
                  getItemKey={(rascunho) => rascunho.id}
                  renderItem={(rascunho) => (
                    <RascunhoAguardandoCardEspelho
                      rascunho={rascunho}
                      onDetalhes={setRascunhoDetalhesTab}
                      onEditar={(item) => window.open(createPageUrl('PDV') + `?mode=vendedor&rascunho_id=${item.id}`, '_blank')}
                      formatarValorExibicao={formatarValorExibicaoLocal}
                    />
                  )}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="movimentos" className={`${caixaTabPanel} ${caixaTabPanelPad} space-y-3`}>
            <div className="max-w-4xl mx-auto space-y-3 pb-4">
              {movimentosTimelineItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Wallet className="w-10 h-10 mb-2" />
                  <p className="text-sm">Nenhuma movimentação registrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className={`${caixaTypo.meta} px-1`}>Histórico do turno (somente leitura)</p>
                  <VirtualizedList
                    items={movimentosTimelineItems}
                    estimateSize={68}
                    className="pr-1 md:h-[calc(100vh-220px)]"
                    itemClassName="pb-2"
                    getItemKey={(item) => item.id}
                    renderItem={(item) => <MovimentoTimelineCard item={item} />}
                  />
                </div>
              )}
            </div>
          </TabsContent>
          </div>

        </Tabs>
      </div>

      {/* Dialogs */}
      <VendasTurnoDialog
        open={showVendasDialog}
        onOpenChange={setShowVendasDialog}
        vendasFinalizadas={vendasFinalizadas}
        turnoAtivo={turnoAtivo}
        caixaData={caixaData}
        formatValor={formatValor}
        metaPorPedidoId={substituicoesCtx?.metaPorPedidoId}
        onVerDetalhes={setVendaDetalhada}
      />
      <VendaDetalheDialog venda={vendaDetalhada} onClose={() => setVendaDetalhada(null)} formatValor={formatValor} />
      <ListaMovimentosDialog open={showReforcosDialog} onOpenChange={setShowReforcosDialog} tipo="reforcos" movimentos={movimentos} despesasLista={caixaData.despesasLista} totalReforcos={caixaData.reforcos} totalSangrias={caixaData.sangrias} totalDespesas={caixaData.despesas} formatValor={formatValor} onRefresh={refreshCaixa} />
      <ListaMovimentosDialog open={showSangriasDialog} onOpenChange={setShowSangriasDialog} tipo="sangrias" movimentos={movimentos} despesasLista={caixaData.despesasLista} totalReforcos={caixaData.reforcos} totalSangrias={caixaData.sangrias} totalDespesas={caixaData.despesas} formatValor={formatValor} onRefresh={refreshCaixa} />
      <ListaMovimentosDialog open={showDespesasDialog} onOpenChange={setShowDespesasDialog} tipo="despesas" movimentos={movimentos} despesasLista={caixaData.despesasLista} totalReforcos={caixaData.reforcos} totalSangrias={caixaData.sangrias} totalDespesas={caixaData.despesas} formatValor={formatValor} onRefresh={refreshCaixa} />
      <SaldoConsolidadoDialog
        open={showSaldoConsolidadoDialog}
        onOpenChange={setShowSaldoConsolidadoDialog}
        caixaData={caixaData}
        turnoAtivo={turnoAtivo}
        vendasFinalizadas={vendasFinalizadas}
        movimentos={movimentos}
        formatValor={formatValor}
      />
      <VendasFormaPagamentoDialog
        open={!!formaPagamentoDialog}
        onOpenChange={(open) => { if (!open) setFormaPagamentoDialog(null); }}
        formaPagamentoKey={formaPagamentoDialog}
        vendasFinalizadas={vendasFinalizadas}
        metaPorPedidoId={substituicoesCtx?.metaPorPedidoId}
        onVerDetalhes={setVendaDetalhada}
      />

      {rascunhoDetalhesTab && (
        <div className={`fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 ${CAIXA_MIRROR_DIALOG_CHILD_CLASS}`}>
          <div className="bg-card rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Senha</div>
                <div className="text-3xl font-bold font-mono text-foreground">{rascunhoDetalhesTab.senha_atendimento?.slice(-4)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-foreground/90">{rascunhoDetalhesTab.cliente_nome || 'Avulso'}</div>
                <div className="text-xs text-muted-foreground">{rascunhoDetalhesTab.vendedor_nome}</div>
              </div>
              <button type="button" onClick={() => setRascunhoDetalhesTab(null)} className="p-2 hover:bg-muted rounded-xl">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Itens</div>
              {(rascunhoDetalhesTab.itens || []).map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground leading-snug">{item.produto_nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">R$ {(item.preco_unitario_praticado || 0).toFixed(2)} × {item.quantidade}</div>
                  </div>
                  <div className="text-sm font-semibold text-foreground flex-shrink-0">R$ {formatarValorExibicaoLocal(item.total || 0)}</div>
                </div>
              ))}
              {rascunhoDetalhesTab.valor_desconto > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Desconto</span>
                  <span>-R$ {formatarValorExibicaoLocal(rascunhoDetalhesTab.valor_desconto)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border/40">
                <span>Total</span>
                <span>R$ {formatarValorExibicaoLocal(rascunhoDetalhesTab.valor_total || 0)}</span>
              </div>
              <p className="text-xs text-center text-muted-foreground pt-2">
                Visualização apenas — confirme o pagamento no PDV Caixa
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </CaixaOverlayStackProvider>
  );
}