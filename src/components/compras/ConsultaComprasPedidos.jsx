import React, { useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
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

function ConsultaQtdUnCol({ qtd, unidade, accent = 'info' }) {
  const dotClass = accent === 'muted' ? p38Accent.muted.dot : p38Accent.info.dot;
  return (
    <div className="relative w-[2.75rem] sm:w-[3.25rem] flex-shrink-0 border-r border-border/40 dark:border-white/10 pr-1.5 py-2.5 text-right">
      <span className={`absolute left-0 top-3 h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
      <p className="text-sm sm:text-base font-din-1451 tabular-nums text-foreground leading-none">
        {formatCommercialQuantity(qtd, unidade)}
      </p>
      <p className={`${caixaTypo.labelSm} mt-1.5 leading-none truncate`}>
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
        'flex min-w-0 max-w-full overflow-hidden',
        striped && 'bg-secondary/15 dark:bg-secondary/20',
      )}
    >
      <ConsultaQtdUnCol qtd={quantidade} unidade={unidade} accent={accent} />
      <div className="flex-1 min-w-0 py-2 pr-2 sm:pr-3 pl-2 overflow-hidden">
        <p className={cn(p38Table.mobileLineTitle, 'line-clamp-3 leading-snug font-light')}>{nome}</p>
        <div className="flex items-baseline justify-between gap-2 mt-1 min-w-0">
          <p className={`${caixaTypo.meta} normal-case tabular-nums min-w-0 truncate`}>
            <span className="text-foreground/90">{formatCaixaR(precoEfetivo)} un.</span>
          </p>
          <div className="shrink-0 max-w-[45%]">
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

export default function ConsultaComprasPedidos({
  pedidosFiltrados = [],
  onVerPedido,
  contextLabel = 'Consulta de compras',
  emptyMessage = 'Nenhum embarque no período selecionado',
}) {
  const [modo, setModo] = useState('produto');

  const produtosAgregados = useMemo(() => aggregateByProduto(pedidosFiltrados), [pedidosFiltrados]);
  const embarquesOrdenados = pedidosFiltrados;

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
      <div className="flex flex-col gap-3 min-w-0">
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
        <div className="space-y-3 min-w-0 max-w-full">
          {embarquesOrdenados.map((card) => {
            const itensEmbarque = getConsultaItens(card);
            const etaEmbarque = card._embarque?.eta ? formatarSoData(card._embarque.eta) : null;
            const ehNecessidade = card._consulta_papel === 'necessidade';
            return (
              <div key={card._virtual_key || card.id} className="bg-card rounded-2xl shadow-sm overflow-hidden max-w-full min-w-0">
                <button
                  type="button"
                  onClick={() => onVerPedido?.(card)}
                  className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 py-3 sm:px-4 border-b border-border/40 text-left hover:bg-muted/30 transition-colors min-w-0"
                >
                  <div className="min-w-0 overflow-hidden">
                    <p className={cn(p38Table.mobileLineTitle, 'truncate font-light')}>
                      {card._display_code || card.numero}
                      {ehNecessidade ? (
                        <span className="text-muted-foreground font-light normal-case"> · falta vir</span>
                      ) : null}
                    </p>
                    <p className={cn(p38Table.mobileLineSubtitle, 'truncate font-light mt-0.5')}>
                      {card._display_fornecedor || card.fornecedor_nome || 'Fornecedor não informado'}
                    </p>
                    <p className={cn(caixaTypo.meta, 'mt-1 truncate font-light normal-case')}>
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
                  <div className="shrink-0 pt-0.5 max-w-[42%] overflow-hidden">
                    <CaixaValorDisplay valor={card._consulta_valor || 0} tone="info" size="sm" />
                  </div>
                </button>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
