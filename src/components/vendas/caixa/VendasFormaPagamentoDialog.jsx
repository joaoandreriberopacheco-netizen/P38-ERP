import React, { useMemo } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { ArrowLeft } from 'lucide-react';
import ConsultaVendasCaixa from '@/components/vendas/caixa/ConsultaVendasCaixa';
import {
  FORMA_CAIXA_LABELS,
  filtrarVendasPorFormaPagamentoCaixa,
  totalFormaPagamentoNasVendas,
} from '@/lib/formasPagamentoCaixa';

export default function VendasFormaPagamentoDialog({
  open,
  onOpenChange,
  formaPagamentoKey,
  vendasFinalizadas = [],
  metaPorPedidoId = {},
  onVerDetalhes,
}) {
  const label = FORMA_CAIXA_LABELS[formaPagamentoKey] || 'Forma de pagamento';

  const vendasFiltradas = useMemo(
    () => filtrarVendasPorFormaPagamentoCaixa(vendasFinalizadas, formaPagamentoKey),
    [vendasFinalizadas, formaPagamentoKey],
  );

  const totalForma = useMemo(
    () => totalFormaPagamentoNasVendas(vendasFinalizadas, formaPagamentoKey),
    [vendasFinalizadas, formaPagamentoKey],
  );

  if (!formaPagamentoKey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CaixaDialogContent className="max-w-full w-full h-full m-0 p-0 rounded-none bg-background flex flex-col">
        <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center flex-shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-6 h-6 text-foreground/90" />
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">
            Vendas — {label}
          </h2>
          <div className="w-11" aria-hidden />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <ConsultaVendasCaixa
            vendasFinalizadas={vendasFiltradas}
            metaPorPedidoId={metaPorPedidoId}
            onVerDetalhes={onVerDetalhes}
            contextLabel={`Recebimentos em ${label}`}
            emptyMessage={`Nenhuma venda com ${label} no turno`}
            formaPagamentoKey={formaPagamentoKey}
            formaPagamentoLabel={label}
            totalFormaPagamento={totalForma}
            forcarModoComprovante
          />
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}
