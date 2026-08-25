import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FoldVertical, ShoppingCart, UnfoldVertical } from 'lucide-react';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { cn } from '@/components/utils';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import { ConsultaProdutoRow } from '@/components/vendas/caixa/ConsultaProdutoRow';
import { caixaTypo } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { getItemCompraExibicaoVitrine } from '@/lib/productUnits';
import { formatarSoData } from '@/components/utils/dateUtils';
import { getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { buildGruposConsultaEmbarques } from '@/lib/consultaComprasEmbarques';
import { buildConsultaItemCustoDetalhe } from '@/lib/consultaItemCustoDetalhe';
import { comprasAccentFromDisplayStatus, getComprasDisplayStatusLabel } from '@/lib/comprasEmbarquesPalette';
import ComprasStatusChip, { ComprasRecebimentoDateChip } from '@/components/compras/ComprasStatusChip';

import { COMPRAS_HIER_L1, COMPRAS_HIER_L2, COMPRAS_SEP } from '@/lib/comprasP38Theme';

/** Recuo hierárquico + tipografia fixa (visual mobile em todos os viewports). */
const CONSULTA_HIER = {
  l1: COMPRAS_HIER_L1,
  l2: COMPRAS_HIER_L2,
  sep: COMPRAS_SEP,
};
const CONSULTA_TITLE =
  'font-din-1451 font-light text-sm uppercase tracking-wide text-foreground leading-snug line-clamp-2 break-words';
const CONSULTA_SUBTITLE =
  'font-din-1451 font-light text-[11px] text-muted-foreground line-clamp-2 break-words';

function getConsultaItens(card) {
  return card._consulta_itens || card.itens || [];
}

function aggregateByProduto(cards) {
  const map = new Map();
  (cards || []).forEach((card) => {
    getConsultaItens(card).forEach((item) => {
      const exib = getItemCompraExibicaoVitrine(item);
      const unidade = item.unidade_medida || exib.unidade_medida || 'UN';
      const key = `${item.produto_id || item.produto_nome || 'sem-id'}::${unidade}`;
      const qtd = Number(item.quantidade) || exib.quantidade;
      const total = Number(item.valor_total_item) || Number(item.total) || getTotalLinhaPedidoCompra(item);
      const prev = map.get(key) || {
        key,
        nome: item.produto_nome || 'Produto',
        unidade,
        quantidade: 0,
        total: 0,
      };
      prev.quantidade += qtd;
      prev.total = roundToTwoDecimals(prev.total + total);
      map.set(key, prev);
    });
  });
  return [...map.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
}

function buildEmbarqueMetaLinhas(card) {
  const etaEmbarque = card._embarque?.eta ? formatarSoData(card._embarque.eta) : null;
  const etaLabel = etaEmbarque
    ? `ETA ${etaEmbarque}`
    : (card.data_prevista_entrega ? `ETA ${formatarSoData(card.data_prevista_entrega)}` : null);

  return {
    fornecedor: card._display_fornecedor || card.fornecedor_nome || 'Fornecedor não informado',
    detalhes: [
      card.data_emissao ? formatarSoData(card.data_emissao) : null,
      etaLabel,
      card._display_status || null,
    ].filter(Boolean),
  };
}

function ConsultaEmbarqueCard({
  card,
  onVerPedido,
  isLast = false,
  exportMode = false,
  showDetalheCustos = false,
  produtosMap = {},
}) {
  const itensEmbarque = getConsultaItens(card);
  const ehNecessidade = card._consulta_papel === 'necessidade';
  const displayStatus = card._display_status || card.status;
  const { fornecedor, detalhes } = buildEmbarqueMetaLinhas(card);
  const statusAccent = comprasAccentFromDisplayStatus(displayStatus);
  const metaSemStatus = detalhes.filter((d) => d !== displayStatus);

  const headerShellClass = cn(
    'w-full text-left min-w-0',
    exportMode ? 'py-3.5 pr-1 overflow-visible' : 'py-3 pr-1',
    CONSULTA_HIER.sep,
    !exportMode && 'hover:bg-muted/20 transition-colors',
  );
  const headerContent = (
    <div className="space-y-2 min-w-0 w-full overflow-visible">
      <p className={cn(CONSULTA_TITLE, exportMode && 'line-clamp-none leading-snug')}>
        {card._display_code || card.numero}
        {ehNecessidade ? (
          <span className="text-muted-foreground font-light normal-case text-sm"> · falta vir</span>
        ) : null}
      </p>
      <p className={cn(CONSULTA_SUBTITLE, 'normal-case', exportMode && 'line-clamp-none')}>{fornecedor}</p>
      <div className={cn(
        'flex min-w-0 gap-3',
        exportMode ? 'flex-col items-stretch' : 'items-end justify-between',
      )}
      >
        <div className={cn(
          caixaTypo.meta,
          'normal-case min-w-0 font-light',
          exportMode ? 'flex flex-col items-start gap-1' : 'flex flex-wrap items-start gap-x-1.5 gap-y-1 flex-1',
        )}
        >
          {displayStatus ? (
            <div className="flex flex-col items-start gap-0.5 shrink-0">
              <ComprasStatusChip displayStatus={displayStatus} fallbackStatus={card.status}>
                {getComprasDisplayStatusLabel(displayStatus)}
              </ComprasStatusChip>
              {displayStatus === 'Concluído' && card._display_data_recebimento ? (
                <ComprasRecebimentoDateChip date={card._display_data_recebimento} />
              ) : null}
            </div>
          ) : null}
          {metaSemStatus.map((part) => (
            <span key={part} className="tabular-nums text-foreground/80 pt-0.5">
              {part}
            </span>
          ))}
        </div>
        <CaixaValorDisplay
          valor={card._consulta_valor || 0}
          tone="neutral"
          signed={false}
          size="sm"
          className={exportMode ? 'self-end' : 'shrink-0'}
        />
      </div>
    </div>
  );

  return (
    <div className={cn('min-w-0 max-w-full', exportMode ? 'overflow-visible' : 'overflow-hidden', !isLast && CONSULTA_HIER.sep)}>
      {exportMode ? (
        <div className={headerShellClass}>{headerContent}</div>
      ) : (
        <button
          type="button"
          onClick={() => onVerPedido?.(card)}
          className={headerShellClass}
        >
          {headerContent}
        </button>
      )}
      {itensEmbarque.length > 0 ? (
        <div className={cn(CONSULTA_HIER.l2, exportMode ? 'pb-1.5 pt-1 overflow-visible' : 'pb-1 pt-0.5')}>
          {itensEmbarque.map((item, idx) => {
            const exib = getItemCompraExibicaoVitrine(item);
            return (
              <ConsultaProdutoRow
                key={`${card._virtual_key || card.id}-${item.produto_id || idx}`}
                compact
                exportPdf={exportMode}
                quantidade={Number(item.quantidade) || exib.quantidade}
                unidade={item.unidade_medida || exib.unidade_medida}
                nome={item.produto_nome}
                valorTotal={Number(item.valor_total_item) || Number(item.total) || getTotalLinhaPedidoCompra(item)}
                precoUnitario={item.preco_unitario || exib.preco_unitario}
                striped={idx % 2 === 1}
                accent={statusAccent}
                valorTone="neutral"
                signedValor={false}
                detalheCustos={
                  showDetalheCustos
                    ? buildConsultaItemCustoDetalhe(item, produtosMap[item.produto_id])
                    : null
                }
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ConsultaGrupoEmbarques({
  grupo,
  onVerPedido,
  open,
  onToggle,
  exportMode = false,
  showDetalheCustos = false,
  produtosMap = {},
}) {
  const hasStructuredHeader = grupo.groupDate != null && grupo.groupCarrier != null;
  const headerTextClass = 'text-sm font-light text-foreground/85 leading-relaxed';

  const headerContent = (
    <>
      <div className="flex-1 min-w-0 overflow-hidden">
        {hasStructuredHeader ? (
          <div className="space-y-0.5 min-w-0">
            <span className={cn(headerTextClass, 'block tabular-nums normal-case')}>
              {grupo.groupDate}
            </span>
            <span className={cn(CONSULTA_SUBTITLE, 'block normal-case')}>
              {grupo.groupCarrier}
            </span>
          </div>
        ) : (
          <span className={cn(headerTextClass, 'block truncate min-w-0 uppercase tracking-wide')}>
            {grupo.label}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
        <CaixaValorDisplay
          valor={grupo.totalConsulta || 0}
          tone="neutral"
          signed={false}
          size="sm"
        />
        {!exportMode ? (
          <ChevronDown
            className={cn(
              'w-4 h-4 text-foreground/70 transition-transform duration-200',
              open ? '' : '-rotate-90',
            )}
          />
        ) : null}
      </div>
    </>
  );

  return (
    <div className="w-full min-w-0 max-w-full">
      {exportMode ? (
        <div
          className={cn(
            'w-full min-w-0 text-left overflow-visible flex items-start gap-2 py-3',
            CONSULTA_HIER.sep,
          )}
        >
          {headerContent}
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'w-full min-w-0 text-left overflow-hidden flex items-start gap-2 py-2.5',
            CONSULTA_HIER.sep,
          )}
        >
          {headerContent}
        </button>
      )}
      {open ? (
        <div className={cn(CONSULTA_HIER.l1, exportMode ? 'space-y-0 overflow-visible' : 'space-y-0')}>
          {grupo.cards.map((card, index) => (
            <ConsultaEmbarqueCard
              key={card._virtual_key || card.id}
              card={card}
              onVerPedido={onVerPedido}
              isLast={index === grupo.cards.length - 1}
              exportMode={exportMode}
              showDetalheCustos={showDetalheCustos}
              produtosMap={produtosMap}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ConsultaComprasPedidos({
  pedidosFiltrados = [],
  onVerPedido,
  contextLabel = 'Consulta de compras',
  emptyMessage = 'Nenhum embarque no período selecionado',
  groupBy = 'eta_transportadora',
  sortOrder = 'asc',
  exportMode = false,
  showDetalheCustos = false,
  produtosMap = {},
  modoFixo = null,
}) {
  const [modo, setModo] = useState(modoFixo || 'produto');
  const [gruposAbertos, setGruposAbertos] = useState(() => new Set());

  const produtosAgregados = useMemo(() => aggregateByProduto(pedidosFiltrados), [pedidosFiltrados]);
  const gruposEmbarque = useMemo(
    () => buildGruposConsultaEmbarques(pedidosFiltrados, groupBy, sortOrder),
    [pedidosFiltrados, groupBy, sortOrder],
  );

  useEffect(() => {
    if (exportMode && modoFixo === 'embarque') {
      setGruposAbertos(new Set(gruposEmbarque.map((g) => g.key)));
      return;
    }
    setGruposAbertos(new Set());
  }, [gruposEmbarque, exportMode, modoFixo]);

  useEffect(() => {
    if (modoFixo) setModo(modoFixo);
  }, [modoFixo]);

  const toggleGrupo = (key) => {
    setGruposAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const abrirTodosGrupos = () => {
    setGruposAbertos(new Set(gruposEmbarque.map((g) => g.key)));
  };

  const recolherTodosGrupos = () => {
    setGruposAbertos(new Set());
  };

  const todosGruposAbertos = gruposEmbarque.length > 0
    && gruposEmbarque.every((g) => gruposAbertos.has(g.key));
  const algumGrupoAberto = gruposEmbarque.some((g) => gruposAbertos.has(g.key));

  const totalGeral = useMemo(
    () => roundToTwoDecimals(
      pedidosFiltrados.reduce((acc, card) => acc + (Number(card._consulta_valor) || 0), 0),
    ),
    [pedidosFiltrados],
  );

  if (pedidosFiltrados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <ShoppingCart className="w-10 h-10 text-muted-foreground mb-3" />
        <p className={caixaTypo.meta}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 min-w-0 max-w-full', exportMode ? 'overflow-visible' : 'overflow-x-hidden', 'font-din-1451')}>
      <div className="flex flex-col gap-3 min-w-0 max-w-full">
        <div className="min-w-0">
          <p className={cn(caixaTypo.labelSm, 'font-light uppercase tracking-wide')}>{contextLabel}</p>
          <CaixaValorDisplay valor={totalGeral} tone="info" size="lg" />
          <p className={`${caixaTypo.meta} mt-1 font-light`}>
            {pedidosFiltrados.length} embarque{pedidosFiltrados.length === 1 ? '' : 's'}
          </p>
        </div>
        {!exportMode ? (
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/15 dark:bg-muted/50 p-1 w-full max-w-md">
            <button
              type="button"
              onClick={() => setModo('produto')}
              className={`px-3 py-2.5 rounded-xl ${caixaTypo.tab} font-light transition-colors truncate ${modo === 'produto' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Por produto
            </button>
            <button
              type="button"
              onClick={() => setModo('embarque')}
              className={`px-3 py-2.5 rounded-xl ${caixaTypo.tab} font-light transition-colors truncate ${modo === 'embarque' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Por embarque
            </button>
          </div>
        ) : null}
      </div>

      {modo === 'produto' ? (
        <P38MobileLineList allViewports className="rounded-lg max-w-full overflow-hidden">
          {produtosAgregados.map((p, index) => (
            <ConsultaProdutoRow
              key={p.key}
              compact
              exportPdf={exportMode}
              quantidade={p.quantidade}
              unidade={p.unidade}
              nome={p.nome}
              valorTotal={p.total}
              striped={index % 2 === 1}
              accent="citrus"
            />
          ))}
        </P38MobileLineList>
      ) : (
        <div className={cn('space-y-4 min-w-0 max-w-full', exportMode ? 'overflow-visible' : 'overflow-x-hidden')}>
          {!exportMode && gruposEmbarque.length > 0 ? (
            <div className="flex items-center justify-end gap-2 min-w-0">
              {!todosGruposAbertos ? (
                <button
                  type="button"
                  onClick={abrirTodosGrupos}
                  className={cn(
                    caixaTypo.meta,
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-light text-foreground/80',
                    'hover:bg-muted/40 transition-colors',
                  )}
                >
                  <UnfoldVertical className="w-4 h-4 shrink-0" aria-hidden />
                  Abrir todos
                </button>
              ) : null}
              {algumGrupoAberto ? (
                <button
                  type="button"
                  onClick={recolherTodosGrupos}
                  className={cn(
                    caixaTypo.meta,
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-light text-foreground/80',
                    'hover:bg-muted/40 transition-colors',
                  )}
                >
                  <FoldVertical className="w-4 h-4 shrink-0" aria-hidden />
                  Recolher todos
                </button>
              ) : null}
            </div>
          ) : null}
          {gruposEmbarque.map((grupo) => (
            <ConsultaGrupoEmbarques
              key={grupo.key}
              grupo={grupo}
              onVerPedido={onVerPedido}
              open={exportMode || gruposAbertos.has(grupo.key)}
              onToggle={() => toggleGrupo(grupo.key)}
              exportMode={exportMode}
              showDetalheCustos={showDetalheCustos}
              produtosMap={produtosMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
