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
import {
  P38MobileLine,
  P38MobileLineList,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';

const R = (v) => {
  const n = v || 0;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

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

const STATUS_CONFIG = {
  'Rascunho': { dot: 'bg-slate-500 dark:bg-slate-400', pill: 'bg-slate-100 dark:bg-slate-800/55 text-slate-700 dark:text-slate-300' },
  'Aguardando': { dot: 'bg-red-500 dark:bg-red-500', pill: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' },
  'Aguardando Aprovação Financeira': { dot: 'bg-amber-400 dark:bg-amber-400', pill: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  'Aguardando Liberação Financeira': { dot: 'bg-amber-400 dark:bg-amber-400', pill: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  'Aguardando Liberação': { dot: 'bg-amber-400 dark:bg-amber-400', pill: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  'Aprovado': { dot: 'bg-lime-400 dark:bg-lime-400', pill: 'bg-lime-50 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300' },
  'Despachado': { dot: 'bg-cyan-600 dark:bg-cyan-600/70', pill: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-500' },
  'Concluído': { dot: 'bg-emerald-500 dark:bg-emerald-500', pill: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  'Cancelado': { dot: 'bg-rose-400 dark:bg-rose-400', pill: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
};

function resolveStatusConfig(displayStatus, fallbackStatus) {
  return STATUS_CONFIG[displayStatus] || STATUS_CONFIG[fallbackStatus] || STATUS_CONFIG['Rascunho'];
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
      className={`flex-none w-2.5 h-2.5 rounded-full mt-0.5 ${blink ? 'animate-blink-led' : cfg.dot} ${className}`}
      aria-hidden
    />
  );
}

function StatusPill({ displayStatus, fallbackStatus, children, className = '' }) {
  const cfg = resolveStatusConfig(displayStatus, fallbackStatus);
  return (
    <span className={`inline-flex max-w-full text-sm px-2 py-0.5 rounded-full font-semibold leading-normal whitespace-nowrap truncate ${cfg.pill} ${className}`}>
      {children}
    </span>
  );
}

// Adiciona animação de piscar ao CSS global
if (typeof document !== 'undefined' && !document.getElementById('blink-animation')) {
  const style = document.createElement('style');
  style.id = 'blink-animation';
  style.innerHTML = `
    @keyframes blink-red-amber {
      0%, 100% { background-color: rgb(239, 68, 68); }
      50% { background-color: rgb(217, 119, 6); }
    }
    .animate-blink-led {
      animation: blink-red-amber 1s infinite;
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
    <div className="flex items-center gap-3 flex-wrap text-sm leading-normal text-foreground/85">
      <span className="flex items-center gap-1.5">
        <CalendarClock className="w-3.5 h-3.5 flex-none text-foreground/70" />
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

function pedidoAccentFromStatus(displayStatus) {
  if (displayStatus === 'Concluído' || displayStatus === 'Aprovado') return 'success';
  if (displayStatus === 'Despachado') return 'info';
  if (displayStatus === 'Aguardando' || String(displayStatus).includes('Aguard') || String(displayStatus).includes('Aprovação')) return 'warning';
  if (displayStatus === 'Cancelado') return 'danger';
  return 'muted';
}

function PedidoMobileLine({ pedido, onEdit, onDelete, selecionado, desabilitadoSelecao, onToggleSelecao, modoSelecao, striped }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const accent = pedidoAccentFromStatus(displayStatus);
  const codigo = String(pedido._display_code || pedido.numero || '').replace(' - ', '-').replace(/\s+/g, '');

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.PedidoCompra.delete(pedido.id);
    setDeleting(false);
    setShowConfirm(false);
    onDelete();
  };

  const qtdLabel = pedido._is_necessidade
    ? (totalQtd > 0 ? `${formatCardQuantity(totalQtd, sufixoUnidade)} ${sufixoUnidade} pend.` : '')
    : totalQtdEmbarcada > 0
      ? `${formatCardQuantity(totalQtdEmbarcada, sufixoUnidade)} / ${formatCardQuantity(totalQtdPedidaCard, sufixoUnidade)} ${sufixoUnidade}`
      : (totalQtd > 0 ? `${formatCardQuantity(totalQtd, sufixoUnidade)} ${sufixoUnidade}` : '');

  return (
    <>
      <P38MobileLine
        striped={striped}
        thinAccent
        accent={p38AccentKeyFromTone(accent)}
        onClick={() => {
          if (modoSelecao) { if (!desabilitadoSelecao) onToggleSelecao?.(pedido); return; }
          onEdit(pedido);
        }}
        title={
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <StatusLed displayStatus={displayStatus} fallbackStatus={pedido.status} className="w-1.5 h-1.5 mt-0" />
            <span className="truncate">{codigo}</span>
          </span>
        }
        subtitle={pedido._display_fornecedor || pedido.fornecedor_nome || '—'}
        meta={
          <>
            <StatusPill displayStatus={displayStatus} fallbackStatus={pedido.status}>{displayStatusLabel}</StatusPill>
            <span>{totalLinhas} {totalLinhas === 1 ? 'item' : 'itens'}{qtdLabel ? ` · ${qtdLabel}` : ''}</span>
            {pedido._display_date ? <span>{formatarDataCurta(pedido._display_date)}</span> : null}
          </>
        }
        value={R(valorExibido)}
        trailing={
          <div className="flex items-center gap-0.5 shrink-0">
            {modoSelecao && (
              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${selecionado ? 'bg-primary text-primary-foreground' : 'bg-muted'} ${desabilitadoSelecao ? 'opacity-40' : ''}`}>
                {selecionado && <Check className="w-3 h-3" />}
              </div>
            )}
            {pedido.status === 'Rascunho' && !modoSelecao && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
                className="h-8 w-8 tablet-landscape:h-11 tablet-landscape:w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500"
                aria-label="Excluir rascunho"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
      />
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

function PedidoCard({ pedido, onEdit, onDelete, selecionado, desabilitadoSelecao, onToggleSelecao, modoSelecao }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        role="button"
        tabIndex={0}
        onClick={() => {
          if (modoSelecao) { if (!desabilitadoSelecao) onToggleSelecao?.(pedido); return; }
          onEdit(pedido);
        }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!modoSelecao) onEdit(pedido); } }}
        className="group relative w-full min-w-0 box-border bg-muted rounded-2xl shadow-sm hover:shadow-md active:scale-[0.995] transition-all cursor-pointer overflow-hidden font-din-1451 tablet-landscape:min-h-[88px]"
      >
        {/* Seleção overlay */}
        {modoSelecao && selecionado && (
          <div className="absolute inset-0 bg-emerald-500/8 dark:bg-emerald-500/10 rounded-2xl pointer-events-none" />
        )}

        <div className="w-full min-w-0 px-2 py-1.5 tablet-landscape:px-4 tablet-landscape:py-3 overflow-hidden">
          {/* Linha principal */}
          <div className="flex w-full min-w-0 items-center justify-between gap-1.5 overflow-hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              {/* Checkbox modo seleção */}
              {modoSelecao && (
                <div className={`flex-none w-5 h-5 rounded-md flex items-center justify-center transition-colors ${selecionado ? 'bg-emerald-500 text-white' : 'bg-muted'} ${desabilitadoSelecao ? 'opacity-40' : ''}`}>
                  {selecionado && <Check className="w-3 h-3" />}
                </div>
              )}

              <StatusLed displayStatus={displayStatus} fallbackStatus={pedido.status} />

              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 items-start justify-between gap-2 overflow-hidden">
                  <div className="min-w-0 flex-1 overflow-hidden" style={{maxWidth: '55%'}}>
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm tablet-landscape:text-base font-semibold text-foreground leading-normal">
                      {String(pedido._display_code || pedido.numero || '').replace(' - ', '-').replace(/\s+/g, '')}
                    </span>
                    <p className="mt-0.5 text-sm tablet-landscape:text-base font-medium text-foreground/85 leading-normal truncate">
                      {pedido._display_fornecedor || pedido.fornecedor_nome || '—'}
                    </p>
                    <div className="mt-0.5">
                      <StatusPill displayStatus={displayStatus} fallbackStatus={pedido.status}>
                        {displayStatusLabel}
                      </StatusPill>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Valor + data */}
            <div className="flex-none text-right shrink-0 flex flex-col justify-center gap-0 pl-1">
              <p className="text-sm font-bold text-foreground leading-normal whitespace-nowrap overflow-hidden text-ellipsis tabular-nums">
                {R(valorExibido)}
              </p>
              <p className="text-sm text-foreground/80 leading-normal whitespace-nowrap">
                {pedido._display_date ? formatarDataCurta(pedido._display_date) : '—'}
              </p>
            </div>
          </div>

          {/* Linha de metadados */}
          <div className="mt-1.5 flex flex-col gap-1 text-sm leading-normal">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-foreground/85">
                <Package2 className="w-3.5 h-3.5 flex-none text-foreground/70" />
                <span>
                  {totalLinhas} {totalLinhas === 1 ? 'item' : 'itens'}
                  {pedido._is_necessidade
                    ? (totalQtd > 0 ? ` · ${formatCardQuantity(totalQtd, sufixoUnidade)} ${sufixoUnidade} pend.` : '')
                    : totalQtdEmbarcada > 0
                      ? ` · ${formatCardQuantity(totalQtdEmbarcada, sufixoUnidade)} de ${formatCardQuantity(totalQtdPedidaCard, sufixoUnidade)} ${sufixoUnidade}`
                      : (totalQtd > 0 ? ` · ${formatCardQuantity(totalQtd, sufixoUnidade)} ${sufixoUnidade}` : '')}
                </span>
              </span>

            </div>
            <EmbarquesInfo pedido={pedido} />
          </div>
        </div>

        {/* Botão delete hover (rascunho) */}
        {pedido.status === 'Rascunho' && !modoSelecao && (
          <button
            onClick={e => { e.stopPropagation(); setShowConfirm(true); }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="Excluir rascunho"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-2xl border-0 shadow-2xl dark:bg-background max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Excluir rascunho?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-muted-foreground">
              O pedido <strong className="font-mono tracking-[0.08em]">{pedido.numero}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-0 shadow-sm dark:bg-muted dark:text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function GrupoDia({ label, pedidos, onEdit, onDelete, selecionadosIds, onToggleSelecao, modoSelecao, className = '', _total_eta = 0 }) {
  const [open, setOpen] = useState(true);
  // Soma apenas _display_valor para cards virtuais (embarques + órfãos), ou usa _total_eta se disponível
  const valorTotal = _total_eta > 0
    ? _total_eta
    : pedidos.reduce((acc, p) => {
        const valorPedido = p._display_valor ?? (p.status === 'Pendência'
          ? (p.valor_pendente_entrega ?? p.valor_total ?? 0)
          : (p.valor_total ?? 0));
        return acc + valorPedido;
      }, 0);

  return (
    <div className={`w-full space-y-2 font-din-1451 ${className}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full min-w-0 flex items-center justify-between border-b border-border/50 dark:border-white/10 px-1 py-2 gap-2 group">
        <p className="text-sm tablet-landscape:text-base font-bold uppercase tracking-wide text-foreground/80 leading-normal truncate min-w-0 flex-1">
          {label}
        </p>
        <div className="flex items-center gap-1.5 flex-none shrink-0">
          <span className="text-sm font-bold text-foreground/80 leading-normal whitespace-nowrap tabular-nums">{R(valorTotal)}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-foreground/70 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
        </div>
      </button>
      {open && (
        <>
          <P38MobileLineList className="desktop-layout:hidden">
            {pedidos.map((p, index) => (
              <PedidoMobileLine
                key={p._virtual_key || p.id}
                pedido={p}
                striped={index % 2 === 1}
                onEdit={onEdit}
                onDelete={onDelete}
                modoSelecao={modoSelecao}
                selecionado={selecionadosIds.includes(p.id)}
                desabilitadoSelecao={!pedidoSelecionavelEnvioFinanceiroLote(p)}
                onToggleSelecao={onToggleSelecao}
              />
            ))}
          </P38MobileLineList>
          <div className="hidden desktop-layout:block space-y-2">
            {pedidos.map(p => (
              <PedidoCard
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
        </>
      )}
    </div>
  );
}

export default function ListaPedidosCompra({ grupos, loading, onEdit, onDelete, selecionadosIds = [], onToggleSelecao, modoSelecao = false }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-muted rounded-2xl animate-pulse" />)}
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
    <div className="space-y-3 font-din-1451">
      {grupos.map(({ key, label, pedidos, _total_eta }, index) => {
        const previousLabel = grupos[index - 1]?.label || '';
        const isSpecialTransition = (
          (previousLabel.includes('Sem transportador') && label.includes('Sem ETA')) ||
          (previousLabel.includes('Sem ETA') && label.includes('Sem transportador'))
        );

        return (
          <GrupoDia
            key={key}
            label={label}
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