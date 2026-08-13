import React, { useMemo, useState } from 'react';
import { ChevronDown, ShoppingCart } from 'lucide-react';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaTypo } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { getItemCompraExibicaoVitrine, formatCommercialQuantity } from '@/lib/productUnits';
import { formatarSoData } from '@/components/utils/dateUtils';
import { getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { buildGruposConsultaEmbarques } from '@/lib/consultaComprasEmbarques';

function ConsultaQtdUnCol({ qtd, unidade, accent = 'info' }) {
  const dotClass = accent === 'muted' ? p38Accent.muted.dot : p38Accent.info.dot;
  return (
    <div className="relative w-[2.5rem] sm:w-[3rem] flex-shrink-0 border-r border-border/40 dark:border-white/10 pr-1 py-2.5 text-right">
      <span className={`absolute left-0 top-3 h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
      <p className="text-xs sm:text-sm font-din-1451 tabular-nums text-foreground leading-none">
        {formatCommercialQuantity(qtd, unidade)}
      </p>
      <p className={`${caixaTypo.labelSm} mt-1 leading-none truncate text-[10px] sm:text-xs`}>
        {(unidade || 'UN').toUpperCase()}
      </p>
    </div>
  );
}

function ConsultaProdutoRow({
  quantidade,
  unidade,
  nome,
  valorTotal,
  precoUnitario,
  striped = false,
  accent = 'info',
}) {
  const borderClass = accent === 'muted' ? p38Accent.muted.border : p38Accent.info.border;
  const precoEfetivo = Number(precoUnitario) || (
    (Number(quantidade) || 0) > 0
      ? roundToTwoDecimals((Number(valorTotal) || 0) / (Number(quantidade) || 1))
      : 0
  );

  return (
    <div
      className={cn(
        p38Table.mobileLineThin,
        borderClass,
        'flex min-w-0 w-full max-w-full overflow-hidden',
        striped && 'bg-secondary/15 dark:bg-secondary/20',
      )}
    >
      <ConsultaQtdUnCol qtd={quantidade} unidade={unidade} accent={accent} />
      <div className="flex-1 min-w-0 py-2 pr-2 pl-1.5 sm:pl-2 overflow-hidden">
        <p className={cn(p38Table.mobileLineTitle, 'line-clamp-2 sm:line-clamp-3 leading-snug font-light break-words')}>{nome}</p>
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-2 mt-1 min-w-0">
          <p className={`${caixaTypo.meta} normal-case tabular-nums min-w-0 truncate`}>
            <span className="text-foreground/90">{formatCaixaR(precoEfetivo)} un.</span>
          </p>
          <div className="shrink-0 self-end sm:self-auto">
            <CaixaValorDisplay
              valor={valorTotal}
              tone={accent === 'muted' ? 'neutral' : 'info'}
              signed={accent !== 'muted'}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

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

function ConsultaEmbarqueCard({ card, onVerPedido }) {
  const itensEmbarque = getConsultaItens(card);
  const etaEmbarque = card._embarque?.eta ? formatarSoData(card._embarque.eta) : null;
  const ehNecessidade = card._consulta_papel === 'necessidade';

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden max-w-full min-w-0 w-full">
      <button
        type="button"
        onClick={() => onVerPedido?.(card)}
        className="w-full flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start gap-1 sm:gap-2 px-3 py-3 sm:px-4 border-b border-border/40 text-left hover:bg-muted/30 transition-colors min-w-0"
      >
        <div className="min-w-0 w-full overflow-hidden">
          <p className={cn(p38Table.mobileLineTitle, 'font-light break-words line-clamp-2')}>
            {card._display_code || card.numero}
            {ehNecessidade ? (
              <span className="text-muted-foreground font-light normal-case text-sm"> · falta vir</span>
            ) : null}
          </p>
          <p className={cn(p38Table.mobileLineSubtitle, 'truncate font-light mt-0.5')}>
            {card._display_fornecedor || card.fornecedor_nome || 'Fornecedor não informado'}
          </p>
          <p className={cn(caixaTypo.meta, 'mt-1 font-light normal-case line-clamp-2')}>
            {[
              card.data_emissao ? formatarSoData(card.data_emissao) : null,
              etaEmbarque ? `ETA ${etaEmbarque}` : (card.data_prevista_entrega ? `ETA ${formatarSoData(card.data_prevista_entrega)}` : null),
            ].filter(Boolean).join(' · ')}
          </p>
          {card._display_status ? (
            <p className={cn(caixaTypo.meta, 'mt-1 truncate font-light uppercase tracking-wide')}>
              {card._display_status}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 sm:pt-0.5 sm:text-right w-full sm:w-auto flex sm:block justify-end">
          <CaixaValorDisplay valor={card._consulta_valor || 0} tone="info" size="sm" />
        </div>
      </button>
      {itensEmbarque.length > 0 ? (
        <div className="ml-1 sm:ml-2 pl-2 sm:pl-2.5 border-l border-border/25 dark:border-white/10 min-w-0 overflow-hidden">
          <P38MobileLineList allViewports className="rounded-none border-0 max-w-full overflow-hidden">
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
        </div>
      ) : null}
    </div>
  );
}

function ConsultaGrupoEmbarques({ grupo, onVerPedido, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasStructuredHeader = grupo.groupDate != null && grupo.groupCarrier != null;
  const headerTextClass = 'text-sm sm:text-base font-light text-foreground/85 leading-relaxed';

  return (
    <div className="w-full min-w-0 max-w-full space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-w-0 max-w-full flex items-center gap-2 sm:gap-3 border-b border-border/50 dark:border-white/10 py-2.5 pr-1 text-left overflow-hidden"
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          {hasStructuredHeader ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-x-3 min-w-0">
              <span className={cn(headerTextClass, 'shrink-0 tabular-nums whitespace-nowrap')}>{grupo.groupDate}</span>
              <span className={cn(headerTextClass, 'truncate min-w-0')}>{grupo.groupCarrier}</span>
            </div>
          ) : (
            <span className={cn(headerTextClass, 'block truncate min-w-0 uppercase tracking-wide')}>{grupo.label}</span>
          )}
        </div>
        <CaixaValorDisplay valor={grupo.totalConsulta || 0} tone="info" size="sm" className="shrink-0 max-w-[40%]" />
        <ChevronDown className={`w-4 h-4 shrink-0 text-foreground/70 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open ? (
        <div className="ml-1 sm:ml-2.5 pl-2 sm:pl-3 border-l border-border/30 dark:border-white/10 space-y-2.5 sm:space-y-3 min-w-0 max-w-full overflow-hidden">
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
      <div className="flex flex-col gap-3 min-w-0 max-w-full">
        <div className="min-w-0">
          <p className={cn(caixaTypo.labelSm, 'font-light uppercase tracking-wide')}>{contextLabel}</p>
          <CaixaValorDisplay valor={totalGeral} tone="info" size="lg" />
          <p className={`${caixaTypo.meta} mt-1 font-light`}>
            {pedidosFiltrados.length} embarque{pedidosFiltrados.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/50 p-1 w-full max-w-md">
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
      </div>

      {modo === 'produto' ? (
        <P38MobileLineList allViewports className="rounded-lg max-w-full overflow-hidden">
          {produtosAgregados.map((p, index) => (
            <ConsultaProdutoRow
              key={p.key}
              quantidade={p.quantidade}
              unidade={p.unidade}
              nome={p.nome}
              valorTotal={p.total}
              striped={index % 2 === 1}
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
