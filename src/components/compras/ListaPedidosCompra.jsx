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
} from '@/components/ui/alert-dialog';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { cn } from '@/components/utils';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { p38Table } from '@/lib/p38TableSurfaces';
import { caixaTypo } from '@/lib/caixaP38Theme';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import { COMPRAS_STATUS_STYLE } from '@/lib/comprasEmbarquesPalette';

const R = (v) => {
  const n = v || 0;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function formatCardQuantity(value, unitSuffix) {
  if (!unitSuffix || unitSuffix === 'un.') return formatQuantity(value);
  return formatCommercialQuantity(value, unitSuffix);
}

function pedidoSelecionavelEnvioFinanceiroLote(pedido = {}) {
  if (pedido.status !== 'Rascunho') return false;
  const saf = String(pedido.status_aprovacao_financeira || '');
  if (!saf || saf === 'Pendente') return true;
  return saf === 'Rejeitado' || saf === 'Rejeitado Financeiramente';
}

const STATUS_CONFIG = {
  Rascunho: { dot: 'bg-slate-500 dark:bg-slate-500/60', pill: 'bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-400' },
  Aguardando: COMPRAS_STATUS_STYLE.aguardando,
  'Aguardando Aprovação Financeira': COMPRAS_STATUS_STYLE.aguardando,
  'Aguardando Liberação Financeira': COMPRAS_STATUS_STYLE.aguardando,
  'Aguardando Liberação': COMPRAS_STATUS_STYLE.aguardando,
  Aprovado: { dot: 'bg-lime-600 dark:bg-[#a4ce33]/70', pill: 'bg-lime-50 dark:bg-lime-900/25 text-lime-700 dark:text-[#a4ce33]/85' },
  Despachado: COMPRAS_STATUS_STYLE.despachado,
  Concluído: { dot: 'bg-emerald-600 dark:bg-emerald-600/70', pill: 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-500' },
  Cancelado: { dot: 'bg-rose-600 dark:bg-rose-600/70', pill: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-500' },
};

function resolveStatusConfig(displayStatus, fallbackStatus) {
  return STATUS_CONFIG[displayStatus] || STATUS_CONFIG[fallbackStatus] || STATUS_CONFIG.Rascunho;
}

function getDisplayStatusLabel(displayStatus) {
  if (displayStatus === 'Aguardando Liberação Financeira' || displayStatus === 'Aguardando Aprovação Financeira') {
    return 'Aguard. Pgto';
  }
  return displayStatus;
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
    <span className={`inline-flex max-w-full text-sm px-2 py-0.5 rounded-full font-medium leading-normal whitespace-nowrap truncate ${cfg.pill} ${className}`}>
      {children}
    </span>
  );
}

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
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-sm leading-normal text-foreground/85 font-light">
      <span className="flex items-center gap-1.5 min-w-0">
        <CalendarClock className="w-3.5 h-3.5 flex-none text-foreground/70" />
        <span className="truncate">{embarque?.eta ? formatarDataCurta(embarque.eta) : 'Sem previsão'}</span>
      </span>
      <span className="text-foreground/75 tabular-nums shrink-0">
        {pedido._display_ordinal || '#01'}
      </span>
      {pedido._is_necessidade && (pedido._quantidade_pendente ?? 0) > 0 && (
        <span className="text-red-500 dark:text-red-400 font-medium truncate">
          {formatQuantity(pedido._quantidade_pendente)} {sufixoUnidade} faltando embarcar
        </span>
      )}
    </div>
  );
}

function pedidoAccentFromStatus(displayStatus) {
  if (displayStatus === 'Concluído' || displayStatus === 'Aprovado') return 'success';
  if (displayStatus === 'Despachado') return 'info';
  if (displayStatus === 'Aguardando' || String(displayStatus).includes('Aguard') || String(displayStatus).includes('Aprovação')) return 'warning';
  if (displayStatus === 'Cancelado') return 'danger';
  return 'muted';
}

