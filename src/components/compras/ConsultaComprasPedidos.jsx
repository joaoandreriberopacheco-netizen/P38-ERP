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
    <div className="relative w-[2.25rem] sm:w-[2.75rem] flex-shrink-0 border-r border-border/40 dark:border-white/10 pr-1 py-1.5 text-right">
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
      <div className="flex-1 min-w-0 py-1.5 pr-1.5 pl-1 sm:pl-2 overflow-hidden">
        <p className={cn(p38Table.mobileLineTitle, 'line-clamp-2 leading-snug font-light break-words text-sm')}>{nome}</p>
        <div className="flex items-baseline justify-between gap-2 mt-0.5 min-w-0">
          <p className={`${caixaTypo.meta} normal-case tabular-nums min-w-0 truncate text-[11px] sm:text-xs`}>
            <span className="text-foreground/90">{formatCaixaR(precoEfetivo)} un.</span>
          </p>
          <div className="shrink-0">
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
  const etaLabel = etaEmbarque
    ? `ETA ${etaEmbarque}`
    : (card.data_prevista_entrega ? `ETA ${formatarSoData(card.data_prevista_entrega)}` : null);
  const metaLinha = [
    card._display_fornecedor || card.fornecedor_nome || 'Fornecedor não informado',
    card.data_emissao ? formatarSoData(card.data_emissao) : null,
    etaLabel,
  ].filter(Boolean).join(' · ');

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden max-w-full min-w-0 w-full">
      <button
        type="button"
        onClick={() => onVerPedido?.(card)}
        className="w-full grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-2 gap-y-0.5 px-2.5 py-2 sm:px-3 border-b border-border/40 text-left hover:bg-muted/30 transition-colors min-w-0 items-start"
      >
        <div className="min-w-0 col-start-1 row-start-1 flex items-center gap-1.5 overflow-hidden">
          <span className={cn(p38Table.mobileLineTitle, 'text-sm font-light truncate min-w-0')}>
            {card._display_code || card.numero}
          </span>
          {ehNecessidade ? (
            <span className="shrink-0 text-[10px] font-medium normal-case text-muted-foreground/90">falta vir</span>
          ) : null}
          {card._display_status ? (
            <span className="shrink-0 max-w-[5.5rem] sm:max-w-[8rem] truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
              {card._display_status}
            </span>
          ) : null}
        </div>
        <div className="col-start-2 row-start-1 row-span-2 self-start shrink-0 max-w-[42%]">
          <CaixaValorDisplay valor={card._consulta_valor || 0} tone="info" size="sm" />
        </div>
        <p className={cn(caixaTypo.meta, 'col-start-1 row-start-2 min-w-0 truncate font-light normal-case text-[11px] sm:text-xs leading-tight')}>
          {metaLinha}
        </p>
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
  const headerTextClass = 'text-xs sm:text-sm font-light text-foreground/85 leading-snug';

  return (
    <div className="w-full min-w-0 max-w-full space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-w-0 max-w-full flex items-center gap-1.5 sm:gap-2 border-b border-border/50 dark:border-white/10 py-2 pr-0.5 text-left overflow-hidden"
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          {hasStructuredHeader ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(headerTextClass, 'shrink-0 tabular-nums whitespace-nowrap')}>{grupo.groupDate}</span>
              <span className={cn(headerTextClass, 'truncate min-w-0')}>{grupo.groupCarrier}</span>
            </div>
          ) : (
            <span className={cn(headerTextClass, 'block truncate min-w-0 uppercase tracking-wide')}>{grupo.label}</span>
          )}
        </div>
        <CaixaValorDisplay valor={grupo.totalConsulta || 0} tone="info" size="sm" className="shrink-0 max-w-[38%] sm:max-w-[40%]" />
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-foreground/70 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open ? (
        <div className="ml-1 sm:ml-2 pl-2 sm:pl-2.5 border-l border-border/30 dark:border-white/10 space-y-2 min-w-0 max-w-full overflow-hidden">
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
    <div className="space-y-3 min-w-0 max-w-full overflow-hidden font-din-1451">
      <div className="flex flex-col gap-2 min-w-0 max-w-full">
        <div className="min-w-0 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className={cn(caixaTypo.labelSm, 'font-light uppercase tracking-wide text-[10px] sm:text-xs')}>{contextLabel}</p>
            <CaixaValorDisplay valor={totalGeral} tone="info" size="lg" />
            <p className={`${caixaTypo.meta} mt-0.5 font-light text-xs`}>
              {pedidosFiltrados.length} embarque{pedidosFiltrados.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-0.5 w-full max-w-md">
          <button
            type="button"
            onClick={() => setModo('produto')}
            className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg ${caixaTypo.tab} font-light transition-colors truncate text-xs sm:text-sm ${modo === 'produto' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por produto
          </button>
          <button
            type="button"
            onClick={() => setModo('embarque')}
            className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg ${caixaTypo.tab} font-light transition-colors truncate text-xs sm:text-sm ${modo === 'embarque' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
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
        <div className="space-y-3 min-w-0 max-w-full overflow-hidden">
          {gruposEmbarque.map((grupo) => (
            <ConsultaGrupoEmbarques key={grupo.key} grupo={grupo} onVerPedido={onVerPedido} />
          ))}
        </div>
      )}
    </div>
  );
}
