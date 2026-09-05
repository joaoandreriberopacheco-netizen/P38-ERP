import React, { useState } from 'react';
import { formatarDataCurta } from '@/components/utils/dateUtils';
import { ChevronDown, Trash2, Check, Package2, CalendarClock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatQuantity } from '@/lib/financialUtils';
import { formatCommercialQuantity } from '@/lib/productUnits';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { cn } from '@/components/utils';
import { comprasStatusBorderClass, getComprasDisplayStatusLabel, resolveComprasStatusConfig } from '@/lib/comprasEmbarquesPalette';
import { ComprasRecebimentoDateChip } from '@/components/compras/ComprasStatusChip';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaTypo } from '@/lib/caixaP38Theme';

import { COMPRAS_HIER_L1, COMPRAS_SEP } from '@/lib/comprasP38Theme';

/** Recuo hierárquico + tipografia (mesma linguagem da Consulta por embarque). */
const EMBARQUE_HIER = {
  l1: COMPRAS_HIER_L1,
  sep: COMPRAS_SEP,
};
const EMBARQUE_TITLE =
  'font-din-1451 font-light text-sm uppercase tracking-wide text-foreground leading-snug line-clamp-2 break-words';
const EMBARQUE_SUBTITLE =
  'font-din-1451 font-light text-[11px] text-muted-foreground line-clamp-2 break-words';

function formatCardQuantity(value, unitSuffix) {
  if (!unitSuffix || unitSuffix === 'un.') return formatQuantity(value);
  return formatCommercialQuantity(value, unitSuffix);
}

/** Rascunhos elegíveis para envio em lote ao financeiro (inclui rejeitados que voltaram a rascunho). */
function pedidoSelecionavelEnvioFinanceiroLote(pedido = {}) {
  if (pedido.status !== 'Rascunho') return false;
  const saf = String(pedido.status_aprovacao_financeira || '');
  if (!saf || saf === 'Pendente') return true;
  return saf === 'Rejeitado' || saf === 'Rejeitado Financeiramente';
}

function resolveStatusConfig(displayStatus, fallbackStatus) {
  return resolveComprasStatusConfig(displayStatus, fallbackStatus);
}

function getDisplayStatusLabel(displayStatus) {
  return getComprasDisplayStatusLabel(displayStatus);
}

function StatusLed({ displayStatus, fallbackStatus, blink = false, className = '' }) {
  const cfg = resolveStatusConfig(displayStatus, fallbackStatus);
  return (
    <span
      className={`flex-none w-1.5 h-1.5 rounded-full mt-0.5 ${blink ? 'animate-blink-led' : cfg.dot} ${className}`}
      aria-hidden
    />
  );
}

function StatusPill({ displayStatus, fallbackStatus, children, className = '' }) {
  const cfg = resolveStatusConfig(displayStatus, fallbackStatus);
  return (
    <span className={`inline-flex max-w-full text-[11px] px-2 py-0.5 rounded-full font-medium leading-normal whitespace-nowrap truncate ${cfg.pill} ${className}`}>
      {children}
    </span>
  );
}

// Adiciona animação de piscar ao CSS global
if (typeof document !== 'undefined' && !document.getElementById('blink-animation')) {
  const style = document.createElement('style');
  style.id = 'blink-animation';
  style.innerHTML = `
    @keyframes blink-aguardando {
      0%, 100% { background-color: #D96F55; }
      50% { background-color: #c45a42; }
    }
    .animate-blink-led {
      animation: blink-aguardando 1s infinite;
    }
  `;
  document.head.appendChild(style);
}

function EmbarquesInfo({ pedido }) {
  const embarque = pedido._embarque;
  const itensEmbarque = getEmbarqueItensLinhas(embarque);
  const itensDisplay = pedido._display_itens || [];
  const unidadesCard = [...new Set(itensDisplay.map((i) => String(i.unidade_medida || '').trim()).filter(Boolean))];
  const sufixoUnidade = unidadesCard.length === 1 ? unidadesCard[0] : 'un.';
  const temItensAssociados = itensEmbarque.some((item) => (Number(item?.quantidade_embarcada) || 0) > 0);
  const quantidadePendente = pedido._quantidade_pendente ?? 0;
  const embarqueDormindo = embarque?.tipo === 'Necessidade' && !embarque?.transportadora_id && !embarque?.transportadora_nome && !embarque?.data_embarque && !embarque?.eta && !temItensAssociados && quantidadePendente <= 0;

  if (embarqueDormindo) return null;

  return (
    <div className={cn(caixaTypo.meta, 'flex items-center gap-2 flex-wrap font-light normal-case text-foreground/80')}>
      <span className="flex items-center gap-1.5">
        <CalendarClock className="w-3 h-3 flex-none text-foreground/70" />
        <span>{embarque?.eta ? formatarDataCurta(embarque.eta) : 'Sem previsão'}</span>
      </span>
      <span className="text-foreground/75 tabular-nums">
        {pedido._display_ordinal || '#01'}
      </span>
      {pedido._is_necessidade && (pedido._quantidade_pendente ?? 0) > 0 && (
        <span className="text-red-500 dark:text-red-400 font-medium">
          {formatQuantity(pedido._quantidade_pendente)} {sufixoUnidade} faltando embarcar
        </span>
      )}
    </div>
  );
}

