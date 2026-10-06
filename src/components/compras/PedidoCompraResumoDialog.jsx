import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Receipt, Truck, FileText, User, CalendarDays, Package } from 'lucide-react';
import { normalizeItemCompraParaExibicao } from '@/lib/productUnits';
import {
  PedidoCompraItensListaShell,
  PedidoCompraItemLinhaResumo,
} from '@/components/compras/PedidoCompraItensListaP38';

const formatCurrency = (value) => `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
};
const formatNumber = (value) => (Number(value || 0)).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function normalizarItemResumo(item) {
  const norm = normalizeItemCompraParaExibicao(item, item?._produto || null);
  const total = Number(item?.total ?? norm.valor_total_item ?? 0) || 0;
  const q = Number(norm.quantidade ?? 0) || 0;
  const unit = q > 0 ? total / q : Number(item?.custo_unitario ?? norm.valor_unitario_compra ?? 0) || 0;
  return {
    ...norm,
    custo_unitario: unit,
    total,
  };
}

export default function PedidoCompraResumoDialog({ open, onOpenChange, pedido }) {
  if (!pedido) return null;

  const itens = pedido.itens || [];
  const criadoPorNome = pedido.created_by_nickname || pedido.created_by_nome || pedido.responsavel_nome || pedido.created_by || '—';
  const subtotal = itens.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  const total = Number(pedido.valor_total) || 0;
  const diferenca = total - subtotal;
  const desconto = diferenca < 0 ? Math.abs(diferenca) : 0;
  const acrescimo = diferenca > 0 ? diferenca : 0;
  const formaPagamento = pedido.forma_pagamento || pedido.condicao_pagamento || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] max-h-[88vh] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-card">
        <DialogHeader className="px-5 py-4 border-b border-border/40">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground font-glacial flex items-center gap-2">
                <Receipt className="w-5 h-5 text-muted-foreground" />
                {pedido.numero || 'Pedido de Compra'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {pedido.fornecedor_nome || 'Fornecedor não informado'}
              </p>
            </div>
            <Badge className="bg-muted text-foreground/90 dark:bg-muted dark:text-foreground border-0 shadow-sm">
              {pedido.status || '—'}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(88vh-76px)]">
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Cabeçalho</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Fornecedor</span><span className="text-right text-foreground dark:text-foreground">{pedido.fornecedor_nome || '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Emissão</span><span className="text-right text-foreground dark:text-foreground">{formatDate(pedido.data_emissao || pedido.created_date)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Prazo de entrega</span><span className="text-right text-foreground dark:text-foreground">{formatDate(pedido.data_prevista_entrega)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Forma de pagamento</span><span className="text-right text-foreground dark:text-foreground">{formaPagamento}</span></div>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Log</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Criado por</span><span className="text-right text-foreground dark:text-foreground break-all">{criadoPorNome}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Criado em</span><span className="text-right text-foreground dark:text-foreground">{formatDate(pedido.created_date)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Atualizado em</span><span className="text-right text-foreground dark:text-foreground">{formatDate(pedido.updated_date)}</span></div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Itens</h3>
              </div>
              {itens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item informado</p>
              ) : (
                <PedidoCompraItensListaShell>
                  {itens.map((rawItem, index) => {
                    const item = normalizarItemResumo(rawItem);
                    return (
                      <PedidoCompraItemLinhaResumo
                        key={`${item.produto_id || item.produto_nome || 'item'}-${index}`}
                        striped={index % 2 === 1}
                        nome={item.produto_nome || 'Item'}
                        detalhe={`${formatNumber(item.quantidade)} ${item.unidade_medida || 'UN'} × ${formatCurrency(item.custo_unitario || 0)}`}
                        totalFormatado={formatCurrency(item.total || 0)}
                      />
                    );
                  })}
                </PedidoCompraItensListaShell>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Totais</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground dark:text-foreground">{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Descontos</span><span className="text-red-600 dark:text-red-400">{formatCurrency(desconto)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Acréscimos</span><span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(acrescimo)}</span></div>
                  <div className="pt-2 mt-2 border-t border-border/40 flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-lg text-foreground font-glacial">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Observações</h3>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {pedido.observacoes || 'Sem observações.'}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}