function pedidoAccentBorderClass(displayStatus) {
  const tone = pedidoAccentFromStatus(displayStatus);
  return p38Accent[tone]?.border || p38Accent.muted.border;
}

function pedidoValorTone(displayStatus) {
  const accent = pedidoAccentFromStatus(displayStatus);
  if (accent === 'success') return 'success';
  if (accent === 'info') return 'info';
  if (accent === 'warning') return 'warning';
  if (accent === 'danger') return 'danger';
  return 'neutral';
}

function getEmbarqueCardMetrics(pedido) {
  const itensDisplay = pedido._display_itens || (pedido.status === 'Pendência'
    ? (pedido.itens || []).filter((i) => ((Number(i.quantidade) || 0) - (Number(i.quantidade_vinculada) || 0)) > 0)
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

  const qtdLabel = pedido._is_necessidade
    ? (totalQtd > 0 ? `${formatCardQuantity(totalQtd, sufixoUnidade)} ${sufixoUnidade} pend.` : '')
    : totalQtdEmbarcada > 0
      ? `${formatCardQuantity(totalQtdEmbarcada, sufixoUnidade)} / ${formatCardQuantity(totalQtdPedidaCard, sufixoUnidade)} ${sufixoUnidade}`
      : (totalQtd > 0 ? `${formatCardQuantity(totalQtd, sufixoUnidade)} ${sufixoUnidade}` : '');

  return { totalLinhas, valorExibido, codigo, qtdLabel };
}

/** Card unificado — design consulta + barra lateral de status + recuo no agrupador. */
function EmbarqueListaCard({ pedido, onEdit, onDelete, selecionado, desabilitadoSelecao, onToggleSelecao, modoSelecao }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const displayStatus = pedido._display_status || pedido.status;
  const displayStatusLabel = getDisplayStatusLabel(displayStatus);
  const { totalLinhas, valorExibido, codigo, qtdLabel } = getEmbarqueCardMetrics(pedido);

  const handleOpen = () => {
    if (modoSelecao) {
      if (!desabilitadoSelecao) onToggleSelecao?.(pedido);
      return;
    }
    onEdit(pedido);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.PedidoCompra.delete(pedido.id);
    setDeleting(false);
    setShowConfirm(false);
    onDelete();
  };

  return (
    <>
      <div
        className={cn(
          'group relative w-full min-w-0 max-w-full bg-card rounded-2xl shadow-sm overflow-hidden font-din-1451 border-l',
          pedidoAccentBorderClass(displayStatus),
          modoSelecao && selecionado && 'ring-1 ring-emerald-500/35',
        )}
      >
        <button
          type="button"
          onClick={handleOpen}
          className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 py-3 sm:px-4 text-left hover:bg-muted/30 transition-colors min-w-0"
        >
          <div className="min-w-0 overflow-hidden flex items-start gap-2">
            {modoSelecao && (
              <div className={`mt-1 flex-none w-5 h-5 rounded-md flex items-center justify-center ${selecionado ? 'bg-emerald-500 text-white' : 'bg-muted'} ${desabilitadoSelecao ? 'opacity-40' : ''}`}>
                {selecionado && <Check className="w-3 h-3" />}
              </div>
            )}
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className={cn(p38Table.mobileLineTitle, 'font-light inline-flex items-center gap-1.5 max-w-full min-w-0')}>
                <StatusLed displayStatus={displayStatus} fallbackStatus={pedido.status} className="w-1.5 h-1.5 mt-0 shrink-0" />
                <span className="truncate">{codigo}</span>
                {pedido._is_necessidade ? (
                  <span className="text-muted-foreground font-light normal-case text-sm shrink-0"> · falta vir</span>
                ) : null}
              </p>
              <p className={cn(p38Table.mobileLineSubtitle, 'truncate font-light mt-0.5')}>
                {pedido._display_fornecedor || pedido.fornecedor_nome || '—'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                <StatusPill displayStatus={displayStatus} fallbackStatus={pedido.status}>
                  {displayStatusLabel}
                </StatusPill>
                <span className={cn(caixaTypo.meta, 'font-light normal-case truncate')}>
                  {totalLinhas} {totalLinhas === 1 ? 'item' : 'itens'}
                  {qtdLabel ? ` · ${qtdLabel}` : ''}
                </span>
              </div>
              <div className="mt-1">
                <EmbarquesInfo pedido={pedido} />
              </div>
            </div>
          </div>
          <div className="shrink-0 pt-0.5 max-w-[42%] overflow-hidden text-right">
            <CaixaValorDisplay valor={valorExibido} tone={pedidoValorTone(displayStatus)} size="sm" />
            {pedido._display_date ? (
              <p className={cn(caixaTypo.meta, 'mt-1 font-light normal-case truncate')}>
                {formatarDataCurta(pedido._display_date)}
              </p>
            ) : null}
          </div>
        </button>

        {pedido.status === 'Rascunho' && !modoSelecao && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Excluir rascunho"
            aria-label="Excluir rascunho"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-2xl border border-border/40 dark:bg-background max-w-sm">
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
  const headerTextClass = 'text-sm sm:text-base font-light text-foreground/85 leading-relaxed';
  const valorTotal = _total_eta > 0
    ? _total_eta
    : pedidos.reduce((acc, p) => {
        const valorPedido = p._display_valor ?? (p.status === 'Pendência'
          ? (p.valor_pendente_entrega ?? p.valor_total ?? 0)
          : (p.valor_total ?? 0));
        return acc + valorPedido;
      }, 0);

  return (
    <div className={cn('w-full min-w-0 max-w-full space-y-2 font-din-1451', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-w-0 max-w-full flex items-center gap-2 sm:gap-3 border-b border-border/50 dark:border-white/10 py-2.5 pr-1 text-left group overflow-hidden"
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          {hasStructuredHeader ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-x-3 min-w-0">
              <span className={cn(headerTextClass, 'shrink-0 tabular-nums whitespace-nowrap')}>{groupDate}</span>
              <span className={cn(headerTextClass, 'truncate min-w-0')}>{groupCarrier}</span>
            </div>
          ) : (
            <span className={cn(headerTextClass, 'block truncate min-w-0 uppercase tracking-wide')}>{label}</span>
          )}
        </div>
        <span className={cn(headerTextClass, 'shrink-0 whitespace-nowrap tabular-nums max-w-[38%] truncate')}>{R(valorTotal)}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-foreground/70 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="ml-1 sm:ml-2.5 pl-2 sm:pl-3 border-l border-border/30 dark:border-white/10 space-y-2.5 sm:space-y-3 min-w-0 max-w-full overflow-hidden">
          {pedidos.map((p) => (
            <EmbarqueListaCard
              key={p._virtual_key || p.id}
              pedido={p}
              onEdit={onEdit}
              onDelete={onDelete}
              modoSelecao={modoSelecao}
              selecionado={selecionadosIds.includes(p.id)}
              desabilitadoSelecao={!pedidoSelecionavelEnvioFinanceiroLote(p)}
              onToggleSelecao={onToggleSelecao}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListaPedidosCompra({ grupos, loading, onEdit, onDelete, selecionadosIds = [], onToggleSelecao, modoSelecao = false }) {
  if (loading) {
    return (
      <div className="space-y-2 min-w-0 max-w-full">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm py-16 flex flex-col items-center gap-2">
        <Package2 className="w-9 h-9 text-muted-foreground dark:text-foreground/90" />
        <p className="text-sm text-foreground/85">Nenhum embarque encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0 max-w-full overflow-hidden font-din-1451">
      {grupos.map(({ key, label, groupDate, groupCarrier, pedidos, _total_eta }, index) => {
        const previousLabel = grupos[index - 1]?.label || '';
        const isSpecialTransition = (
          (previousLabel.includes('Sem transportador') && label.includes('Sem ETA'))
          || (previousLabel.includes('Sem ETA') && label.includes('Sem transportador'))
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