function getPedidoDisplayData(pedido) {
  const displayStatus = pedido._display_status || pedido.status;
  const displayStatusLabel = getDisplayStatusLabel(displayStatus);
  const itensDisplay = pedido._display_itens || (pedido.status === 'Pendência'
    ? (pedido.itens || []).filter(i => ((Number(i.quantidade) || 0) - (Number(i.quantidade_vinculada) || 0)) > 0)
    : (pedido.itens || []));
  const totalLinhas = itensDisplay.length;
  const totalQtd = itensDisplay.reduce((a, i) => a + (Number(i.quantidade) || 0), 0);
  const totalQtdEmbarcada = itensDisplay.reduce((a, i) => a + (Number(i.quantidade_embarcada) || 0), 0);
  const totalQtdPedidaCard = itensDisplay.reduce((a, i) => a + (Number(i.quantidade_pedida) || Number(i.quantidade) || 0), 0);
  const unidadesCard = [...new Set(itensDisplay.map((i) => String(i.unidade_medida || '').trim()).filter(Boolean))];
  const sufixoUnidade = unidadesCard.length === 1 ? unidadesCard[0] : 'un.';
  const valorExibido = pedido._display_valor ?? (pedido.status === 'Pendência'
    ? (pedido.valor_pendente_entrega ?? pedido.valor_total)
    : pedido.valor_total);
  const codigo = String(pedido._display_code || pedido.numero || '').replace(' - ', '-').replace(/\s+/g, '');

  const qtdPendNec = Number(pedido._quantidade_pendente) || 0;
  const qtdLabel = pedido._is_necessidade
    ? (qtdPendNec > 0 ? `${formatCardQuantity(qtdPendNec, sufixoUnidade)} ${sufixoUnidade} pend.` : '')
    : totalQtdEmbarcada > 0
      ? `${formatCardQuantity(totalQtdEmbarcada, sufixoUnidade)} / ${formatCardQuantity(totalQtdPedidaCard, sufixoUnidade)} ${sufixoUnidade}`
      : (totalQtd > 0 ? `${formatCardQuantity(totalQtd, sufixoUnidade)} ${sufixoUnidade}` : '');

  return {
    displayStatus,
    displayStatusLabel,
    itensDisplay,
    totalLinhas,
    valorExibido,
    codigo,
    qtdLabel,
  };
}

