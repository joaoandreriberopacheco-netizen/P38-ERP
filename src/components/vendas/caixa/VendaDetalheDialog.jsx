import React from 'react';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatarDataHora } from '@/components/utils/dateUtils';
import { caixaClasses } from '@/lib/caixaP38Theme';
import FormaPagamentoBadges from '@/components/vendas/FormaPagamentoBadges';

export default function VendaDetalheDialog({ venda, onClose, formatValor }) {
  if (!venda) return null;
  return (
    <Dialog open={!!venda} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <CaixaDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-background dark:text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">
            Detalhes da Venda - {venda.numero}
          </DialogTitle>
          <FormaPagamentoBadges pagamentos={venda.pagamentos} className="pt-1" />
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium text-foreground">{venda.cliente_nome}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vendedor:</span>
              <p className="font-medium text-foreground">{venda.vendedor_nome}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Horário:</span>
              <p className="font-medium text-foreground">
                {formatarDataHora(venda.created_date)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Pagamento:</span>
              {venda.pagamentos?.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {venda.pagamentos.map((p, idx) => (
                    <p key={idx} className="font-medium text-foreground text-sm">
                      {p.forma_pagamento} — {formatValor(p.valor)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="font-medium text-muted-foreground">—</p>
              )}
            </div>
          </div>
          <div className="border-t border-border/40 pt-4">
            <h4 className="font-semibold text-foreground mb-3">Itens da Venda</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venda.itens?.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.produto_nome}</TableCell>
                    <TableCell className="text-right">{item.quantidade}</TableCell>
                    <TableCell className="text-right">{formatValor(item.preco_unitario_praticado)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatValor(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-border/40 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-foreground">{formatValor(venda.subtotal)}</span>
            </div>
            {venda.valor_desconto > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Desconto:</span>
                <span className={`font-medium ${caixaClasses('danger').text}`}>-{formatValor(venda.valor_desconto)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/40">
              <span className="text-foreground">Total:</span>
              <span className={caixaClasses('success').text}>{formatValor(venda.valor_total)}</span>
            </div>
          </div>
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}