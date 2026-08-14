import React, { useMemo, useState } from 'react';
import { ChevronDown, ShoppingCart } from 'lucide-react';
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
import { comprasAccentFromDisplayStatus } from '@/lib/comprasEmbarquesPalette';

/** Recuo hierárquico + tipografia fixa (visual mobile em todos os viewports). */
const CONSULTA_HIER = {
  l1: 'ml-1 pl-2 border-l border-border/30 dark:border-white/10 min-w-0 max-w-full',
  l2: 'ml-1 pl-2 border-l border-border/20 dark:border-white/[0.06] min-w-0 max-w-full',
  sep: 'border-b border-border/40 dark:border-white/10',
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

function ConsultaEmbarqueCard({ card, onVerPedido, isLast = false }) {
  const itensEmbarque = getConsultaItens(card);
  const ehNecessidade = card._consulta_papel === 'necessidade';
  const { fornecedor, detalhes } = buildEmbarqueMetaLinhas(card);
  const statusAccent = comprasAccentFromDisplayStatus(card._display_status || card.status);

  return (
    <div className={cn('min-w-0 max-w-full overflow-hidden', !isLast && CONSULTA_HIER.sep)}>
      <button
        type="button"
        onClick={() => onVerPedido?.(card)}
        className={cn(
          'w-full text-left hover:bg-muted/20 transition-colors min-w-0 py-3 pr-1',
          CONSULTA_HIER.sep,
        )}
      >
        <div className="space-y-1.5 min-w-0 w-full">
          <p className={CONSULTA_TITLE}>
            {card._display_code || card.numero}
            {ehNecessidade ? (
              <span className="text-muted-foreground font-light normal-case text-sm"> · falta vir</span>
            ) : null}
          </p>
          <p className={cn(CONSULTA_SUBTITLE, 'normal-case')}>{fornecedor}</p>
          <div className="flex items-end justify-between gap-3 min-w-0">
            <p className={cn(caixaTypo.meta, 'normal-case min-w-0 line-clamp-2 flex-1 font-light')}>
              {detalhes.join(' · ')}
            </p>
            <CaixaValorDisplay
              valor={card._consulta_valor || 0}
              tone="neutral"
              signed={false}
              size="sm"
              className="shrink-0"
            />
          </div>
        </div>
      </button>
      {itensEmbarque.length > 0 ? (
        <div className={cn(CONSULTA_HIER.l2, 'pb-1 pt-0.5')}>
          {itensEmbarque.map((item, idx) => {
            const exib = getItemCompraExibicaoVitrine(item);
            return (
              <ConsultaProdutoRow
                key={`${card._virtual_key || card.id}-${item.produto_id || idx}`}
                compact
                quantidade={Number(item.quantidade) || exib.quantidade}
                unidade={item.unidade_medida || exib.unidade_medida}
                nome={item.produto_nome}
                valorTotal={Number(item.valor_total_item) || Number(item.total) || getTotalLinhaPedidoCompra(item)}
                precoUnitario={item.preco_unitario || exib.preco_unitario}
                striped={idx % 2 === 1}
                accent={statusAccent}
                valorTone="neutral"
                signedValor={false}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ConsultaGrupoEmbarques({ grupo, onVerPedido, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasStructuredHeader = grupo.groupDate != null && grupo.groupCarrier != null;
  const headerTextClass = 'text-sm font-light text-foreground/85 leading-relaxed';

  return (
    <div className="w-full min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full min-w-0 text-left overflow-hidden flex items-start gap-2 py-2.5',
          CONSULTA_HIER.sep,
        )}
      >
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
          <ChevronDown
            className={cn(
              'w-4 h-4 text-foreground/70 transition-transform duration-200',
              open ? '' : '-rotate-90',
            )}
          />
        </div>
      </button>
      {open ? (
        <div className={cn(CONSULTA_HIER.l1, 'space-y-0')}>
          {grupo.cards.map((card, index) => (
            <ConsultaEmbarqueCard
              key={card._virtual_key || card.id}
              card={card}
              onVerPedido={onVerPedido}
              isLast={index === grupo.cards.length - 1}
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
    <div className="space-y-4 min-w-0 max-w-full overflow-x-hidden font-din-1451">
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
              compact
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
        <div className="space-y-4 min-w-0 max-w-full overflow-x-hidden">
          {gruposEmbarque.map((grupo) => (
            <ConsultaGrupoEmbarques
              key={grupo.key}
              grupo={grupo}
              onVerPedido={onVerPedido}
            />
          ))}
        </div>
      )}
    </div>
  );
}