function EmbarqueListaCard({
  pedido,
  onEdit,
  onDelete,
  selecionado,
  desabilitadoSelecao,
  onToggleSelecao,
  modoSelecao,
  isLast = false,
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    displayStatus,
    displayStatusLabel,
    totalLinhas,
    valorExibido,
    codigo,
    qtdLabel,
  } = getPedidoDisplayData(pedido);

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.PedidoCompra.delete(pedido.id);
    setDeleting(false);
    setShowConfirm(false);
    onDelete();
  };

  const handleActivate = () => {
    if (modoSelecao) {
      if (!desabilitadoSelecao) onToggleSelecao?.(pedido);
      return;
    }
    onEdit(pedido);
  };

  return (
    <>
      <div
        className={cn(
          'relative min-w-0 max-w-full overflow-hidden',
          !isLast && EMBARQUE_HIER.sep,
          modoSelecao && selecionado && 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08]',
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleActivate();
            }
          }}
          className={cn(
            'w-full text-left hover:bg-muted/20 active:bg-muted/30 transition-colors min-w-0 py-3 pr-1 pl-2 cursor-pointer border-l touch-manipulation',
            EMBARQUE_HIER.sep,
            comprasStatusBorderClass(displayStatus, pedido.status),
          )}
        >
          <div className="flex items-start gap-2 min-w-0 w-full">
            {modoSelecao ? (
              <div
                className={cn(
                  'flex-none w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-colors',
                  selecionado ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  desabilitadoSelecao && 'opacity-40',
                )}
              >
                {selecionado ? <Check className="w-3 h-3" /> : null}
              </div>
            ) : null}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-start gap-1.5 min-w-0">
                <StatusLed displayStatus={displayStatus} fallbackStatus={pedido.status} className="mt-1.5 shrink-0" />
                <p className={cn(
                  EMBARQUE_TITLE,
                  displayStatus === 'Aprovado' && 'font-normal',
                  'flex-1 min-w-0',
                )}>{codigo}</p>
                {pedido.status === 'Rascunho' && !modoSelecao ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 shrink-0"
                    aria-label="Excluir rascunho"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>

              <p className={cn(
                EMBARQUE_SUBTITLE,
                'normal-case',
                displayStatus === 'Aprovado' && 'font-normal text-foreground/75',
              )}>
                {pedido._display_fornecedor || pedido.fornecedor_nome || '—'}
              </p>

              <div className="flex items-end justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-start gap-x-1.5 gap-y-1">
                  <div className="flex flex-col items-start gap-0.5 shrink-0">
                    <StatusPill displayStatus={displayStatus} fallbackStatus={pedido.status}>
                      {displayStatusLabel}
                    </StatusPill>
                    {displayStatus === 'Concluído' && pedido._display_data_recebimento ? (
                      <ComprasRecebimentoDateChip date={pedido._display_data_recebimento} />
                    ) : null}
                  </div>
                  <span className={cn(caixaTypo.meta, 'font-light normal-case text-foreground/80 inline-flex items-center gap-1 pt-0.5')}>
                    <Package2 className="w-3 h-3 flex-none text-foreground/70" />
                    <span>
                      {totalLinhas} {totalLinhas === 1 ? 'item' : 'itens'}
                      {qtdLabel ? ` · ${qtdLabel}` : ''}
                    </span>
                  </span>
                  {pedido._display_date ? (
                    <span className={cn(caixaTypo.meta, 'font-light normal-case text-foreground/75 tabular-nums')}>
                      {formatarDataCurta(pedido._display_date)}
                    </span>
                  ) : null}
                </div>
                <EmbarquesInfo pedido={pedido} />
              </div>
              <CaixaValorDisplay
                valor={valorExibido}
                tone="neutral"
                signed={false}
                size="sm"
                className="shrink-0"
              />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl dark:bg-background max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido <strong className="font-mono">{pedido.numero}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function GrupoDia({ label, groupDate, groupCarrier, pedidos, onEdit, onDelete, selecionadosIds, onToggleSelecao, modoSelecao, className = '', _total_eta = 0 }) {
  const [open, setOpen] = useState(true);
  const hasStructuredHeader = groupDate != null && groupCarrier != null;
  const headerTextClass = 'text-sm font-light text-foreground/85 leading-relaxed';
  const valorTotal = _total_eta > 0
    ? _total_eta
    : pedidos.reduce((acc, p) => {
        const valorPedido = p._display_valor ?? (p.status === 'Pendência'
          ? (p.valor_pendente_entrega ?? p.valor_total ?? 0)
          : (p.valor_total ?? 0));
        return acc + valorPedido;
      }, 0);

  return (
    <div className={cn('w-full min-w-0 max-w-full font-din-1451', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full min-w-0 text-left overflow-hidden flex items-start gap-2 py-2.5 touch-manipulation active:bg-muted/15',
          EMBARQUE_HIER.sep,
        )}
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          {hasStructuredHeader ? (
            <div className="space-y-0.5 min-w-0">
              <span className={cn(headerTextClass, 'block tabular-nums normal-case')}>
                {groupDate}
              </span>
              <span className={cn(EMBARQUE_SUBTITLE, 'block normal-case')}>
                {groupCarrier}
              </span>
            </div>
          ) : (
            <span className={cn(headerTextClass, 'block truncate min-w-0 uppercase tracking-wide')}>
              {label}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <CaixaValorDisplay
            valor={valorTotal}
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
        <div className={cn(EMBARQUE_HIER.l1, 'space-y-0')}>
          {pedidos.map((p, index) => (
            <EmbarqueListaCard
              key={p._virtual_key || p.id}
              pedido={p}
              onEdit={onEdit}
              onDelete={onDelete}
              modoSelecao={modoSelecao}
              selecionado={selecionadosIds.includes(p.id)}
              desabilitadoSelecao={!pedidoSelecionavelEnvioFinanceiroLote(p)}
              onToggleSelecao={onToggleSelecao}
              isLast={index === pedidos.length - 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ListaPedidosCompra({ grupos, loading, onEdit, onDelete, selecionadosIds = [], onToggleSelecao, modoSelecao = false }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className={cn('h-14 bg-secondary/20 animate-pulse', COMPRAS_SEP)} />)}
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className={cn('py-16 flex flex-col items-center gap-2', COMPRAS_SEP)}>
        <Package2 className="w-9 h-9 text-muted-foreground dark:text-foreground/90" />
        <p className="text-sm text-foreground/85 font-light">Nenhum embarque encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 font-din-1451">
      {grupos.map(({ key, label, groupDate, groupCarrier, pedidos, _total_eta }, index) => {
        const previousLabel = grupos[index - 1]?.label || '';
        const isSpecialTransition = (
          (previousLabel.includes('Sem transportador') && label.includes('Sem ETA')) ||
          (previousLabel.includes('Sem ETA') && label.includes('Sem transportador'))
        );

        return (
          <GrupoDia
            key={key}
            label={label}
            groupDate={groupDate}
            groupCarrier={groupCarrier}
            pedidos={pedidos}
            onEdit={onEdit}
            onDelete={onDelete}
            selecionadosIds={selecionadosIds}
            onToggleSelecao={onToggleSelecao}
            modoSelecao={modoSelecao}
            className={index > 0 ? (isSpecialTransition ? 'pt-3' : 'pt-2') : ''}
            _total_eta={_total_eta}
          />
        );
      })}
    </div>
  );
}
