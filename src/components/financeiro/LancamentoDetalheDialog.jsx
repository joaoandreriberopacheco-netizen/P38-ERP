import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatarSoData } from '@/components/utils/dateUtils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Clock,
  X,
  Pencil,
  RotateCcw,
  AlertCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import CancelarLancamentoDialog from './CancelarLancamentoDialog';
import { useToast } from '@/components/ui/use-toast';
import AnexosPanel from '@/components/anexos/AnexosPanel';
import { tagsVisiveisFinanceiro } from './fluxo/FinanceiroLancRow';
import { P38StatusLabel } from '@/components/ui/p38-mobile-line';
import { isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';
import { resolverDataLancamentoInput } from '@/lib/lancamentoOrdemMeta';
import { datetimeLocalParaISO } from '@/components/utils/dateUtils';
import { EXIBIR_UI_CONCILIACAO_FINANCEIRO } from '@/lib/financeiroConciliacaoUiFlags';

const R = (v) => `R$ ${Math.abs(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const mesAnoLabel = (dataStr) => {
  if (!dataStr) return '';
  const s = String(dataStr).slice(0, 10);
  const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const [y, m] = s.split('-');
  if (!y || !m) return '';
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
};

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

function statusTone(status) {
  if (status === 'Pago') return 'success';
  if (status === 'Vencido') return 'danger';
  if (status === 'Cancelado') return 'muted';
  return 'warning';
}

export default function LancamentoDetalheDialog({ lancamento, onClose, onEdit, onSaved }) {
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isCancelado = lancamento.status === 'Cancelado';
  const isReceita = lancamento.tipo === 'Receita';
  const isTransf = lancamento.tipo === 'Transferência';
  const isPago = isLancamentoPago(lancamento);
  const ehLancamentoEditavel = !isTransf && !isCancelado;
  const isPendente = lancamento.status_conciliacao === 'Pendente';
  const tagsVisiveis = tagsVisiveisFinanceiro(lancamento.tags);
  const dataOrdem = resolverDataLancamentoInput(lancamento);
  const dataOrdemFmt = dataOrdem
    ? formatarSoData(datetimeLocalParaISO(dataOrdem) || dataOrdem)
    : 'Automática';

  const obsLimpa = (lancamento.observacoes || '').replace(/\[CANCELADO.*?\]/gs, '').trim();

  let Icon = ArrowRightLeft;
  let iconClass = 'text-muted-foreground';
  if (!isTransf) {
    Icon = isReceita ? ArrowDownLeft : ArrowUpRight;
    iconClass = isPago ? (isReceita ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground';
  }

  const handleRestaurar = async () => {
    setSaving(true);
    try {
      const statusAnterior =
        lancamento.referencia_tipo === 'MovimentosCaixa'
          ? 'Em Aberto'
          : lancamento.data_pagamento
            ? 'Pago'
            : 'Em Aberto';
      await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
        status: statusAnterior,
        observacoes: (lancamento.observacoes || '').replace(/\[CANCELADO.*?\]/gs, '').trim(),
      });
      toast({ title: 'Lançamento restaurado!', className: 'bg-muted text-foreground' });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="flex max-h-[min(92vh,40rem)] min-h-0 w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 dark:border-border/40 dark:bg-background sm:max-w-md [&~div[data-radix-dialog-overlay]]:bg-card/30 [&~div[data-radix-dialog-overlay]]:backdrop-blur-sm [&~div[data-radix-dialog-overlay]]:dark:bg-black/30">
          <div className="shrink-0 px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground leading-snug flex-1 pr-2 line-clamp-3">
                {lancamento.descricao}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {ehLancamentoEditavel && onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(lancamento)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="w-11 h-11 flex-none rounded-xl bg-muted flex items-center justify-center">
                <Icon className={`w-5 h-5 ${iconClass}`} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground tracking-tight">
                  {isTransf ? '' : isReceita ? '+' : '−'}
                  {R(lancamento.valor_liquido ?? lancamento.valor)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <P38StatusLabel tone={statusTone(isPago ? 'Pago' : lancamento.status)}>
                    {isPago ? 'Pago' : lancamento.status || 'Em Aberto'}
                  </P38StatusLabel>
                  {lancamento.is_recorrente && lancamento.data_vencimento && (
                    <span className="text-[0.65rem] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                      {mesAnoLabel(lancamento.data_vencimento)}
                    </span>
                  )}
                  {EXIBIR_UI_CONCILIACAO_FINANCEIRO && isPendente && isPago && (
                    <span className="flex items-center gap-1 text-[0.65rem] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5" /> Aguard. conciliação
                    </span>
                  )}
                </div>
              </div>
            </div>

            {tagsVisiveis.length > 0 && (
              <div className="mt-3 flex gap-1.5 flex-wrap">
                {tagsVisiveis.map((t) => (
                  <span key={t} className="text-[0.65rem] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
            <div className="rounded-xl bg-muted/40 px-4 py-1">
              <InfoRow label="Tipo" value={lancamento.tipo} />
              <InfoRow label="Categoria" value={lancamento.categoria || '—'} />
              <InfoRow label="Conta" value={lancamento.conta_financeira_nome} />
              <InfoRow
                label="Vencimento"
                value={lancamento.data_vencimento ? formatarSoData(lancamento.data_vencimento) : '—'}
              />
              {isPago && (
                <InfoRow
                  label="Pagamento"
                  value={lancamento.data_pagamento ? formatarSoData(lancamento.data_pagamento) : '—'}
                />
              )}
              <InfoRow label="Ordem na lista" value={dataOrdemFmt} />
              {lancamento.forma_pagamento_tipo && (
                <InfoRow label="Forma" value={lancamento.forma_pagamento_tipo} />
              )}
              {lancamento.referencia_numero && (
                <InfoRow label="Referência" value={lancamento.referencia_numero} />
              )}
              {obsLimpa && <InfoRow label="Observações" value={obsLimpa} />}
            </div>

            {isCancelado && (
              <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/40">
                <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Cancelado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Este lançamento não entra nos cálculos de saldo.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border/40 px-5 py-4 space-y-3">
            {isCancelado ? (
              <button
                type="button"
                onClick={handleRestaurar}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Restaurar lançamento
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCancelarDialog(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Cancelar lançamento
              </button>
            )}

            <div className="flex items-center justify-end gap-2 flex-wrap">
              {lancamento.pedido_compra_vinculado_id && (
                <AnexosPanel
                  referenciaId={lancamento.pedido_compra_vinculado_id}
                  referenciaTipo="PedidoCompra"
                  referenciaNumero={lancamento.pedido_compra_vinculado_numero}
                  inline
                />
              )}
              <AnexosPanel
                referenciaId={lancamento.id}
                referenciaTipo="LancamentoFinanceiro"
                referenciaNumero={lancamento.descricao}
                inline
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CancelarLancamentoDialog
        lancamento={lancamento}
        isOpen={showCancelarDialog}
        onClose={() => setShowCancelarDialog(false)}
        onSuccess={() => {
          setShowCancelarDialog(false);
          onSaved?.();
        }}
      />
    </>
  );
}
