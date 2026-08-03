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
import {
  calcValorTotalPedidoCompra,
  getTotalLinhaPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';

function ConsultaQtdUnCol({ qtd, unidade, accent = 'info' }) {
  const dotClass = accent === 'muted' ? p38Accent.muted.dot : p38Accent.info.dot;
  return (
    <div className="relative w-[3.25rem] flex-shrink-0 border-r border-border/40 dark:border-white/10 pr-1.5 py-2.5 text-right">
      <span className={`absolute left-0 top-3 ${dotClass}`} aria-hidden />
      <p className="text-base font-din-1451 tabular-nums text-foreground leading-none">
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
        'flex min-w-0',
        striped && 'bg-secondary/15 dark:bg-secondary/20',
      )}
    >
      <ConsultaQtdUnCol qtd={quantidade} unidade={unidade} accent={accent} />
      <div className="flex-1 min-w-0 py-2 pr-3 pl-2">
        <p className={cn(p38Table.mobileLineTitle, 'line-clamp-3 leading-snug')}>{nome}</p>
        <div className="flex items-baseline justify-between gap-3 mt-1">
          <p className={`${caixaTypo.meta} normal-case tabular-nums min-w-0`}>
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

function aggregateByProduto(pedidos) {
  const map = new Map();
  (pedidos || []).forEach((pedido) => {
    (pedido.itens || []).forEach((item) => {
      const key = item.produto_id || item.produto_nome || 'sem-id';
      const exib = getItemCompraExibicaoVitrine(item);
      const qtd = exib.quantidade;
      const total = getTotalLinhaPedidoCompra(item);
      const prev = map.get(key) || {
        key,
        nome: item.produto_nome || 'Produto',
        unidade: exib.unidade_medida || 'UN',
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
  emptyMessage = 'Nenhum pedido de compra no período selecionado',
}) {
  const [modo, setModo] = useState('produto');

  const produtosAgregados = useMemo(() => aggregateByProduto(pedidosFiltrados), [pedidosFiltrados]);
  const pedidosOrdenados = pedidosFiltrados;

  const totalGeral = useMemo(
    () => roundToTwoDecimals(pedidosFiltrados.reduce((acc, p) => acc + calcValorTotalPedidoCompra(p), 0)),
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className={caixaTypo.labelSm}>{contextLabel}</p>
          <CaixaValorDisplay valor={totalGeral} tone="info" size="lg" />
          <p className={`${caixaTypo.meta} mt-1`}>
            {pedidosFiltrados.length} pedido{pedidosFiltrados.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex rounded-2xl bg-muted/50 p-1 gap-1">
          <button
            type="button"
            onClick={() => setModo('produto')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'produto' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por produto
          </button>
          <button
            type="button"
            onClick={() => setModo('pedido')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'pedido' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por pedido
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
            />
          ))}
        </P38MobileLineList>
      ) : (
        <div className="space-y-3">
          {pedidosOrdenados.map((pedido) => (
            <div key={pedido.id} className="bg-card rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => onVerPedido?.(pedido)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className={`${p38Table.mobileLineTitle} truncate`}>{pedido.numero}</p>
                  <p className={`${p38Table.mobileLineSubtitle} truncate`}>
                    {pedido.fornecedor_nome || 'Fornecedor não informado'}
                    {pedido.data_emissao ? ` · ${formatarSoData(pedido.data_emissao)}` : ''}
                    {pedido.data_prevista_entrega ? ` · ETA ${formatarSoData(pedido.data_prevista_entrega)}` : ''}
                  </p>
                  {pedido.status ? (
                    <p className={`${caixaTypo.meta} mt-1`}>{pedido.status}</p>
                  ) : null}
                </div>
                <CaixaValorDisplay valor={calcValorTotalPedidoCompra(pedido)} tone="info" size="sm" />
              </button>
              <P38MobileLineList allViewports className="rounded-none border-0">
                {(pedido.itens || []).map((item, idx) => {
                  const exib = getItemCompraExibicaoVitrine(item);
                  return (
                    <ConsultaProdutoRow
                      key={`${pedido.id}-${idx}`}
                      quantidade={exib.quantidade}
                      unidade={exib.unidade_medida}
                      nome={item.produto_nome}
                      valorTotal={getTotalLinhaPedidoCompra(item)}
                      precoUnitario={exib.preco_unitario}
                      striped={idx % 2 === 1}
                      accent="muted"
                    />
                  );
                })}
              </P38MobileLineList>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
