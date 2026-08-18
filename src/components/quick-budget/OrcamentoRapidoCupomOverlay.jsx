import React from 'react';
import OrcamentoRapidoCupom from './OrcamentoRapidoCupom';
import { QUICK_ACCESS_NESTED_DIALOG_CLASS } from '@/lib/quickAccessOverlay';

/**
 * Pré-visualização / impressão cupom 80mm ou A4 (orçamento rápido).
 */
export default function OrcamentoRapidoCupomOverlay({
  open,
  cupomProps,
  formato = '80mm',
  nomeTabela = '',
  empresa = null,
  onClose,
}) {
  if (!open || !cupomProps?.itens?.length) return null;

  return (
    <div className={`fixed inset-0 ${QUICK_ACCESS_NESTED_DIALOG_CLASS}`}>
      <OrcamentoRapidoCupom
        itens={cupomProps.itens}
        total={cupomProps.total}
        desconto={cupomProps.desconto}
        subtotal={cupomProps.subtotal}
        observacoes={cupomProps.observacoes}
        numero={cupomProps.numero || ''}
        formato={formato}
        nomeTabela={nomeTabela}
        clienteNome={cupomProps.clienteNome}
        empresa={empresa}
        onVoltar={onClose}
      />
    </div>
  );
}
