import React, { useMemo, useState } from 'react';
import { ChevronDown, ShoppingCart } from 'lucide-react';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import { ConsultaProdutoRow } from '@/components/vendas/caixa/ConsultaProdutoRow';
import { caixaTypo } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { getItemCompraExibicaoVitrine } from '@/lib/productUnits';
import { formatarSoData } from '@/components/utils/dateUtils';
import { getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { buildGruposConsultaEmbarques } from '@/lib/consultaComprasEmbarques';

function getConsultaItens(card) {
  return card._consulta_itens || card.itens || [];
}

function aggregateByProduto(cards) {
  const map = new Map();
  (cards || []).forEach((card) => {
    getConsultaItens(card).forEach((item) => {
      const key = item.produto_id || item.produto_nome || 'sem-id';
      const exib = getItemCompraExibicaoVitrine(item);
      const qtd = Number(item.quantidade) || exib.quantidade;
      const total = Number(item.valor_total_item) || Number(item.total) || getTotalLinhaPedidoCompra(item);
      const prev = map.get(key) || {
        key,
        nome: item.produto_nome || 'Produto',
        unidade: exib.unidade_medida || item.unidade_medida || 'UN',
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

/** Card de embarque — mesmo esqueleto da consulta de vendas (por comprovante), identidade compras (ciano). */
function ConsultaEmbarqueCard({ card, onVerPedido }) {
  const itensEmbarque = getConsultaItens(card);
  const etaEmbarque = card._embarque?.eta ? formatarSoData(card._embarque.eta) : null;
  const ehNecessidade = card._consulta_papel === 'necessidade';
  const etaLabel = etaEmbarque
    ? `ETA ${etaEmbarque}`
    : (card.data_prevista_entrega ? `ETA ${formatarSoData(card.data_prevista_entrega)}` : null);
  const subtitulo = [
    card._display_fornecedor || card.fornecedor_nome || 'Fornecedor não informado',
    card.data_emissao ? formatarSoData(card.data_emissao) : null,
    etaLabel,
    card._display_status || null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => onVerPedido?.(card)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 text-left hover:bg-muted/30 transition-colors min-w-0"
      >
        <div className="min-w-0 flex-1">
          <p className={cn(p38Table.mobileLineTitle, 'truncate')}>
            {card._display_code || card.numero}
            {ehNecessidade ? (
              <span className="text-muted-foreground font-normal normal-case text-sm"> · falta vir</span>
            ) : null}
          </p>
          <p className={cn(p38Table.mobileLineSubtitle, 'truncate')}>{subtitulo}</p>
        </div>
        <CaixaValorDisplay valor={card._consulta_valor || 0} tone="info" size="sm" className="shrink-0" />
      </button>
      {itensEmbarque.length > 0 ? (
        <P38MobileLineList allViewports className="rounded-none border-0">
          {itensEmbarque.map((item, idx) => {
            const exib = getItemCompraExibicaoVitrine(item);
            return (
              <ConsultaProdutoRow
                key={`${card._virtual_key || card.id}-${item.produto_id || idx}`}
                quantidade={Number(item.quantidade) || exib.quantidade}
                unidade={exib.unidade_medida || item.unidade_medida}
                nome={item.produto_nome}
                valorTotal={Number(item.valor_total_item) || Number(item.total) || getTotalLinhaPedidoCompra(item)}
                precoUnitario={item.preco_unitario || exib.preco_unitario}
                striped={idx % 2 === 1}
                accent="muted"
              />
            );
          })}
        </P38MobileLineList>
      ) : null}
    </div>
  );
}

/** Agrupamento ETA + transportadora — identidade da lista de embarques. */
function ConsultaGrupoEmbarques({ grupo, onVerPedido, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasStructuredHeader = grupo.groupDate != null && grupo.groupCarrier != null;

  return (
    <div className="w-full min-w-0 max-w-full space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-w-0 flex items-center gap-2 border-b border-border/50 dark:border-white/10 py-2 pr-1 text-left overflow-hidden"
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          {hasStructuredHeader ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(caixaTypo.labelSm, 'shrink-0 tabular-nums whitespace-nowrap normal-case')}>
                {grupo.groupDate}
              </span>
              <span className={cn(p38Table.mobileLineSubtitle, 'truncate min-w-0 normal-case')}>
                {grupo.groupCarrier}
              </span>
            </div>
          ) : (
            <span className={cn(caixaTypo.labelSm, 'block truncate min-w-0 uppercase tracking-wide')}>
              {grupo.label}
            </span>
          )}
        </div>
        <CaixaValorDisplay valor={grupo.totalConsulta || 0} tone="info" size="sm" className="shrink-0 max-w-[40%]" />
        <ChevronDown className={`w-4 h-4 shrink-0 text-foreground/70 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open ? (
        <div className="ml-2 pl-2.5 border-l border-border/30 dark:border-white/10 space-y-3 min-w-0 max-w-full overflow-hidden">
          {grupo.cards.map((card) => (
            <ConsultaEmbarqueCard key={card._virtual_key || card.id} card={card} onVerPedido={onVerPedido} />
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
}) {
  const [modo, setModo] = useState('produto');

  const produtosAgregados = useMemo(() => aggregateByProduto(pedidosFiltrados), [pedidosFiltrados]);
  const gruposEmbarque = useMemo(
    () => buildGruposConsultaEmbarques(pedidosFiltrados, groupBy, sortOrder),
    [pedidosFiltrados, groupBy, sortOrder],
  );

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
    <div className="space-y-4 min-w-0 max-w-full overflow-hidden font-din-1451">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <p className={caixaTypo.labelSm}>{contextLabel}</p>
          <CaixaValorDisplay valor={totalGeral} tone="info" size="lg" />
          <p className={`${caixaTypo.meta} mt-1`}>
            {pedidosFiltrados.length} embarque{pedidosFiltrados.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex rounded-2xl bg-muted/50 p-1 gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setModo('produto')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'produto' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por produto
          </button>
          <button
            type="button"
            onClick={() => setModo('embarque')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'embarque' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por embarque
          </button>
        </div>
      </div>

      {modo === 'produto' ? (
        <P38MobileLineList allViewports className="rounded-lg">
          {produtosAgregados.map((p, index) => (
            <ConsultaProdutoRow
              key={p.key}
              quantidade={p.quantidade}
              unidade={p.unidade}
              nome={p.nome}
              valorTotal={p.total}
              striped={index % 2 === 1}
              accent="info"
            />
          ))}
        </P38MobileLineList>
      ) : (
        <div className="space-y-4 min-w-0 max-w-full overflow-hidden">
          {gruposEmbarque.map((grupo) => (
            <ConsultaGrupoEmbarques key={grupo.key} grupo={grupo} onVerPedido={onVerPedido} />
          ))}
        </div>
      )}
    </div>
  );
}
